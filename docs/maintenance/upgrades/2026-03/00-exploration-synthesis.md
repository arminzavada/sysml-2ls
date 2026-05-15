# 2026-03 upgrade — exploration synthesis

> **Per-upgrade artifact, end of exploration phase.** Synthesizes findings from all six chunk deliverables and three Chunk 3 follow-ups. Inputs to the **planning phase** that follows; not itself a plan.
>
> **Date:** 2026-05-04. **Target:** pilot tag `2026-03` (commit `3a1be5b87`), `SysML-v2-Release` tag `2026-03` (commit `cd99f7ca7`).

## Revisions from prototype-phase findings (2026-05-04)

### From P2 (Langium 1→2 hop attempt)

**The pre-migration audit underestimated Phase 0 by ~3x.** The Langium 1→2 hop is *not* mechanical. Three issues:

1. **Langium 2.0+ is ESM-only.** The repo is workspace-wide CJS; an ESM migration of all 6 packages is a prerequisite. Realistic chunk: ~1 week of focused work.
2. **`createParser` removed from public Langium API.** The repo's `SysMLParser` depends on this internal symbol — a refactor, not a rename.
3. **43 TS errors across 12 files** from various API reshuffles even after the mechanical translations.

Phase 0 reframed as four sub-phases (ESM migration + three Langium major hops). Realistic total: **2–3 weeks**, not "one focused week."

### From P1 + P1a (fork-patch reclassification)

[P1a](prototypes/01a-reclassify-patches.md) surfaced two significant revisions to the exploration findings below:

1. **Headline #2 ("multi-spec scoping is the highest-leverage single fix") is partly stale.** The catalogue's claim that ~10 fork patches (Cat. A + J) would be retired by the scoping fix assumed all of those patches were still load-bearing. P1a's empirical reclassification shows that **23 of 26 fork patches are already moot at HEAD**, including *all* Category A diamond-redefinition expansions. The diamond-resolution gap has been closed in the LSP since the 2024-12 baseline — likely as part of recent revival work — without being documented. The multi-spec scoping fix is **still needed for [Probe 2's still-failing qualified-name redefinition case](03c-redef-target-probe.md)** (Chunk 3 item 4 + item 5), but it doesn't collapse a large patch backlog.
2. **Headline #3 ("most fork patches are not moot at 2026-03") is reversed.** Of the catalogued 26 patches: **23 moot, 2 contradicts upstream (drop on principle), 1 actually load-bearing** (`Occurrences.kerml`, an `end`-keyword cross-feature participant case that fires `checkFeatureCrossingSpecialization` falsely). [Phase 1's scope](plan.md#phase-1--stdlib-pin-migration--fork-patch-infrastructure) collapses to: build the `.patch` infrastructure, populate it with one patch (`Occurrences.kerml`), and file one LSP bug against `checkFeatureCrossingSpecialization`. The 23 moot patches evaporate at re-fetch.

[Catalogue (Chunk 2 sub-deliverable)](02-library-builtins-fork-patches.md) has been updated with the per-file reclassification. P1a's harness ([`scripts/reclassify-patches.ts`](../../../packages/syside-languageserver/scripts/reclassify-patches.ts)) is reusable for future upgrades.

## Index of exploration deliverables

