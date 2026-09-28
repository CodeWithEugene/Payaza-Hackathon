import { test, expect, type Page } from "@playwright/test";

/**
 * The judge's first move: paste a WhatsApp message → Jev extraction → review
 * the confidence-banded fields → Create invoice (risk screen + send). This is
 * the only runtime coverage of createInvoiceAction + finalizeInvoice (demo
 * payment-link fixture) — the extraction API itself is covered by the unit
 * suite and this flow's assertions pin the UI wiring end to end.
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

test("demo: WhatsApp paste → Jev extraction → reviewed invoice created & sent", async ({ page }) => {
  test.setTimeout(180_000);

  // Known seed (reset wipes the session → log in again afterwards).
  await page.goto("/login");
  let resp = await page.request.post("/api/demo/reset");
  if (!resp.ok()) {
    await login(page);
    resp = await page.request.post("/api/demo/reset");
  }
  expect(resp.ok()).toBeTruthy();
  await login(page);

  // 1. Open the wizard (AI tab is default) and fill the sample message.
  await page.goto("/app/invoices/new");
  await page.getByRole("button", { name: /Fill sample message/i }).click();
  await expect(page.locator("textarea")).toContainText(/French beans/i);

  // 2. Extract with Jev — deterministic demo-rules engine, honest labeling.
  const extractResp = page.waitForResponse(
    (r) => r.url().includes("/api/invoices/extract") && r.status() === 200,
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /Extract with Jev AI/i }).click();
  await extractResp;

  // 3. Review step: buyer surfaced (directory match → Select text, or
  //    pre-filled new-buyer form → input value; the contract allows either),
  //    USD total, honest demo-rules labeling.
  await expect(page.getByRole("button", { name: /Create invoice/i })).toBeVisible({ timeout: 15_000 });
  const buyerNameInput = page.locator("#buyer-name");
  if (await buyerNameInput.count()) {
    await expect(buyerNameInput).toHaveValue(/Dubai Fresh FZE/i);
  } else {
    await expect(page.getByText(/Dubai Fresh FZE/i).first()).toBeVisible();
  }
  await expect(page.getByText("Total (USD)")).toBeVisible();
  // Honest engine label: demo-rules without TYPESAFE_API_KEY, live Jev with it.
  await expect(page.getByText(/^(Demo rules|Jev AI)$/i).first()).toBeVisible();
  // Send-immediately is on by default; risk screen runs inside the action.
  await expect(page.locator("#send-now")).toBeVisible();

  // 4. Create — the action screens (fail-closed) and, on pass + sendNow,
  //    finalizes via the demo payment-link fixture, then redirects.
  await page.getByRole("button", { name: /Create invoice/i }).click();
  await page.waitForURL(/\/app\/invoices\/inv_/, { timeout: 30_000 });

  // 5. The new invoice detail page renders, screened and sent.
  await expect(page.getByRole("heading", { name: /^KSN-2026-\d{4}$/ })).toBeVisible({ timeout: 15_000 });
  const statusBadge = page
    .locator('[data-slot="badge"]')
    .filter({ hasText: /^(Sent|Ready to send|Needs review|On hold)$/ })
    .first();
  await expect(statusBadge).toHaveText("Sent");
  await expect(page.getByText(/Dubai Fresh FZE/).first()).toBeVisible();
});
