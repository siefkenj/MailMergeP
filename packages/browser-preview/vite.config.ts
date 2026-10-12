import { createServer, defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import viteTsconfigPaths from "vite-tsconfig-paths";
import svgrPlugin from "vite-plugin-svgr";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "node:path";

const INTERFACE_ROOT = path.resolve(__dirname, "../interface");
const IFRAME_SERVICE_SRC = path.resolve(
    __dirname,
    "../iframe-service/src/iframe-service.ts"
);

/**
 * In dev mode, serve the interface package's source (with HMR) at `/interface/`
 * instead of copying its prebuilt `dist` folder.
 */
function interfaceDevServer(): Plugin {
    return {
        name: "mailmergep-interface-dev-server",
        apply: "serve",
        async configureServer(server) {
            const interfaceServer = await createServer({
                configFile: path.join(INTERFACE_ROOT, "vite.config.ts"),
                root: INTERFACE_ROOT,
                base: "/interface/",
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
        react(),
        viteTsconfigPaths(),
        svgrPlugin(),
        interfaceDevServer(),
        command === "build" &&
            viteStaticCopy({
                targets: [
                    {
                        src: path.join(INTERFACE_ROOT, "dist/*"),
                        dest: "interface",
                    },
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
    // Listen on all interfaces so the server is reachable from outside the dev container
    server: { host: "0.0.0.0" },
    preview: { host: "0.0.0.0" },
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
