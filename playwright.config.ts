// Playwright config for the smoke test. Auto-starts the cold-clone dev
// server (`npm run dev:blank` on port 3030) so tests run against a fresh
// SQLite each invocation, no risk of test state leaking into a real
// install. Reuses the running server when you've already started one
// locally to keep the loop fast during development.

import { defineConfig, devices } from "@playwright/test";

const PORT = 3030;

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev:blank",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
