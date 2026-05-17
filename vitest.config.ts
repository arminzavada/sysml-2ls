import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: [
            "packages/syside-base/src/**/*.{test,spec}.ts",
            "packages/syside-cli/src/**/*.{test,spec}.ts",
            "packages/syside-languageclient/src/**/*.{test,spec}.ts",
            "packages/syside-languageserver/src/**/*.{test,spec}.ts",
            "packages/syside-protocol/src/**/*.{test,spec}.ts",
        ],
        testTimeout: 20000,
        setupFiles: ["packages/syside-languageserver/src/testing/setup-vitest.ts"],
        coverage: {
            provider: "v8",
            include: [
                "packages/syside-base/src/**/*.ts",
                "packages/syside-cli/src/**/*.ts",
                "packages/syside-languageclient/src/**/*.ts",
                "packages/syside-languageserver/src/**/*.ts",
                "packages/syside-protocol/src/**/*.ts",
            ],
            exclude: [
                "**/node_modules/**",
                "**/__tests__/**",
                "**/__test__/**",
                "**/testing/**",
                "packages/syside-languageserver/gen/**",
                "packages/syside-languageserver/src/node/main.ts",
            ],
            reporter: ["html", "text", "text-summary", "cobertura"],
            reportsDirectory: "coverage",
        },
    },
    resolve: {
        alias: [
            {
                find: /^#generated\/(.*)\.js$/,
                replacement: here("./packages/syside-languageserver/gen/$1.ts"),
            },
            { find: "syside-base", replacement: here("./packages/syside-base/src/index.ts") },
            { find: "syside-protocol", replacement: here("./packages/syside-protocol/src/index.ts") },
            {
                find: "syside-languageclient",
                replacement: here("./packages/syside-languageclient/src/index.ts"),
            },
            {
                find: "syside-languageserver/node.js",
                replacement: here("./packages/syside-languageserver/src/node/index.ts"),
            },
            {
                find: "syside-languageserver/node",
                replacement: here("./packages/syside-languageserver/src/node/index.ts"),
            },
            {
                find: "syside-languageserver",
                replacement: here("./packages/syside-languageserver/src/index.ts"),
            },
        ],
    },
});
