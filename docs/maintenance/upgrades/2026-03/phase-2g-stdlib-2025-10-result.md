# Phase 2g — Stdlib 2025-09 → 2025-10

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`:

- Old: `1d1afb7186143f038af6e446f1c21f10aec6c669` (upstream 2025-09)
- New: `e302dad625886e4deab2fd1e12be43d46149c64c` (upstream "Corrected
  org.omg.sysml.site.zip for 2025-10.")

2025-09.1 was a single-fix hotfix on the 2025-09 branch (feature-typing
regression) inherited transitively by jumping to 2025-10. No separate step.

## Stdlib refresh

`rm -rf SysML-v2-Release && node packages/syside-languageserver/scripts/clone-sysml-release.mjs`
succeeded. Upstream HEAD landed at `e302dad`.

## Occurrences patch (`0001-occurrences-end-keyword.patch`)

Applied cleanly — no rebase required.

## 2025-10 behavior changes

The 2025-10 digest calls out two behavior changes in the pilot:

1. **Usages must be typed by Definitions / KerML Classifiers, not other
   Usages.** Pilot adds a validator that flags `ref x : a, A` when `a` is a
   Usage. This repo does not yet emit the equivalent diagnostic. Per the
   isolate-migration-axes rule and the phase brief, this is *not* added here —
   it belongs in Phase 4 (validation work). Recorded as TODO. The stdlib
   content advance itself does not depend on the validator firing, and the
   stdlib `.sysml` sources do not exercise the (now-illegal) pattern in a way
   that surfaces as a test regression.

2. **`protected` members blocked through feature chains (`p.b`).** Per
   `docs/maintenance/upgrades/2026-03/03b-visibility-filter-trace.md`, this
   repo's `localScope()` already applies `CHILD_CONTENTS_OPTIONS` (with
   `inherited.visibility = Visibility.public`) uniformly to both `::` and `.`
   chains. So the pilot's 2025-10 fix is inherent here — we are already at
   least as strict as the pilot on this axis. Test outcome confirms: no
   Semantifyr or stdlib model relies on protected-through-chain visibility,
   so no new failures surfaced.

## Test result

`pnpm test`: **2152 passed | 7 skipped (2159 total)** — at baseline.

## Build & lint

- `pnpm run build`: success (0 warnings / 0 errors on both node + browser
  bundles).
- `pnpm run lint`: 13 errors / 6 warnings — identical to pre-change baseline
  (carried over from Phase 2f; no source files touched in this phase).

## Summary

Pin-only phase. One-line bump in `clone-sysml-release.mjs`, regenerated
stdlib, Occurrences patch applied cleanly, baseline preserved. Behavior
change #1 (Usage-as-type rejection) is recorded as a Phase 4 TODO. Behavior
change #2 (protected through `.`-chain) is already inherent in the repo's
visibility filtering.
