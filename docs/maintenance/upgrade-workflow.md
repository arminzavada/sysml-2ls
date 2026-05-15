# SysML upgrade workflow

> **The canonical workflow for advancing `sysml-2ls` from one pilot release to the next.** Built from the 2026-03 upgrade's experience. Read in conjunction with [`upstream-sources.md`](upstream-sources.md), [`upgrade-checklist.md`](upgrade-checklist.md), and [`project-issues-analysis.md`](project-issues-analysis.md).

## When to start an upgrade

A new pilot tag (`YYYY-MM`) has been published. Decision: stay on current, or upgrade. Per [`upstream-sources.md`](upstream-sources.md): **targeting policy is always the latest available pilot tag**.

## The four phases

This project follows design-thinking ([memory: feedback_design_thinking_phases](../../).../memory/feedback_design_thinking_phases.md)): **don't skip phases**. Each one's outputs feed the next.

### Phase 1 — Exploration

**Goal:** understand what changed upstream and how this repo couples to it.

**Outputs (per upgrade, in `docs/maintenance/upgrades/<tag>/`):**

- `release-notes-digest.md` — author-curated upstream changes across the tag range, drawn from GitHub release notes via `gh release view`. **Delegate to a subagent** — the raw release-notes output is high-volume.
- Six **chunk reports**, one per language area:
  1. `01-grammar-keywords.md` — surface syntax changes (.xtext vs .langium).
  2. `02-library-builtins.md` — stdlib content + repo-coupling map.
  3. `03-scoping-visibility.md` — scope/visibility/name-resolution changes.
  4. `04-type-system.md` — typing relations, inference, redefinition.
  5. `05-expressions-evaluation.md` — evaluator + expression changes.
  6. `06-validation-rules.md` — validation constraint changes.
- Per-chunk sub-deliverables as needed (e.g. fork-patch catalogue, pilot-side mini-spec, behavioral probe).
- `00-exploration-synthesis.md` — top-level synthesis with cross-cutting findings.

**Confidence-marking convention:** each item is tagged `understood` / `structurally-clear` / `needs-deeper-trace` / `consult-Armin`. **Don't over-claim** — SysML v2 is dense ([memory: feedback_calibration_on_complexity](../../).../memory/feedback_calibration_on_complexity.md)).

**Method per chunk:** look at this repo's code, look at the pilot's code at the target tag, compare. Status table → per-item analysis → open questions.

**Phase gate:** all six chunks done + synthesis written. Then ask the user about strategic decisions before moving to planning.

### Phase 2 — Planning

**Goal:** convert exploration findings into an ordered roadmap.

**Outputs:**

- `plan.md` in the upgrade folder. Includes: phased roadmap, sub-phase breakdown, success criteria per phase, first-prototype spec, explicit out-of-scope list.
- Memory updates if the user provides strategic principles during planning (e.g. "stricter than pilot is OK if documented").

**Pre-migration audit** (always run before finalizing the plan): see [`project-issues-analysis.md`](project-issues-analysis.md). Check Langium version, run `pnpm audit`, triage skipped tests, characterize known limitations (Heisenbug-class issues). These can change effort estimates substantially.

**Phase gate:** user signs off on the plan. Strategic decisions resolved explicitly (e.g. "fork-patch disposition", "validation philosophy", "model API timing", "Langium upgrade ordering").

### Phase 3 — Prototype

**Goal:** validate the plan with small, isolated changes before committing to full implementation. Each prototype is a discrete experiment that answers one question.

**Outputs (per prototype, in `docs/maintenance/upgrades/<tag>/prototypes/`):**

- A **packet** — subagent-ready brief. Self-contained: goal, in/out-of-scope, success criteria, required reading, method, output format, **and a "stop if scope expands" clause**.
- A **results doc** — produced by the subagent, in `prototypes/results/N-<name>-result.md`.

**Default packets** (each upgrade may add/remove):

- **P1: Default-value type propagation** — calibrates one Cat. B inference fix.
- **P1a: Reclassify fork patches** — empirical re-check of which fork patches are still load-bearing at HEAD. **Critical:** the catalogue's 2024-12-baseline classifications may be stale.
- **P2: First Langium major hop** — calibrates Phase 0 (Langium upgrade) cost.
- **P3: Stdlib repoint + patches infra** — validates the `.patch`-files-applied-by-clone-script strategy.
- **P4: One validation translation** — validates "spec → validator code" is mechanical.
- **P5: Multi-spec scoping fix** — concretely targets the Probe 2 case (qualified-name redefinition target).

**Orchestration rules** ([per the orchestration doc](upgrades/2026-03/prototypes/00-orchestration.md)):

- **Spawn one at a time** in foreground. Parallel spawns produce a flood of return-results.
- **Use worktree isolation** (`isolation: "worktree"` on the Agent tool). Subagents make uncommitted changes in isolated git worktrees; review the path post-run.
- **~300-word report-back** from each subagent. Detail goes in their results doc.
- **Trust the subagent's findings** but don't paper over: if a subagent reports a finding that warrants plan revision, **revise the plan before spawning the next prototype**.

