# Jest 30 → Vitest migration results

Status: **baseline reached**. **72 / 72 test files green, 2133 passed / 8 skipped (2141 total)** under `pnpm test` (which now runs `vitest run`). Net regression vs. Phase 0b: **0**. All Jest-specific shims retired.

## Final versions

| Package                              | Phase 0b     | Now         |
| ------------------------------------ | ------------ | ----------- |
| `jest` (+ siblings)                  | `^30.0.0`    | removed     |
| `@jest/expect-utils`                 | `^30.0.0`    | removed     |
| `@jest/globals`                      | `^30.0.0`    | removed     |
| `@swc/jest`                          | `^0.2.39`    | removed     |
| `@swc/core`                          | `^1.3.35`    | removed     |
| `@types/jest`                        | `^30.0.0`    | removed     |
| `expect`                             | `^30.0.0`    | removed     |
| `jest-junit`                         | `^16.0.0`    | removed     |
| `jest-matcher-utils`                 | `^30.0.0`    | removed     |
| `jest-snapshot`                      | `^30.0.0`    | removed     |
| `resolve.exports`                    | `^2.0.3`     | removed     |
| `vitest`                             | —            | `^2.1.9`    |
| `@vitest/coverage-v8`                | —            | `^2.1.9`    |
| `@vitest/expect`                     | —            | `^2.1.9`    |

