/*
 * Runs a real Thunderbird with the add-on installed, sending mail to a local Mailpit
 * server, and drives it over Marionette. Thunderbird runs on a virtual display (Xvfb).
 *
 * The binaries are found on the PATH, or set with the THUNDERBIRD and MAILPIT
 * environment variables. The dev container installs both
 * (see .devcontainer/install-thunderbird.sh).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Marionette } from "./marionette.ts";

export const ADDON_ID = "mailmergep@example.net";
// Thunderbird derives the compose action button's id from the add-on id
const COMPOSE_ACTION_BUTTON =
    "#mailmergep_example_net-composeAction-toolbarbutton";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor<T>(
    check: () => Promise<T> | T,
    description: string,
    timeout = 20_000
): Promise<Exclude<T, false | null | undefined | "" | 0>> {
    const end = Date.now() + timeout;
    let lastError: unknown;
    while (Date.now() < end) {
        try {
            const value = await check();
            if (value) {
                return value as Exclude<T, false | null | undefined | "" | 0>;
            }
        } catch (e) {
            lastError = e;
        }
        await sleep(250);
    }
    throw new Error(
        `Timed out waiting for ${description}` +
            (lastError ? `: ${lastError}` : "")
    );
}

async function freePort() {
    const server = net.createServer();
    await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
    );
    const { port } = server.address() as net.AddressInfo;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

async function waitForPort(port: number, description: string) {
    await waitFor(
        () =>
            new Promise<boolean>((resolve) => {
                const socket = net.connect(port, "127.0.0.1");
                socket.once("connect", () => {
                    socket.end();
                    resolve(true);
                });
                socket.once("error", () => resolve(false));
            }),
        description,
        60_000
    );
}

// Start a process in its own process group, so it can be stopped with its children
function start(command: string, args: string[], logFile: string) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const log = fs.openSync(logFile, "a");
    const child = spawn(command, args, {
        detached: true,
        stdio: ["ignore", log, log],
    });
    const exited = new Promise<void>((resolve) =>
        child.once("exit", () => resolve())
    );
    const kill = (signal: NodeJS.Signals) => {
        try {
            process.kill(-child.pid!, signal);
        } catch {
            // Already exited
        }
    };
    return {
        child,
        // Stop the process and its children, and wait for it to exit
        async stop() {
            if (child.pid && child.exitCode === null) {
                kill("SIGTERM");
                const timeout = setTimeout(() => kill("SIGKILL"), 5000);
                await exited;
                clearTimeout(timeout);
            }
            fs.closeSync(log);
        },
    };
}

export type ReceivedMessage = {
    from: string;
    to: string[];
    subject: string;
    text: string;
    html: string;
};

/** A local SMTP server that keeps the messages it receives. */
export class Mailpit {
    readonly smtpPort: number;
    readonly #httpPort: number;
    readonly #process: ReturnType<typeof start>;

    private constructor(
        smtpPort: number,
        httpPort: number,
        process: ReturnType<typeof start>
    ) {
        this.smtpPort = smtpPort;
        this.#httpPort = httpPort;
        this.#process = process;
    }

    static async start(logDir: string) {
        const smtpPort = await freePort();
        const httpPort = await freePort();
        const process = start(
            globalThis.process.env.MAILPIT || "mailpit",
            [
                "--smtp",
                `127.0.0.1:${smtpPort}`,
                "--listen",
                `127.0.0.1:${httpPort}`,
            ],
            path.join(logDir, "mailpit.log")
        );
        try {
            await waitForPort(httpPort, "Mailpit to start");
        } catch (e) {
            await process.stop();
            throw e;
        }
        return new Mailpit(smtpPort, httpPort, process);
    }

    async #api(endpoint: string) {
        const response = await fetch(
            `http://127.0.0.1:${this.#httpPort}/api/v1/${endpoint}`
        );
        return response.json();
    }

    async messages(): Promise<ReceivedMessage[]> {
        const { messages } = await this.#api("messages");
        return Promise.all(
            messages.map(async ({ ID }: { ID: string }) => {
                const message = await this.#api(`message/${ID}`);
                return {
                    from: message.From.Address,
                    to: message.To.map((to: { Address: string }) => to.Address),
                    subject: message.Subject,
                    text: message.Text,
                    html: message.HTML,
                };
            })
        );
    }

    async waitForMessages(count: number) {
        return waitFor(
            async () => {
                const messages = await this.messages();
                return messages.length >= count && messages;
            },
            `${count} messages to arrive`,
            60_000
        );
    }

    stop() {
        return this.#process.stop();
    }
}

export type Identity = { name: string; email: string };

