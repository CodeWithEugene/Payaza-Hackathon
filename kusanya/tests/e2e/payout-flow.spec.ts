import { test, expect, type Page } from "@playwright/test";

/**
 * Payout half of the money spine (demo climax — "Imefika!"):
 * reset → SENT invoice → collection replay → settlement replay → SETTLED →
 * PayoutDialog → Initiate (creates an awaiting payout; money must NOT move)
 * → WRONG code rejected (gate is real) → demo code 123456 → Payaza transfer
 * executes (invoice → Paying out) → demo settlement webhook fires through
 * the same completion path → "Imefika! Completed".
 *
 * Regression guard: initiation used to move money BEFORE the confirmation
 * code was checked (gate was cosmetic). Steps 4–5 pin the fixed ordering.
 */

const DEMO_EMAIL = "wanjiru@kusanya.demo";
const DEMO_PASSWORD = "kusanya-demo-2026";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#login-email").fill(DEMO_EMAIL);
  await page.locator("#login-password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app/, { timeout: 20_000 });
}

test("demo: settled invoice pays out through the confirmation gate → Imefika!", async ({ page }) => {
  test.setTimeout(180_000);

  // 1. Known seed (reset wipes the session → log in again afterwards).
  await page.goto("/login");
  let resp = await page.request.post("/api/demo/reset");
  if (!resp.ok()) {
    await login(page);
    resp = await page.request.post("/api/demo/reset");
  }
  expect(resp.ok()).toBeTruthy();
  const { invoiceIds } = (await resp.json()) as { invoiceIds: Record<string, string> };
  const sentId = invoiceIds.sent;
  const sentRef = invoiceIds.sentTxnRef;
  await login(page);

  // 2. Drive the invoice to SETTLED through the real webhook pipeline.
  const h = { "Content-Type": "application/json" } as const;
  const momo = await page.request.post("/api/demo/replay", {
    headers: h,
    data: { event: "momo.success", reference: sentRef },
  });
  expect(momo.ok()).toBeTruthy();
  const settle = await page.request.post("/api/demo/replay", {
    headers: h,
    data: { event: "settlement.complete", reference: sentId },
  });
  expect(settle.ok()).toBeTruthy();

  // 3. Open the settled invoice — payout unlocked.
  await page.goto(`/app/invoices/${sentId}`);
  const statusBadge = page
    .locator('[data-slot="badge"]')
    .filter({ hasText: /^(Settled|Paying out|Imefika! Completed)$/ })
    .first();
  await expect(statusBadge).toHaveText("Settled", { timeout: 15_000 });

  // 4. Open the payout dialog and initiate. The dialog shows the net of the
  //    waterfall; initiating must NOT move money — the badge stays Settled.
  await page.getByRole("button", { name: /Pay out to M-Pesa/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Confirm payout")).toBeVisible();
  await expect(dialog.getByText("You'll receive", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: /Initiate payout/i }).click();
  await expect(dialog.getByText("Confirmation code")).toBeVisible({ timeout: 15_000 });
  await expect(statusBadge).toHaveText("Settled"); // money has NOT moved yet

  // 5. Wrong code → rejected, dialog stays open, still Settled. The gate is real.
  await dialog.locator("#payout-code").fill("000000");
  await dialog.getByRole("button", { name: /Confirm & send money/i }).click();
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: /Wrong confirmation code/i }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText("Confirmation code")).toBeVisible();
  await expect(statusBadge).toHaveText("Settled");

  // 6. Correct demo code → the transfer executes now (and only now).
  await dialog.locator("#payout-code").fill("123456");
  await dialog.getByRole("button", { name: /Confirm & send money/i }).click();
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: /Payout sent/i }),
  ).toBeVisible({ timeout: 20_000 });

  // 7. Invoice → Paying out (dialog closed + router.refresh), then the demo
  //    settlement webhook lands ~1.5s later through the same completion path.
  await expect(statusBadge).toHaveText(/^(Paying out|Imefika! Completed)$/, { timeout: 20_000 });
  await expect
    .poll(
      async () => {
        await page.reload();
        return statusBadge.textContent();
      },
      { timeout: 30_000, intervals: [1_000, 2_000, 2_000] },
    )
    .toBe("Imefika! Completed");

  // 8. The timeline tells the arrival story with the masked account.
  await expect(page.getByText(/Imefika! KES landed in/i)).toBeVisible();
});
