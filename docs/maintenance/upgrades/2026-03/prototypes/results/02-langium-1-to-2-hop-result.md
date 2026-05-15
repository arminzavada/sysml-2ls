# Prototype P2 — Langium `1.2 → 2.x` first hop — Results

> Worktree branch: `proto/p2-langium-1-to-2-hop`. Uncommitted. **Status:
> blocked — scope expansion**: the hop is not a mechanical migration. Per
> the brief's "If scope expands" clause I stopped and wrote up findings
> rather than push through.

## Outcome at a glance

- **Final 2.x version targeted:** `langium@~2.1.3`, `langium-cli@~2.1.0`
  (also forced peer-dep bumps: `vscode-languageserver@~9.0.1`,
  `vscode-languageclient@~9.0.1`, `chevrotain@~11.0.3`,
  `vscode-uri@~3.0.8`, `vscode-languageserver-textdocument@~1.0.11`).
- **Baseline tests** (1.2.x, fresh checkout of `semantifyr-integration` tip
  `e6c281c`): `Tests: 8 skipped, 2133 passed, 2141 total`. (Note: brief
  cited 2118/2126 — the codebase moved since the brief was authored.)
- **After upgrade:** 0 test suites pass — Jest cannot resolve `langium`
  from CommonJS-compiled test code (Langium 2.0 is ESM-only). TypeScript
  build: down from a wall of errors to **43 errors across 12 files** after
  mechanical fixes (see §Categorized breakages); the remaining errors
  require non-mechanical decisions.
- **Time spent:** ~3 hours of focused work (reading changelog, package
  bumps, ts-config experiments, six rounds of TS-error triage, baseline
  re-check, writeup).
- **Confidence the same approach scales to 2→3, 3→4:** Low/Medium.
  Subsequent hops will NOT have the same ESM-cliff (2.x is already ESM),
  but the same kind of API rename + internal-symbol-removal pattern will
  recur. The 2→3 hop drops `MultiReference` (or introduces it; need to
  check) and likely reshuffles validation/scoping again. Rough sizing
  per hop, calibrated against this one: **~1.5–3 days per hop** of
  focused mechanical+small-architecture work, **assuming** Phase 0 starts
  with a one-time-only ESM/CJS module-system decision (see §Blocking).

## Method actually followed

