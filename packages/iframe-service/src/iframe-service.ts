/*
 * provide a messaging api equivalent to what is supplied by Thunderbird when
 * running as an extension
 */

import type { Email, Prefs } from "../../interface/src/types/modelTypes";
import type { Strings } from "../../interface/src/types/types";

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
    id?: string | number;
    source?: "CHILD" | "PARENT";
    reply_id?: string | number;
    data?: {
        prefs?: Partial<Prefs>;
        template?: Email;
        strings?: Strings;
        emails?: Email[];
        email?: Email;
        sendmode?: Prefs["sendmode"];
        url?: string;
    };
};

type MessageChildPayload = Pick<MessagePayload, "type" | "id" | "data">;

export type IframeService = {
    iframe: HTMLIFrameElement | null;
    log: (message: unknown) => void;
    init: (iframe: HTMLIFrameElement) => void;
    onmessage: (e: MessageEvent<MessagePayload>) => Promise<void>;
    initChild: () => void;
    messageChild: (payload: MessageChildPayload) => void;
    commands: {
        getDefaultPreferences: () => Promise<Prefs>;
        getPreferences: () => Promise<Prefs>;
        getLocalizedStrings: () => Promise<Strings>;
        getTemplate: () => Promise<Email>;
        setPreferences: (_prefs?: Partial<Prefs>) => Promise<void>;
        sendEmails: (_emails: Email[]) => Promise<void>;
        sendEmail: (
            _email: Email,
            _sendmode?: Prefs["sendmode"]
        ) => Promise<void>;
        cancel: () => void;
        openUrl: (_url: string) => void;
    };
};

export const iframeService: IframeService = {
    iframe: null,
    log: function log(message: unknown) {
        console.log(message);
    },
    init: function init(iframe: HTMLIFrameElement) {
        // Find our child iframe and send it a message as soon as possible
        // so it is capable of sending messages back.
        iframeService.iframe =
            iframe ||
            window.document.querySelector<HTMLIFrameElement>("#content-frame");
        window.childFrame = iframe;

        if (iframe.contentDocument?.readyState === "complete") {
            iframeService.initChild();
        } else {
            iframeService.iframe.onload = () => {
                iframeService.initChild();
            };
        }
    },
    onmessage: async function (e: MessageEvent<MessagePayload>) {
        const payload = e.data || {};
        const { type, id, source, data } = payload;

        if (!data) {
            return;
        }

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
                    data: {
                        prefs: await iframeService.commands.getDefaultPreferences(),
                    },
                });
                break;
            case "GET_PREFERENCES":
                iframeService.messageChild({
                    type,
                    id,
                    data: {
                        prefs: await iframeService.commands.getPreferences(),
                    },
                });
                break;
            case "SET_PREFERENCES":
                await iframeService.commands.setPreferences(data.prefs);
                iframeService.messageChild({
                    type,
                    id,
                    data: {
                        prefs: await iframeService.commands.getPreferences(),
                    },
                });
                break;
            case "GET_TEMPLATE":
                iframeService.messageChild({
                    type,
                    id,
                    data: {
                        template: await iframeService.commands.getTemplate(),
                    },
                });
                break;
            case "GET_LOCALIZED_STRINGS":
                iframeService.messageChild({
                    type,
                    id,
                    data: {
                        strings:
                            await iframeService.commands.getLocalizedStrings(),
                    },
                });
                break;
            case "SEND_EMAILS":
                if (data.emails) {
                    await iframeService.commands.sendEmails(data.emails);
                }
                iframeService.messageChild({ type, id });
                break;
            case "SEND_EMAIL":
                if (data.email) {
                    await iframeService.commands.sendEmail(
                        data.email,
                        data.sendmode
                    );
                }
                iframeService.messageChild({ type, id });
                break;
            case "OPEN_URL":
                if (data.url) {
                    iframeService.commands.openUrl(data.url);
                }
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

        const payload = { type: "INITIALIZE_PARENT" };
        iframeService.iframe?.contentWindow?.postMessage(payload, "*");
        iframeService.log({ ...payload, direction: "tochild" });
    },
    // send a message to the child iframe
    messageChild: function messageChild(payload: MessageChildPayload) {
        const { type, id, data } = payload;
        const message: MessagePayload = {
            type: type,
            source: "PARENT",
            reply_id: id,
            data: { ...data },
        };
        iframeService.iframe?.contentWindow?.postMessage(message, "*");
        iframeService.log({ ...message, direction: "tochild" });
    },
    commands: {
        getDefaultPreferences: async () => {
            console.warn("Function not implemented");
            return {} as Prefs;
        },
        getPreferences: async () => {
            console.warn("Function not implemented");
            return {} as Prefs;
        },
        getLocalizedStrings: async () => {
            console.warn("Function not implemented");
            return {} as Strings;
        },
        getTemplate: async () => {
            console.warn("Function not implemented");
            return {} as Email;
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setPreferences: async (_prefs?: Partial<Prefs>) => {
            console.warn("Function not implemented");
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        sendEmails: async (_emails: Email[]) => {
            console.warn("Function not implemented");
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        sendEmail: async (_email: Email, _sendmode?: Prefs["sendmode"]) => {
            console.warn("Function not implemented");
        },
        cancel: () => {
            console.warn("Function not implemented");
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        openUrl: (_url: string) => {
            console.warn("Function not implemented");
        },
    },
};

window.iframeService = iframeService;
