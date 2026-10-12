import { defineConfig, devices } from "@playwright/test";

// https://playwright.dev/docs/test-configuration
export default defineConfig({
    testDir: "packages/browser-preview/e2e",
    // Use a distinct suffix so vitest doesn't pick these files up
    testMatch: "**/*.e2e.ts",
    forbidOnly: !!process.env.CI,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: "http://localhost:4173",
        trace: "retain-on-failure",
    },
    projects: [
        // Thunderbird is built on Firefox
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    ],
    webServer: {
        // Test the production build, served with Thunderbird's Content Security Policy
        command:
            "npm run build && npm run preview -w browser-preview -- --port 4173 --strictPort",
        url: "http://localhost:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
});
