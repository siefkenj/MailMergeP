/*
 * End-to-end tests of the add-on in a real Thunderbird, sending to a local Mailpit
 * server. Run with `npm run test:thunderbird`.
 *
 * Screenshots are saved to `test-results-thunderbird/screenshots/` (and attached to
 * the HTML report). The `store` test makes the screenshots for the add-on's listing
 * on addons.thunderbird.net, in `test-results-thunderbird/screenshots/store/`.
 * `npm run prepare-release` copies those to `docs/screenshots/`.
 */
import { test as base, expect, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { Mailpit, Thunderbird, waitFor, type Identity } from "./thunderbird.ts";

const XPI = path.resolve(
    import.meta.dirname,
    "../../../mailmergep@example.net-latest.xpi"
);
const PEOPLE_CSV = path.join(import.meta.dirname, "people.csv");
const SCREENSHOTS_DIR = path.resolve(
    import.meta.dirname,
    "../../../test-results-thunderbird/screenshots"
);

const BODY =
    "Hi {{first}} {{last}}. Your report is ready. Please visit {{url}} for details.";

type Fixtures = {
    identity: Identity;
    mailpit: Mailpit;
    thunderbird: Thunderbird;
    capture: (name: string) => Promise<void>;
};

const test = base.extend<Fixtures>({
    identity: [
        { name: "Ada Lovelace", email: "ada@example.com" },
        { option: true },
    ],
    // eslint-disable-next-line no-empty-pattern
    mailpit: async ({}, use, testInfo) => {
        const mailpit = await Mailpit.start(testInfo.outputDir);
        await use(mailpit);
        await mailpit.stop();
    },
    thunderbird: async ({ mailpit, identity }, use, testInfo) => {
        if (!fs.existsSync(XPI)) {
            throw new Error(
                `${XPI} not found. Run \`npm run build-and-package\`.`
            );
        }
        fs.mkdirSync(testInfo.outputDir, { recursive: true });
        const thunderbird = await Thunderbird.start({
            xpi: XPI,
            smtpPort: mailpit.smtpPort,
            outputDir: testInfo.outputDir,
            identity,
        });
        await use(thunderbird);
        await thunderbird.stop();
        await testInfo.attach("thunderbird.log", { path: thunderbird.logFile });
    },
    // Save a screenshot of the current window, numbered in the order they are taken
    capture: async ({ thunderbird }, use, testInfo) => {
        let count = 0;
        await use(async (name) => {
            const file = screenshotPath(
                testInfo,
                `${String(++count).padStart(2, "0")}-${name}.png`
            );
            fs.writeFileSync(file, await thunderbird.screenshot());
            await testInfo.attach(name, {
                path: file,
                contentType: "image/png",
            });
        });
    },
});

function screenshotPath(
    testInfo: TestInfo,
    name: string,
    folder = testInfo.titlePath.slice(1).join(" - ")
) {
    const dir = path.join(SCREENSHOTS_DIR, folder);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, name);
}

test.afterEach(async ({ thunderbird }) => {
    // Fails on any error from the add-on, including Content Security Policy violations
    expect(await thunderbird.addonErrors()).toEqual([]);
});

test("sends a personalized email to each row of the spreadsheet", async ({
    thunderbird,
    mailpit,
    capture,
}) => {
    await thunderbird.compose({
        to: "{{email}}",
        subject: "Hi {{first}}",
        body: `<p>${BODY}</p><p>Best,<br>Tester</p>`,
    });
    await capture("compose");

    const mailMerge = await thunderbird.openMailMerge();
    await capture("data-empty");
    await mailMerge.loadSpreadsheet(PEOPLE_CSV);
    await capture("data");

    // A delay between messages, so the progress dialog can be seen
    await mailMerge.setSetting("pref-sendmode", "now");
    await mailMerge.setSetting("pref-delay", "2");
    await capture("settings");

    await mailMerge.tab("Preview");
    expect(await mailMerge.text("#email-subject")).toBe("Hi Tom");
    expect(await mailMerge.text("#template-errors-summary")).toBeNull();
    await capture("preview");

    await mailMerge.clickButton("Send");
    await waitFor(() => mailMerge.text("#send-dialog"), "the send dialog");
    await capture("sending");

    const messages = await mailpit.waitForMessages(2);
    const bySubject = messages.sort((a, b) =>
        a.subject.localeCompare(b.subject)
    );
    expect(
        bySubject.map(({ from, to, subject }) => ({ from, to, subject }))
    ).toEqual([
        { from: "ada@example.com", to: ["a@a.com"], subject: "Hi Tom" },
        { from: "ada@example.com", to: ["b@b.com"], subject: "Hi Wanda" },
    ]);
    expect(bySubject[0].text).toContain(
        "Hi Tom Smith. Your report is ready. Please visit google.com for details."
    );
    // Thunderbird sends simple HTML like this as plain text
    expect(bySubject[1].text).toContain(
        "Hi Wanda Ballard. Your report is ready. Please visit yahoo.com for details."
    );
});

