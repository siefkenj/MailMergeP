/*
 * A minimal client for Marionette, the remote control protocol built into
 * Thunderbird (and Firefox). See https://firefox-source-docs.mozilla.org/testing/marionette/Protocol.html
 */
import net from "node:net";

type Pending = {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
};

export class Marionette {
    #socket: net.Socket;
    #buffer = Buffer.alloc(0);
    #nextId = 0;
    #pending = new Map<number, Pending>();

    private constructor(socket: net.Socket) {
        this.#socket = socket;
    }

    static async connect(port: number, host = "127.0.0.1") {
        const socket = net.connect(port, host);
        const client = new Marionette(socket);
        const handshake = new Promise<void>((resolve, reject) => {
            socket.once("error", reject);
            client.#onHandshake = resolve;
        });
        socket.on("data", (data: Buffer) => client.#receive(data));
        await handshake;
        await client.send("WebDriver:NewSession", {});
        return client;
    }

    #onHandshake: () => void = () => {};

    // Messages are framed as `<length in bytes>:<json>`
    #receive(data: Buffer) {
        this.#buffer = Buffer.concat([this.#buffer, data]);
        for (;;) {
            const colon = this.#buffer.indexOf(":");
            if (colon < 0) {
                return;
            }
            const length = Number(this.#buffer.subarray(0, colon).toString());
            if (this.#buffer.length < colon + 1 + length) {
                return;
            }
            const json = this.#buffer
                .subarray(colon + 1, colon + 1 + length)
                .toString("utf8");
            this.#buffer = this.#buffer.subarray(colon + 1 + length);
            const message = JSON.parse(json);
            if (!Array.isArray(message)) {
                // The first message is a handshake
                this.#onHandshake();
                continue;
            }
            const [, id, error, result] = message;
            const pending = this.#pending.get(id);
            this.#pending.delete(id);
            if (error) {
                pending?.reject(new Error(`${error.error}: ${error.message}`));
            } else {
                pending?.resolve(result);
            }
        }
    }

    send<T = unknown>(command: string, params: object = {}): Promise<T> {
        return new Promise((resolve, reject) => {
            const id = ++this.#nextId;
            this.#pending.set(id, {
                resolve: resolve as (value: unknown) => void,
                reject,
            });
            const text = JSON.stringify([0, id, command, params]);
            this.#socket.write(`${Buffer.byteLength(text)}:${text}`);
        });
    }

    close() {
        this.#socket.end();
    }
}
