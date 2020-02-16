/* eslint-disable object-shorthand */

// Get various parts of the WebExtension framework that we need.
const { ExtensionCommon } = ChromeUtils.import(
    "resource://gre/modules/ExtensionCommon.jsm"
);

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

/**
 * Store and lookup windows by Id. A `WeakMap` is used
 * internally to prevent memory leaks.
 *
 * @class ComposeWindows
 */
class ComposeWindows {
    constructor() {
        this._currentId = null;
        this._nextUnusedId = 1;
        this._weakMap = new WeakMap();
    }
    add(window, setCurrent = true) {
        if (!window) {
            console.warn("Value of window cannot be null");
            return;
        }
        if (this._weakMap.has(window)) {
            const id = this._weakMap.get(window);
            if (setCurrent) {
                this._currentId = id;
            }
            return id;
        }
        // We haven't been added to the window list yet, so get
        // a new ID and add ourselves
        const newId = this._nextUnusedId;
        this._nextUnusedId++;
        this._weakMap.set(window, newId);
        if (setCurrent) {
            this._currentId = newId;
        }
        return newId;
    }
    setCurrent(id) {
        this._currentId = id;
    }
    get(id = this._currentId) {
        for (const window of Services.ww.getWindowEnumerator(null)) {
            const winId = this._weakMap.get(window);
            if (winId === id) {
                return window;
            }
        }
    }
    getCurrent() {
        return this.get(this._currentId);
    }
}
const composeWindows = new ComposeWindows();

// Implement the functions and events defined in api.json.
// The variable must have the same we use in the schema.
var mailmergep = class extends ExtensionCommon.ExtensionAPI {
    getAPI(context) {
        return {
            // Again, this key must have the same name.
            mailmergep: {
                async getComposedMessage(windowId) {
                    const gMsgCompose = composeWindows.get(windowId)
                        .gMsgCompose;
                    if (!gMsgCompose) {
                        console.warn(
                            `Tried to get a compose template for window with id=${windowId} but there was no "gMsgCompose" attribute`
                        );
                    }
                    return utils.getEmailTemplate(gMsgCompose);
                },

                async sendMail(data, windowId, prefs) {
                    const gMsgCompose = composeWindows.get(windowId)
                        .gMsgCompose;
                    if (!gMsgCompose) {
                        console.warn(
                            `Found window with id=${windowId} but there was no "gMsgCompose" attribute`
                        );
                        return;
                    }
                    utils.sendEmail(data, prefs, gMsgCompose);
                },

                // The events
                onClick: new ExtensionCommon.EventManager({
                    context,
                    name: "mailmergep.onClick",
                    // In this function we add listeners for any events we want to listen to, and return a
                    // function that removes those listeners. To have the event fire in your extension,
                    // call fire.async.
                    register(fire) {
                        function callback(event, windowId) {
                            return fire.async(windowId);
                        }

                        windowListener.add(callback);
                        return function() {
                            windowListener.remove(callback);
                        };
                    }
                }).api(),
                onTemplateChange: new ExtensionCommon.EventManager({
                    context,
                    name: "mailmergep.onTemplateChange",
                    // In this function we add listeners for any events we want to listen to, and return a
                    // function that removes those listeners. To have the event fire in your extension,
                    // call fire.async.
                    register(fire) {
                        return function() {};
                        /*
                        function callback(event, windowId) {
                            return fire.async(windowId);
                        }

                        windowListener.add(callback);
                        return function() {
                            windowListener.remove(callback);
                        };
                        */
                    }
                }).api()
            }
        };
    }
};

// A helpful class for listening to windows opening and closing.
// (This file had a lowercase E in Thunderbird 65 and earlier.)
var { ExtensionSupport } = ChromeUtils.import(
    "resource:///modules/ExtensionSupport.jsm"
);

