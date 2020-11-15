function log(...args) {
    console.log("[MailMerge P]:", ...args);
}

log("Extension loaded...");

class MailmergeWindow {
    constructor() {
        this.openWindowId = null;
        this.isReady = false;
        this._messageQueue = [];

        // If we get a message, it means that the window has finished loading.
        // In that case, we are free to send messages to the window
        browser.runtime.onMessage.addListener((message) => {
            log("background.js got", message);
            if ((message || {}).status === "loaded") {
                this._onWindowOpened();
            }
        });
    }
    _onWindowOpened() {
        this.isReady = true;
        for (const message of this._messageQueue) {
            this.sendMessage(message);
        }
        this._messageQueue.length = 0;
    }
    async ensureWindowOpened() {
        let ret = null;
        try {
            ret = await browser.windows.get(this.openWindowId);
            await browser.windows.update(this.openWindowId, { focused: true });
        } catch (e) {
            ret = await browser.windows.create({
                url: "content/thunderbird-iframe-server.html",
                type: "popup",
                allowScriptsToClose: true,
                height: 800,
                width: 600,
            });
            this.openWindowId = ret.id;
        }
        return ret;
    }
    async sendMessage(message) {
        // Check to see if the window is still open. If not,
        // it is no longer ready.
        try {
            await browser.windows.get(this.openWindowId);
        } catch (e) {
            this.isReady = false;
        }

        // Even if the window is open, it may not be ready
        if (this.isReady) {
            browser.runtime.sendMessage(message);
        } else {
            this._messageQueue.push(message);
        }
    }
    async close() {
        try {
            await browser.windows.get(this.openWindowId);
            await browser.windows.remove(this.openWindowId);
            this.openWindowId = null;
            this.isReady = false;
        } catch (e) {
            // Already closed
            log(e);
        }
    }
}
const mailmergeWindow = new MailmergeWindow();

// Listen for when the "MailMerge P" button is pressed in the compose
// window.
browser.composeAction.onClicked.addListener(async (tabInfo) => {
    mailmergeWindow.sendMessage({ activeTabId: tabInfo.id });
    const openedWindow = await mailmergeWindow.ensureWindowOpened();
});

// We are responsible for closing the MailMerge P window if asked.
browser.runtime.onMessage.addListener(async (message) => {
    if ((message || {}).action === "close") {
        await mailmergeWindow.close();
    }
});
