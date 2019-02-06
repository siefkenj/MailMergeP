"use strict";
Components.utils.import("resource://gre/modules/Services.jsm");

const utils = {
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
     * Returns a promise that resolves when the openend dialog is ready.
     */
    openDialogPromise: function openDialogPromise(dialogUrl) {
        return new Promise((resolve, reject) => {
            let numWaits = 0;
            let dgl = window.open(
                dialogUrl,
                "_blank",
                "chrome,dialog,centerscreen,alwaysRaised"
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
        compFields.securityInfo = gMsgCompose.compFields.securityInfo;
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
    },

    /*
     * Javascript wrapper around nsIPrefBranch which will handles all type information.
     * Native prefs only support strings, ints, and bools.
     */
    PrefManager: class PrefManager {
        constructor(branch = "extensions.mailmerge.") {
            this.prefs = Services.prefs.getBranch(branch);
            let prefs = this.prefs;
            this._getFunctions = {
                [prefs.PREF_INT]: prefs.getIntPref,
                [prefs.PREF_BOOL]: prefs.getBoolPref,
                [prefs.PREF_STRING]: prefs.getStringPref,
                [prefs.PREF_INVALID]: function() {
                    return void 0;
                }
            };
        }
        getPref(prefName, defaultValue) {
            let getFunction = this._getFunctions[
                this.prefs.getPrefType(prefName)
            ];
            let pref = getFunction(prefName);
            // if it is a string, it may be JSON encoded
            if (typeof pref === "string" && pref.startsWith("{")) {
                try {
                    pref = JSON.parse(pref);
                    if (pref.hasOwnProperty("_PREF_DATA")) {
                        pref = pref["_PREF_DATA"];
                    }
                } catch (e) {}
            }
            if (typeof pref === "undefined") {
                return defaultValue;
            }
            return pref;
        }
        setPref(prefName, value) {
            // bools and ints can be natively stored. Everything
            // else, serialize.
            switch (typeof value) {
                case "boolean":
                    this.prefs.setBoolPref(prefName, value);
                    break;
                case "number":
                    if (parseInt(value) === value) {
                        this.prefs.setIntPref(prefName, value);
                        break;
                    }
                case "string":
                default:
                    let serialized;
                    try {
                        serialized = JSON.stringify({ _PREF_DATA: value });
                    } catch (e) {
                        throw new Error(
                            "Preference '" + value + "' could not be stored"
                        );
                    }
                    this.prefs.setStringPref(prefName, serialized);
            }
        }
        getAll() {
            let ret = {};
            for (let prefName of this.prefs.getChildList("", {})) {
                ret[prefName] = this.getPref(prefName);
            }
            return ret;
        }
    }
};