test("sends plain text emails as plain text", async ({
    thunderbird,
    mailpit,
}) => {
    await thunderbird.compose({
        to: "{{email}}",
        subject: "Hi {{first}}",
        body: `${BODY}\n\nBest,\n   Tester`,
        plainText: true,
    });
    const mailMerge = await thunderbird.openMailMerge();
    await mailMerge.loadSpreadsheet(PEOPLE_CSV);
    await mailMerge.tab("Preview");
    await mailMerge.clickButton("Send");

    const messages = await mailpit.waitForMessages(2);
    const tom = messages.find((message) => message.subject === "Hi Tom");
    expect(tom?.html).toBe("");
    // Thunderbird sends plain text as format=flowed (RFC 3676), which adds a space
    // to lines starting with a space. Mail clients remove it when displaying them.
    const text = tom?.text.replace(/\r\n/g, "\n").replace(/^ /gm, "").trim();
    expect(text).toBe(
        "Hi Tom Smith. Your report is ready. Please visit google.com for details.\n\nBest,\n   Tester"
    );
});

test("doesn't send emails that can't be filled in", async ({
    thunderbird,
    mailpit,
    capture,
}) => {
    // `nickname` isn't a column in the spreadsheet
    await thunderbird.compose({
        to: "{{email}}",
        subject: "Hi {{ nickname | trim }}",
        body: `<p>${BODY}</p>`,
    });
    const mailMerge = await thunderbird.openMailMerge();
    await mailMerge.loadSpreadsheet(PEOPLE_CSV);
    await mailMerge.tab("Preview");

    expect(await mailMerge.text("#template-errors-summary")).toContain(
        "2 of the emails can't be filled in"
    );
    expect(await mailMerge.isButtonDisabled("Send")).toBe(true);
    await capture("preview-errors");

    await mailMerge.clickButton("Send");
    await new Promise((r) => setTimeout(r, 2000));
    expect(await mailpit.messages()).toEqual([]);
});

test.describe("store", () => {
    // The sender shown in the listing's screenshots
    test.use({ identity: { name: "", email: "test@test.net" } });

    test("screenshots for addons.thunderbird.net", async ({ thunderbird }) => {
        const save = async (name: string) => {
            // A fixed folder, which `npm run copy-screenshots` copies from
            const file = screenshotPath(test.info(), `${name}.png`, "store");
            fs.writeFileSync(file, await thunderbird.screenshot());
            await test
                .info()
                .attach(name, { path: file, contentType: "image/png" });
        };

        await thunderbird.compose({
            to: "{{email}}",
            subject: "Hi {{first}}",
            body: `${BODY}\n\nBest,\n   Tester`,
            plainText: true,
        });
        // Wider than the original screenshot (594px), since Thunderbird's toolbar is
        // wider now
        await thunderbird.setWindowRect({
            x: 0,
            y: 0,
            width: 760,
            height: 606,
        });
        await save("1-compose");

        const mailMerge = await thunderbird.openMailMerge();
        await thunderbird.setWindowRect({
            x: 0,
            y: 0,
            width: 500,
            height: 700,
        });
        await mailMerge.loadSpreadsheet(PEOPLE_CSV);
        await save("2-data");

        await mailMerge.setSetting("pref-sendmode", "now");
        await mailMerge.setSetting("pref-delay", "11");
        await save("3-settings");

        await mailMerge.tab("Preview");
        expect(await mailMerge.text("#email-subject")).toBe("Hi Tom");
        await save("4-preview");
    });
});
