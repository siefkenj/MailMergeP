/*
 * Runs a mail merge in the browser preview, which is served with the Content Security
 * Policy that Thunderbird applies to the add-on. The test fails if anything the add-on
 * does (e.g. using `eval` or `new Function`) is blocked by the policy.
 */
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const TEMPLATE = {
    from: "me@example.com",
    to: "{{email}}",
    cc: "",
    bcc: "",
    replyTo: "",
    attachment: "",
    subject: "Hi {{first}}",
    body: "Dear {{first}} {{last}},",
};

// Collect CSP violations from the page and the interface iframe. Firefox reports each
// one as a console error. (A `securitypolicyviolation` listener added with
// `page.addInitScript` doesn't reach the iframe's document in Firefox.)
function collectCspViolations(page: Page) {
    const violations: string[] = [];
    page.on("console", (message) => {
        const text = message.text();
        if (text.includes("Content-Security-Policy")) {
            violations.push(text);
        }
    });
    return violations;
}

for (const parser of ["jinja", "legacy"]) {
    test(`fills templates with the ${parser} parser without CSP violations`, async ({
        page,
    }) => {
        const violations = collectCspViolations(page);
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));

        const response = await page.goto("/");
        // Make sure the policy is actually being enforced
        const csp = response?.headers()["content-security-policy"];
        expect(csp).toContain("script-src 'self'");
        expect(csp).not.toContain("unsafe-eval");

        await page.locator("#template-textarea").fill(JSON.stringify(TEMPLATE));

        const app = page.frameLocator("#content-frame");
        const tab = (name: string) =>
            app.locator(".panel-section-tabs-button", { hasText: name });

        await tab("Settings").click();
        await app.locator("#pref-parser").selectOption(parser);

        await tab("Data").click();
        await app
            .locator("input[type=file]")
            .setInputFiles(path.join(import.meta.dirname, "data.csv"));

        await tab("Preview").click();
        // Soft assertions, so a failure also reports any CSP violations below
        await expect.soft(app.locator("#email-subject")).toHaveText("Hi Alice");
        await expect
            .soft(app.locator("#email-content"))
            .toHaveText("Dear Alice Smith,");

        expect(violations).toEqual([]);
        expect(pageErrors).toEqual([]);
    });
}
