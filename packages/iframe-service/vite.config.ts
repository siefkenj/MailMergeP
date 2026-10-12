import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    build: {
        sourcemap: true,
        minify: false,
        lib: {
            entry: "src/iframe-service.ts",
            name: "iframeService",
            formats: ["es"],
        },
    },
});
