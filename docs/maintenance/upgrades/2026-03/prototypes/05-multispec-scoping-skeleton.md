# Prototype P5 — Qualified-name redefinition-target fix

> **Subagent brief — REVISED 2026-05-04.** Original P5 scope (multi-spec scoping skeleton aimed at retiring diamond patches) is **partly obsolete** — [P1a](01a-reclassify-patches.md) showed all Category A diamond patches are already moot, meaning the LSP's diamond resolution is fine at HEAD. What remains as a real bug is **Probe 2's qualified-name redefinition target failure** ([Chunk 3 §4](../03-scoping-visibility.md), [`03c-redef-target-probe.md`](../03c-redef-target-probe.md)): when a redefinition target's first segment has a self-collision (e.g. `B :> A; B { classifier X; feature :>> X::y; }` where both A and B have an `X`), the resolver picks self's `X` and the `X::y` resolution fails.
>
> **Revised goal:** implement just enough scoping change to make Probe 2 pass.

## Goal

Implement the `isRedefinition` short-circuit from the pilot's `KerMLScope.xtend:209-213` ([per `03a-multi-spec-resolution-pilot.md` §3](../03a-multi-spec-resolution-pilot.md#3-redefinition-target-resolution----ab)): when resolving the first segment of a qualified-name redefinition target, start lookup from inherited members (the `gen` path), not from self's owned members. This is the change that fixes Probe 2.

**Do not** implement the full multi-spec `gen()` algorithm, the `redefined` accumulator, the `addName` tie-break, the `$::` global qualifier, or anything else from chunk 3.

## What this prototype answers

**Question:** Can the existing scope-provider's `initialScope()` ([`scope-provider.ts:141-224`](../../../packages/syside-languageserver/src/services/references/scope-provider.ts)) be extended with a redefinition-context short-circuit cleanly, or does the surrounding architecture fight it?

This is now the **last remaining Chunk 3 work** for the upgrade — diamond resolution is fine. If this prototype lands cleanly, Chunk 3 closes; if it surfaces friction, we know to expand the prototype's scope.

## In scope

- Read [`03-scoping-visibility.md`](../03-scoping-visibility.md), [`03a-multi-spec-resolution-pilot.md`](../03a-multi-spec-resolution-pilot.md), [`03c-redef-target-probe.md`](../03c-redef-target-probe.md).
- Locate the equivalent of the pilot's `gen()` loop ([`KerMLScope.xtend:380-383`](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/blob/2026-03/org.omg.kerml.xtext/src/org/omg/kerml/xtext/scoping/KerMLScope.xtend#L380)) in this repo's [`scopes.ts`](../../../packages/syside-languageserver/src/utils/scopes.ts) — likely inside `TypeScope` (line 387+).
- Change it to traverse all owned specializations regardless of whether a match was found.
- Add a Jest test that exercises a diamond case: `class T :> A, B; A { f; } B { f :>> A::f; }` — both branches must be visible to the walk for the redefinition tie-break to be possible.
- **Do not** implement the tie-break itself or the `redefined` accumulator. Those are followup prototypes (or implementation-phase work) after this one validates the architecture.

## Out of scope

- The `redefined` accumulator from [`03a-multi-spec-resolution-pilot.md` section 2c](../03a-multi-spec-resolution-pilot.md#2c-inheritance-in-gen--the-multi-specialization-case).
- The `addName` tie-break.
- `$::` global qualifier.
- Visibility filter changes.
- Retiring any fork patches (the patches need both the accumulator AND the tie-break; just the loop change alone doesn't retire them — and that's an interesting *negative* result worth recording).
- Committing. Branch `proto/p5-multispec-skeleton`.

## Success criteria

- The loop change is implemented and the existing test suite is green.
- A new test exercises a diamond case where both A and B branches are traversed. The test asserts something testable about the walk (e.g. that both branches' features are present in the scope's collected memberships, regardless of declaration order).
- **The test passing or failing both count as success.** If it passes, the architecture admits the change cleanly. If it fails because the architecture only supports first-match semantics, that is *exactly* the architectural finding we want.

## Required reading

1. [`03-scoping-visibility.md`](../03-scoping-visibility.md).
2. [`03a-multi-spec-resolution-pilot.md`](../03a-multi-spec-resolution-pilot.md) — especially section 2c on `gen()`.
3. [`03b-visibility-filter-trace.md`](../03b-visibility-filter-trace.md).
4. [`03c-redef-target-probe.md`](../03c-redef-target-probe.md).
5. [`feedback_calibration_on_complexity.md`](../../../) memory — **especially relevant here.** Be especially explicit about uncertainty. SysML v2 scoping is the densest part of the codebase. If you don't fully understand a piece of the existing code, say so in the writeup; don't paper over.
6. Source code: [`packages/syside-languageserver/src/utils/scopes.ts`](../../../packages/syside-languageserver/src/utils/scopes.ts) (614 lines), [`scope-provider.ts`](../../../packages/syside-languageserver/src/services/references/scope-provider.ts) (311 lines).

## Method

1. Read all five required-reading items thoroughly. Allocate generous time for `scopes.ts` itself.
2. Locate the inheritance walk in `TypeScope`. Document what it currently does (early-return on match? collect all? something in between?).
3. If early-return: change it to collect all. If already-collects-all: skip to step 5 with a "no change needed at this layer" note, but verify against the diamond test.
4. Add the diamond test.
5. Run the suite. Document outcome.
6. Write the results doc.

## Output

**1. Code changes**, uncommitted, branch `proto/p5-multispec-skeleton`:
- The minimal change to `scopes.ts`.
- The new diamond test.

**2. Results writeup** at `docs/maintenance/upgrades/2026-03/prototypes/results/05-multispec-skeleton-result.md`. **This is the most important writeup of all five prototypes.** Include:
- What the current `TypeScope` inheritance walk does (verbatim code excerpts).
- What change was needed.
- Did the test pass?
- **Did the change break any existing tests?** If yes, those are tests that currently *rely on first-match semantics* — possibly intentional, possibly incidental. Each is a finding.
- Architectural assessment: does the existing architecture admit the rest of the algorithm (accumulator, tie-break) cleanly? Or is `TypeScope` shaped in a way that fights it?
- Recommendation: should Phase 3a proceed as planned, or does the architecture need pre-work?

## Report back

~300 words: change made, test outcomes (new + regressions), architectural admittance assessment, recommendation for Phase 3a.

## If scope expands

The whole point of this prototype is to find out where the friction is. If you find that even the minimal change cannot be made without a larger rewrite, **stop and document precisely what's blocking**. That negative result is the most valuable possible outcome — it tells us Phase 3a is more expensive than planned.