function profilePrefs(
    marionettePort: number,
    smtpPort: number,
    identity: Identity
) {
    const prefs: Record<string, string | number | boolean> = {
        "marionette.port": marionettePort,
        // Skip first run prompts and notifications
        "mail.shell.checkDefaultClient": false,
        "mail.provider.enabled": false,
        "mailnews.start_page.enabled": false,
        "mail.rights.version": 1,
        "datareporting.policy.dataSubmissionEnabled": false,
        "datareporting.policy.dataSubmissionPolicyBypassNotification": true,
        "toolkit.telemetry.reportingpolicy.firstRun": false,
        "app.update.disabledForTesting": true,
        "app.donation.eoy.version.viewed": 999,
        "extensions.update.enabled": false,
        // Load the (unsigned) add-on placed in the profile's extensions folder
        "extensions.autoDisableScopes": 0,
        "extensions.enabledScopes": 15,
        "xpinstall.signatures.required": false,
        // Run extension pages in the main process, so their DOM can be reached from
        // Marionette's chrome context. (Marionette can't switch to an add-on's popup
        // window in its content context.) Their CSP is still enforced.
        "extensions.webextensions.remote": false,
        // Copy console messages (including CSP violations) to the log
        "devtools.console.stdout.chrome": true,
        "devtools.console.stdout.content": true,
        // An account whose mail is sent to Mailpit. Its incoming server is never used.
        "mail.accountmanager.accounts": "account1,account2",
        "mail.accountmanager.defaultaccount": "account1",
        "mail.accountmanager.localfoldersserver": "server2",
        "mail.account.account1.identities": "id1",
        "mail.account.account1.server": "server1",
        "mail.account.account2.server": "server2",
        "mail.server.server1.type": "pop3",
        "mail.server.server1.hostname": "pop.invalid",
        "mail.server.server1.userName": "sender",
        "mail.server.server1.name": identity.email,
        "mail.server.server1.login_at_startup": false,
        "mail.server.server1.check_new_mail": false,
        "mail.server.server2.type": "none",
        "mail.server.server2.hostname": "Local Folders",
        "mail.server.server2.name": "Local Folders",
        "mail.server.server2.userName": "nobody",
        "mail.identity.id1.fullName": identity.name,
        "mail.identity.id1.useremail": identity.email,
        "mail.identity.id1.smtpServer": "smtp1",
        "mail.identity.id1.valid": true,
        "mail.smtpservers": "smtp1",
        "mail.smtp.defaultserver": "smtp1",
        "mail.smtpserver.smtp1.hostname": "127.0.0.1",
        "mail.smtpserver.smtp1.port": smtpPort,
        "mail.smtpserver.smtp1.authMethod": 1, // No authentication
        "mail.smtpserver.smtp1.try_ssl": 0,
    };
    return Object.entries(prefs)
        .map(
            ([name, value]) =>
                `user_pref(${JSON.stringify(name)}, ${JSON.stringify(value)});`
        )
        .join("\n");
}

export type ThunderbirdOptions = {
    xpi: string;
    smtpPort: number;
    outputDir: string;
    // The sender
    identity?: Identity;
    // Size of the virtual screen
    screen?: { width: number; height: number };
};

export class Thunderbird {
    readonly marionette: Marionette;
    readonly logFile: string;
    readonly #process: ReturnType<typeof start>;
    readonly #profileDir: string;

    private constructor(
        marionette: Marionette,
        process: ReturnType<typeof start>,
        profileDir: string,
        logFile: string
    ) {
        this.marionette = marionette;
        this.#process = process;
        this.#profileDir = profileDir;
        this.logFile = logFile;
    }

