import { test, expect } from "@playwright/test";

/**
 * Dark mode (next-themes + shadcn .dark token block):
 * - stored theme applies the .dark class on <html> before paint
 * - semantic tokens actually flip (computed background = oklch(0.145 0 0)
 *   = rgb(37,37,37) — the shadcn dark --background)
 * - the ModeToggle (aria-label "Toggle theme") switches themes via the
 *   dropdown, and the "d" hotkey (components/theme-provider.tsx) toggles
 * - login page carries its own toggle and inherits the stored theme
 * No DB state involved — landing + login only.
 */

test("dark mode: stored theme, token flip, toggle, hotkey", async ({ page }) => {
  // Chrome serializes computed colors in the source color space (oklch →
  // lab()); 1×1 canvas pixel readback quantizes ANY CSS color to 8-bit sRGB.
  const bodyBgHex = () =>
    page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = Array.from(ctx.getImageData(0, 0, 1, 1).data);
      return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    });

  // next-themes reads localStorage["theme"] in a blocking pre-paint script.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("theme", "dark");
    } catch {
      // storage unavailable — test will fail visibly below
    }
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await bodyBgHex()).toBe("#0a0a0a"); // oklch(0.145 0 0) — shadcn dark --background

  // Toggle via the dropdown → Light
  const toggle = page.getByRole("button", { name: "Toggle theme" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await bodyBgHex()).toBe("#ffffff"); // oklch(1 0 0)

  // "d" hotkey flips back to dark (outside inputs)
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("d");
  await expect(page.locator("html")).toHaveClass(/dark/);

  // Login page: toggle present + stored dark theme applied
  await page.goto("/login");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Toggle theme" })).toBeVisible();
});
