import { defineConfig } from "@playwright/test";

// End-to-end tests in a real Thunderbird (see packages/thunderbird-extension/e2e/).
// They use Playwright's test runner, but drive Thunderbird over Marionette rather
// than with a Playwright browser.
export default defineConfig({
    testDir: "packages/thunderbird-extension/e2e",
    testMatch: "**/*.tb.ts",
    // Cleared before each run. Screenshots are saved in its `screenshots` folder.
    outputDir: "test-results-thunderbird",
    // Each test starts its own Thunderbird
    workers: 1,
    timeout: 120_000,
    retries: process.env.CI ? 1 : 0,
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI
        ? [
              ["list"],
              [
                  "html",
                  {
                      open: "never",
                      outputFolder: "playwright-report-thunderbird",
                  },
              ],
          ]
        : "list",
});
