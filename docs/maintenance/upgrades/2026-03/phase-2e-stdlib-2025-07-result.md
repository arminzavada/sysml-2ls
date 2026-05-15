# Phase 2e — Stdlib advance to upstream 2025-07

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`:

- Old: `53736d8b23b36f72a8c356fef52ff476a092abf7` (2025-06)
- New: `de44b238c60e63ad57d33529a6bca07d6e630fe9` (2025-07, "Updated for 2025-07.")

## Occurrences patch status

The `0001-occurrences-end-keyword.patch` applied cleanly against the
2025-07 tree without rebase. The `surroundedSpace` / `surroundingSpace`
declarations in `Occurrences::Occurrence::SurroundedSpacePerformances`
are unchanged at the same line offsets (`@@ -601,8 +601,8 @@`) relative
to 2025-06. The diamond-inheritance reshuffle in 2025-07 did touch
`Occurrences.kerml` elsewhere, but not this specific block.

Verified: `grep -n "surroundedSpace\|surroundingSpace" Occurrences.kerml`
shows the patched `end feature` lines at 604-605 post-patch.

## Hardcoded-string sweep

Searched the TypeScript sources for the references called out in the
2025-07 digest:

- `Message::source`, `Message::target` — 0 hits.
- `messageTransfers` — 0 hits.
- String literal `"transfers"` / `'transfers'` / `::transfers` (as a
  feature name we'd resolve by string) — 0 hits.

No code-side adaptation required for the `Message` end-feature rename
to `sourceEvent` / `targetEvent`, nor for the `transfers` /
`messageTransfers` reclassification at the string level.

## AST shape (`transfers` flows → steps)

The Langium interface declarations were already aligned with the
post-2025-07 shape: `ItemFlow` extends `Connector, Step`, and
`FlowUsage` extends `ConnectorAsUsage, ActionUsage, ItemFlow`. The
metamodel-level move of `transfers` / `messageTransfers` from flow
features to step features is therefore absorbed transparently — the
content lives in the stdlib `.kerml` / `.sysml` text and the existing
interface hierarchy already accommodates it.

No grammar or interface change required.

## `validateConnectorBinarySpecialization`

The pilot 2025-07 fix changes the predicate from
`TypeUtil.getAllEndFeaturesOf(c)` to `c.connectorEnd`, i.e. from
"count all (inherited+owned) end features" to "count only directly
owned connector ends". Our implementation in
`packages/syside-languageserver/src/services/validation/kerml-validator.ts`
already uses `node.ownedEnds()`, which corresponds to the corrected
(2025-07) behaviour:

```
const ends = node.ownedEnds();
if (ends.length > 2 && node.conforms("Links::BinaryLink")) { ... }
```

No change needed — our validator was incidentally consistent with the
fixed predicate (the previous pilot bug bit "any inherited end pushes
the count past 2", and we never reproduced that bug).

## Semantifyr test models

No changes required. All nine Semantifyr models continue to parse and
validate without errors after the upgrade. None of them used implicit
`subject` / `objective` insertion in `requirement def` / `use case` /
`concern` declarations with stakeholders/actors/extra params, so the
removal of auto-insertion in 2025-07 left them untouched.

## Test result

Baseline pre-change: **2152 passed / 7 skipped / 2159 total**.
Post-change: **2152 passed / 7 skipped / 2159 total** (75 files).

`pnpm run build` succeeds (tsc + esbuild). `pnpm run lint` shows the
same pre-existing errors/warnings present on `main`; this phase added
no lint debt.

## Uncertainty surfaced

- **Distinguishability warnings on diamond inheritance.** 2025-07 adds
  new warning sites (the Vehicle → Car/Truck → SUV style example).
  Our validator stack does not yet implement
  `validateNamespaceDistinguishability` with the 2025-07 namespace
  parameter threading. None of the bundled stdlib content triggered
  it under our current validators, but a user model with explicit
  diamond inheritance plus name collisions would silently not warn
  where the pilot does. Worth a follow-up validator chunk; out of
  scope here per "isolate migration axes".
- **`SpatialItem` subitem warning.** 2025-07 says subitems of
  `SpatialItem` should warn unless `subSpatialItems` /
  `subSpatialParts` / `componentParts` are used. The library content
  now ships these new features, but we have no validator producing
  the warning. Same follow-up category.
- **`TransitionPerformance::accept` rework.** Inherited via stdlib
  content only; no AST-level surface noticed during this phase, but
  flagged here because it is a behavioural change that *could*
  influence transition-related expressions in user models that bind
  the `receive` parameter.
