/*
 * provide a messaging api equivalent to what is supplied by Thunderbird when
 * running as an extension
 */
"use strict";

let iframe = null;

// Log a message to #processing-log
function log(message) {
    let { type, direction, ...rest } = message;
    let li = document.createElement("li");
    let text = document.createTextNode(
        type + "\n" + JSON.stringify(rest, false, 4)
    );
    li.appendChild(text);
    li.classList.add(direction);

    let logElm = document.getElementById("processing-log");
    if (logElm) {
        logElm.appendChild(li);
    }
}

// send a message to the child iframe so that it has a reference to us,
// it's parent.
function initializeChild() {
    let payload = { type: "INITIALIZE_PARENT" };
    iframe.contentWindow.postMessage(payload, "*");
    log({ ...payload, direction: "tochild" });
}

window.onload = e => {
    // Find our child iframe and send it a message as soon as possible
    // so it is capable of sending messages back.
    iframe = window.document.getElementById("content-frame");
    window.childFrame = iframe;

    if (iframe.contentDocument.readyState === "complete") {
        initializeChild();
    } else {
        iframe.onload = e => {
            initializeChild();
        };
    }

    //console.log("childFrame:", iframe);
};

// send a message to the child iframe
function messageChild(payload) {
    const { type, id, ...data } = payload;
    let message = {
        type: type,
        source: "PARENT",
        reply_id: id,
        data: data
    };
    iframe.contentWindow.postMessage(message, "*");
    log({ ...message, direction: "tochild" });
    //console.log("messaging child", message);
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
        fileContents: []
    };
}
function getPreferences() {
    let prefs = getDefaultPreferences();
    try {
        prefs = JSON.parse(window.localStorage.getItem("prefs")) || prefs;
    } catch (e) {
        console.warn("error when decoding prefs from JSON");
    }
    return prefs;
}
function setPreferences(prefs) {
    let newPrefs = { ...getPreferences(), ...prefs };
    window.localStorage.setItem("prefs", JSON.stringify(newPrefs));
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
function sendEmails(emails) {
    for (let email of emails) {
        console.log(
            "%c Sending Email",
            "background: blue; color: white;",
            email
        );
    }
}

window.addEventListener("message", e => {
    const payload = e.data || {};
    const { type, id, source, data } = payload;

    //console.log("parent window got", payload, e);
    if (source !== "CHILD") {
        // We got a message that wasn't from our child iframe.
        // It should be handled by a different event listener.
        return;
    }

    log({ ...payload, direction: "fromchild" });

    switch (type) {
        case "ECHO":
            messageChild(payload);
            break;
        case "GET_DEFAULT_PREFERENCES":
            messageChild({ type, id, prefs: getDefaultPreferences() });
            break;
        case "GET_PREFERENCES":
            messageChild({ type, id, prefs: getPreferences() });
            break;
        case "SET_PREFERENCES":
            setPreferences(data.prefs);
            messageChild({ type, id, prefs: getPreferences() });
            break;
        case "GET_TEMPLATE":
            messageChild({ type, id, template: getTemplate() });
            break;
        case "SEND_EMAILS":
            sendMessages(data.emails);
            break;
        default:
            console.warn("Unknown message type", type);
    }
});