- [`release-notes-digest.md`](release-notes-digest.md) — what changed upstream between baseline `2024-12` and target `2026-03`, drawn from the pilot's 12 GitHub releases.
- [`01-grammar-keywords.md`](01-grammar-keywords.md) — grammar/AST-level deltas.
- [`02-library-builtins.md`](02-library-builtins.md) — stdlib content + repo-coupling map.
- [`02-library-builtins-fork-patches.md`](02-library-builtins-fork-patches.md) — catalogue of fork patches against upstream `2024-12`, with three-option strategic analysis.
- [`03-scoping-visibility.md`](03-scoping-visibility.md) — scope/visibility deltas + carry-forwards.
- [`03a-multi-spec-resolution-pilot.md`](03a-multi-spec-resolution-pilot.md) — pilot's multi-specialization resolution algorithm, transcribed from `KerMLScope.xtend` with verbatim excerpts.
- [`03b-visibility-filter-trace.md`](03b-visibility-filter-trace.md) — static trace of `protected` filter on `::` vs `.` chains.
- [`03c-redef-target-probe.md`](03c-redef-target-probe.md) — Jest probe confirming the 2025-11 redefinition-target bug is present in this repo.
- [`04-type-system.md`](04-type-system.md) — typing-relations deltas.
- [`05-expressions-evaluation.md`](05-expressions-evaluation.md) — evaluator + filter-expression deltas.
- [`06-validation-rules.md`](06-validation-rules.md) — validation-constraint deltas (the 2026-01 batch + others).

## Headline findings

**1. The 2025-02 grammar release is the foundation.** Almost everything downstream depends on it: `var`/`const`/`constant`, `new`, `$::`, send/accept body forms, `derived` ordering, all library renames. The repo's grammar is fundamentally pre-2025-02 — implementing 2025-02 grammar is the prerequisite for testing most other items. ([Chunk 1](01-grammar-keywords.md))

**2. Multi-specialization name resolution is the single highest-leverage fix.** Implementing the pilot's `KerMLScope.xtend` algorithm in this repo's scope provider closes:
- Chunk 3 items 3 (multi-spec), 4 (qualified-name redef target — bug *confirmed* by Probe 2 in [03c](03c-redef-target-probe.md)), 5 (accept-body receiver).
- Chunk 2 fork patches Category A (~9 files of manual diamond-redefinition expansion) and Category J (receiver hiding) — ~10 of the ~16 fork-only patches become unnecessary.
- Probable downstream cleanup of typing decisions that depend on correct member resolution.

The pilot's algorithm is documented in [`03a-multi-spec-resolution-pilot.md`](03a-multi-spec-resolution-pilot.md): three load-bearing mechanisms — `gen()` traverses **all** owned specializations even after a match; a `redefined` accumulator filters out redefined inheritance during the walk; and `addName()` performs a final tie-break replacing an entry when a redefining feature arrives.

**3. Type inference gaps form a second, smaller cluster.** Chunk 2 Category B fork patches (~6 files of explicit `: Type` / `as Type` ascriptions) trace to specific gaps: default-value type propagation, `size(...)` return-type narrowing, redefining-feature type inheritance, implicit subtyping for nested types. Each is small in isolation; together they are a useful prototype scope. ([Chunk 4 §9](04-type-system.md))

**4. Library re-fetch handles most stdlib work; repo-side renames are mechanical but high-volume.** `FlowConnection*` → `Flow*` touches ~25 files including 3 dedicated model classes (with file renames), grammar interfaces, generated code, printer, metamodel-builder, validator. Confirmed plan: filenames mirror class names. ([Chunk 2](02-library-builtins.md))

**5. The fork-patch wipe surfaces real LSP debt, not nothing.** Most fork patches do not become moot under upstream `2026-03`. The catalogue's recommendation is a staged option (b)→(a): convert to versioned `.patch` files applied by the clone script (so the upgrade unblocks), treat each patch as an LSP bug ticket, retire it when fixed. Two patches contradict the spec and must be dropped outright. ([Chunk 2 patches](02-library-builtins-fork-patches.md))

**6. The 2026-01 validation batch is uniformly missing.** All 13 validations are either commented out in this repo as "implicitly ensured by the model" (6 of them) or absent entirely (7 of them). The work is mechanical translation of spec constraints; bounded but voluminous. ([Chunk 6](06-validation-rules.md))

