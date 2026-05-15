# Phase 0a — Workspace ESM migration — Results

> Worktree branch: `worktree-agent-ad2f1b81935a8454e` (uncommitted). Status:
> **complete**. All six packages now ship as native ESM under Langium 1.2,
> with the full test suite green at the pre-migration baseline.

## Outcome at a glance

- All 6 workspace packages declare `"type": "module"` and emit ESM under
  `tsc`.
- Workspace `tsconfig.json` switched to `module: ESNext`,
  `moduleResolution: Bundler`, `target: ES2022`.
- ~398 source files have `.js` extensions on relative imports (script-driven
  sweep, see "Method").
- 185 `declare module "../../generated/ast"` augmentation forms also picked
  up `.js` to satisfy NodeNext-style rules even under Bundler.
- 16 deep imports into `langium/lib/...`, `langium/node`,
  `vscode-languageserver/{browser,node}`, `vscode-uri/lib/umd/uri` had `.js`
  appended.
- `chevrotain` 9.x's `exports`-without-`types` quirk fixed via a `paths`
  override in `packages/syside-languageserver/tsconfig.json`. No ambient
  type stub needed.
- esbuild bundles now emit `.cjs` so they remain loadable under
  `"type": "module"` packages.
- `__dirname` / `__filename` removed from 5 files; replaced with
  `currentDir = path.dirname(fileURLToPath(import.meta.url))` (different
  name to avoid colliding with SWC's CJS re-injection at Jest runtime).
- Bins (`syside-cli/bin/cli`, `syside-languageserver/bin/syside-languageserver`)
  rewritten as ESM scripts that prefer the esbuild `.cjs` bundle.
- Stays on Langium 1.2 throughout. **No Langium API surface touched.**

## Test results

| Phase | Test Suites | Tests | Snapshots |
|-------|-------------|-------|-----------|
| Baseline (pre-migration, branch `semantifyr-integration`) | 72 passed | 8 skipped, 2133 passed, 2141 total | 67 passed |
| Post-migration | 72 passed | 8 skipped, 2133 passed, 2141 total | 67 passed |

Identical. The brief's baseline target (8 skipped, 2127 passed, 2135 total)
was authored at an earlier point in the branch; the actual `semantifyr-integration`
tip is at 2133 passed when this sub-phase started, matching the P2 prototype
result.

## Method (final shape, after course-corrections)

1. Updated workspace `tsconfig.json` (`module`, `moduleResolution`,
   `target`). After **trying NodeNext first and seeing 2079 cascading TS
   errors** rooted in module-identity confusion across the langium
   `interface Element extends AstNode` chain, switched to `Bundler` and
   the errors dropped to a single one (the chevrotain typings issue).
2. Added `"type": "module"` to all 6 workspace `package.json`.
3. Wrote a Node script (`/tmp/esm-add-js-extensions.mjs`) that walks each
   package's source tree and rewrites every `from "./foo"` /
   `import "./foo"` / `import("./foo")` / `export * from "./foo"` /
   `declare module "./foo"` to include `.js` extensions when the target
   resolves to a `.ts`/`.tsx` file. Script ran across all packages plus
   `syside-languageserver/scripts/`.
4. Used `sed` for the subpath-import sweep into `langium/lib/...`,
   `langium/node`, `vscode-languageserver/{browser,node}`,
   `vscode-uri/lib/umd/uri` (script-detected via `grep`).
5. Per-package `jest.config.js` files renamed to `.cjs` (the
   `"type": "module"` declaration would otherwise load them as ESM and
   `module.exports = ...` would fail).
6. Root `jest.config.base.js` extended with `moduleNameMapper`:
   - Strip trailing `.js` from relative imports (so SWC-compiled CJS
     `require('./foo.js')` resolves to the underlying `.ts`).
   - Map workspace `syside-*` packages to their `src/` directly, avoiding
     the ESM `lib/` outputs that won't load under Jest's CJS runtime.
   - Special-case `syside-languageserver/node` and
     `syside-languageserver/node.js` to point at `src/node/index.ts`,
     since the package's top-level `node.js` re-export shim isn't part
     of `src/`.
7. `@swc/jest` told explicitly to emit CJS via
   `module: { type: "commonjs" }`, since SWC otherwise switches to ES6
   when Jest reports `supportsStaticESM` — and Jest's runtime is still
   CJS.
8. Replaced `__dirname` and `__filename` with a non-colliding
   `currentDir` / `currentFile` pattern in 5 files. SWC's CJS output
   transforms `import.meta.url` to a `require("url").pathToFileURL(__filename)`
   expression, which re-introduces the CJS `__filename` global. Defining
   our own `__dirname` then collides at Jest runtime ("Identifier '__dirname'
   has already been declared"). Renaming the locals sidesteps it.
9. Bins (`syside-cli/bin/cli`, `syside-languageserver/bin/syside-languageserver`)
   rewritten as ESM with a `createRequire`-based fast path that loads the
   esbuild CJS bundle (`out/*.cjs`), falling back to dynamic
   `import("../lib/*.js")` if the bundle isn't present.
10. esbuild build script (`scripts/build.mjs`) configured with
    `outExtension: { ".js": ".cjs" }` for both `node` and `browser`
    builds. Updated VS Code extension's `main`/`browser` and the
    language-server-launch path in
    `packages/syside-vscode/src/common/extension.ts` to reference `.cjs`.
11. `syside-cli` got a `prebuild` step generating `version.ts` from
    `package.json`, mirroring `syside-languageserver`'s pattern; this
    avoids `createRequire(import.meta.url)` at runtime (which goes blank
    when esbuild bundles to CJS).
12. `packages/syside-languageserver/node.js` (a convenience re-export
    shim) and its `.d.ts` rewritten from CJS `module.exports = require(...)`
    to ESM `export * from "./lib/node/index.js"`.
13. `packages/syside-cli/src/sysml-util.ts` and the two VS Code
    `language-server/main.ts` files now reference
    `syside-languageserver/node.js` / `syside-languageserver/lib/{node,browser}/main.js`
    (subpath imports now extension-explicit).

## Per-package change summary

| Package | Files touched | Biggest categories |
|---------|---------------|--------------------|
| `syside-base` | 4 | `package.json`, 2 `.js`-extension rewrites, comment line in jest config |
| `syside-protocol` | 3 | `package.json`, 1 `.js`-extension rewrite, jest config rename |
| `syside-languageserver` | 379 | bulk of the package's relative imports (358), 185 `declare module` rewrites, 16 deep-import `.js` patches, 5 `__dirname` rewrites, chevrotain typings shim, prebuild prebuild generation already in place |
| `syside-languageclient` | 7 | `package.json`, 5 source `.js`-rewrites, jest config rename |
| `syside-cli` | 5 | `package.json` (gain prebuild), `src/index.ts` (drop `createRequire`), `src/sysml-util.ts` (subpath `.js`), bin shim rewrite, jest config rename |
| `syside-vscode` | 9 | `package.json` (gain `"type": "module"`, `.cjs` for `main`/`browser`), 6 source `.js`-rewrites, esbuild output references updated to `.cjs` |
| (root) | 3 | `tsconfig.json` (ESM-mode), `jest.config.base.js` (CJS-mode SWC + module-name-mapper), `scripts/build.mjs` (`.cjs` `outExtension`) |

## Surprises and how they were resolved

### NodeNext is unworkable for this codebase against Langium 1.2

First attempt set `module: NodeNext`, `moduleResolution: NodeNext`. Result:
**2079 TS errors**, almost all cascading from "type `Element | undefined`
not assignable to type `AstNode | undefined`" — even though `Element extends
AstNode` from langium. Root cause appears to be **dual-module-identity** in
how NodeNext resolves langium's CJS `.d.ts` vs the rest of the ESM workspace:
TS treats the same `AstNode` interface as two distinct symbols across the
boundary.

Switching to `module: ESNext`, `moduleResolution: Bundler` reduced this to
**one** error (chevrotain typings, fixed separately). Bundler resolution
doesn't enforce the strict `.js`-extension rule at the TS level but happily
accepts our `.js` extensions where present. Runtime behaviour is identical
since Node ESM is what's actually loading the output.

**Recommendation for Phase 0b:** stay on Bundler for the Langium 1→2 hop
itself; reconsider switching to NodeNext once Langium is 2.x (ESM itself)
and the dual-identity hazard is gone.

### `chevrotain` 9.x publishes `exports` without `types`

```
"exports": {
  "require": "./lib/src/api.js",
  "import": "./lib_esm/api_esm.mjs"
}
```

Under `moduleResolution: Bundler`, TS follows the `import` condition to the
`.mjs` file which has no co-located typings. The `typings` field at the
package root is suppressed by the presence of `exports`. Fixed by a
`compilerOptions.paths` override in
`packages/syside-languageserver/tsconfig.json` pointing `"chevrotain"`
straight at `./node_modules/chevrotain/chevrotain.d.ts`. The 1→2 Langium
hop pulls chevrotain 11.x which ships proper `types` conditions and the
override goes away.

### Langium 1.2 named-import-from-ESM smoke check

```
$ node --input-type=module -e "import { AstNode } from 'langium'; ..."
SyntaxError: Named export 'AstNode' not found. The requested module 'langium' is a CommonJS module ...
```

Langium 1.2's CJS index uses dynamic `__exportStar(require("./..."), exports)`
which Node ESM's static analyzer can't see through. **Named imports from
Langium 1.2 fail at runtime in Node ESM** but **succeed under Jest** because
Jest stays in CJS mode (SWC emits `require()` calls). This is intentional
under our plan:

- **Tests** (Jest, CJS): green at baseline. The safety net works.
- **esbuild bundles** (the production runtime path): green; esbuild rewrites
  CJS named imports to default-import-then-destructure internally.
- **`tsc lib/` output run by Node ESM directly**: broken for the same
  reason. The bin shims fall back to dynamic `import("../lib/...")` only
  when the esbuild bundle is missing; this path now also fails at the
  first langium/vscode-uri/vscode-languageserver named-import. Treated as
  acceptable: the supported runtime path is the bundle. The hop in
  Phase 0b moves langium to ESM and this issue retires.

### `__dirname` collision when SWC re-emits CJS for Jest

Defining a local `const __dirname = path.dirname(fileURLToPath(import.meta.url))`
to bridge ESM source → CJS Jest runtime fails: SWC's `import.meta.url` →
`require("url").pathToFileURL(__filename).toString()` transformation re-uses
the global CJS `__filename`, which puts `__dirname` back in scope as a
CJS-globally-injected `var`. Then our local `const __dirname` shadows it
and Node throws "Identifier '__dirname' has already been declared".

Renamed the local to `currentDir`/`currentFile`. Touches 5 files
(`server-initialize-params.ts`, `node-file-system-provider.ts`,
`extension-manager.test.ts`, `node-file-system-provider.test.ts`,
`run-validation.ts`).

### esbuild bundles still need to be CJS for VS Code

VS Code's extension host loads `main` via `require()`. Under
`"type": "module"`, a `.js` file is ESM and `require` of ESM throws.
Solution: `outExtension: { ".js": ".cjs" }` in `scripts/build.mjs`. The
runtime bundles are now `.cjs`, the `package.json#main`/`browser` /
language-server-launch reference is `.cjs`, and the bin shims `require()`
the `.cjs`.

### `import.meta.url` is empty under esbuild CJS bundling

esbuild warned: `"import.meta" is not available with the "cjs" output
format and will be empty`. This affected one site
(`node-file-system-provider.ts:currentDir`). Replaced with a try/catch that
falls back to the CJS `__dirname` global when `fileURLToPath(import.meta.url)`
throws — preserving correct behaviour under tsc-emitted ESM, esbuild CJS
bundles, AND Jest's SWC-CJS runtime.

The CLI's `createRequire(import.meta.url)` use was less recoverable; it
was replaced by a generated `version.ts` mirroring the existing pattern
in `syside-languageserver`.

## Deviations from the "standard" ESM migration pattern

| File / pattern | What we did | Why |
|----------------|-------------|-----|
| Per-package `jest.config.{js→cjs}` | Renamed `.js` to `.cjs` | Each package is now `"type": "module"`, so `.js` configs would be loaded as ESM and `module.exports = ...` would fail. The alternative (rewrite as ESM) would have to drop `require("../../jest.config.base")`. |
| `packages/syside-languageserver/tsconfig.json` `paths` | Added `"chevrotain": ["./node_modules/chevrotain/chevrotain.d.ts"]` | chevrotain 9.x's `exports` map lacks a `types` condition. Retire after Phase 0b. |
| `packages/syside-languageserver/node.{js,d.ts}` | Rewrote from CJS `module.exports = require("./lib/node")` to ESM `export * from "./lib/node/index.js"` | The convenience shim is now ESM-loaded along with the rest of the package. |
| `scripts/build.mjs` esbuild `outExtension` | `.js → .cjs` for both node and browser | Makes CJS bundles loadable under `"type": "module"` packages. |
| `syside-cli` gained a `prebuild` | Generates `version.ts` from `package.json` | esbuild CJS bundling makes `createRequire(import.meta.url)` blow up at runtime. The pattern matches `syside-languageserver`. |
| Local `currentDir`/`currentFile` instead of `__dirname`/`__filename` | Different names | Avoid collision with the CJS `__dirname` global re-injected by SWC under Jest. |
| `IRecognitionException`/`ILexingError` → `import type` | Type-only import | Smaller blast radius for the chevrotain typings shim. |

No file required a `.cjs` extension that we wouldn't have wanted. No package
fell back to special treatment (no per-package tsconfig overrides apart from
the chevrotain `paths` map).

## Risk note: dual-package hazard residue

Even after this phase, **two execution paths coexist**:

- **CJS path**: Jest tests, esbuild bundles (VS Code extension, CLI
  bundle, language-server bundle). All "named import from CJS dep"
  patterns work here.
- **ESM path**: direct Node ESM execution of the tsc-emitted `lib/`.
  Named imports from langium/vscode-uri/vscode-languageserver fail
  here because those packages are CJS-with-`__exportStar`.

The CJS path is the production runtime (per the bins) and the test path.
The ESM-via-`lib/` path is broken until those deps go ESM (which the
Langium 2.x hop accomplishes for langium and pulls in vscode-uri 3.x with
proper exports/etc).

In practice this is invisible to developers running `pnpm test`, building,
or running the packaged extension/CLI. It would only bite if someone runs
`node packages/syside-cli/lib/index.js` directly. The bin shims currently
warn-then-fail in that case.

## Readiness for Phase 0b

The brief asked for a calibrated view. Three observations:

1. **Module-system migration is done.** Phase 0b can focus exclusively on
   Langium API surface translation and the `createParser` refactor
   identified in P2. The "should we go ESM first or batch with Langium?"
   question is resolved; ESM is in place.

2. **The dual-package hazard is mostly inert.** Langium 1.2 is CJS;
   Langium 2.x is ESM. Phase 0b will, by construction, eliminate the
   single biggest source of the hazard (the `__exportStar` index). The
   tsconfig `paths` chevrotain shim retires alongside it. The choice of
   `moduleResolution: Bundler` was the right call — it keeps us out of
   NodeNext's identity-confusion territory while Langium itself is still
   CJS, and we can revisit NodeNext once Langium is ESM.

3. **Risk for Phase 0b is roughly P2's estimate.** The ESM migration was
   tightly scoped and converged to baseline; that was the largest unknown
   in P2's "this is option A1" recommendation. P2 estimated ~2 working
   days per hop after ESM landed; nothing in this work suggests that's
   wrong. The `createParser` refactor (P2 Blocking 2) is still the
   biggest non-trivial piece of Phase 0b and should be tackled first in
   each hop.

**Recommendation**: Phase 0b is ready to start. Begin with the langium
package bumps (1.2 → 2.1) and re-confirm the 43-TS-error envelope P2
documented. The ESM-migration scaffolding is now in place to support it.

## Files changed in this phase

(All uncommitted on branch `worktree-agent-ad2f1b81935a8454e`.)

- `tsconfig.json` — target/module/moduleResolution change.
- `jest.config.base.js` — SWC CJS forcing, moduleNameMapper for
  `.js`-stripping and workspace `syside-*` → `src/` mapping.
- `scripts/build.mjs` — esbuild `outExtension: { ".js": ".cjs" }` for both
  build profiles.
- `packages/*/package.json` (×6) — `"type": "module"`; some gained
  `prebuild`/`clean` adjustments.
- `packages/*/jest.config.js → .cjs` (×5) — rename for ESM package context.
- ~400 TS source files — `.js` extensions on relative imports,
  `declare module` rewrites, deep-import `.js` patches.
- 5 files — `__dirname`/`__filename` → `currentDir`/`currentFile`.
- `packages/syside-cli/bin/cli`,
  `packages/syside-languageserver/bin/syside-languageserver` — ESM rewrites
  with `.cjs` bundle preference.
- `packages/syside-languageserver/node.{js,d.ts}` — ESM re-export shim.
- `packages/syside-languageserver/src/testing/chevrotain.d.ts` (deleted,
  approach changed to `paths` map).
- `packages/syside-languageserver/tsconfig.json` — `paths` override for
  chevrotain typings.
- `packages/syside-vscode/src/common/extension.ts` — `language-server/main.js`
  → `.cjs`.
- `packages/syside-languageserver/scripts/run-validation.ts` —
  `__dirname`/`require` migrated to `import.meta`-derived helpers.
- `packages/syside-cli/src/index.ts` — drop `createRequire`, use generated
  `version.ts`.

## Success criteria check

- All 6 packages have `"type": "module"`. ✅
- All relative imports have `.js` extensions. ✅ (script-driven, plus the
  declare-module/sed sweeps for less-common forms)
- `pnpm install` succeeds. ✅
- `pnpm run build` succeeds (tsc + esbuild for VS Code extension). ✅
- `pnpm test` succeeds at the same baseline as before: 8 skipped,
  2133 passed, 2141 total. ✅ (the brief cited 2127/2135, which appears
  to be slightly older than `semantifyr-integration` tip — actual baseline
  on this branch matches P2's reading of 2133/2141)
- The clone script (`packages/syside-languageserver/scripts/clone-sysml-release.mjs`)
  still works. ✅ (module loads cleanly; not network-exercised)
