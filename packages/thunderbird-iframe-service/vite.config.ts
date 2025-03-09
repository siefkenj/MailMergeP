import { defineConfig } from "vite";
// import { viteSingleFile } from "vite-plugin-singlefile";

// https://vitejs.dev/config/
export default defineConfig({
    //plugins: [viteSingleFile()],
    base: "./",
    build: {
        sourcemap: false,
        minify: false,
        rollupOptions: {
            input: {
                "thunderbird-iframe-server": "thunderbird-iframe-server.html"
            }
        },
        lib: {
            entry: "src/thunderbird-iframe-service.js",
            name: "thunderbirdIframeService",
            formats: ["es"],
        },
    },
});
