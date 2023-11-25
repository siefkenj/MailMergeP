/*
 * provide a messaging api equivalent to what is supplied by Thunderbird when
 * running as an extension
 */

export type MessagePayload = {
    type:
        | "ECHO"
        | "GET_DEFAULT_PREFERENCES"
        | "GET_PREFERENCES"
        | "SET_PREFERENCES"
        | "GET_TEMPLATE"
        | "GET_LOCALIZED_STRINGS"
        | "SEND_EMAILS"
        | "SEND_EMAIL"
        | "OPEN_URL"
        | "CANCEL"
        | "INITIALIZE_PARENT";
    id: string | number;
    source: "CHILD" | "PARENT";
    data?: {
        prefs: unknown;
        template: string;
        strings: any;
        emails: any;
        email: any;
        sendmode: any;
        url: any;
    };
};

export const iframeService = {
    iframe: null as HTMLIFrameElement | null,
    log: function log(message) {
        console.log(message);
    },
    init: function init(iframe: HTMLIFrameElement) {
        // Find our child iframe and send it a message as soon as possible
        // so it is capable of sending messages back.
        iframeService.iframe =
            iframe ||
            (window.document.getElementById(
                "content-frame"
            ) as HTMLIFrameElement);
        (window as any).childFrame = iframe;

        if (iframe.contentDocument?.readyState === "complete") {
            iframeService.initChild();
        } else {
            iframeService.iframe.onload = (e) => {
                iframeService.initChild();
            };
        }
    },
    onmessage: async function (e) {
        const payload = (e.data || {}) as MessagePayload;
        const { type, id, source, data } = payload;

        if (source !== "CHILD") {
            // We got a message that wasn't from our child iframe.
            // It should be handled by a different event listener.
            return;
        }

        iframeService.log({ ...payload, direction: "fromchild" });

        switch (type) {
            case "ECHO":
                iframeService.messageChild(payload);
                break;
            case "GET_DEFAULT_PREFERENCES":
                iframeService.messageChild({
                    type,
                    id,
                    prefs: await iframeService.commands.getDefaultPreferences(),
                });
                break;
            case "GET_PREFERENCES":
                iframeService.messageChild({
                    type,
                    id,
                    prefs: await iframeService.commands.getPreferences(),
                });
                break;
            case "SET_PREFERENCES":
                await iframeService.commands.setPreferences(data!.prefs);
                iframeService.messageChild({
                    type,
                    id,
                    prefs: await iframeService.commands.getPreferences(),
                });
                break;
            case "GET_TEMPLATE":
                iframeService.messageChild({
                    type,
                    id,
                    template: await iframeService.commands.getTemplate(),
                });
                break;
            case "GET_LOCALIZED_STRINGS":
                iframeService.messageChild({
                    type,
                    id,
                    strings: await iframeService.commands.getLocalizedStrings(),
                });
                break;
            case "SEND_EMAILS":
                await iframeService.commands.sendEmails(data!.emails);
                iframeService.messageChild({ type, id });
                break;
            case "SEND_EMAIL":
                await iframeService.commands.sendEmail(
                    data!.email,
                    data!.sendmode
                );
                iframeService.messageChild({ type, id });
                break;
            case "OPEN_URL":
                iframeService.commands.openUrl(data!.url);
                break;
            case "CANCEL":
                iframeService.commands.cancel();
                break;
            default:
                console.warn("Unknown message type", type);
        }
    },
    // send a message to the child iframe so that it has a reference to us,
    // it's parent.
    initChild: function initChild() {
        iframeService.iframe?.contentWindow?.addEventListener(
            "message",
            iframeService.onmessage
        );

        let payload = { type: "INITIALIZE_PARENT" };
        iframeService.iframe?.contentWindow?.postMessage(payload, "*");
        iframeService.log({ ...payload, direction: "tochild" });
    },
    // send a message to the child iframe
    messageChild: function messageChild(payload) {
        const { type, id, ...data } = payload;
        let message = {
            type: type,
            source: "PARENT",
            reply_id: id,
            data: data,
        };
        iframeService.iframe?.contentWindow?.postMessage(message, "*");
        iframeService.log({ ...message, direction: "tochild" });
    },
    commands: {
        getDefaultPreferences: () => {
            console.warn("Function not implemented");
        },
        getPreferences: () => {
            console.warn("Function not implemented");
        },
        getLocalizedStrings: () => {
            console.warn("Function not implemented");
        },
        getTemplate: () => {
            console.warn("Function not implemented");
        },
        setPreferences: (prefs: unknown) => {
            console.warn("Function not implemented");
        },
        sendEmails: (emails: string[]) => {
            console.warn("Function not implemented");
        },
        sendEmail: (email: string, mode?: string) => {
            console.warn("Function not implemented");
        },
        cancel: () => {
            console.warn("Function not implemented");
        },
        openUrl: (url: string) => {
            console.warn("Function not implemented");
        },
    },
};

(window as any).iframeService = iframeService;