**7. Several items closed unexpectedly *positively*.** The visibility filter on `.` chains ([03b](03b-visibility-filter-trace.md)) is *likely already conformant* with the 2025-10 change — both `::` and `.` go through `localScope` with `inherited.visibility = public`. Behavioral confirmation still recommended.

## Cross-cutting findings

### What we know about the broader work surface
- **Grammar work, scoping work, type-inference work, library renames, and validation translation** are the five major buckets.
- They have natural sequencing: grammar → library renames (depend on AST/grammar) → scoping fix (independent) → type-inference fixes (depend on grammar+typing) → validation (mostly independent, can interleave).
- The Semantifyr integration consumes this repo's API; per the conformance rule, it adapts to whatever shape we produce — does not constrain decisions.

### Things needing spec consultation in planning
- Item 6 of Chunk 4 (item-usage typing softening) — repo's rule names `Structures`, pilot's was `ItemDefinition`; spec PDF settles which is current.
- Item 5 of Chunk 5 (reduced evaluable function set) — a normative table in the KerML spec.
- The 13 Chunk 6 validations — each defined precisely in the spec; the predicate is the implementation.

### Items I have *not* fully traced (debt for planning)
- **Item 7 of Chunk 4 (KERML11-191):** the OMG issue is referenced but not described in release notes; substance unknown. Recorded for Armin's recall or OMG-tracker lookup.
- **Item 2 of Chunk 4 (end-features-redefined-only-by-end-features):** worth re-evaluating after Chunk 1 grammar work lands.
- **`validateConnectorBinarySpecialization` 2025-07 correction:** repo has the validator by name, semantic conformance unverified.
- **The full evaluator algorithm** (`evaluator.ts`, 353 lines) — surveyed but not read end-to-end.
- **Spec-PDF text** for any of the constraint or typing items.

## Strategic choices that will need decisions in planning

1. **Fork-patch disposition.** Catalogue recommendation: drop the 2 contradiction patches, convert the rest to `.patch` files applied by the clone script, treat each as an LSP bug ticket. Decision needed before re-running the clone script.
2. **Sequencing of grammar work vs. multi-spec scoping fix.** They're independent; grammar work unlocks more downstream items but the scoping fix has the highest single-fix leverage. Either can come first.
3. **Validation translation philosophy** ([06 §Open questions](06-validation-rules.md)): commit to mechanical spec-to-validator translation for all 13, or sequence by user-visible-diagnostic value? Affects timeline.
4. **Model API design** ([memory](../../../).../memory/project_overview.md, cross-cutting goal) — this exploration informs the API shape (scoping operations, type queries, evaluator entry points), but the API itself needs its own design pass once Chunks 3 and 4 implementation directions are firmer.
5. **Prototype target.** My recommendation: the **type-inference patches** (Category B) are the lowest-friction first prototype — small, isolated, testable end-to-end. They validate the workflow without requiring the full multi-spec scoping rewrite. Multi-spec is the bigger prize but a more ambitious first prototype.

## Confidence note

Per the [calibration rule](../../../).../memory/feedback_calibration_on_complexity.md): every chunk explicitly marks items as `understood` / `structurally-clear` / `needs-deeper-trace` / `consult-Armin`. Items at lower confidence levels are the ones most likely to shift during planning. Specifically, the cross-cutting "every change touches the EMF metamodel" note ([memory](../../../).../memory/project_pilot_changes_touch_emf.md) implies that even items I marked as content-only at upgrade time may have AST/interface ramifications I didn't surface in static review.

## What ends with this synthesis

- **Exploration phase complete.**
- All identified gaps catalogued by chunk; cross-cutting leverage identified.
- A short list of decisions for planning is on the table.

## What begins with the next phase

- **Planning phase.** Given the catalogues, decide: (a) sequencing of work; (b) fork-patch disposition; (c) prototype target; (d) how the model-API design track interleaves; (e) what validation philosophy to commit to.
- Planning produces a written plan with explicit decisions on each point, ready for prototype-phase work.
