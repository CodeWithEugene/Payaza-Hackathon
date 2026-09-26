import { test, expect } from "@playwright/test";

/**
 * Money-path smoke E2E: demo reset → login → dashboard → open the SENT
 * invoice → replay a successful M-Pesa webhook through the merchant Demo
 * controls → invoice flips to Paid via the SAME pipeline as live webhooks.
 *
 * This is the single most important flow of the product; if it works end to
 * end in a browser, the spine (webhook → single completion path → SSE/refresh
 * → UI) is proven.
 */

const DEMO_EMAIL = "wanjiru@kusanya.demo";
const DEMO_PASSWORD = "kusanya-demo-2026";

test("demo: reset → login → invoice pays via webhook replay", async ({ page, request }) => {
  test.setTimeout(120_000);

  // 1. Fresh demo data (unauthenticated allowed only on an empty DB; if a
  //    session exists from a prior run, cookies aren't shared with `request`
  //    — so reset via the API context after login instead when needed).
  const loginFirst = async () => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(DEMO_EMAIL);
    await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/app/, { timeout: 20_000 });
  };

  // Try reset before login; falls back to post-login reset when the DB
  // already has users (route guards unauthenticated resets then).
  let resetResp = await request.post("/api/demo/reset");
  if (resetResp.status() === 401) {
    await loginFirst();
    resetResp = await page.request.post("/api/demo/reset");
    await page.waitForLoadState("networkidle");
  }
  expect(resetResp.ok()).toBeTruthy();
  const reset = await resetResp.json();
  const sentInvoiceId = reset.invoiceIds?.sent as string;
  expect(sentInvoiceId).toBeTruthy();

  // 2. Login (unless already logged in above).
  if (!page.url().includes("/app")) {
    await loginFirst();
  }
  await expect(page.getByText(/FreshLeaf Exports/i).first()).toBeVisible({ timeout: 15_000 });

  // 3. Open the SENT invoice (KES 48,500 to Mama Njeri, momo prompt pending).
  await page.goto(`/app/invoices/${sentInvoiceId}`);
  await expect(page.getByText("KSN-2026-0003")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Mama Njeri/i).first()).toBeVisible();

  // 4. Replay a successful M-Pesa webhook via Demo controls.
  const demoCard = page.getByText(/Demo controls/i).locator("xpath=ancestor::*[contains(@class,'card') or self::section][1]");
  void demoCard;
  const momoBtn = page.getByRole("button", { name: /M-Pesa payment succeeds/i });
  await expect(momoBtn).toBeVisible({ timeout: 10_000 });
  await momoBtn.click();

  // 5. The invoice must flip to Paid (server refresh after replay).
  await expect(page.getByText(/^Paid$/).first()).toBeVisible({ timeout: 30_000 });
});
