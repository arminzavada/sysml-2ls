# Phase 2f — Stdlib 2025-07 → 2025-09

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`:

- Old: `de44b238c60e63ad57d33529a6bca07d6e630fe9` (upstream 2025-07)
- New: `1d1afb7186143f038af6e446f1c21f10aec6c669` (upstream "Updated for 2025-09.")

## Stdlib refresh

`rm -rf SysML-v2-Release && node packages/syside-languageserver/scripts/clone-sysml-release.mjs` succeeded.
Upstream HEAD landed at commit `1d1afb7` ("Updated for 2025-09.").

## Occurrences patch (`0001-occurrences-end-keyword.patch`)

Applied cleanly — no rebase required.

## Scoping (multi-specialization redefinition resolution)

The 2025-09 digest item is the order-independent redefinition lookup fix in pilot
`KerMLScope.xtend` (`gen()` exhaustive traversal + `addName()` tie-break). As
flagged in the phase brief, this is already addressed in this repo:

- P5 (commit `4741fcd`) introduced `InheritedTypeScope` for the qualified-name
  redefinition target case.
- P1a's reclassification harness previously showed the broader multi-spec
  patches were moot at HEAD.

Test outcome confirms this — no regressions appeared after the stdlib bump, so
the existing scope provider already produces order-independent redefinition
resolution consistent with pilot 2025-09. No new scoping code added in this
phase (per the isolate-migration-axes rule).

## Test result

`pnpm test`: **2152 passed | 7 skipped (2159 total)** — at baseline.

## Build & lint

- `pnpm run build`: success (0 warnings, 0 errors on both node + browser bundles).
- `pnpm run lint`: 13 errors / 6 warnings — identical to pre-change baseline on
  `eaec83e` (verified via stash-and-rerun). Not introduced by this phase; no
  source files were modified.

## Summary

Pin-only phase. One-line bump in `clone-sysml-release.mjs`, regenerated stdlib,
Occurrences patch applied cleanly, baseline preserved. The 2025-09 scoping fix
is already covered by P5's prior work in this repo.
