/*
 * provide a messaging api equivalent to what is supplied by Thunderbird when
 * running as an extension
 */
"use strict";

if (typeof iframeService === "undefined") {
    console.warn("iframeService is undefined. It must be loaded first!");
}

(function () {
    // Set up some internal globals
    let composeTabId = null;
    // background.js will let us know what the id of the current compose window
    // is with a message.
    browser.runtime.onMessage.addListener(function (message, sender) {
        if (sender.id.toLowerCase() === "mailmergep@example.net") {
            if (message.activeTabId != null) {
                composeTabId = message.activeTabId;
            }
        }
    });

    // Let background.js know that we're ready. We must send a message
    // because there is no other way for background.js to know that we're
    // loaded.
    browser.runtime.sendMessage({ status: "loaded" });

    /**
     * Find the sender's email given a `composeDetails` object as
     * returned by the Thunderbird API.
     *
     * @param {*} composeDetails
     */
    async function getSenderFromComposeDetails(composeDetails) {
        const activeIdentityId = composeDetails.identityId;
        const accounts = await browser.accounts.list();
        const activeAccount = accounts.find((account) =>
            account.identities.some((ident) => ident.id === activeIdentityId)
        );
        if (activeAccount == null) {
            console.warn(
                "Could not find the active account for a message with composeDetails:",
                composeDetails
            );
            return "";
        }

        const identity = activeAccount.identities.find(
            (ident) => ident.id === activeIdentityId
        );
        if (identity == null) {
            console.warn(
                "Could not find identity",
                activeIdentityId,
                "in account",
                activeAccount
            );
            return "";
        }

        return identity.email;
    }

    /*
     * Functions to simulate the mailmerge commands
     */
    function getDefaultPreferences() {
        return {
            delay: 0,
            sendmode: "now",
            range: "",
            parser: "nunjucks",
            fileName: "",
            fileContents: [],
        };
    }

    async function getPreferences() {
        let prefs = getDefaultPreferences();
        try {
            const fetched = await browser.storage.local.get("prefs");
            if (fetched.prefs) {
                prefs = fetched.prefs;
            }
        } catch (e) {
            console.warn("error when loading prefs");
        }
        return prefs;
    }

    async function setPreferences(prefs) {
        let newPrefs = { ...(await getPreferences()), ...prefs };
        await browser.storage.local.set({ prefs: newPrefs });
    }

    async function getTemplate() {
        if (composeTabId != null) {
            const composeDetails = await browser.compose.getComposeDetails(
                composeTabId
            );

            return {
                from: await getSenderFromComposeDetails(composeDetails),
                to: composeDetails.to.join(", "),
                cc: composeDetails.cc.join(", "),
                bcc: composeDetails.bcc.join(", "),
                replyTo: composeDetails.replyTo.join(", "),
                attachment: "",
                subject: composeDetails.subject,
                body: composeDetails.body,
            };
        }

        // return a dummy template
        const defaultTemplate = {
            from: "From Guy <from@guy.com>",
            to: "To Guy <to@guy.com>, {{email}}",
            cc: "To Guy CC <tocc@guy.com>",
            bcc: "To Guy BCC <tobcc@guy.com>",
            replyTo: "",
            attachment: "",
            subject: "Error processing template; this is a default template",
            body: "Hi {{name}}.\n\nPlease ask me about our special offer.",
        };

        let textarea = document.querySelector("#template-textarea");
        try {
            let ret = JSON.parse(textarea.value);
            textarea.classList.remove("processing-error");
            return ret;
        } catch (e) {
            textarea.classList.add("processing-error");
            return defaultTemplate;
        }
    }
    function getLocalizedStrings() {
        const stringNames = [
            "next",
            "previous",
            "cancel",
            "send",
            "data",
            "dataInfo",
            "openAFile",
            "settings",
            "preview",
            "sendMode",
            "sendModeDesc",
            "sendModeNow",
            "sendModeLater",
            "sendModeDraft",
            "messageDelay",
            "messageDelayDesc",
            "sendMessageRange",
            "sendMessageRangeDesc",
            "parser",
            "parserDesc",
            "parserLegacy",
            "previewEmpty",
            "previewPreviewing",
            "about",
            "developers",
            "support",
            "license",
            "donate",
            "euro",
            "dollar",
            "current",
            "total",
            "time",
            "progress",
            "status",
            "sending",
            "waiting",
        ];
        const ret = {};
        for (const name of stringNames) {
            ret[name] = browser.i18n.getMessage(name);
        }
        return ret;
    }

    async function sendEmail(email, sendmode) {
        await browser.mailmergep.sendMail(email, composeTabId, {
            sendmode,
        });
    }

    function cancel() {
        // If the cancel button was clicked, close the window
        browser.runtime.sendMessage({ action: "close" });
    }

    function openUrl(url) {
        window.open(url, "_blank");
    }

    // attach all our function calls to the iframeService
    iframeService.log = function () {}; // Comment out if you want to see debug messages
    Object.assign(iframeService.commands, {
        getDefaultPreferences,
        getPreferences,
        getLocalizedStrings,
        getTemplate,
        setPreferences,
        sendEmail,
        openUrl,
        cancel,
    });
})();

window.onload = () => {
    iframeService.init(window.document.getElementById("content-frame"));
};
