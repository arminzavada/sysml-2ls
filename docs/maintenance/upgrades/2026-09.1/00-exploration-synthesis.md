# 2026-09.1 upgrade — exploration synthesis

> End-of-exploration artifact. Input to planning; not a plan.
>
> **Date:** 2026-10-30. **From:** pilot `2026-03` (commit `3a1be5b87`), `SysML-v2-Release` `2026-03` (commit `cd99f7ca`). **Target:** pilot `2026-09.1` (commit `d81b2ad50`), `SysML-v2-Release` `2026-09` (commit `b7a6b770`). Tags in range: `2026-04`, `2026-05`, `2026-07`, `2026-08`, `2026-09`, `2026-09.1` (no `2026-06`).

## Index

- [`release-notes-digest.md`](release-notes-digest.md) — per-tag upstream changes, ecore-diff verdict.
- [`01-grammar-keywords.md`](01-grammar-keywords.md) — G1–G7, X1.
- [`02-library-builtins.md`](02-library-builtins.md) — L1–L6, F1/F2, stdlib registry (its S1).
- [`03-scoping-visibility.md`](03-scoping-visibility.md) — S1–S7.
- [`04-type-system.md`](04-type-system.md) — T1–T11.
- [`05-expressions-evaluation.md`](05-expressions-evaluation.md) — E1–E5.
- [`06-validation-rules.md`](06-validation-rules.md) — V1–V14, G5, TV, pre-existing inventory (A/B/C).

## Headlines

1. **No metamodel change.** The `2026-04` ecore churn is re-sorting plus a duplicated module. The only structural change is `SendActionUsage::payloadArgument` lower bound 1→0, which our AST already models as optional. AST impact comes only from grammar, and the grammar needs no new properties.
2. **The library hop is test-neutral.** With the `2026-09` pin: 79 files / 2165 passed / 7 skipped, stdlib diagnostics `{}`, Semantifyr models and OXSTS snapshots unchanged. 10 library files change, none added, removed or renamed.
3. **Name resolution is unchanged upstream.** The `2026-09.1` proxy fix doesn't apply to us.
4. **The in-range port is small.** Seven grammar widenings/narrowings (G1–G7), four type-system derivations (T2, T2b, T5, T9) and three new pilot-rejects validators (V1, V5, V11). Estimated at a few focused days.
5. **The bigger exposure is pre-existing.** Probing for this range surfaced conformance gaps older than `2026-03`. In all of them we accept what the pilot rejects or misclassify:
   - Compositeness of connection, interface, allocation and flow usages (T3).
   - Flow classification (T7/F1, T8/F2).
   - `ownedPorts` (T4).
   - The bodied `send` form and payload-less state sends (X1, V3).
   - 11 reachable pilot validators with no counterpart here (inventory A).
   - Missing default multiplicity (T1).
   - An undocumented stricter-than-pilot set (inventory B) and a wrong `known_limitations.md` entry.

## In-range work (required for conformance at `2026-09.1`)

| Layer | Items | Direction | Size | Notes |
| --- | --- | --- | --- | --- |
| Stdlib pin | `2026-09` | — | < 1 h | Pin + `upstream-sources.md` + README. Re-clone required. |
| Grammar | G1, G3, G4, G5, G6, G7 | we reject what pilot accepts | < 1 day total | Plus printer fixes for G5 (value dropped) and G7 (multiplicity refused). G1/G6 need lookahead tests. |
| Grammar | G2 (`frame concern` body) | both directions | in the above | We also accept result expressions/`return`/action nodes the pilot now rejects. |
| Typing | T2 (attribute-owned usages referential), T2b (variant compositeness), T5 (`isSubrequirement`) | misclassification | < 1 h each | T2 unblocks V6 (attribute-feature validators, currently TODO). |
| Typing | T9 `mayTimeVary` / `isVariable` | missing derivation | ~0.5 day with V1 | Must not alter `featuredBy`. |
| Validation | V1 time-varying assignment referent | we accept what pilot rejects | ~1 h on T9 | |
| Validation | V11 connection/flow def ends must be usages | we accept what pilot rejects | 1–2 h | Must land **with or after** the stdlib pin: on the `2026-03` library it would flag `Flows::Message`/`MessageAction`. |
| Validation | V5 end-redefinition conformance (narrowed) | we accept what pilot rejects | ~1 h | Validator never existed here. |
| Validation | V8 anchor, V10 severity | cosmetic / severity | minutes | |
| Cleanup | V4 send-parameter check enforces a retired OCL rule | — | minutes | Retire. |