    static async start({
        xpi,
        smtpPort,
        outputDir,
        identity = { name: "Ada Lovelace", email: "ada@example.com" },
        screen,
    }: ThunderbirdOptions) {
        const profileDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "mailmergep-thunderbird-")
        );
        fs.mkdirSync(path.join(profileDir, "extensions"));
        fs.copyFileSync(
            xpi,
            path.join(profileDir, "extensions", `${ADDON_ID}.xpi`)
        );
        const marionettePort = await freePort();
        fs.writeFileSync(
            path.join(profileDir, "user.js"),
            profilePrefs(marionettePort, smtpPort, identity)
        );

        const { width = 1280, height = 900 } = screen ?? {};
        const logFile = path.join(outputDir, "thunderbird.log");
        const process = start(
            "xvfb-run",
            [
                "--auto-servernum",
                "--server-args",
                `-screen 0 ${width}x${height}x24`,
                globalThis.process.env.THUNDERBIRD || "thunderbird",
                "--profile",
                profileDir,
                "--marionette",
                "--remote-allow-system-access",
                "--no-remote",
            ],
            logFile
        );
        try {
            await waitForPort(marionettePort, "Thunderbird to start");
            const marionette = await Marionette.connect(marionettePort);
            await marionette.send("Marionette:SetContext", { value: "chrome" });
            const thunderbird = new Thunderbird(
                marionette,
                process,
                profileDir,
                logFile
            );
            await thunderbird.#collectAddonErrors();
            await waitFor(
                () =>
                    thunderbird.js<boolean>(
                        `
                        const { AddonManager } = ChromeUtils.importESModule(
                            "resource://gre/modules/AddonManager.sys.mjs"
                        );
                        const addon = await AddonManager.getAddonByID(arguments[0]);
                        return addon?.isActive ?? false;
                    `,
                        [ADDON_ID]
                    ),
                "the add-on to be installed"
            );
            return thunderbird;
        } catch (e) {
            // Don't leave Thunderbird running if it didn't start properly
            await process.stop();
            fs.rmSync(profileDir, { recursive: true, force: true });
            throw e;
        }
    }

    /**
     * Run `script` as the body of an async function with chrome privileges in the
     * current window, and return its result.
     */
    async js<T = unknown>(script: string, args: unknown[] = []): Promise<T> {
        const { value } = await this.marionette.send<{
            value: { value?: T; error?: string };
        }>("WebDriver:ExecuteAsyncScript", {
            script: `
                const resolve = arguments[arguments.length - 1];
                (async function () { ${script} })
                    .apply(null, Array.from(arguments).slice(0, -1))
                    .then(
                        (value) => resolve({ value }),
                        (e) => resolve({ error: String(e) + "\\n" + e.stack })
                    );`,
            args,
            scriptTimeout: 30_000,
        });
        if (value.error) {
            throw new Error(value.error);
        }
        return value.value as T;
    }

    /** Make the window whose document URL matches `pattern` the current window. */
    async switchToWindow(pattern: RegExp) {
        return waitFor(async () => {
            const handles = await this.marionette.send<string[]>(
                "WebDriver:GetWindowHandles"
            );
            for (const handle of handles) {
                await this.marionette.send("WebDriver:SwitchToWindow", {
                    handle,
                    focus: true,
                });
                if (
                    pattern.test(
                        await this.js<string>("return document.documentURI")
                    )
                ) {
                    return handle;
                }
            }
            return null;
        }, `a window matching ${pattern}`);
    }

    /** A PNG screenshot of the current window */
    async screenshot() {
        const { value } = await this.marionette.send<{ value: string }>(
            "WebDriver:TakeScreenshot",
            { full: false }
        );
        return Buffer.from(value, "base64");
    }

    /** Resize and move the current window */
    async setWindowRect(rect: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    }) {
        await this.marionette.send("WebDriver:SetWindowRect", rect);
        await sleep(500);
    }

    /** Open a compose window filled in with `fields` and make it the current window */
    async compose(fields: {
        to: string;
        subject: string;
        body: string;
        plainText?: boolean;
    }) {
        await this.switchToWindow(/messenger\.xhtml/);
        await this.js(
            `
            const [fields] = arguments;
            const compFields = Cc["@mozilla.org/messengercompose/composefields;1"]
                .createInstance(Ci.nsIMsgCompFields);
            compFields.to = fields.to;
            compFields.subject = fields.subject;
            compFields.body = fields.body;
            const params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                .createInstance(Ci.nsIMsgComposeParams);
            params.type = Ci.nsIMsgCompType.New;
            params.format = fields.plainText
                ? Ci.nsIMsgCompFormat.PlainText
                : Ci.nsIMsgCompFormat.HTML;
            params.identity = MailServices.accounts.defaultAccount.defaultIdentity;
            params.composeFields = compFields;
            MailServices.compose.OpenComposeWindowWithParams(null, params);`,
            [fields]
        );
        await this.switchToWindow(/messengercompose\.xhtml/);
        // Wait for the editor and the add-on's toolbar button
        await waitFor(
            () =>
                this.js<boolean>(
                    `return !!document.querySelector(arguments[0]) &&
                        window.composeEditorReady === true`,
                    [COMPOSE_ACTION_BUTTON]
                ),
            "the compose window to be ready"
        );
    }

    /** Click the add-on's button in the compose window, then switch to its window */
    async openMailMerge() {
        await this.js(`document.querySelector(arguments[0]).click()`, [
            COMPOSE_ACTION_BUTTON,
        ]);
        await this.switchToWindow(/extensionPopup\.xhtml/);
        await waitFor(
            () =>
                this.app<boolean>(
                    `return !!app.querySelector(".text-section-header")`
                ),
            "the Mail Merge window to load"
        );
        return new MailMergeWindow(this);
    }

    /**
     * Run `script` with `app` set to the document of the add-on's interface (inside
     * the iframe in the add-on's window)
     */
    app<T = unknown>(script: string, args: unknown[] = []) {
        return this.js<T>(
            `
            const popup = [...Services.wm.getEnumerator(null)].find((w) =>
                w.document.documentURI.includes("extensionPopup")
            );
            const app = popup?.document
                .querySelector("browser")
                ?.contentDocument?.getElementById("content-frame")
                ?.contentDocument;
            if (!app) {
                throw new Error("The Mail Merge window isn't open");
            }
            ${script}`,
            args
        );
    }

    /**
     * Record errors from the add-on's pages, including Content Security Policy
     * violations, which aren't written to Thunderbird's log. They are kept on the
     * main window, which stays open while Thunderbird runs.
     */
    async #collectAddonErrors() {
        await this.js(`
            const isAddonError = (message) =>
                message instanceof Ci.nsIScriptError &&
                message.sourceName.startsWith("moz-extension://") &&
                (message.category.startsWith("CSP") ||
                    !(message.flags & Ci.nsIScriptError.warningFlag));
            const main = await new Promise((resolve) => {
                const check = () => {
                    const window = Services.wm.getMostRecentWindow("mail:3pane");
                    window ? resolve(window) : setTimeout(check, 100);
                };
                check();
            });
            // Include errors from before the listener was added (e.g. from the
            // add-on's background page as Thunderbird starts)
            main.addonErrors = Services.console
                .getMessageArray()
                .filter(isAddonError)
                .map((message) => message.message);
            Services.console.registerListener({
                observe(message) {
                    if (isAddonError(message)) {
                        main.addonErrors.push(message.message);
                    }
                },
            });`);
    }

    /** Errors from the add-on's pages, including Content Security Policy violations */
    addonErrors() {
        return this.js<string[]>(
            `return Services.wm.getMostRecentWindow("mail:3pane").addonErrors`
        );
    }

    async stop() {
        try {
            await this.js("Services.startup.quit(Ci.nsIAppStartup.eForceQuit)");
        } catch {
            // The connection closes as Thunderbird quits
        }
        this.marionette.close();
        await sleep(1000);
        await this.#process.stop();
        fs.rmSync(this.#profileDir, { recursive: true, force: true });
    }
}

