/*
 * Emails that can't be filled in must be reported in the Preview tab and never sent.
 */
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

function template(subject: string) {
    return JSON.stringify({
        from: "me@example.com",
        to: "{{email}}",
        cc: "",
        bcc: "",
        replyTo: "",
        attachment: "",
        subject,
        body: "Dear {{first}},",
    });
}

async function openPreview(page: Page, subject: string) {
    await page.locator("#template-textarea").fill(template(subject));
    const app = page.frameLocator("#content-frame");
    const tab = (name: string) =>
        app.locator(".panel-section-tabs-button", { hasText: name });
    // The template is fetched again whenever the Preview tab is opened
    await tab("Data").click();
    await tab("Preview").click();
    return app;
}

test("reports emails that can't be filled in and blocks sending", async ({
    page,
}) => {
    await page.goto("/");
    const app = page.frameLocator("#content-frame");
    await app
        .locator("input[type=file]")
        .setInputFiles(path.join(import.meta.dirname, "data.csv"));

    // `nickname` isn't a column, so it can't be passed through a filter
    await openPreview(page, "Hi {{ nickname | trim }}");
    const send = app.locator("button", { hasText: "Send" });
    await expect(app.locator("#template-errors-summary")).toContainText(
        "2 of the emails can't be filled in"
    );
    await expect(app.locator("#template-errors")).toContainText("subject:");
    await expect(app.locator("#email-subject")).toHaveText(
        "Hi {{ nickname | trim }}"
    );
    await expect(send).toBeDisabled();
    await expect(send).toHaveAttribute(
        "title",
        "Some emails can't be filled in. See the Preview tab."
    );

    // Fixing the template clears the errors
    await openPreview(page, "Hi {{ first | trim }}");
    await expect(app.locator("#email-subject")).toHaveText("Hi Alice");
    await expect(app.locator("#template-errors-summary")).toHaveCount(0);
    await expect(app.locator("#template-errors")).toHaveCount(0);
    await expect(send).toBeEnabled();
});
