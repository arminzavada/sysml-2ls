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
        testTimeout: 10000,
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
                "packages/syside-languageserver/src/generated/**",
                "packages/syside-languageserver/src/node/main.ts",
            ],
            reporter: ["html", "text", "text-summary", "cobertura"],
            reportsDirectory: "coverage",
        },
    },
    resolve: {
        alias: {
            "syside-base": here("./packages/syside-base/src/index.ts"),
            "syside-protocol": here("./packages/syside-protocol/src/index.ts"),
            "syside-languageclient": here("./packages/syside-languageclient/src/index.ts"),
            "syside-languageserver/node.js": here("./packages/syside-languageserver/src/node/index.ts"),
            "syside-languageserver/node": here("./packages/syside-languageserver/src/node/index.ts"),
            "syside-languageserver": here("./packages/syside-languageserver/src/index.ts"),
        },
    },
});