Evaluator items (E1–E5) need no work. E2 (`c#(i)` typed as the whole collection) is pre-existing and low priority.

## Ordering constraints

- Stdlib pin and grammar port are independent; neither uses the other's changes.
- T9 → V1 and the SysML half of TV.
- T2 → V6.
- Stdlib pin → V11.
- T8 (F2) → V12 (our flow-end check over-reports owned ends and misses inherited overflow).

## Pre-existing deviations surfaced (outside the range)

- **T3:** connection/interface/allocation/flow usages are forced referential, so they miss pilot implicit supertypes. Expect snapshot churn.
- **T4:** ports in parts never get `Parts::Part::ownedPorts`.
- **T7/F1:** end-less `message`/`flow` usages are classified as `Flows::flows` instead of `Flows::messages`.
- **T8/F2:** the flow-definition base should be `Flows::MessageAction`. The current base gives a spurious "more than two ends" error.
- **T10/S2:** a classifier with semantic metadata subclassifies the base-type feature itself.
- **T1:** no SysML default multiplicity, so none of the pilot's 8 warnings in its own test model fire. The pilot rule is provisional (SYSML21-185).
- **X1:** the bodied `send { … }` form parses as a payload, so we reject the pilot's own `ActionTest` example.
- **V3:** payload-less `send` in state entry/do/exit and transition effects parses here, but the pilot's grammar rejects it. `send via r;` is the opposite case.
- **G5 (validation):** `validateConnectorRelatedFeatures` is shaped differently, so we accept a non-abstract `interface i = i1;` / `connection c : C;`.
- **Inventory A:** 11 pilot validators reachable from text, missing here. 5 read `isVariable` (overlap with TV), the other 6 are under 1 h each. `validateRedefinitionDirectionConformance` is commented out on our side.
- **Inventory B:** three checks are stricter than the pilot and undocumented: library package severity, part/item occurrence typing, and redefinition featuring types. The `known_limitations.md` entry for `validateFeatureTyping` is inaccurate; the pilot has the same rule.
- **Chunk 2 S1:** the client/browser stdlib download registry (`syside-base/src/stdlib.ts`, `scripts/update-stdlib.mjs`) still points at the retired 2024-12 Sensmetry fork, which returns 404 for `Flows.sysml`.

## Strategic decisions for planning

Resolved by Armin on 2026-10-30; the answers are in [`plan.md`](plan.md#resolved-strategic-decisions-armin-2026-10-30).

- **D1 — Cycle scope.** In-range only, or in-range plus a conformance-backlog phase for the pre-existing deviations?
- **D2 — Default multiplicity (T1).** Port the pilot's provisional rule now, or wait for SYSML21-185?
- **D3 — `isVariable` validators (TV / inventory A1–A5).** Only V1, or all readers alongside T9?
- **D4 — Connection/flow compositeness (T3).** Fix this cycle (snapshot churn), or document as a known limitation?
- **D5 — Send grammar (X1, V3).** Fix in this cycle's grammar phase, or track separately?
- **D6 — Stricter-than-pilot set (inventory B).** Align with the pilot, or document in `known_limitations.md`? Also fix the `validateFeatureTyping` entry.
- **D7 — Stdlib download registry (chunk 2 S1).** Retarget to the pin, derive it from the pin, or drop the download path?

## Not affecting us

Scoping refactors (S3, S4, S7), the proxy fix (S1), self-annotation recursion (S6), evaluator items E1/E3–E5, V2/V7/V9/V13/V14, and infrastructure/relicensing in `2026-04`.
