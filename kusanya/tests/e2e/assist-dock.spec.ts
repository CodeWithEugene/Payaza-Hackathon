import { test, expect } from "@playwright/test";

/**
 * Bottom-right dock: accessibility prefs apply + persist across a reload
 * (inline head script, no flash), and Kusanya Help renders curated answers.
 */

test("accessibility menu: larger text + high contrast persist across reloads", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("kusanya-a11y"));
  await page.reload();

  await page.getByRole("button", { name: "Accessibility options" }).click();
  await page.getByRole("radio", { name: "Larger" }).click();
  await page.getByRole("switch", { name: "High contrast" }).click();

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-a11y-text", "larger");
  await expect(html).toHaveAttribute("data-a11y-contrast", "high");

  await page.reload();
  await expect(html).toHaveAttribute("data-a11y-text", "larger");
  await expect(html).toHaveAttribute("data-a11y-contrast", "high");

  await page.getByRole("button", { name: "Accessibility options" }).click();
  await page.getByRole("button", { name: "Reset To Defaults" }).click();
  await expect(html).not.toHaveAttribute("data-a11y-text", /.+/);
});

test("help chat: a starter question shows its curated answer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Kusanya Help chat" }).click();
  const chat = page.getByRole("dialog", { name: "Kusanya Help chat" });
  await expect(chat.getByText(/Hi, I'm Kusanya Help/)).toBeVisible();

  await chat.getByRole("button", { name: "How Does The Demo Work?" }).click();
  await expect(chat.getByText(/Visa 4508 7500 1574 1019/)).toBeVisible();
  await expect(chat.getByRole("link", { name: "Open Demo" })).toHaveAttribute("href", "/demo");
});
