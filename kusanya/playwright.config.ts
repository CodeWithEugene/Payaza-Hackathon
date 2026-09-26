import { defineConfig, devices } from "@playwright/test";

/**
 * E2E (build.md §13): uses the SYSTEM Chrome channel — no browser download
 * (hackathon disk budget). Run: pnpm test:e2e (boots its own dev server).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    // Serve the existing production build on 3100 (3000 may be taken by
    // another local app). BETTER_AUTH_URL must match the served origin or
    // better-auth's CSRF/origin check rejects sign-in.
    command:
      "BETTER_AUTH_URL=http://localhost:3100 NEXT_PUBLIC_APP_URL=http://localhost:3100 npx next start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