/** The add-on's window */
export class MailMergeWindow {
    readonly #thunderbird: Thunderbird;

    constructor(thunderbird: Thunderbird) {
        this.#thunderbird = thunderbird;
    }

    #app<T = unknown>(script: string, args: unknown[] = []) {
        return this.#thunderbird.app<T>(script, args);
    }

    async tab(name: string) {
        // The tab labels appear once the localized strings have loaded
        await waitFor(
            () =>
                this.#app<boolean>(
                    `const tab = [...app.querySelectorAll(".panel-section-tabs-button")]
                        .find((tab) => tab.textContent.includes(arguments[0]));
                    tab?.click();
                    return !!tab;`,
                    [name]
                ),
            `the ${name} tab`
        );
        await sleep(500);
    }

    async loadSpreadsheet(file: string) {
        await this.tab("Data");
        await this.#app(
            `
            const input = app.querySelector("input[type=file]");
            // Creates the File objects in the page, so the page can read them
            input.mozSetFileNameArray([arguments[0]]);
            input.dispatchEvent(new app.defaultView.Event("change", { bubbles: true }));`,
            [file]
        );
        await waitFor(
            () =>
                this.#app<boolean>(
                    `return app.querySelector(".ht_master td")?.textContent !== ""`
                ),
            "the spreadsheet to load"
        );
    }

    /** Set an input or select in the Settings tab, as if the user had changed it */
    async setSetting(id: string, value: string) {
        await this.tab("Settings");
        await this.#app(
            `
            const [id, value] = arguments;
            const win = app.defaultView;
            const element = app.getElementById(id);
            element.focus();
            element.value = value;
            element.dispatchEvent(new win.Event("input", { bubbles: true }));
            element.dispatchEvent(new win.Event("change", { bubbles: true }));
            element.dispatchEvent(new win.FocusEvent("focusout", { bubbles: true }));
            element.blur();`,
            [id, value]
        );
        await sleep(500);
    }

    text(selector: string) {
        return this.#app<string | null>(
            `return app.querySelector(arguments[0])?.textContent ?? null`,
            [selector]
        );
    }

    async clickButton(label: string) {
        await this.#app(
            `[...app.querySelectorAll("button")]
                .find((button) => button.textContent.includes(arguments[0]))
                .click();`,
            [label]
        );
    }

    isButtonDisabled(label: string) {
        return this.#app<boolean>(
            `return [...app.querySelectorAll("button")]
                .find((button) => button.textContent.includes(arguments[0]))
                .disabled;`,
            [label]
        );
    }
}
