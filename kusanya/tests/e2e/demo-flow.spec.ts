import { test, expect, type Page } from "@playwright/test";

/**
 * Money-path smoke E2E (the single most important flow): demo reset → login →
 * open the SENT invoice → replay a successful M-Pesa webhook through the
 * merchant Demo controls → the invoice flips to "Paid" via the SAME pipeline
 * as a live Payaza webhook (single completion path), surfaced by router.refresh().
 *
 * Note on reset: /api/demo/reset wipes + reseeds the demo business, which
 * deletes the signed-in user — so the session must be (re)established AFTER
 * the reset. The flow below logs in, resets, then logs in again on the fresh
 * seed before driving the UI.
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

test("demo: reset → login → SENT invoice pays via webhook replay", async ({ page }) => {
  test.setTimeout(120_000);

  // 1. Establish a session, then reset to a known seed. (Reset may also be
  //    callable unauthenticated on an empty DB, but logging in first works in
  //    both cases.) The reset response carries the fresh invoice ids.
  await page.goto("/login");
  let resp = await page.request.post("/api/demo/reset");
  if (!resp.ok()) {
    await login(page);
    resp = await page.request.post("/api/demo/reset");
  }
  expect(resp.ok(), "demo reset should succeed").toBeTruthy();
  const { invoiceIds } = (await resp.json()) as { invoiceIds: Record<string, string> };
  const sentId = invoiceIds.sent;
  expect(sentId, "reset returns the SENT invoice id").toBeTruthy();

  // 2. Reset wiped the session → log in again against the fresh seed.
  await login(page);
  await expect(page.getByText(/FreshLeaf Exports/i).first()).toBeVisible({ timeout: 15_000 });

  // 3. Open the SENT invoice (KES 48,500 to Mama Njeri, momo prompt pending).
  await page.goto(`/app/invoices/${sentId}`);
  await expect(page.getByRole("heading", { name: "KSN-2026-0003" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Mama Njeri/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /M-Pesa payment succeeds/i })).toBeVisible();

  // The invoice status badge starts at "Sent" (isolated via data-slot so we
  // don't match the transaction-status badges or reminder text).
  const statusBadge = page.locator('[data-slot="badge"]').filter({ hasText: /^(Sent|Paid)$/ }).first();
  await expect(statusBadge).toHaveText("Sent");

  // 4. Replay a successful M-Pesa webhook via Demo controls. Wait for the
  //    deterministic API round-trip (skill pattern: waitForResponse, not
  //    arbitrary sleeps), then let router.refresh() re-render the badge.
  const replayResp = page.waitForResponse(
    (r) => r.url().includes("/api/demo/replay") && r.status() === 200,
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: /M-Pesa payment succeeds/i }).click();
  await replayResp;

  // 5. The invoice status badge must flip to "Paid".
  await expect(statusBadge).toHaveText("Paid", { timeout: 30_000 });
});
