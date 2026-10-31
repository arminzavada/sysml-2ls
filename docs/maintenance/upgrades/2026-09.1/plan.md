# 2026-09.1 upgrade — plan

> **Date:** 2026-10-30. **Target:** pilot `2026-09.1` (commit `d81b2ad50`), `SysML-v2-Release` `2026-09` (commit `b7a6b77000c9136f8f24822fc9d2cb237c76267f`).
>
> Item IDs refer to the exploration chunks; see [`00-exploration-synthesis.md`](00-exploration-synthesis.md).

## Resolved strategic decisions (Armin, 2026-10-30)

- **D1 — Scope:** in-range port plus the adjacent pre-existing fixes (T4, T7/F1, T8/F2, T10, X1, V3, V4 retirement), then a conformance-backlog phase after the pin advance (T3, inventory A6–A11, G5, inventory B).
- **D2 — Default multiplicity (T1):** wait for SYSML21-185; document as a known limitation.
- **D3 — `isVariable` readers:** port all of them (inventory A1–A5) alongside T9, including KerML `const ⇒ var`.
- **D4 — Compositeness (T3):** fix in the backlog phase; accept snapshot churn.
- **D5 — Send grammar (X1, V3):** fix in the grammar phase.
- **D6 — Stricter-than-pilot set (inventory B):** align with the pilot; correct the `validateFeatureTyping` entry in `known_limitations.md`.
- **D7 — Stdlib download registry:** derive from the clone-script pin.
- **Prototype phase:** folded into implementation at Armin's direction ("perform the upgrades"). The risky items (T9, G1/G6 lookahead, T3 churn) are sized at the start of their phase; a phase stops and reports if its scope expands.

## Phases

Tests green at each phase boundary. Changes stay uncommitted on `main`'s working tree until Armin commits.

### Phase 1 — Stdlib pin and registry

- Pin `clone-sysml-release.mjs` to `2026-09`; re-clone.
- D7: derive the client/browser download registry (`syside-base/src/stdlib.ts`, `scripts/update-stdlib.mjs`) from the pin (chunk 2 S1).
- Update `upstream-sources.md` and any version mention in READMEs.
- **Done when:** suite green, stdlib diagnostics empty, Semantifyr snapshots unchanged.

### Phase 2 — Grammar

- G1–G7, with printer fixes for G5 (value dropped) and G7 (multiplicity refused); G2 in both directions.
- X1 bodied `send { … }`, V3 payload-less `send` in state actions/transition effects; retire the V4 send-parameter check.
- Lookahead tests for G1 and G6.
- **Done when:** suite green, every chunk 1 probe parses (or fails) as in the pilot.

### Phase 3 — Typing

- T2, T2b, T5.
- T9 `mayTimeVary` / `isVariable` derivation; KerML `const ⇒ var`. `featuredBy` stays untouched.
- T4 `ownedPorts`, T7/F1 message classification, T8/F2 `Flows::MessageAction` base, T10 semantic-metadata base type.
- **Done when:** suite green, every snapshot change traced to an item.

### Phase 4 — Validation

- V1, V5, V11, V6 (after T2), V12 (after T8), V8 anchor, V10 severity.
- Inventory A1–A5 (`isVariable` readers).
- Time-varying end usages are constant (ST6RI-856), with A3; needs explicit vs derived `constant` in the printer. *(Added 2026-10-31 from Phase 3.)*
- **Done when:** suite green, each chunk 6 probe reports as in the pilot.

### Phase 5 — Conformance backlog

Split into two runs *(2026-10-31)*.

#### 5a — Typing backlog

- T3 connection/interface/allocation/flow compositeness.
- From Phase 3: non-port occurrence usages lack the pilot's `object`/`subobject`/`dataValue` supertypes; association default supertype by owned ends; checks other than compositeness that still treat a variant as owned by its variation (e.g. variant actions subset `enclosedPerformances`).

#### 5a2 — Typing follow-ups *(added 2026-10-31 from 5a)*

- Drop the implied typing of snapshot/timeslice usages by their owner (`addImplicitOccurrenceUsageTyping`), which the pilot removed in `2025-02` (SYSML2_-158); stop if name resolution the pilot supports depends on it.
- Reference usages, plain `#keyword` usages, attribute usages and KerML features pick their default supertype from owned typings only, as the pilot does.

#### 5a3 — Typing tail *(added 2026-10-31 from 5a2)*

- Constructor-expression results typed by the instantiated type.
- No default supertype on flow ends.
- KerML `portion` features not composite.

#### 5b — Validation backlog

- Inventory A6–A11.
- G5 `validateConnectorRelatedFeatures` by related features; binary-specialization shape.
- Inventory B alignment: library-package severity, part/item occurrence typing, redefinition featuring types (set equality).
- From Phase 4: V11/V12 end counting ignoring redefined ends as the pilot does; the extra cross-feature type error on the pilot's cross-features test model.
- From 5a3: diagnostic codes and messages still using pre-`2025-02` names (`validateItemFlowEndSubsetting`, "ItemFlowEnd …") renamed to the pilot's.
- `known_limitations.md`: correct `validateFeatureTyping`, add T1.

#### 5c — Remaining pilot-rejects *(added 2026-10-31 from 5b)*

- Scoping: transition source and succession target resolve in the owning namespace (pilot `SysMLScopeProvider`); operator-expression operand names do not resolve to the operator function's parameters. Then land A10 and A11.
- KerML behaviors and steps get implied parameter redefinitions (A6 gap).
- `validateFeatureEndFeatureMultiplicity`: the pilot's inherited-multiplicity warning.
- `validateSubsettingFeaturingTypes` / `checkConnectorTypeFeaturing` as errors (blocked by snapshot featuring on `TimeVaryingCarDriver.kerml`): align if local, otherwise document.
- Crash: `assign (p).x := 1;` in `astToModel`.
- *(2026-10-31: done. `assign (expr).x` parity needs a grammar change; documented in `known_limitations.md` instead, like extra invocation arguments and the implied-parameter-redefinition gap.)*

- **Done when:** suite green, the stricter-than-pilot list contains only documented entries, and no known pilot-reject is accepted without a `known_limitations.md` entry.

### Close

- `upgrade-checklist.md` lessons, `RESUME.md` retrospective.

## Out of scope

- T1 default multiplicity (documented, pending SYSML21-185).
- E2 `c#(i)` typing.
- Inventory C (not reachable from text in the pilot).
- Constructor-expression result feature (5a3): the pilot's `ConstructorExpression` owns a result feature holding the arguments; ours has none. Porting it is an AST change reaching scoping, the evaluator, the printer and the Semantifyr mapper. Deferred for Armin.
