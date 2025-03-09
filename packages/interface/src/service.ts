/**
 * This is the interface between the iframe mailMerge UI and
 * the outside world (which has permission to send mail)
 */

import type { MessagePayload } from "../../iframe-service/src/iframe-service";

let _messageId = 0;
function getUniqueMessageId() {
    return _messageId++;
}
// We need to avoid sending messages until the parent has initialized,
// so we set up a promise that gets triggered when the parent has sent its first signal.
let resolveParentInitialized: (value?: unknown) => void = () => {};
const parentInitialized = new Promise((resolve) => {
    resolveParentInitialized = resolve;
});

// send a message to the parent window
// including payload. Returns a promise that
// is resolved by the parent's response.
async function messageParent(payload: Pick<MessagePayload, "type" | "data">) {
    const { type, data } = payload;
    const message: MessagePayload = {
        type: type,
        source: "CHILD",
        id: getUniqueMessageId(),
        data: { ...data },
    };

    // We cannot send any messages until our parent has initialized, so we wait!
    await parentInitialized;

    return new Promise<MessagePayload["data"]>((resolve) => {
        // construct a listener that resolves the promise when
        // getting back a reply, then removes itself from
        // listening.
        const listener = (e: MessageEvent<MessagePayload>) => {
            const { data } = e;
            // bail if this isn't a response for this message
            if (data.source !== "PARENT" || data.reply_id !== message.id) {
                return;
            }
            // if we're here, it's a response to this message
            window.removeEventListener("message", listener);
            resolve(data.data);
        };
        window.addEventListener("message", listener);
        window.postMessage(message, "*");
    });
}

// Always listen for an INITIALIZE_PARENT message
// Until we get this message, we can't send any messages!
window.addEventListener("message", (e) => {
    const data = e.data || {};
    if (data.type === "INITIALIZE_PARENT") {
        // Let the child (us) know that it's safe to send messages to the parent.
        resolveParentInitialized();
        console.log(
            "Got signal from parent window to initialize",
            data,
            e.source
        );
    }
});

export { messageParent };