1. Read [Langium 2.x changelog](https://github.com/langium/langium/blob/main/packages/langium/CHANGELOG.md) for 2.0.0/2.1.0 entries.
2. Baseline `pnpm test`: 8 skipped, 2133 passed.
3. Bump `langium ~1.2.0 → ~2.1.3` and `langium-cli ~1.2.0 → ~2.1.0` in
   the two `package.json` files that declare them. Bump forced peer
   deps. Run `pnpm install`.
4. Run `pnpm run grammar:generate` — succeeds with `langium-cli 2.1.0`.
   Newly-generated `ast.ts` is encoded differently and adds discriminated
   `$type` unions on interfaces (this is a deliberate Langium 2.x
   generator change).
5. `pnpm run typecheck` to surface the first wave of errors. Iteratively
   fix the mechanical ones; the residue is what's reported below.
6. Switch `tsconfig.json` `module: commonjs → esnext` and
   `moduleResolution: node → bundler`. This was forced — Langium 2.x has
   no `main` field, only `exports`, so `moduleResolution: node` cannot
   resolve it at all.

## Categorized breakages encountered

### Category A — Mechanical, fixed in this prototype (10 files touched)

| Category | Count | Representative one-line |
|---|---|---|
| `SysMlAstType → SysMLAstType` / `SysMlAstReflection → SysMLAstReflection` casing rename in generated code | 2 files | `import { ... SysMlAstReflection } from "../generated/ast"` → `SysMLAstReflection` |
| `SysMlGeneratedSharedModule → SysMLGeneratedSharedModule` casing rename | 1 file | identical pattern |
| `langium/lib/<subpath>` internal imports (now blocked by the new `exports` map) — re-route through top-level `langium` or via `GrammarAST` namespace | 8 files | `import { isAbstractRule } from "langium/lib/grammar/generated/ast"` → `import { GrammarAST } from "langium"; GrammarAST.isAbstractRule(...)` |
| `vscode-uri/lib/umd/uri` deep import (no longer exposed via `exports`) → local re-declaration of `UriComponents` | 1 file | local `interface UriComponents { ... }` |

### Category B — TS module-system change (workspace-wide config)

| Category | Count | Representative one-line |
|---|---|---|
| `tsconfig.json` `module`/`moduleResolution` switched to `esnext`/`bundler` | 1 file (workspace root) | required because Langium 2.x has no `main`, only `exports` |

This is the load-bearing decision. With `module: commonjs +
moduleResolution: node` (1.x baseline) TS cannot even find `langium`'s
typings. `bundler` resolution is the lightest-touch fix but it forces TS
to **emit** ESM. Our `lib/` outputs become ESM. Workspace consumers
(`syside-vscode`, `syside-cli`) currently expect CJS lib files. esbuild
can bundle either, but Jest is the bottleneck (see §Blocking 1).

### Category C — Real Langium API changes (43 TS errors remain; not fixed)

| Category | Count (errors) | Files | Representative |
|---|---|---|---|
| `BuildOptions.validationChecks` removed, replaced by `validation: boolean \| ValidationOptions` (changelog 2.0.0) | 4 | `services/config.ts`, `testing/utils.ts`, `services/shared/workspace/document-builder.ts`, `packages/syside-cli/src/cli-util.ts` | `{ validationChecks: "all" }` → `{ validation: { categories: [...], ... } }` |
| `CompletionContext`/`CompletionValueItem` reshape: provider hooks dropped `label`/`textEdit` direct props, `completionForCrossReference`/`completionForKeyword` argument counts shrunk, `charactersFuzzyMatch` removed, `backtrackToAnyToken` now returns `CompletionBacktrackingInformation` not a number | 16 | `services/lsp/completion-provider.ts` (single file, but pervasive) | `super.completionForCrossReference(context, refInfo, acceptor)` → 2-arg shape |
| `IndexManager.isAffected` signature change: `(doc, changedUri: URI)` → `(doc, changedUris: Set<string>)` (changelog 2.0.0) | 3 | `services/shared/workspace/index-manager.ts` | also `getAffectedDocuments` removed |
| `IndexManager.indexManager` visibility changed protected→public in `DefaultIndexManager`; SysML overrides now incompatible | 3 | `services/shared/workspace/index-manager.ts`, `services/references/scope-provider.ts`, `services/shared/workspace/document-builder.ts` | structural mismatch |
| `ValidationRegistry` API: `register` rename/removal, `getChecks` signature change, generic constraints tightened on `P extends string` | 5 | `services/validation/validation-registry.ts`, `sysml-module.ts` | `override register(...)` no longer matches base |
| `DefaultDocumentValidator.validateAst` signature change (categories now non-optional) | 2 | `services/validation/document-validator.ts` | structural mismatch |
| `createParser` is **no longer exported** from any public Langium 2.x path — but the project subclasses `LangiumParser` and bootstraps via this exact internal symbol | 1 (but architectural) | `services/parser/parser.ts` | see §Blocking 2 |
| Stricter `AstNode.$container?: AstNode \| undefined` propagation forces null-handling at several link/scope/metamodel sites | 6 | `services/references/linker.ts`, `services/shared/workspace/metamodel-builder.ts`, `services/lsp/completion-provider.ts` | `ref.$container.$meta` → `ref.$container?.$meta` with subsequent narrowing |
| `LangiumParser.assignMandatoryProperties` made `protected` (TS can no longer access via index syntax in 2.x typings) | 2 | `services/parser/parser.ts` | `super["assignMandatoryProperties"](node)` |
| Reflected metaclass `$type` is now a discriminated string-literal union on every generated interface (langium-cli 2.x); SysML's `*Meta.specializationKind(): SubtypeKeys<Inheritance>` returns a wider `string` and no longer satisfies subinterfaces' narrower `$type` constraint | 18 (in `generated/ast.ts` itself) | `generated/ast.ts` (generated), upstream causes in `model/metamodel.ts`, `model/KerML/{classifier,feature,item-feature}.ts` | type-level mismatch; needs `specializationKind` typed via the new `Inheritance["$type"]` union, propagated through SubtypeKeys |

(Counts are TS error counts at typecheck, not file edits.)

## Blocking issues that justified stopping

### Blocking 1 — ESM/CJS module-system decision is workspace-wide

Langium 2.0 ships ESM-only (`"type": "module"`, conditional `exports`,
no `main`). chevrotain 11 and vscode-uri 3 followed. The toolchain in
this repo is currently CJS-everywhere:

- `tsconfig.json`: `module: commonjs, moduleResolution: node`.
- `lib/<pkg>/index.js` outputs are consumed by other workspace packages
  via plain CJS `require`.
- Jest uses `@swc/jest` which emits CJS regardless of TS settings.
- esbuild bundles `syside-vscode` to CJS for the extension.

Three real options for the workspace, none of them mechanical:

- **A1.** Go full ESM: add `"type": "module"` to every workspace
  `package.json`, switch `tsconfig` to `module: node16`, add `.js`
  extensions to **all** ~398 relative-import statements, reconfigure
  Jest for ESM (`extensionsToTreatAsEsm`, change
  `transformIgnorePatterns` to transform `langium` too, replace
  `swc/jest` if necessary). VSCode extension entry stays CJS by way of
  esbuild's `--format=cjs` bundle.
- **A2.** Hybrid: TS emits ESM (`module: esnext, moduleResolution:
  bundler`), but the workspace stays CJS at the `package.json` level.
  Jest transforms langium via `transformIgnorePatterns: []` plus an
  `--experimental-vm-modules` runner. This is what I implicitly aimed
  for; Jest fails immediately on `require('langium')` because the swc
  transform still emits CJS. Workable but fragile.
- **A3.** Use a TS shim layer: vendor a thin `langium-cjs/` workspace
  package that lazy-loads `langium` via `await import()` at module load
  and re-exports the public surface. Keeps the rest of the workspace
  CJS. Heavy initial cost (~1 day) but isolates the ESM bridge.

This decision applies once across all of Phase 0 — once made, the 2→3
and 3→4 hops are within the new module system.

**Recommendation:** A1, but plan it as a discrete prerequisite
sub-prototype (call it "P2.0 ESM migration") that ships first. The hops
themselves should not also be doing module-system migration.

### Blocking 2 — `createParser` (internal API) removed from public surface

`packages/syside-languageserver/src/services/parser/parser.ts` extends
`LangiumParser`, defines `SysMLParser`, and bootstraps it via
`createParser(grammar, parser, lexer.definition)`. In Langium 2.x,
`createParser` still exists at `lib/parser/parser-builder-base.js` but
the package's `exports` field blocks deep imports, and only
`createLangiumParser`/`prepareLangiumParser` are public — and those
hard-code `new LangiumParser(services)` rather than accepting a
subclass.

Three real options, again non-mechanical:

- **B1.** Vendor a copy of `parser-builder-base` into the repo
  (~100 LOC of grammar→Chevrotain bridging) and call it directly. Risk:
  must stay in sync with Langium internals across hops.
- **B2.** Stop subclassing `LangiumParser`. Move the SysMLParser
  overrides (`construct`, `nodeBuilder` replacement, `collectChildren`)
  into a wrapper or into a custom service that decorates the default
  parser post-construction. Requires real understanding of why those
  overrides exist — the `SysMLCstNodeBuilder` replacement (in
  `parser.ts:269`) is non-trivial.
- **B3.** File an upstream issue asking Langium to either re-export
  `createParser` or provide a `parser` factory DI hook. Doesn't help
  the 2.x hop in the short term.

**Recommendation:** B2, but it's a real piece of design work — touches
how custom CST nodes are produced and how `$cstNode.feature` is set.
This is also where the `CstNode#feature → grammarSource` rename from
the 2.0 changelog lands (see `parser.ts:350`).

### Blocking 3 — generated-AST discriminated-union ripple

langium-cli 2.x emits stricter `$type` discriminated unions on every
interface. The repo's `*Meta.specializationKind()` returns a wide
`string` (typed as `SubtypeKeys<Inheritance>`) and the relationship of
`Meta` to AST `$type` is no longer assignable through SubtypeKeys when
the AST's `$type` narrows in subinterfaces.

This is ~18 errors in the generated `ast.ts` itself (the generated file
disagrees with the model layer's contracts). The fix is in the **model
layer**, not in the generated file: tighten `specializationKind`'s
return type at each level so its sub-interfaces report the right union,
and update SubtypeKeys to match. Probably mechanical at scale but needs
care; would not have surfaced if Langium 1.x had been emitting these
unions all along.

## HTML-comment workaround in README

The brief asks whether the README's HTML-comment about
`addSuperPropertiesInternal` is still relevant. I did not progress far
enough to test this — the parser/AST-reflection layer is among the
unfixed-residue files, and the workaround lives there. **Status:
unknown, deferred to the actual upgrade work.** The note in
`README.md` should stay until verified.

## Surprises

- `langium-cli` 2.x's generator changes are heavier than the public
  changelog suggests. The Mc → ML casing of `SysMLAstType` /
  `SysMLAstReflection` / `SysMLGeneratedSharedModule` is not mentioned
  in the public changelog at all but breaks the build immediately.
- The `vscode-uri 2.x → 3.x` and `vscode-languageserver 8 → 9` forced
  upgrades come along with this hop. Both are mostly safe but they're
  real version transitions the workspace would have otherwise picked
  individually. Worth tracking as part of the Phase-0 budget.
- The `transformIgnorePatterns: ["<rootDir>/node_modules/"]` line in
  `jest.config.base.js` actively prevents Jest from working with any
  ESM-only dep. The whole Phase-0 jest configuration probably needs a
  one-time rework alongside the module-system decision.
- Approximately 398 of 426 TS source files contain relative imports —
  rough lower bound for the source-edit count if full ESM migration
  (option A1) is chosen.

## Confidence statement for next hops

- **`2 → 3`** I expect this to be cheaper than this hop *if* the
  module-system question is resolved first. The 3.x changelog brings a
  `MultiReference` type and reshuffles scope-provider/linker APIs; the
  current codebase's scope-provider is already heavily customized
  (`services/references/scope-provider.ts`, `scope-computation.ts`)
  which means real attention there.
- **`3 → 4`** Largest unknown. 4.x changelog mentions further
  validation-registry / index-manager rework. Probably comparable cost
  to this hop.

Realistic Phase-0 budget if my findings hold up: pick one
module-system option, then **~2 working days per major hop**, plus
**~1 day for the ESM migration sub-prototype itself**.

## Files changed in this prototype

(All uncommitted on branch `proto/p2-langium-1-to-2-hop`.)

- `tsconfig.json` — `module`/`moduleResolution` change.
- `packages/syside-base/package.json` — `vscode-uri` bump.
- `packages/syside-cli/package.json` — `langium` + `vscode-languageserver` + `vscode-uri` bumps.
- `packages/syside-languageclient/package.json` — `vscode-languageserver` bump.
- `packages/syside-languageserver/package.json` — `langium`, `langium-cli`, `chevrotain`, `vscode-languageserver`, `vscode-languageserver-textdocument`, `vscode-uri` bumps.
- `packages/syside-protocol/package.json` — `vscode-languageserver` bump.
- `packages/syside-vscode/package.json` — `vscode-languageclient`, `vscode-languageserver`, `vscode-uri` bumps.
- `pnpm-lock.yaml` — regenerated.
- `packages/syside-languageserver/src/generated/{ast,grammar,module}.ts` — langium-cli 2.1.0 output.
- Source edits (10 files): see Category A table above.

## Request for guidance

Two concrete questions for the project owner:

1. **ESM/CJS decision** (Blocking 1). Which of A1/A2/A3 do we pick?
   This is a one-time decision but it controls the shape of all three
   hops. My recommendation: A1 as a discrete preceding sub-prototype.
2. **`createParser` replacement** (Blocking 2). Are we OK with B2
   (refactor away from `LangiumParser` subclassing)? B1 (vendoring) is
   faster now but compounds across hops.

If the answer to either is "design more first", that's a clean
exploration-phase task before any hop work proceeds.
