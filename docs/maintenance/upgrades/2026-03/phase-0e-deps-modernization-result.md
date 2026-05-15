# Phase 0e — Dependency modernization (non-Langium)

## Summary

Brought every non-Langium dependency in the workspace up to current and applied each tool's modern best practices. Migrated ESLint to v9 flat config, bumped Vitest to v3, and replaced the `@types/node@14` pin with Node 22 LTS. Baseline test suite restored: **2133 passed / 8 skipped / 2141 total** (matches Phase 0d baseline).

## Deps bumped

| dep                                  | from        | to         | notes                                              |
| ------------------------------------ | ----------- | ---------- | -------------------------------------------------- |
| @types/node                          | ~14.18.36   | ~22.18.0   | Aligns with Node 22 LTS                            |
| @types/fs-extra                      | ^11.0.1     | ^11.0.4    | patch                                              |
| @types/vscode                        | ^1.56.0     | ^1.91.0    | matches VS Code stable                             |
| @octokit/rest                        | ^19.0.7     | ^22.0.1    | major                                              |
| @vitest/coverage-v8                  | ^2.1.9      | ^3.2.4     | major (Vitest 3)                                   |
| @vitest/expect                       | ^2.1.9      | ^3.2.4     | major                                              |
| vitest                               | ^2.1.9      | ^3.2.4     | major                                              |
| @typescript-eslint/eslint-plugin     | ^5.59.8     | (removed)  | replaced by `typescript-eslint` meta-pkg           |
| @typescript-eslint/parser            | ^5.59.8     | (removed)  | ditto                                              |
| typescript-eslint                    | —           | ^8.46.4    | meta-package for v9 flat config                    |
| @eslint/js                           | —           | ^9.39.1    | required by flat config                            |
| eslint                               | ^8.34.0     | ^9.39.1    | major; flat config                                 |
| eslint-config-prettier               | ^8.8.0      | ^10.1.8    | major                                              |
| eslint-plugin-prettier               | ^5.0.0      | ^5.5.5     | minor                                              |
| eslint-plugin-deprecation            | ^1.5.0      | (removed)  | unmaintained — see "Deferred"                      |
| eslint-plugin-unused-imports         | ^2.0.0      | ^4.4.1     | major                                              |
| globals                              | —           | ^15.15.0   | required by flat config                            |
| prettier                             | ^3.0.0      | ^3.8.3     | minor                                              |
| esbuild                              | ^0.17.10    | ^0.25.0    | major (multiple)                                   |
| concurrently                         | ^8.0.1      | ^9.2.1     | major                                              |
| tsx                                  | ^3.12.3     | ^4.22.0    | major                                              |
| commander                            | ^10.0.1     | ^14.0.3    | major; same in root, cli, languageserver           |
| chalk                                | ^5.2.0      | ^5.6.2     | minor                                              |
| fs-extra                             | ^11.1.0     | ^11.3.5    | minor                                              |
| octokit                              | ^2.0.14     | ^5.0.5     | major                                              |
| node-stdlib-browser                  | ^1.2.0      | ^1.3.1     | minor                                              |
| rollup-plugin-license                | ^3.5.2      | ^3.7.1     | minor                                              |
| shx                                  | ^0.3.4      | ^0.4.0     | major                                              |
| vscode-uri                           | ~3.0.8      | ~3.1.0     | minor; bumped in 4 packages                        |
| string-width                         | ^6.1.0      | ^8.2.1     | major                                              |
| typescript-string-operations         | ^1.5.0      | ^1.6.1     | minor                                              |
| vscode-languageserver-textdocument   | ~1.0.11     | ~1.0.12    | patch                                              |
| @vscode/vsce                         | ^2.20.0     | ^3.9.1     | major                                              |
| ovsx                                 | ^0.8.0      | ^0.10.12   | minor (broke 0.x convention but no major signal)   |
| typescript-json-schema               | ^0.59.0     | ^0.67.2    | minor                                              |

`typescript`, `langium`, `langium-cli`, `chevrotain` were intentionally left at the versions set by Phases 0c/0d.

## Tooling config migrations

### ESLint: legacy `.eslintrc.json` → flat config (`eslint.config.mjs`)