**Phase gate:** all 5 (or current) prototypes complete with results. Plan revised to reflect what was learned.

### Phase 4 — Implementation

**Goal:** execute the plan. Each phase from `plan.md` is concrete work; this is no longer hypothesis testing.

**Method:** still chunked, still test-driven. Per [memory: feedback_isolate_migration_axes](../../).../memory/feedback_isolate_migration_axes.md): **change one axis at a time**. The test suite is the safety net; don't migrate it concurrently with the language under test.

**Per-phase outputs:**

- Code on a branch.
- Tests green at each phase boundary.
- Phase success criteria met.
- Brief retrospective added to the upgrade folder's `RESUME.md` (or equivalent).

**Phase gate per implementation phase:** the success criteria listed in `plan.md` for that phase.

## Standing principles (durable across upgrades)

These are codified as memories; this is their executive summary:

1. **Conformance over compatibility** — match pilot/spec; never accept what pilot rejects.
2. **Stricter than pilot is OK if documented** — we may reject more; document in [`known_limitations.md`](known_limitations.md).
3. **Authoring, not execution** — this LSP is for authoring; full runtime/semantic equivalence is *not* a goal. Bound scope to what authoring diagnostics need.
4. **Isolate migration axes** — one dimension at a time (Langium upgrade, then SysML; not concurrently). Test suite is the safety net.
5. **Design-thinking phases** — don't skip ahead. Exploration → plan → prototype → implementation.
6. **Calibration on complexity** — SysML v2 is dense. Surface uncertainty honestly; never project confidence on language semantics.
7. **No local paths in repo docs** — `~/work/...` paths belong in memory, not committed docs.
8. **EMF metamodel ripples** — most pilot releases touch the metamodel; expect AST/interface impact even on "stdlib-only" releases.

## Common pitfalls (learned the hard way)

- **The fork-patch catalogue's "load-bearing" classifications drift.** Always run P1a (reclassify patches) early — the LSP evolves and patches become moot without being marked. The 2026-03 cycle found 23 of 26 patches already moot — a ~15x overestimate in the original catalogue.
- **Pre-migration audit may underestimate effort.** The 2026-03 audit estimated Phase 0 (Langium upgrade) at "one focused week"; reality was ~2-3 weeks (ESM migration + 3 hops). Build in margin.
- **Langium 2.0+ is ESM-only.** Any upgrade past 1.x requires a workspace ESM migration as a separate sub-phase.
- **Markdown lint warnings** accumulate when chunks/plan docs are edited iteratively. Do a cleanup pass once strategic content settles, not per-edit.
- **The Heisenbug** ([`pre-migration-audit.md` §3](pre-migration-audit.md#3-heisenbug-characterization)) is a validation/linking race in `validateFeatureTyping`. Best fixed by the multi-spec scoping work; don't expect Phase 1 stdlib swap to address it.

## Where upgrade state lives

Per upgrade `<tag>`:

```
docs/maintenance/upgrades/<tag>/
├── 00-exploration-synthesis.md
├── release-notes-digest.md
├── 01-grammar-keywords.md
├── 02-library-builtins.md
├── 02-library-builtins-fork-patches.md
├── 03-scoping-visibility.md
├── 03a-multi-spec-resolution-pilot.md
├── 03b-visibility-filter-trace.md
├── 03c-redef-target-probe.md
├── 04-type-system.md
├── 05-expressions-evaluation.md
├── 06-validation-rules.md
├── plan.md
├── pre-migration-audit.md  (or at parent level)
├── RESUME.md               (state-of-play for session pickup)
└── prototypes/
    ├── 00-orchestration.md
    ├── 01-default-value-type-prop.md
    ├── 01a-reclassify-patches.md
    ├── 02-langium-1-to-2-hop.md
    ├── 03-stdlib-patches-infra.md
    ├── 04-one-validation-translation.md
    ├── 05-multispec-scoping-skeleton.md
    └── results/
        └── <each prototype's result>.md
```

Permanent (not per-upgrade):

```
docs/maintenance/
├── upstream-sources.md           (what we track; updated each upgrade)
├── upgrade-checklist.md          (procedure; refined as we learn)
├── upgrade-workflow.md           (this document)
└── project-issues-analysis.md    (re-run before each upgrade)
```

## Resuming a paused upgrade

If a previous session left an upgrade mid-flight: read the upgrade's `RESUME.md` first. It captures phase, completed work, pending work, and concrete next steps for session pickup.

If `RESUME.md` is absent or stale, **read in this order**:

1. `00-exploration-synthesis.md` — overall state.
2. `plan.md` — what's planned.
3. `prototypes/results/*-result.md` — what's been tested.
4. The exploration chunks and the catalogue.

Then check `git status` and `git branch` for any in-flight prototype branches.

## Triggering this workflow

Use the `/sysmlupgrade` slash command. Either:

- `/sysmlupgrade` (no arg) — resume the in-flight upgrade (whichever `<tag>` dir exists), or start a new one if none.
- `/sysmlupgrade <tag>` — explicitly start an upgrade targeting that pilot tag (e.g. `/sysmlupgrade 2026-04`).

The command bootstraps Claude into this workflow with all the project memories pre-loaded.
