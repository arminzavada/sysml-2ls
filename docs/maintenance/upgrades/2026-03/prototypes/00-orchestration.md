# Prototype-phase orchestration

> **How the prototype phase runs.** Five discrete prototypes; each is a self-contained subagent brief. The main agent (Claude) orchestrates: spawn → review → integrate → proceed.

## Role split

- **Main agent (Claude, me):** strategic management. Brief subagents, review their outputs, update [`plan.md`](../plan.md) and [`00-exploration-synthesis.md`](../00-exploration-synthesis.md) when prototype findings warrant. Keep my working context lean by delegating actual code-reading and code-writing to subagents.
- **Subagents:** execute one prototype packet end-to-end. Each gets a packet to read and a minimal additional brief. They produce: (a) code changes, (b) a results writeup at `prototypes/results/N-<name>-result.md`, (c) a ~300-word summary I return as their tool output.

## Why prototypes

Per [`feedback_design_thinking_phases`](../../../) memory: prototypes validate the plan **cheaply**, before committing to implementation. Each prototype is sized to answer a specific question:

| # | Prototype | Question it answers |
|---|-----------|---------------------|
| [P1](01-default-value-type-prop.md) | Default-value type propagation | Does the simplest type-inference change in [Chunk 4 §9](../04-type-system.md#9-type-inference-gaps-from-chunk-2-fork-patches-carry-forward-chunk-2-b) work end-to-end and retire a fork patch? |
| [P2](02-langium-1-to-2-hop.md) | Langium `1.2 → 2.x` first hop | What does one Langium major hop actually break, and how long does the fix take? |
| [P3](03-stdlib-patches-infra.md) | Stdlib repoint + patches infrastructure | Does the `.patch`-files-applied-by-clone-script strategy work, and does converting one representative patch reveal blockers? |
| [P4](04-one-validation-translation.md) | Spec → validator translation | Does the "13 validations are mechanical translations" claim hold up against a real spec predicate? |
| [P5](05-multispec-scoping-skeleton.md) | Multi-spec scoping skeleton | Does the existing [`TypeScope`](../../../packages/syside-languageserver/src/utils/scopes.ts) architecture admit the pilot's `gen()` algorithm cleanly, or do we need a larger rewrite? |

Each prototype is **small on purpose**. Success is "we learned something concrete"; failure is also informative.

## Sequencing

```
       P1 (Default-value)   ─┐
                             │
  P2 (Langium 1→2)           ├──→  Review → plan revisions → next round
                             │
  P4 (One validation)        ─┘
                             
  P3 (Patches infra)         ──→  After P1 result (P3 may depend on stable test infra)
                             
  P5 (Multi-spec skeleton)   ──→  Last; biggest, riskiest
```

**Reasoning:**
- **P1, P2, P4 run first**, in any order. Each is independent.
- **P3 runs after** the first batch — P1's test infra changes may inform P3's script changes.
- **P5 runs last** — biggest scope, highest risk of revealing architectural gaps. Better to validate the easier prototypes first so we know our overall workflow is sound.

### Revision after P1 (2026-05-04)

P1's results surfaced that the [fork-patch catalogue](../02-library-builtins-fork-patches.md) may overestimate "load-bearing" patches. Added [P1a — Reclassify fork patches](01a-reclassify-patches.md), to run **before P3** so that P3 has a tighter scope:

```
       P1 (Default-value) ✓ done
         │
         ↓
       P1a (Reclassify patches)  ← inserted; informs P3
         │
P2 (Langium 1→2)              P4 (One validation)
         │
P3 (Patches infra)  ← runs with P1a's reduced scope
         │
P5 (Multi-spec skeleton)
```

I'll spawn them one at a time, not in parallel. Each subagent's result is ~300 words I can integrate fast; parallel spawns would produce a flood of return-results I can't process in one batch.

## Reporting flow

1. Main agent picks a prototype packet to run.
2. Spawn a subagent with the packet contents + minimal extra brief.
3. Subagent executes:
   - Reads required-reading docs.
   - Performs the work.
   - Writes results doc.
   - Reports back via tool output (~300 words).
4. Main agent reviews the report; reads the results doc if needed.
5. **If findings invalidate the plan** → update [`plan.md`](../plan.md), then proceed.
6. **If findings confirm the plan** → mark the packet "done" in the roadmap, proceed.

## Where outputs go

- Code changes: directly in the repo, on a branch named `proto/<packet-name>`. Subagent is asked **not to commit**; main agent decides commit timing.
- Results doc: `prototypes/results/N-<name>-result.md`. Each results doc is the historical record of what was tried, what was found, what the retrospective says.
- Plan revisions: edits to [`plan.md`](../plan.md) or [`00-exploration-synthesis.md`](../00-exploration-synthesis.md), each annotated with the prototype that motivated the change.

## Constraints inherited by all prototypes

Each subagent brief restates these so they don't drift:

1. **Conformance over compatibility** — never accept what the pilot rejects. ([memory](../../../).../memory/feedback_conformance_over_compat.md))
2. **Stricter than pilot is OK if documented** — we may reject more, with a [`known_limitations.md`](../../known_limitations.md) entry. ([memory](../../../).../memory/feedback_stricter_than_pilot_ok_if_documented.md))
3. **Authoring, not execution** — semantic depth bounded by editor diagnostics needs. ([memory](../../../).../memory/project_authoring_not_execution.md))
4. **Design-thinking phases** — prototypes validate, they do not implement broadly. If a prototype's scope expands beyond what's specified, the subagent **stops and reports** rather than continuing. ([memory](../../../).../memory/feedback_design_thinking_phases.md))
5. **Calibration on SysML v2 complexity** — surface uncertainty honestly. ([memory](../../../).../memory/feedback_calibration_on_complexity.md))

## State of the world

- Exploration phase: complete (12 deliverables under `upgrades/2026-03/`).
- Planning phase: [`plan.md`](../plan.md) drafted, audit-revised, five strategic decisions resolved with Armin.
- Pre-migration audit: complete ([`pre-migration-audit.md`](../../pre-migration-audit.md)).
- Prototype phase: **starting now.**

When all five prototypes have results in hand, the next strategic conversation is whether to:
- **Proceed to implementation** with the prototype-validated plan, or
- **Revise the plan** if prototypes surfaced unexpected complexity, or
- **Reorder phases** based on what turned out to be hardest.