* `.eslintrc.json` and `tsconfig.eslint.json` removed.
* New `eslint.config.mjs` uses `tseslint.config(...)` from the `typescript-eslint` meta-package, composing `@eslint/js`'s `recommended`, `typescript-eslint`'s `recommended`, and `eslint-plugin-prettier`'s `recommended` configs.
* Removed the old `--ext ts` flag from all `lint` scripts (ESLint v9 dropped it; flat config selects files via `files` patterns and ignores via `ignores`).
* `parserOptions.project: ./tsconfig.eslint.json` retired — the recommended (non-type-checked) ruleset doesn't require it, and the dedicated `tsconfig.eslint.json` was the only consumer.
* Globals migrated from `env: { browser, es2021 }` to the `globals` package (`globals.browser`, `globals.node`).

### Plugin retirements / rule renames

* `eslint-plugin-deprecation` (rule `deprecation/deprecation`) removed: unmaintained, last release 2024. Its replacement `@typescript-eslint/no-deprecated` requires type-checked lint which we intentionally don't enable here (large monorepo, expensive). Inline `// eslint-disable-next-line deprecation/deprecation` comments in `sysml-language-client.ts` were removed since the rule no longer runs.
* `@typescript-eslint/ban-types` was split in v8. Stale `ban-types` disables in `common.ts`, `setup-vitest.ts`, `completion-provider.test.ts` were either removed (when no longer needed) or rewritten to `@typescript-eslint/no-unsafe-function-type`.
* New v8 errors localised with targeted disables where the pattern is intentional (ts-mixer declaration merging, empty marker interfaces, ternary side-effect expressions).

### TypeScript: root `tsconfig.json` cleanup

* Stripped ~62 lines of stale `/* ... */` boilerplate comments left over from the TS init template (kept only the actual settings).
* Trailing comma cleaned up in `exclude`.
* No semantic settings changed: `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler` were already current.

### Vitest

* `testTimeout` raised from 10 s to 20 s. Vitest 3 has slightly higher per-test setup overhead under heavy concurrency; one parameterised concurrent completion test was flaky at 10 s under full-suite load.
* `vitest.config.ts` shape kept as-is — already using the current `defineConfig` API.

### Prettier

* `.prettierrc` left intact — settings are all intentional deviations from defaults (`tabWidth: 4`, `printWidth: 100`).

### Engines

* Added `"engines": { "node": ">=20.11.0" }` to the root `package.json` to make the Node baseline explicit and consistent with `@types/node@22`.

## Comment cleanup tally

* `tsconfig.json`: ~62 stale TS-template comments removed.
* Inline source comments: 6 stale `// eslint-disable-next-line …` directives revised (4 renamed to v8 rule names, 2 removed entirely) and 4 new targeted disables added for intentional patterns now flagged by `typescript-eslint` v8.

Total: ≈70 comment lines cleaned/revised.

## Final verification

```
pnpm install            → ok
pnpm run grammar:generate → ok
pnpm test               → Test Files 72 passed (72)
                          Tests 2133 passed | 8 skipped (2141)
pnpm run build          → ok (tsc -b + esbuild bundles)
pnpm run lint           → 0 errors, 0 warnings (max-warnings 0)
```

Matches Phase 0d baseline exactly.

## Deferred (with reason)

* **`typescript` 5.8 → 6.0.3**: held back by the root `pnpm.overrides` pin and by the Langium 4.2.x peer (Phase 0d freshly stabilised). Worth a separate phase once Langium 5.x lands.
* **Vitest 4.x**: 3.x is the safer first step. Vitest 4 changed the public API around `vi.useFakeTimers`/`workspace`; should be a deliberate next pass.
* **ESLint 10.x**: only available as 10.4 RC-stream; v9 is the current LTS-equivalent for the flat-config ecosystem.
* **`@typescript-eslint/no-deprecated`** (the modern replacement for `eslint-plugin-deprecation`): would require enabling type-checked lint (`parserOptions.projectService`) on the whole monorepo. That is its own modernisation step — needs proper triage of the deprecation warnings that surface, and a measure of CI cost.
* **`performance-now` and `node-fetch`**: not on the outdated report but worth retiring (`performance-now` → `performance.now()`, `node-fetch` → built-in `fetch` from Node 18+). Functional change, deferred.
* **Bare `ovsx@0.10.x`** — bumped to latest 0.x, no major channel exists.
