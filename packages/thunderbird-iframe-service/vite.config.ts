import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    build: {
        sourcemap: false,
        minify: false,
        rollupOptions: {
            input: {
                "thunderbird-iframe-server": "thunderbird-iframe-server.html",
            },
        },
        lib: {
            entry: "src/thunderbird-iframe-service.js",
            name: "thunderbirdIframeService",
            formats: ["es"],
        },
    },
});