// This object is just what we're using to listen for toolbar clicks. The implementation isn't
// what this example is about, but you might be interested as it's a common pattern. We count the
// number of callbacks waiting for events so that we're only listening if we need to be.
var windowListener = new (class extends ExtensionCommon.EventEmitter {
    constructor() {
        super();
        this.callbackCount = 0;
        this.listeners = [];
    }

    handleEvent(event, window) {
        const windowId = composeWindows.add(window);
        windowListener.emit("toolbar-clicked", windowId);
        //utils.openDialogPromise("apis.html", composeWindows.getCurrent().domWindow);
    }

    add(callback) {
        this.on("toolbar-clicked", callback);
        this.callbackCount++;

        if (this.callbackCount == 1) {
            ExtensionSupport.registerWindowListener("windowListener", {
                chromeURLs: [
                    "chrome://messenger/content/messengercompose/messengercompose.xul"
                ],
                onLoadWindow: win => {
                    // Save the compose window for later
                    const composeWindowId = composeWindows.add(win);

                    let toolbox = win.document.getElementById(
                        "compose-toolbox"
                    );
                    const callback = event => {
                        composeWindows.setCurrent(composeWindowId);
                        windowListener.handleEvent(
                            event,
                            composeWindows.getCurrent()
                        );
                    };
                    try {
                        this.listeners.push(callback);
                    } catch (e) {
                        console.warn(e);
                    }
                    toolbox.addEventListener("click", callback);
                }
            });
        }
    }

    remove(callback) {
        this.off("toolbar-clicked", callback);
        this.callbackCount--;

        if (this.callbackCount == 0) {
            for (let window of ExtensionSupport.openWindows) {
                if (
                    window.location.href ==
                    "chrome://messenger/content/messengercompose/messengercompose.xul"
                ) {
                    let toolbox = window.document.getElementById(
                        "compose-toolbox"
                    );
                    for (const callback of this.listeners) {
                        toolbox.removeEventListener("click", callback);
                    }
                }
            }
            ExtensionSupport.unregisterWindowListener("windowListener");
        }
    }
})();

