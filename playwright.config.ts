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
/**
 * Where the web app is. Port 3000 by default; a machine that runs the dev
 * server elsewhere says so with PLAYWRIGHT_BASE_URL, which the API must
 * also allow as an origin.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${new URL(baseURL).port || "3000"}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
