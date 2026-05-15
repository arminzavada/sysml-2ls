# Phase 0f — Final cleanup pass

Last phase of the 2026-03 upgrade arc. Audits idiomatic-Langium fit, workspace
shape, and comment discipline; preserves baseline behaviour (2133 passed /
8 skipped / 2141 total).

## Reference projects: idiomatic Langium 4.x impressions

Three references were inspected as baselines. Only one (`ase-labs`) actually
uses Langium on the npm side; the other two (`semantifyr`, `refinery`) are
JVM-first with TS shells. They were still useful for workspace shape and
toolchain pattern.

### `~/work/ftsrg-edu/ase-labs` — single-package Langium project

The canonical "Langium DI" file (`src/language/data-space-module.ts`) follows
the langium-cli–scaffolded template literally:

* `inject(createDefaultSharedModule(context), GeneratedSharedModule, customSharedModule)`
  for the shared module; `inject(createDefaultModule({ shared }), GeneratedModule, languageModule)`
  for each language module; `ServiceRegistry.register(language)` and
  `registerValidationChecks(language)` after construction.
* Scope provider, validator etc. extend `DefaultScopeProvider`,
  `DefaultValidator`, etc. — no vendored internals.
* `src/language/runner/lsp-server.ts` is six lines: `startLanguageServer(shared)`.

Sysml-2ls's `sysml-module.ts` matches this shape one-for-one; the extra
service additions (parser composition, metamodel builder, evaluator, etc.) are
all SysML-domain-specific and have no equivalent to compare against.

### `~/work/ftsrg/semantifyr` — multi-workspace TS shell idioms

The TS workspaces (`semantifyr-editor-common`, `semantifyr-vscode`,
`semantifyr-live/frontend`) demonstrate the modern multi-package shape:

* Each package has `package.json` with the same canonical scripts
  (`typecheck`, `lint`, `check`, `assemble`, `build`); the common `check` is
  `typecheck && lint`.
