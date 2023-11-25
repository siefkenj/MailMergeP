import { defineConfig } from "vite";
import vts from "vite-plugin-dts"

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    plugins: [vts()],
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
