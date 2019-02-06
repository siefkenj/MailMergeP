/*
 * provide a messaging api equivalent to what is supplied by Thunderbird when
 * running as an extension
 */
"use strict";
Components.utils.import("resource://gre/modules/Services.jsm");

function init() {
    // Find our child iframe and send it a message as soon as possible
    // so it is capable of sending messages back.
    let iframe = window.document.getElementById("ui-frame");
    iframeService.init(iframe);
}

(function(gMsgCompose) {
    // stateful storage
    let stringbundleCache, prefManager;

    function log(message) {
        let { type, direction, ...rest } = message;
        console.log("logging", type, direction, rest);
    }

    function getDefaultPreferences() {
        if (!prefManager) {
            prefManager = new utils.PrefManager();
        }
        let ret = {};
        for (let pref of [
            "delay",
            "sendmode",
            "range",
            "parser",
            "fileName",
            "fileContents"
        ]) {
            ret[pref] = prefManager.getPref(pref);
        }
        return ret;
    }

    function getPreferences() {
        if (!prefManager) {
            prefManager = new utils.PrefManager();
        }
        return prefManager.getAll();
    }

    function setPreferences(prefs) {
        if (!prefManager) {
            prefManager = new utils.PrefManager();
        }
        for (let [key, val] of Object.entries(prefs)) {
            prefManager.setPref(key, val);
        }
    }

    function getTemplate() {
        // return a dummy template
        const defaultTemplate = {
            from: "From Guy <from@guy.com>",
            to: "To Guy <to@guy.com>, {{email}}",
            cc: "To Guy CC <tocc@guy.com>",
            bcc: "To Guy BCC <tobcc@guy.com>",
            replyTo: "",
            attachment: "",
            subject: "Error processing template; this is a default template",
            body: "Hi {{name}}.\n\nPlease ask me about our special offer."
        };

        // gMsgCompose should be passed in by our caller
        if (!gMsgCompose) {
            console.warn("Could not find gMsgCompose");
            return defaultTemplate;
        }

        // make sure the to/cc/bcc/from fields are populated
        gMsgCompose.domWindow.Recipients2CompFields(gMsgCompose.compFields);
        let template = {
            from: gMsgCompose.compFields.from,
            to: gMsgCompose.compFields.to,
            cc: gMsgCompose.compFields.cc,
            bcc: gMsgCompose.compFields.bcc,
            replyTo: gMsgCompose.compFields.replyTo,
            body: gMsgCompose.editor.outputToString("text/html", 4),
            subject: gMsgCompose.domWindow.GetMsgSubjectElement().value
        };

        return template;
    }

    function getLocalizedStrings() {
        if (stringbundleCache) {
            return stringbundleCache;
        }

        // the stringbundle hasn't been loaded, so load it now.
        stringbundleCache = {};
        let stringbundle = document.getElementById("mailmergep-stringbundle");
        // loop through all strings in the stringbundle and add the appropriate ones
        let enumerator = stringbundle.strings;
        while (enumerator.hasMoreElements()) {
            let property = enumerator
                .getNext()
                .QueryInterface(Components.interfaces.nsIPropertyElement);
            let key = property.key.match(/mailmergep\.ui\.(.+)/);
            if (key) {
                stringbundleCache[key[1]] = property.value;
            }
        }

        return stringbundleCache;
    }

    async function sendEmails(emails) {
        const msgWin = gMsgCompose.domWindow;
        const prefs = { ...getPreferences() };
        let delayInMs = 0;
        try {
            delayInMs = parseInt(1000 * prefs.delay, 10);
        } catch (e) {}

        // returns a promise that delays for number of miliseconds
        function delay(duration) {
            return new Promise((resolve, reject) => {
                window.setTimeout(function() {
                    resolve();
                }, duration);
            });
        }

        // wait for any saving/editing to finish
        await new Promise((resolve, reject) => {
            let numWaits = 0;
            function testAndWait() {
                if (
                    !msgWin.gSaveOperationInProgress &&
                    !msgWin.gSendOperationInProgress
                ) {
                    resolve();
                    return;
                }
                if (numWaits > 5) {
                    reject("Waited too many times");
                    return;
                }
                numWaits += 1;
                window.setTimeout(testAndWait, 1000);
            }
            testAndWait();
        });

        gMsgCompose.expandMailingLists();

        let delivermode;
        const modes = Components.interfaces.nsIMsgCompDeliverMode;
        switch (prefs.sendmode) {
            case "now":
                delivermode = modes.Now;
                break;
            case "later":
                delivermode = modes.Later;
                break;
            case "draft":
                delivermode = modes.SaveAsDraft;
                break;
            default:
                console.warn("Unknown sendmode", prefs.sendmode);
        }

        let dgl = await utils.openDialogPromise(
            "chrome://mailmergep/content/deliveryprogress.xul"
        );

        const updateDialog = dgl.update;

        // start a timer to update the time in the dialog window
        const startTime = Date.now();
        const timer = window.setInterval(function() {
            updateDialog({ time: Date.now() - startTime });
        }, 200);

        updateDialog({ total: emails.length });
        let currMail = 0;
        for (let email of emails) {
            // if the dialog has closed, abort any sending
            if (dgl.closed) {
                break
            }

            // we might have been delayed by things like
            // waiting for a message to get sent. Compute
            // what time it should be, and from that how much
            // longer we should wait.
            let nextMessageTime = startTime + delayInMs * currMail;
            let neededDelay = nextMessageTime - Date.now()
            if (neededDelay > 0) {
                await delay(neededDelay);
            }

            let progress = Math.floor((100 * (currMail + 1)) / emails.length);
            updateDialog({ current: currMail, progress: progress });

            console.log(
                "%c Sending Email",
                "background: blue; color: white;",
                email
            );

            let prepped = utils.prepareEmail(email, gMsgCompose);

            // set the message and wait for a "Copy complete." status.
            // This message is localized, so make sure to get the correct text.
            // XXX this is an ugly hack. http://doxygen.db48x.net/mozilla-full/html/d8/dc4/interfacensIWebProgressListener.html
            // says we should get back an `aStatus` from onStatusChange, but we don't...only a message
            const completedMessage = gMsgCompose.domWindow.document
                .getElementById("bundle_composeMsgs")
                .getString("copyMessageComplete");

            await new Promise((resolve, reject) => {
                function onStatusChange(
                    aWebProgress,
                    aRequest,
                    aStatus,
                    aMessage
                ) {
                    updateDialog({ status: aMessage });
                    if (aMessage === completedMessage) {
                        resolve();
                    }
                }

                prepped.compose.SendMsg(
                    delivermode,
                    prepped.currentIdentity,
                    prepped.currentAccountKey,
                    null,
                    { onStatusChange }
                );
            });

            currMail++;
        }

        window.clearInterval(timer);
        dgl.close()
        window.close()
    }

    function cancel() {
        window.close();
    }

    // attach all our function calls to the iframeService
    iframeService.log = log;
    Object.assign(iframeService.commands, {
        getDefaultPreferences,
        getPreferences,
        getLocalizedStrings,
        getTemplate,
        setPreferences,
        sendEmails,
        cancel
    });
})(window.opener.mailmergeGlobals.gMsgCompose);