* Per-package `tsconfig.json` extends a root `tsconfig.base.json` with full
  strict settings (`strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `erasableSyntaxOnly`, `isolatedModules`,
  `useDefineForClassFields`).
* Per-package `tsconfig.json` is composite-build (`composite: true`,
  `declarationMap: true`, `incremental: true`) using `tsc -b` for the whole
  workspace.
* Per-package `eslint.config.js` is one line: `baseConfig({ tsconfigRootDir })`,
  delegating to a root `eslint.config.base.js` factory.
* `module: NodeNext` / `Node16`.

### `~/work/ftsrg/refinery`

Same TS shape as semantifyr's. Adds a TypeScript project-references diagram
across the BOM packages; sysml-2ls already does this via `tsconfig.build.json`.

### Impression vs sysml-2ls

* **Already on-grain**: DI wiring, `tsc -b` project references, ESLint v9 flat
  config, per-package strict TS, ESM modules. No vendored Langium internals;
  every customised service extends a `Default*` / `Abstract*` class.
* **Stricter-than-references would be churny**: semantifyr opts into
  `tseslint.configs.strictTypeChecked` and `stylisticTypeChecked` plus
  `exactOptionalPropertyTypes`. Sysml-2ls runs the non-type-checked recommended
  rule-set (see Phase 0e). Adopting type-checked lint would surface real but
  large-volume findings; it's already flagged in Phase 0e deferred and stays
  there.
* **Inherent complexity beyond the references**: 6-package workspace, custom
  parser postprocessing, metamodel builder/evaluator, SysML/KerML dual
  validators. None of the references model this domain; differences in
  complexity are justified.

## Idiomatic-Langium audit — changes

| File | Before | After |
| --- | --- | --- |
| `services/parser/parser.ts` | `SysMLParser`/`type SysMLParser` re-export alias (Langium 1.x compat) plus a deprecated JSDoc block | Removed. Re-export gone; consumers use `LangiumParser` directly. |
| `services/services.ts` | `parser.LangiumParser: SysMLParser` (alias type) | `parser.LangiumParser: LangiumParser` (direct Langium type). |
| `sysml-module.ts` | langium-cli scaffold doc blocks for `SysMLDefaultModule`, `createSysMLServices`, plus a `// handling for chain references` aside and a commented-out `RenameProvider` line | Removed. |
| `services/services.ts` | langium-cli scaffold doc blocks on `SysMLDefaultAddedServices`, `SysMLDefaultServices`, and an inline "locator and description provider should definitely be shared..." aside | Removed. |
| `services/parser/parser.ts` (createSysMLParser docstring) | Multi-paragraph "Composes SysML behaviour..." | Tightened to 4 lines explaining only the load-bearing ordering invariant. |

### Items reviewed and intentionally kept

| Item | Why kept |
| --- | --- |
| `services/shared/workspace/documents.ts` — lazy `MetamodelBuilder` getter | Comment documents an actual Langium DI cycle (`SysMLDocumentFactory → MetamodelBuilder → IndexManager → LangiumDocuments → LangiumDocumentFactory`). Removing the getter reintroduces the cycle at injector construction. Comment is the load-bearing context. |
| `utils/common.ts` — `sanitizeRange` | Defensive guard against CST ranges with `null` end values after a partial reparse. The original Langium 1.x quirk that motivated it may be fixed in 4.x, but the only way to verify is to remove and observe; risk surfaces only in incremental-reparse scenarios that aren't well covered by the test suite (`vitest run` parses each test in a fresh workspace). Conservative: keep with the existing one-line explanation. |
| `services/references/linker.ts` — three "TODO: fix in Langium" / "TODO: fix eager linking" | Reference real ongoing Langium-side quirks: `refInfo.container.$meta` can be unpopulated mid-link, `index` missing from eager linking, and a fallback for partial-state references in the `get ref()` accessor. No Langium 4.2.x release notes resolve these. |
| `services/parser/parser.ts` — `// (╯°□°)╯︵ ┻━┻` aside | Documents that `createEmptyParametersInTransitionUsage` exists because Langium doesn't allow linking to elements without AST nodes. Aside is colourful but the *information* (Langium constraint) is non-obvious from the code and worth a line. |

## Workspace / build / package.json simplifications

| Change | Files | Reason |
| --- | --- | --- |
| Removed `out/` from `clean` (no-esbuild packages) | `syside-base`, `syside-protocol`, `syside-languageclient` | These packages don't run esbuild; the `out/` reference was vestigial. |
| Removed `out/` from root `tsconfig.json` `exclude` | `tsconfig.json` | Root build never produces an `out/` directory; only the two esbuild'd packages do, and their own `tsconfig.json` excludes it. |
| Replaced `out` → `dist` in `syside-vscode/package.json` `files` and `clean` | `syside-vscode/package.json` | The package emits `dist/`, not `out/` — `out/` in `files` was incorrect and `clean` left `dist/` behind. |
| Fixed `syside-cli/package.json` `main` | `"./out/index.js"` → `"./lib/index.js"` | `out/` is only created during `prepack` (esbuild minify), not during default build. Consumers without `prepack` would get a broken entry point. The dual `bin/syside-languageserver`-style fallback still picks up the esbuild bundle when present. |
| Tightened per-package `tsconfig.test.json` `include` | `syside-base`, `syside-protocol`, `syside-cli`, `syside-languageclient` | Previously `["src/*.ts"]`, which matches only root-level files in `src/` — it never actually picked up `src/**/__tests__/**/*.ts`. The "test typecheck" pass was a no-op (it re-checked production code already covered by `tsconfig.json`). Now correctly scoped to `["src/**/__tests__/**/*.ts"]`. |
| Tidied `tsconfig.test.json` formatting | All five | Collapsed multi-line `references`/`compilerOptions` blocks, removed trailing commas. |
| Re-confirmed `out/` exclusion for `syside-languageserver` and `syside-cli` (which DO esbuild) | (no change, but verified) | Their `clean` and `files` correctly retain `out/`. |

### Items reviewed and intentionally kept

* **6-package workspace**: `syside-base`/`syside-protocol`/`syside-languageclient`/`syside-languageserver`/`syside-cli`/`syside-vscode`. Merging would conflate concerns: `syside-base` (pure utilities) vs `syside-protocol` (LSP additions, depends only on `vscode-languageserver`) vs `syside-languageclient` (client-only extras). Keeping them separate matches the publishing model (consumers can pull just the bits they need).
* **`tsconfig.build.json` shape**: 5-tuple of `tsconfig.json` + `tsconfig.test.json` per package matches the semantifyr `tsc -b` pattern. Tested chain compiles correctly.
* **Per-package `typecheck` script** (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json --noEmit`): now actually does something useful for the test config, post-include-fix.
* **`scripts/generate-index.mjs`** (root): used by the `pnpm run -r index` plus per-package `index` scripts. Not part of the default build, but a real authoring helper. Keep.
* **`bin/syside-languageserver` and `bin/syside`** (esbuild-bundle-first, lib-fallback): both still resolve correctly with the unchanged `out/` retention.

## Test-file fix (Vitest 3 deprecation warning)

`packages/syside-languageserver/src/node/__tests__/node-file-system-provider.test.ts`
had two `expect(p).resolves.toBe...` assertions returned from non-async `it`
callbacks. Vitest 3 prints a deprecation about hanging assertions ("will fail in
Vitest 3"). Adjusted both callsites to `await expect(...).resolves...` inside an
`async` callback.

This was the only such case across the suite.

## TODO / FIXME / HACK sweep

Tally:

```
$ grep -rnE "TODO|FIXME|XXX|HACK" packages/*/src --include='*.ts' | wc -l
before: 55
after:  55
```

Every remaining marker was reviewed; none are stale. Categories:

* **Spec uncertainties** (~10): "this part of chapter 7 may be wrong", "TODO:
  filter by visibility", etc. These are real SysML-spec questions tracked for
  future authoring work.
* **Future feature TODOs** (~25): metamodel typing improvements, semantic
  highlighting refinements, completion-provider enhancements. Not part of the
  Langium upgrade arc.
* **Real upstream-Langium TODOs** (~3): linker's "fix in Langium" markers
  describing AST/CST consistency issues during partial relink. Not resolved in
  Langium 4.2.x; leave with their existing comments.
* **Element redefinition spec notes** (~5): "isOrdered/name/shortName/typings
  can become stale if heritage changes" — known limitations of the current
  evaluator design, tracked.
* **Test-suite TODOs** (~5): "feel free to add more hover tests like the
  above", "implement filtering". Test-coverage gaps, not phase-relevant.

## Comment cleanup tally

Roughly ~50 lines of decorative / boilerplate doc-comment removed across:

* `sysml-module.ts`: 3 langium-cli scaffold docstrings (~20 lines) + one aside
  + one commented-out service line.
* `services/services.ts`: 2 langium-cli scaffold docstrings (~10 lines) + one
  type-doc aside.
* `services/parser/parser.ts`: deprecated `SysMLParser` alias docstring
  (~10 lines) + tightened `createSysMLParser` docstring (~6 lines net).
* `tsconfig.test.json` × 5: trailing commas, multi-line block collapse.

No comments explaining non-obvious behaviour were touched.

## Final verification

```
pnpm install              → ok (8.6s)
pnpm run grammar:generate → ok
pnpm test                 → Test Files 72 passed (72)
                            Tests 2133 passed | 8 skipped (2141)  ← baseline
pnpm run build            → ok (tsc -b + esbuild bundles, 0 warnings, 0 errors)
pnpm run lint             → 0 errors, 0 warnings (max-warnings 0)
```

Baseline preserved exactly. No SysML semantic changes.

## Deliberately left complicated (with reason)

| Thing | Reason |
| --- | --- |
| `SysMLDocumentFactory` lazy MetamodelBuilder getter | Closes a Langium-imposed DI cycle. Removing reintroduces a constructor-time ordering failure. |
| `sanitizeRange` helper + two call sites | Defensive against a Langium-1.x-era CST-range quirk. Verification of obsolescence in Langium 4.2.x would require a targeted incremental-reparse test the suite doesn't have. Conservative-keep. |
| `services/parser/parser.ts` postprocessing pipeline | Five SysML-specific AST shaping passes (operator-expression fix, while-loop member fill, import finalisation, transition-usage parameter creation, succession-as-usage ends) all required for downstream semantics. Documented in the function-level comment. |
| Three "TODO: fix in Langium" markers in `linker.ts` | Reference real Langium-4.2.x quirks. Workarounds are surgical. |
| Per-language `SysMLDefaultModule`/`SysMLModule`/`KerMLModule` split | SysML and KerML share most defaults but each contributes a different `ValidationRegistry` and validator. The split is the cleanest expression of that. |

## Retrospective on the Phase 0 arc (0a → 0f)

The codebase entered Phase 0a as a working SysML v2 LSP pinned to Langium 1.2,
Jest, CommonJS, ESLint 8 with `.eslintrc.json`, and `@types/node@14`. It now
sits on Langium 4.2, Vitest 3, ESM throughout, ESLint 9 flat config,
`@types/node@22`, and TypeScript 5.8 — with the same test suite passing
(2133/8/2141) end-to-end.

What future maintainers will find different:

* **Migration is now per-axis**, not all-at-once. Each phase isolated one
  upgrade axis (ESM, then each Langium minor, then Vitest, then deps). When the
  next Langium major lands (5.x), the same playbook applies: stop at the
  intermediate Langium release that introduces a breaking change, fix
  surgically, then move on.
* **Workarounds are documented at their site** with the upstream constraint
  they encode (DI cycle on `MetamodelBuilder`; AST/CST inconsistency in eager
  linking; `_ref`/`_nodeDescription` shape required by `DefaultLinker.doLink`).
  Nothing is "magic" anymore; each surviving non-idiomatic shape names the
  Langium-side reason.
* **The test suite is the safety net.** It's wired to baseline numbers
  explicitly checked at each phase boundary; deviating from 2133/8/2141 in any
  future PR is a signal, not a fact to be tolerated.
* **Idiomatic-Langium fit is now close.** What remains different from a
  greenfield Langium project is *only* domain complexity: SysML/KerML dual
  language wiring, the metamodel builder/evaluator, parser postprocessing for
  five SysML-specific AST shapes. None of these are leftover workarounds —
  each maps to a SysML language feature.
* **Toolchain is mainstream.** ESM + Vitest + ESLint flat config + Langium 4 +
  TypeScript 5.8 is what a 2026 Langium project would scaffold from scratch.
  The only deferred items are predictable: typescript 6, ESLint 10 RC, Vitest 4
  — each a deliberate future phase.

The biggest single quality jump was Phase 0a (ESM): without it, every later
phase would have fought against CommonJS-vs-ESM boundaries. The biggest single
risk-reduction was Phase 0d's switch back to compositional bootstrap
(`prepareLangiumParser` → wrap → `finalize`) — the previous override of
private internals would not have survived a Langium 5.x bump.

The biggest single surprise during Phase 0f: the per-package
`tsconfig.test.json` `include` pattern was wrong for *years* (matching only
root-level `src/*.ts`, not `src/**/__tests__/**/*.ts`). The "test typecheck"
script was a no-op, silently. Test files are now properly type-checked at the
typecheck script level, in addition to via Vitest at run-time.
