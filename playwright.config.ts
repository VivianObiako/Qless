import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real stack: Postgres, the Go API, and the
 * Next dev server. Nothing is mocked — the point of these is the seams the Go
 * tests cannot reach, where a browser, a socket and a second device are all
 * involved at once.
 *
 * The web server is reused when one is already running, which is the normal
 * case locally: two `next dev` processes share `.next` and fight over the build
 * cache. On a clean machine Playwright starts one itself.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
