import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Match Thunderbird's Content Security Policy, which blocks eval() and new Function()
        execArgv: ["--disallow-code-generation-from-strings"],
    },
});
