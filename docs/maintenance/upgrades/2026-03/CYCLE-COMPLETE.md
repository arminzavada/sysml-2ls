# 2026-03 upgrade cycle — complete

> The 2026-03 upgrade cycle's target is reached. This doc captures the final state, deferred work, and lessons for the next cycle.

## Final state

- **Langium:** `4.2.4` (was `1.2.0`).
- **TypeScript:** `5.8.3`.
- **Test runner:** Vitest `3.x` (was Jest 29).
- **ESLint:** `9.x` (flat config; was 8.x `.eslintrc`).
- **`@types/node`:** `22` LTS (was `14`).
- **Module system:** ESM workspace-wide.
- **Stdlib pin:** upstream `Systems-Modeling/SysML-v2-Release` at tag `2026-03` (commit `cd99f7ca`).
- **Patches:** **zero**. `Occurrences` patch retired at 2026-01 when upstream emitted the same `end`-shape we'd been patching.
- **Test baseline:** `2152 passed / 7 skipped / 2159 total`. Held stably through every commit.

## Cycle summary

**Phases shipped** (~56 commits on `main`):

| Phase | Outcome |
|-------|---------|
| 0a–0f | Toolchain modernization: ESM, Vitest, Langium 1→4 via four sub-hops, deps refresh, idiomatic cleanup |
| Prototypes | P1, P1a, P2 (calibrated scope), P4, P5 |
| Fix | `validateUsageOwningType` KerML-Feature transparent owner trap |
| Phase 1 | Retire fork contradictions; switch to upstream; one explicit patch |
| Phase 2a | 2025-02 grammar: `var`/`const`/`constant`, `new`, `$::`, `derived` ordering, expanded `send`/`accept` |
| Phase 2b | stdlib `2025-02` + `FlowConnection*` → `Flow*` renames |
| Phase 2c | stdlib `2025-04` + control-node action bodies |
| Phase 2d | stdlib `2025-06` + Occurrences patch rebase |
| Phase 2e–2k | stdlib `2025-07` through `2026-02`, mostly pin-only with minor grammar/validator additions |
| Phase 2l | stdlib `2026-03` (target) |
| Phase 4 | 13 missing validators from the 2026-01 batch implemented |

**Integration test added:** Semantifyr `TestModels` (9 models, all pass).

## Deferred work (explicitly out of scope for this cycle)

### Phase 5 — evaluator catch-up

Per [`feedback_authoring_not_execution`](../../../) memory, full evaluator parity with the pilot is *not* a goal — this LSP is for authoring, not runtime simulation. Specifically deferred:

- **Constructor expression evaluation** (2025-04). AST + parser shipped in Phase 2a; opaque-instance treatment is the authoring-rule-mandated bar.
- **`collect`/`select` evaluable** (2025-11).
- **Full evaluation of `SequenceFunctions` / `CollectionFunctions` / `ControlFunctions` / `min`/`max` / collection equality** (2025-12).
- **`TrigFunctions` evaluable** (2026-01).
- **De-listings** (`prod`, `sum`, `excludes`, `includes`, `isEmpty`, `notEmpty`, `size`, `Length`, `Substring` no longer model-level evaluable per spec, 2025-11). If currently registered in the evaluator's function table, retire on a future cycle when convenient.

None of these block any test in the current suite. They become work items only if a future model surfaces a real need.

### Filter-expression transformation divergence

Phase 2l surfaced that `checkConnectorTypeFeaturing` and filter-expression handling depend on the pilot's implicit-binding-connector transformations (`FeatureReferenceExpressionAdapter.addReferenceConnector`). The LSP doesn't model these transformations. Result: we're more lenient than pilot `2026-03` on filter-expression qualified-name feature references. Pre-existing divergence, not introduced by this cycle. Deferred to a dedicated transformation/adapter track.

### Accept-action body `receiver` redefinition (Chunk 3 item 5)

The 2025-02 semantic affordance (`accept trig { in receiver = …; }` redefining `receiver` in the body) is a scoping/redefinition concern. Not directly forced by tests; not in scope for this cycle.

### Auto-update `known_limitations.md`

`docs/known_limitations.md` was updated in Phase 4 with the defensive-vs-pilot note. The earlier "Heisenbug" entry and LL(*) parser limitations remain — they were not the target of this cycle and may have shifted; a focused re-audit would be cheap.

## Lessons codified

Memories saved during the cycle (in `~/.claude/projects/-home-armin-work-sensmetry-sysml-2ls/memory/`):

- `feedback_conformance_over_compat` — never accept what pilot/spec rejects.
- `feedback_stricter_than_pilot_ok_if_documented` — we can reject more, with docs.
- `project_authoring_not_execution` — runtime depth bounded by authoring needs.
- `feedback_isolate_migration_axes` — one axis at a time; test suite as safety net.
- `feedback_upgrade_includes_cleanup` — compile-green is the floor, not the goal.
- `feedback_follow_framework_grain` — adapt to framework intent, don't vendor internals.
- `feedback_comment_discipline` — comments only for non-obvious / TODO / FIXME.
- `feedback_design_thinking_phases` — exploration → plan → prototype → implement.
- `project_pilot_changes_touch_emf` — expect AST ripple even on "stdlib-only" releases.
- `reference_langium_project` — pointers to canonical Langium reference projects.

The `/sysmlupgrade` slash command and `docs/maintenance/upgrade-workflow.md` together provide a self-contained workflow for the next cycle.

## Procedural notes for next cycle

- **Bundled stdlib needs fresh re-clone after pin advance.** The clone script doesn't auto-refresh — running `rm -rf SysML-v2-Release && node packages/syside-languageserver/scripts/clone-sysml-release.mjs` is the explicit reset. Worktrees that symlink to a stale main-repo bundle will diverge from a freshly-pinned worktree, masking issues.
- **Subagent worktree base.** The Agent tool's `isolation: "worktree"` doesn't reliably pick up the current branch's tip; it tends to branch from `main` or an older state. The reliable pattern: create worktrees manually with `git worktree add -b <branch> <path> main`, then spawn agents without isolation but with explicit `cd` to the worktree path. This was used from Phase 2 onward.
- **Fork-patch retirement is empirical.** P1a's reclassification harness should be re-run before any cycle that wants to "drop the patches" — workarounds quietly become moot as the LSP evolves.
- **"No syntax change" releases are not no-ops** — `project_pilot_changes_touch_emf` memory captures this. Always re-verify by running tests after a pin bump.
