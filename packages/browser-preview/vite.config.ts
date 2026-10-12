import { createServer, defineConfig, type Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "node:path";
import { randomBytes } from "node:crypto";

const INTERFACE_ROOT = path.resolve(import.meta.dirname, "../interface");
const IFRAME_SERVICE_SRC = path.resolve(
    import.meta.dirname,
    "../iframe-service/src/iframe-service.ts"
);

/**
 * Thunderbird's default Content Security Policy for extension pages (Manifest V2).
 * The add-on is served under it, so test against it here; in particular, `eval` and
 * `new Function` are blocked. The add-on's manifest currently loosens this with
 * `'unsafe-eval'`, which addons.thunderbird.net no longer accepts.
 */
const THUNDERBIRD_CSP = "script-src 'self'; object-src 'self';";

// In dev mode Vite and the React plugin inject inline scripts (e.g. for hot reloading).
// Vite tags them with this nonce, and the dev CSP allows only those inline scripts.
const DEV_NONCE = randomBytes(16).toString("base64");
const DEV_CSP = `script-src 'self' 'nonce-${DEV_NONCE}'; object-src 'self';`;

/**
 * A `viteStaticCopy` target that copies everything inside `dir` (including
 * subdirectories) into `dest`, without recreating the path to `dir` itself.
 */
function copyDirContents(dir: string, dest: string) {
    // `stripBase` counts the segments of the source path relative to this package,
    // ignoring leading `..` segments.
    const segments = path
        .relative(import.meta.dirname, dir)
        .split(path.sep)
        .filter((segment) => segment !== "..");
    return { src: dir, dest, rename: { stripBase: segments.length } };
}

/**
 * In dev mode, serve the interface package's source (with HMR) at `/interface/`
 * instead of copying its prebuilt `dist` folder.
 */
function interfaceDevServer(): Plugin {
    return {
        name: "mailmergep-interface-dev-server",
        apply: "serve",
        async configureServer(server) {
            server.middlewares.use((_req, res, next) => {
                res.setHeader("Content-Security-Policy", DEV_CSP);
                next();
            });
            const interfaceServer = await createServer({
                configFile: path.join(INTERFACE_ROOT, "vite.config.ts"),
                root: INTERFACE_ROOT,
                base: "/interface/",
                html: { cspNonce: DEV_NONCE },
                server: {
                    middlewareMode: true,
                    // Share our HTTP server for the interface's HMR websocket. The two websockets
                    // don't conflict because they are served on different base paths.
                    hmr: server.httpServer
                        ? { server: server.httpServer }
                        : undefined,
                },
            });
            // Only hand off `/interface/` requests; otherwise the interface's SPA fallback
            // would answer requests meant for this server.
            server.middlewares.use((req, res, next) => {
                if (req.url?.startsWith("/interface/")) {
                    interfaceServer.middlewares(req, res, next);
                } else {
                    next();
                }
            });
            server.httpServer?.once("close", () => interfaceServer.close());
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    base: "./",
    plugins: [
        interfaceDevServer(),
        command === "build" &&
            viteStaticCopy({
                targets: [
                    copyDirContents(
                        path.join(INTERFACE_ROOT, "dist"),
                        "interface"
                    ),
                ],
            }),
    ],
    resolve: {
        // Use the iframe-service source directly in dev so it doesn't need to be built first
        alias:
            command === "serve"
                ? { "@mailmergep/iframe-service": IFRAME_SERVICE_SRC }
                : undefined,
    },
    html: command === "serve" ? { cspNonce: DEV_NONCE } : undefined,
    // Listen on all interfaces so the server is reachable from outside the dev container
    server: { host: "0.0.0.0" },
    preview: {
        host: "0.0.0.0",
        headers: { "Content-Security-Policy": THUNDERBIRD_CSP },
    },
    build: {
        sourcemap: true,
        minify: true,
        rollupOptions: {
            output: {
                entryFileNames: `assets/[name].js`,
                chunkFileNames: `assets/[name].js`,
                assetFileNames: `assets/[name].[ext]`,
            },
        },
    },
}));