Vitest 2.x chosen over 3.x/4.x because `@types/node@^14.18.36` (the project's pinned version) doesn't satisfy 3.x/4.x's `@types/node ^18.0.0 || ^20.0.0 || >=22.0.0` peer constraint. Install proceeded with a peer warning; runtime is unaffected (Node 22 in this dev env). Upgrading `@types/node` is a separate axis.

## Removed Jest-specific files / shims

| Path                                                 | What it was                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `jest.config.base.js`                                | Workspace-shared Jest config (SWC transform + ESM allowlist + custom resolver + module name mapper). |
| `jest.config.js`                                     | Root Jest projects aggregator.                                                                       |
| `jest.resolver.cjs`                                  | Custom Jest resolver bridging Jest's CJS loader to ESM-only `package.json#exports` for Langium 2.x + parser stack. |
| `packages/{base,cli,languageclient,languageserver,protocol}/jest.config.cjs` | Per-package configs that just spread the base.                                                       |
| `packages/syside-languageserver/src/testing/setup-jest.ts` | Custom matcher setup that imported from `@jest/globals`, `@jest/expect-utils`, `jest-matcher-utils`, `jest-snapshot`. |

The `transformIgnorePatterns` ESM-package allowlist, the `moduleNameMapper` workspace-source aliases, and the `prettierPath: null` workaround are all retired — Vite's loader handles them natively or doesn't need them.

## New Vitest config structure

**Single workspace config** at `vitest.config.ts` covers all five test-running packages (base, cli, languageclient, languageserver, protocol). Per-package configs aren't needed — there were no per-package divergences in the old Jest setup except for languageserver's setup file, which is now in the root config's `setupFiles`. `syside-vscode` continues to be excluded from test/coverage scope.

`globals: true` is enabled, so `describe`/`it`/`expect`/`vi`/`beforeAll`/etc. remain free globals — minimum-churn rewrite (option (a) from the brief). Vitest's type globals are pulled in via `"types": ["vitest/globals"]` in each `tsconfig.test.json` (replacing `"jest"`).

Workspace-source resolution (the old `moduleNameMapper` block in `jest.config.base.js`) is mirrored via `resolve.alias` for the four cross-package imports (`syside-base`, `syside-protocol`, `syside-languageclient`, `syside-languageserver` + its `/node` subpath).

## Test API translation summary

| Pattern                                    | Count | Replacement                                          |
| ------------------------------------------ | ----- | ---------------------------------------------------- |
| `jest.fn`                                  | 27    | `vi.fn`                                              |
| `jest.JestMatchers<T>`                     | 27    | `Assertion<T>` (imported from `"vitest"`)            |
| `jest.Mock`                                | 3     | `Mock` (imported from `"vitest"`)                    |
| `jest.Expect`                              | 2     | `ExpectStatic` (imported from `"vitest"`)            |
| `import { expect } from "@jest/globals"`   | 2     | `import { expect } from "vitest"`                    |
| `test.failing` / `describe.failing`        | 7     | `test.fails` / `describe.fails` (vitest's idiom)     |

`vi` and the type imports were added explicitly at the top of each affected file; the global `vi` is also available courtesy of `globals: true`, but explicit imports made the test-file changes self-contained and didn't require relying on the global for types like `Mock`, `Assertion`, `ExpectStatic`.

The custom `toParseKerML` / `toParseSysML` matchers in `setup-vitest.ts` (renamed from `setup-jest.ts`) were rewritten to use `expect.extend` from `vitest` plus `getObjectSubset` from `@vitest/expect`. `printWithType` and `matcherErrorMessage` from `jest-matcher-utils` were inlined as small helpers (~10 LOC) since `@vitest/utils` / `@vitest/expect` doesn't expose them. The `declare global namespace jest` augmentation became `declare module "vitest" { interface Assertion<T> extends CustomMatchers<T> }`.

## Compatibility issues encountered

1. **`test.failing` → `test.fails`.** Vitest 2.x renamed the API. Straight substitution across 4 test files.

2. **`toMatchInlineSnapshot` not allowed inside `test.each` / `describe.each`.** Vitest refuses to update inline snapshots inside loops because the source file would end up inconsistent across iterations. One affected snapshot (`connectors.test.ts > %s item flows > should print succession item flow`) was converted from `toMatchInlineSnapshot` to a plain `toEqual` against the same string literal — the snapshot value didn't actually vary across the two `describe.each` rows.

3. **`toThrowErrorMatchingInlineSnapshot` format difference.** Jest stringifies thrown errors as their `.message`; Vitest stringifies them as `[Error: message]`. One affected inline snapshot was updated to match Vitest's format.

4. **`Assertion<T>` is stricter than `JestMatchers<T>`.** Two helpers (`expectModelValidations` in kerml-validator.test.ts and sysml-validator.test.ts, plus `expectOwningType` in sysml-validator.test.ts) returned `Assertion<ModelDiagnostic[]>` but the value passed to `expect()` was actually a `Promise<ModelDiagnostic[]>`. Vitest's TS surface caught what Jest's loose `JestMatchers<>` had hidden. Return types corrected to `Assertion<Promise<ModelDiagnostic[]>>`.

5. **Vitest's `test.each` callback type is strict `(...args) => Awaitable<void>`.** Several `test.each(...)` callbacks were of the form `async (...) => { return expect(...).toParseKerML(...); }`. The returned `Promise<string>` (from the async matcher) fails Vitest's `void`-return constraint. `return expect(...)` → `await expect(...)` across 12 occurrences in 7 files. This is the typical Vitest idiom anyway.

6. **`@swc/jest` `__dirname` shim no longer relevant.** Three files had a `currentDir` / `currentFile` rename done specifically to avoid colliding with `@swc/jest`'s re-injected CJS `__dirname` global. Vitest doesn't re-inject CJS globals (it's ESM-native via Vite), so the rename is no longer load-bearing. The comments referring to `@swc/jest` were retired:
   - `packages/syside-languageserver/src/services/shared/__tests__/extension-manager.test.ts`
   - `packages/syside-languageserver/src/testing/server-initialize-params.ts`
   - `packages/syside-languageserver/src/node/__tests__/node-file-system-provider.test.ts`

   The variable name `currentDir` was kept for readability; the comment justifying it was deleted (per comment discipline — the code is self-explanatory).

   `packages/syside-languageserver/src/node/node-file-system-provider.ts` still keeps the `__dirname` fallback, but only for the esbuild-CJS-bundling case (which sets `import.meta.url` to empty). The `@swc/jest` half of the comment was retired.

7. **Snapshot file format.** Vitest reads Jest-produced `.snap` files. The format header (`// Vitest Snapshot v1, ...` vs `// Jest Snapshot v1, ...`) gets rewritten the first time Vitest touches the file. Test names use ` > ` as the describe/it separator in Vitest; the only place this mattered was `printer/__tests__/__snapshots__/utils.test.ts.snap` where 2 of the 4 entries used the old Jest separator (a space); those obsolete entries were deleted manually.

## Pre-existing issues surfaced (not addressed)

- **8 instances of `expect(...).resolves.toBe…()` not awaited.** Vitest 2.x auto-awaits but emits a warning; Vitest 3 will fail. Pre-existing test bugs (would also have hidden rejection failures under Jest). Out of scope for this migration; flag for Phase 0c sweep.
- **ESLint config conflict between worktree and parent.** Both share the same `@typescript-eslint` plugin install path; the worktree's local `node_modules` and the parent's both resolve it. Pre-existing worktree-setup issue.

## Coverage shape

Coverage HTML, text, text-summary, and cobertura reporters all produce equivalent shape to Jest's output. `coverage/cobertura-coverage.xml` is the same path the GitLab CI config consumes. `junit.xml` is produced at the root for `test:ci`.

Final coverage: 88.63% statements / 88.96% branches / 85.81% functions / 88.63% lines (vs. the Jest baseline which produced equivalent percentages — V8 vs. Istanbul instrumentation can differ slightly on branch coverage, no material change here).

## CI configuration

`.gitlab-ci.yml`'s `test:ci` invocation continues to work: `pnpm run test:ci` now runs `vitest run --passWithNoTests --coverage --reporter=default --reporter=junit --outputFile=junit.xml`. The same `coverage/cobertura-coverage.xml` and root `junit.xml` artifacts are produced.

## Test results

| Stage                       | Test Files | Tests       |
| --------------------------- | ---------- | ----------- |
| Phase 0b baseline (Jest 30) | 72 / 72    | 2133 passed / 8 skipped / 67 snapshots |
| First Vitest run            | 66 / 72    | 1964 passed / 8 skipped (3 failures, 4 collect errors) |
| After API translation       | 72 / 72    | 2133 passed / 8 skipped |
| **Final**                   | **72 / 72** | **2133 passed / 8 skipped** |

Snapshot count is harder to read off Vitest's default reporter (no "Snapshots: 67 passed" line). All inline + file snapshots succeed (no obsolete warnings after cleanup, no written/updated entries).

## Time taken

About 1 hour 45 minutes of focused work.

Rough breakdown:
- Survey + plan (read all jest configs, count API usages, decide single-vs-multi config): ~15 min.
- Initial vitest config + setup-vitest.ts rewrite + bulk `jest.* → vi.*` / `Assertion<>` substitutions + import additions: ~30 min.
- First test run + fixing `test.failing`, inline-snapshot-in-each, error-format snapshot: ~15 min.
- Typecheck pass + fixing strict `Assertion<>` return types + `Awaitable<void>` callback errors: ~30 min.
- Final sweep (config scope tightening, obsolete-snapshot cleanup, writeup): ~15 min.

## Confidence assessment for Phase 0c (Langium 2.x → 3.x)

**Cleaner test infra makes Phase 0c easier**, but only modestly. The main wins:

- No more `jest.resolver.cjs` / `transformIgnorePatterns` to maintain when Langium 3.x's ESM exports shape changes again. Vite's resolver handles ESM exports natively.
- No more `@swc/jest` transform layer in the dependency chain. SWC was an indirection that occasionally surprised under Jest 30 (the `customExportConditions` interaction with `synckit`). Vite doesn't transform `node_modules` JS by default.
- Test API surface is now mostly the same as Jest's, so any future API moves in Vitest are straightforward (the project relies on `expect`, `describe`, `it`, `test`, `test.each`, `vi.fn`, snapshots — all stable).

The migration didn't expose any latent Langium-coupling problems in the test runner — the issues that surfaced (strict types in `Assertion<>`, the `Awaitable<void>` `each` callback rule) were generic Vitest-vs-Jest semantics that would have hit any TS-typed test suite.

**Confidence: slightly higher than going into Phase 0c with the Jest setup.** The mechanism for bridging future ESM-only deps is "let Vite handle it", which is more durable than "extend the custom resolver allowlist". If Langium 3.x adds new ESM transitives that break Vitest's resolution, the fix surface will be smaller than the old jest.resolver.cjs.

Concrete Phase-0c-relevant note: Vitest's `globals: true` keeps the Jest-shaped test files unchanged, so an upgrade across Langium versions won't force a parallel test-API churn. The `setup-vitest.ts` custom matcher is the only place tightly coupled to vitest internals (`MatcherState`, `getObjectSubset` from `@vitest/expect`); if Vitest 4.x's expect API changes, that file needs re-validation.