const utils = {
    getEmailTemplate(gMsgCompose) {
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
    },

    async sendEmail(email, prefs = { delay: 0 }, gMsgCompose) {
        const msgWin = gMsgCompose.domWindow;

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

        let prepped = utils.prepareEmail(email, gMsgCompose);

        // set the message and wait for a "Copy complete." status.
        // This message is localized, so make sure to get the correct text.
        // XXX this is an ugly hack. http://doxygen.db48x.net/mozilla-full/html/d8/dc4/interfacensIWebProgressListener.html
        // says we should get back an `aStatus` from onStatusChange, but we don't...only a message
        const completedMessage = msgWin.document
            .getElementById("bundle_composeMsgs")
            .getString("copyMessageComplete");

        await new Promise((resolve, reject) => {
            function onStatusChange(aWebProgress, aRequest, aStatus, aMessage) {
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
    },

    /*
     * Present standard prompts for missing to, missing attachment, etc.
     * Returns `true` if there's nothing missing.
     *
     * `promptFor` defaults to
     *       {
     *           emptyTo: true,
     *           emptySubject: true,
     *           missingAttachment: true,
     *           spellcheck: true
     *       }
     */
    checkForMissingEmailParts: function checkForMissingEmailParts(
        editorWindow,
        promptFor = {}
    ) {
        promptFor = Object.assign(
            {
                emptyTo: true,
                emptySubject: true,
                missingAttachment: true,
                spellcheck: true
            },
            promptFor
        );

        const {
            Recipients2CompFields,
            gMsgCompose,
            GetMsgSubjectElement,
            gManualAttachmentReminder,
            SetMsgBodyFrameFocus
        } = editorWindow;
        const editorDocument = editorWindow.document;

        // addressinvalid start
        try {
            Recipients2CompFields(gMsgCompose.compFields);
            if (promptFor.emptyTo && gMsgCompose.compFields.to === "") {
                var bundle = editorDocument.getElementById(
                    "bundle_composeMsgs"
                );
                Services.prompt.alert(
                    editorWindow,
                    bundle.getString("addressInvalidTitle"),
                    bundle.getString("noRecipients")
                );
                return;
            }
        } catch (e) {}

        // subjectempty start
        try {
            var subject = GetMsgSubjectElement().value;
            if (promptFor.emptySubject && subject === "") {
                var bundle = editorDocument.getElementById(
                    "bundle_composeMsgs"
                );
                var flags =
                    Services.prompt.BUTTON_TITLE_IS_STRING *
                        Services.prompt.BUTTON_POS_0 +
                    Services.prompt.BUTTON_TITLE_IS_STRING *
                        Services.prompt.BUTTON_POS_1;

                if (
                    Services.prompt.confirmEx(
                        editorWindow,
                        bundle.getString("subjectEmptyTitle"),
                        bundle.getString("subjectEmptyMessage"),
                        flags,
                        bundle.getString("sendWithEmptySubjectButton"),
                        bundle.getString("cancelSendingButton"),
                        null,
                        null,
                        { value: 0 }
                    ) == 1
                ) {
                    return;
                }
            }
        } catch (e) {}

        // attachmentreminder start
        try {
            if (
                promptFor.missingAttachment &&
                (gManualAttachmentReminder ||
                    (getPref("mail.compose.attachment_reminder_aggressive") &&
                        editorDocument
                            .getElementById("attachmentNotificationBox")
                            .getNotificationWithValue("attachmentReminder")))
            ) {
                var bundle = editorDocument.getElementById(
                    "bundle_composeMsgs"
                );
                var flags =
                    Services.prompt.BUTTON_TITLE_IS_STRING *
                        Services.prompt.BUTTON_POS_0 +
                    Services.prompt.BUTTON_TITLE_IS_STRING *
                        Services.prompt.BUTTON_POS_1;

                if (
                    Services.prompt.confirmEx(
                        editorWindow,
                        bundle.getString("attachmentReminderTitle"),
                        bundle.getString("attachmentReminderMsg"),
                        flags,
                        bundle.getString("attachmentReminderFalseAlarm"),
                        bundle.getString("attachmentReminderYesIForgot"),
                        null,
                        null,
                        { value: 0 }
                    ) == 1
                ) {
                    return;
                }
            }
        } catch (e) {}

        // spellcheck start
        try {
            if (promptFor.spellcheck && getPref("mail.SpellCheckBeforeSend")) {
                SetMsgBodyFrameFocus();

                editorWindow.cancelSendMessage = false;
                editorWindow.openDialog(
                    "chrome://editor/content/EdSpellCheck.xul",
                    "_blank",
                    "dialog,close,titlebar,modal,resizable",
                    true,
                    true,
                    false
                );
                if (editorWindow.cancelSendMessage) {
                    return;
                }
            }
        } catch (e) {}

        return true;
    },

    /*
     * Returns a promise that resolves when the opened dialog is ready.
     */
    openDialogPromise: function openDialogPromise(dialogUrl, window) {
        return new Promise((resolve, reject) => {
            let numWaits = 0;
            let dgl = window.open(
                dialogUrl,
                "_blank",
                "chrome,dialog,centerscreen,alwaysRaised,height=600,width=500"
            );
            function testAndWait() {
                if (dgl.document.readyState === "complete") {
                    resolve(dgl);
                    return;
                }
                if (numWaits > 10) {
                    reject("Waited too many times");
                    return;
                }
                numWaits += 1;
                window.setTimeout(testAndWait, 50);
            }
            testAndWait();
        });
    },

    /*
     * Prepare an email for sending
     */
    prepareEmail: function prepareEmail(fields, gMsgCompose) {
        const {
            from,
            to,
            cc,
            bcc,
            reply,
            subject,
            body,
            attachments,
            at,
            customheaders
        } = fields;

        /* compfields start */
        // create new compFields
        var compFields = Components.classes[
            "@mozilla.org/messengercompose/composefields;1"
        ].createInstance(Components.interfaces.nsIMsgCompFields);
        /* compfields end */

        /* composeparams start */
        var composeParams = Components.classes[
            "@mozilla.org/messengercompose/composeparams;1"
        ].createInstance(Components.interfaces.nsIMsgComposeParams);

        composeParams.type = Components.interfaces.nsIMsgCompType.New;
        composeParams.format = gMsgCompose.composeHTML
            ? Components.interfaces.nsIMsgCompFormat.HTML
            : Components.interfaces.nsIMsgCompFormat.PlainText;
        composeParams.identity = gMsgCompose.identity;
        composeParams.composeFields = compFields;
        /* composeparams end */

        /* compose start */
        var compose = Components.classes[
            "@mozilla.org/messengercompose/compose;1"
        ].createInstance(Components.interfaces.nsIMsgCompose);
        compose.initialize(composeParams);
        /* compose end */

        /* compfields start */
        compFields.from = from;
        compFields.to = to;
        compFields.cc = cc;
        compFields.bcc = bcc;
        compFields.replyTo = reply;
        compFields.subject = subject;

        compFields.attachVCard = gMsgCompose.compFields.attachVCard;
        compFields.characterSet = gMsgCompose.compFields.characterSet;
        compFields.DSN = gMsgCompose.compFields.DSN;
        compFields.organization = gMsgCompose.compFields.organization;
        compFields.priority = gMsgCompose.compFields.priority;
        compFields.returnReceipt = gMsgCompose.compFields.returnReceipt;
        // Started causing an error in TB 68...Don't know why.
        //compFields.securityInfo = gMsgCompose.compFields.securityInfo;
        /* compfields end */

        /* customheaders start */
        try {
            /* Thunderbird */
            for (var i = 0; i < customheaders.length; i++) {
                compFields.setHeader(
                    customheaders[i].name,
                    customheaders[i].value
                );
            }
        } catch (e) {}
        /* customheaders end */

        /* attachments start */
        var bucket = gMsgCompose.domWindow.document.getElementById(
            "attachmentBucket"
        );
        for (var i = 0; i < bucket.itemCount; i++) {
            try {
                compFields.addAttachment(bucket.getItemAtIndex(i).attachment);
            } catch (e) {
                console.warn("Error adding attachment");
                return;
            }
        }
        /* attachments end */

        /* attachments start */
        var objPattern = new RegExp('("[^"]+"|[^",]+)', "g");
        var arrMatches = [];
        while ((arrMatches = objPattern.exec(attachments))) {
            try {
                var file = arrMatches[0];

                /* compatibility start */
                file = file.replace(new RegExp('"', "g"), "");
                file = file.replace(new RegExp("\\s+$", "g"), "");
                file = file.replace(new RegExp("^\\s+", "g"), "");
                file = file.replace(new RegExp("^file://", "g"), "");
                /* compatibility end */

                var localFile = Components.classes[
                    "@mozilla.org/file/local;1"
                ].createInstance(Components.interfaces.nsIFile);
                localFile.initWithPath(file);

                if (!localFile.exists() || !localFile.isFile()) {
                    continue;
                }

                var attachment = Components.classes[
                    "@mozilla.org/messengercompose/attachment;1"
                ].createInstance(Components.interfaces.nsIMsgAttachment);
                attachment.url = "file://" + file;

                compFields.addAttachment(attachment);
            } catch (e) {}
        }
        /* attachments end */

        /* format start */
        var format = gMsgCompose.domWindow.DetermineHTMLAction(
            gMsgCompose.domWindow.DetermineConvertibility()
        );
        switch (format) {
            case Components.interfaces.nsIMsgCompSendFormat.Both:
                compFields.forcePlainText = false;
                compFields.useMultipartAlternative = true;
                break;

            case Components.interfaces.nsIMsgCompSendFormat.HTML:
                compFields.forcePlainText = false;
                compFields.useMultipartAlternative = false;
                break;

            case Components.interfaces.nsIMsgCompSendFormat.PlainText:
                compFields.forcePlainText = true;
                compFields.useMultipartAlternative = false;
                break;

            default:
        }
        /* format end */

        /* editor start */
        compose.initEditor(gMsgCompose.editor, gMsgCompose.domWindow.content);

        compose.editor.QueryInterface(Components.interfaces.nsIHTMLEditor);
        compose.editor.rebuildDocumentFromSource(body);
        /* editor end */

        return {
            compose,
            currentIdentity: gMsgCompose.domWindow.getCurrentIdentity(),
            currentAccountKey: gMsgCompose.domWindow.getCurrentAccountKey()
        };
    }
};
