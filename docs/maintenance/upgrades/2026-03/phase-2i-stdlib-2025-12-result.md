# Phase 2i — stdlib 2025-12

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`: bumped from
`834a3daf073b1886244833d9341677eb9733d1e4` (2025-11) to
`6b980cacc63c0f6e62e84b2f2673d378ea9e0f5f` (upstream 2025-12).

## Occurrences patch

`0001-occurrences-end-keyword.patch` applied cleanly during
`clone-sysml-release.mjs` execution; no rebase required.

## Evaluator changes deferred

The 2025-12 release-notes digest entry is purely evaluator-side: full
evaluation for `SequenceFunctions`, `CollectionFunctions`, `ControlFunctions`,
plus `min`/`max` and collection equality. Per the authoring-not-execution
project stance, evaluator catch-up is deferred to Phase 5 and is out of scope
here.

## Results

- Tests: 2152 passed / 7 skipped / 2159 total — matches baseline.
- Build: green (`pnpm run build`).
- Lint: pre-existing baseline noise (13 errors / 6 warnings); unchanged by
  this phase (verified by stashing the pin change and re-running lint).
