import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default tseslint.config(
    {
        ignores: [
            "**/generated/**",
            "**/lib/**",
            "**/out/**",
            "**/dist/**",
            "**/scripts/**",
            "**/coverage/**",
            "**/node_modules/**",
            "**/syntaxes/**",
            "**/*.cjs",
            "**/*.mjs",
            "**/*.js",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettierRecommended,
    {
        plugins: {
            "unused-imports": unusedImports,
        },
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            semi: ["error", "always"],
            "no-multi-spaces": ["error"],
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/explicit-function-return-type": "off",
        },
    },
    {
        files: ["**/*.ts", "**/*.mts", "**/*.cts", "**/*.tsx"],
        rules: {
            "@typescript-eslint/explicit-function-return-type": "warn",
        },
    },
);
