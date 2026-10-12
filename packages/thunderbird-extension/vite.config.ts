import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import path from "node:path";

const IFRAME_DIR = path.dirname(
    require.resolve("@mailmergep/thunderbird-iframe-service/thunderbird-iframe-server.html")
);
const INTERFACE_DIR = path.dirname(
    require.resolve("@mailmergep/interface/index.html")
);

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
 * A `viteStaticCopy` transform that leaves out source maps, and the comments that
 * point to them, to keep the add-on small.
 */
const withoutSourceMaps = {
    encoding: "buffer" as const,
    handler: (content: Buffer, filename: string) => {
        if (filename.endsWith(".map")) {
            return null;
        }
        if (filename.endsWith(".js") || filename.endsWith(".css")) {
            return Buffer.from(
                content
                    .toString("utf8")
                    .replace(
                        /\n\/[/*]# sourceMappingURL=\S+(?: \*\/)?\s*$/,
                        "\n"
                    )
            );
        }
        return content;
    },
};

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    plugins: [
        viteStaticCopy({
            targets: [
                copyDirContents(IFRAME_DIR, "content"),
                {
                    ...copyDirContents(INTERFACE_DIR, "content/interface"),
                    transform: withoutSourceMaps,
                },
            ],
        }),
    ],

    build: {
        sourcemap: false,
        minify: false,
        lib: {
            entry: "src/background.js",
            name: "background",
            formats: ["es"],
        },
        rollupOptions: {
            output: {
                entryFileNames: `content/[name].js`,
                chunkFileNames: `content/[name].js`,
                assetFileNames: `content/[name].[ext]`,
            },
        },
    },
});
