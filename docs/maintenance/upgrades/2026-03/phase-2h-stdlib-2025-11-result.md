# Phase 2h — Stdlib advance to 2025-11

Branch: `phase-2h-stdlib-2025-11` (based on `aac93fd`, Phase 2g tip on `main`).

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`:

- old: `e302dad625886e4deab2fd1e12be43d46149c64c` (2025-10)
- new: `834a3daf073b1886244833d9341677eb9733d1e4` (upstream "Updated for 2025-11.")

## Occurrences patch

`scripts/patches/0001-occurrences-end-keyword.patch` applied cleanly via `git apply` against the fresh 2025-11 checkout. No rebase needed.

## `const end` grammar fix

The 2025-11 pilot allows `const` before `end` on EndFeaturePrefix:

```
EndFeaturePrefix: ( isConstant ?= 'const')? isEnd ?= 'end'
```

Phase 2a's `var`/`const` work added `ConstantOrVariable` only to `BasicFeaturePrefix`, not to the `End` branch of `FeaturePrefix`/`Feature`. The `End` branch was missing the constant marker, so `const end ...` would not parse.

Fix in `packages/syside-languageserver/src/grammar/KerML.langium`:

- `FeaturePrefix`: changed `( End (crossingFeature=...)? | BasicFeaturePrefix )` to `( (isConstant?='const')? End (crossingFeature=...)? | BasicFeaturePrefix )`.
- `Feature`: changed `( End EndFeatureDeclarationPart | ... )` to `( (isConstant?='const')? End EndFeatureDeclarationPart | ... )`.

Only `const` is permitted (not `var`), matching pilot 2025-11 exactly.

## Evaluator-set reduction (TODO, deferred)

The 2025-11 spec de-lists several functions from model-level evaluation:
`prod`, `sum`, `excludes`, `includes`, `isEmpty`, `notEmpty`, `size`, `Length`, `Substring`.

Per `feedback_authoring_not_execution`, this is not required for authoring diagnostics and is therefore out of scope for Phase 2h. Recorded as a Phase 5 (expressions/evaluation) follow-up. The complementary change — `ControlFunctions::collect`/`select` becoming evaluable (enabling `seq.{…}` / `seq.?{…}`) — is similarly an evaluator concern. Existing grammar in `KerML.expressions.langium` already supports the `.{…}` / `.?{…}` shorthand syntax for parsing purposes; no grammar work needed.

## `.kpar` libraries

The 2025-11 release commit (`834a3da`) does **not** yet include a `sysml.library.kpar/` tree; it ships `sysml.library/`, `sysml.library.xmi/`, and `sysml.library.xmi.implied/`. We continue to consume the source `sysml.library/` directory. No action.

## Qualified-name redefinition target

Already addressed by Phase 5's `InheritedTypeScope` (commit `4741fcd`). No work here.

## Tests

`pnpm test`: **2152 passed / 7 skipped (2159 total)** — matches baseline.

`pnpm run build`: 0 warnings, 0 errors (both node and browser bundles).

`pnpm run lint`: pre-existing errors only (in `scope-provider.ts` and test integration files), unrelated to this phase's changes.
