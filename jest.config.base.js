/** @type {import('@swc/core').Config} */
const swcConfig = {
    jsc: {
        parser: {
            syntax: "typescript",
            decorators: true,
        },
        target: "es2022",
        loose: false,
        externalHelpers: false,
        // Requires v1.2.50 or upper and requires target to be es2016 or upper.
        keepClassNames: false,
    },
    minify: false,
    // ESM source uses `import './foo.js'` (NodeNext rules). Jest runs under
    // CommonJS, so tell @swc/jest to emit CJS regardless of supportsStaticESM.
    module: {
        type: "commonjs",
    },
};

/** @type {import('jest').Config} */
// eslint-disable-next-line no-undef
module.exports = {
    transform: {
        "^.+\\.(t|j)sx?$": ["@swc/jest", swcConfig],
    },
    transformIgnorePatterns: ["<rootDir>/node_modules/"],
    testEnvironment: "node",
    testTimeout: 10000,
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.ts"],
    coveragePathIgnorePatterns: ["node_modules", "__tests__", "__test__", "testing"],
    coverageReporters: ["html", "text", "text-summary", "cobertura"],
    testRegex: "(\\.|/)(test|spec)\\.[jt]sx?$",
    // v3.0 is broken so disable it
    prettierPath: null,
    // ESM-style relative imports include the `.js` extension. Jest still
    // resolves to the underlying TS source, so strip the extension first.
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
        // Resolve workspace packages straight to source so we don't depend on
        // the built `lib/` output (which is ESM under "type": "module").
        "^syside-base$": "<rootDir>/../syside-base/src/index.ts",
        "^syside-base/(.*)$": "<rootDir>/../syside-base/src/$1",
        "^syside-protocol$": "<rootDir>/../syside-protocol/src/index.ts",
        "^syside-protocol/(.*)$": "<rootDir>/../syside-protocol/src/$1",
        "^syside-languageclient$": "<rootDir>/../syside-languageclient/src/index.ts",
        "^syside-languageclient/(.*)$": "<rootDir>/../syside-languageclient/src/$1",
        "^syside-languageserver$": "<rootDir>/../syside-languageserver/src/index.ts",
        // Convenience subpath `syside-languageserver/node` exposes
        // `src/node/index.ts` via the top-level `node.js` re-export shim.
        "^syside-languageserver/node\\.js$": "<rootDir>/../syside-languageserver/src/node/index.ts",
        "^syside-languageserver/node$": "<rootDir>/../syside-languageserver/src/node/index.ts",
        "^syside-languageserver/(.*)$": "<rootDir>/../syside-languageserver/src/$1",
    },
};
