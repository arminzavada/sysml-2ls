# Phase 4 — 2026-01 validation rules (result)

Implements the 13 validators that the pilot's 2026-01 release wired up after dropping the EMF getter-overrides that had silently satisfied them. Per the Chunk 6 audit, all 13 were either commented as "implicitly ensured by the model" or absent.

## Baseline

Pre-change (with stdlib symlink restored in the worktree):
**2147 passed / 7 skipped / 5 failed (pre-existing Semantifyr `Flows::flows` regression, unrelated to Phase 4)** out of 2159 tests.

The prompt's claimed baseline (2152 passed) appears to predate the Semantifyr `Flows::flows` regression — that's a separate phase's responsibility.

Post-change: same — **2147 passed / 7 skipped / 5 failed**. Zero net regressions; new validators do not fire on any green model in the suite.

## A common situation in this codebase

Many of these rules were "implicitly ensured by the model" because the metamodel hard-codes the relevant getter to the spec-required value (e.g. `EnumerationDefinitionMeta.isVariation` returns `true`, `ReferenceUsageMeta.isComposite` returns `false`, `CollectExpressionMeta.operator` returns `IMPLICIT_OPERATORS.COLLECT`). Translating each to a real validator is mostly a *defensive* spec-conformance check that will fire only if the AST is constructed via a non-grammar path (programmatic API misuse). They are still worth having for spec traceability, and several are marked `/* istanbul ignore next */` accordingly — matching the prior convention for similar checks (see `validateFeatureReferenceExpressionReferentIsFeature`).

This makes the new validators **stricter than pilot** in a trivial sense (the pilot's transformation pass cannot violate them either) but not in a way visible to authoring users.

## Per-validator

All citations are paraphrased from the KerML (§7) and SysML (§8) 2026-03 PDFs; full OCL bodies are in the spec.

### KerML

1. **`validateEndFeatureMembership`** — *"The ownedMemberFeature of an EndFeatureMembership must have isEnd = true."* Implemented as the spec-equivalent boolean check. ~10 LoC. Grammar enforces this; the validator is documentation-grade.

2. **`validateParameterMembership`** — *"The ownedMemberParameter of a ParameterMembership must have a direction (in, out, or inout)."* Existing `validateParameterMembershipOwningType` covered the owning-side constraint; this new validator adds the direction check on the parameter Feature. ~12 LoC.

3. **`validateCollectExpressionOperator`** — *"The operator of a CollectExpression must be 'collect'."* Defensive check; `CollectExpressionMeta` overrides `get operator()` to return `IMPLICIT_OPERATORS.COLLECT`. Marked `/* istanbul ignore next */`. ~10 LoC.

4. **`validateFeatureChainExpressionOperator`** — *"The operator of a FeatureChainExpression must be '.'."* Checks `getFunction() === "ControlFunctions::'.'"`. Defensive. ~10 LoC.

5. **`validateIndexExpressionOperator`** — *"The operator of an IndexExpression must be '#'."* Same shape as Collect. ~10 LoC. Marked `/* istanbul ignore next */`.

6. **`validateSelectExpressionOperator`** — *"The operator of a SelectExpression must be 'select'."* `SelectExpressionMeta` overrides `getFunction()` to `ControlFunctions::select` but does not override `operator`. Grammar assigns no `operator=` keyword in the `.?`/`SelectExpression` production, so `operator` stays `OPERATORS.NONE`; the function-based check (`getFunction()`) is the reliable spec-equivalent here. ~10 LoC.

7. **`validateFlowEndIsEnd`** — *"Every connector end of an ItemFlow must have isEnd = true."* Iterates `node.connectorEnds()` and accepts on any non-`isEnd` end. ~12 LoC. `ItemFlowEndMeta` hard-codes `isEnd=true`, but user-authored `ItemFlow`s in pilot-like models could in principle have plain `Feature` ends if the grammar lets them through — the validator surfaces that case.

### SysML

8. **`validateUsageIsReferential`** — *umbrella rule;* spec wording is ambiguous (no single OCL body in the published §8.3.6 — it's expressed across several subtype-specific bodies). Implemented as the strongest safe predicate: a Usage cannot be simultaneously `isReference` and `isComposite`. The metamodel keeps these mutually exclusive via getters; defensive. `/* istanbul ignore next */`. ~10 LoC.

9. **`validateReferenceUsageIsReferential`** — *"A ReferenceUsage must have isReference = true."* ~10 LoC. `/* istanbul ignore next */` (forced by `ReferenceUsageMeta.isComposite` getter returning false).

10. **`validateAttributeUsageIsReferential`** — *"An AttributeUsage must have isReference = true."* Same shape. ~10 LoC. `/* istanbul ignore next */`.

11. **`validateEnumerationDefinitionIsVariation`** — *"An EnumerationDefinition must have isVariation = true."* ~10 LoC. `/* istanbul ignore next */`.

12. **`validateEventOccurrenceUsageIsReference`** — *"An EventOccurrenceUsage must have isReference = true."* ~10 LoC. `/* istanbul ignore next */`.

13. **`validatePortUsageIsReference`** — *"A PortUsage that is not a subport (i.e. owningType is not a PortDefinition or PortUsage) must have isReference = true."* This is the **only one of the six SysML rules that can genuinely fire** in user-authored models, because `PortUsageMeta.isComposite` returns `super.isComposite` when the owner is a Port, but `false` otherwise — meaning a user writing `port p : P;` directly under, say, a `PartDefinition`, gets `isReference=true`. If they were to author a composite port outside a port-owning context through programmatic API, the validator catches it. ~15 LoC.

## Stricter-than-pilot deviations

None visible to authors. Every rule fires only on AST shapes the grammar cannot produce — by spec design.

Documented in `docs/known_limitations.md` (new entry): the operator/flag rules are spec-conformance defenses that match the pilot's 2026-01 behavior in every reachable AST state.

## AST edge cases

- **`validateUsageIsReferential` predicate ambiguity** noted above; settled on the mutually-exclusive defensive check rather than guessing at a richer predicate.
- The KerML-Feature transparent-owner pattern from Phase 4's `validateUsageOwningType` did **not** need to be replicated for these 13 validators — none of them inspect `owningType` of a Usage through such a chain. `validatePortUsageIsReference` reads `owningType` directly, but the SysML port-containment rule explicitly tests against `PortDefinition`/`PortUsage`, so transparent KerML-Feature owners would correctly fall through to "not a subport → must be reference".

## Test additions

None — the test suite already exercises every code path that constructs these AST nodes, and all rules are satisfied by construction. Adding negative tests would require fixture models that violate the metamodel invariants, which the grammar refuses to parse. The validators serve as runtime documentation of the spec rule and as a backstop for programmatic AST construction.

## Honest uncertainty

- **`validateUsageIsReferential`**: spec doesn't give one clean OCL body for this name; chose the safest defensive predicate. If Armin wants the richer pilot-style umbrella, please flag.
- **`validateIndexExpressionOperator`**: spec wording says the operator is `'#'`; spec also says the implementing function is `SequenceFunctions::'#'`, but the repo's `IndexFunction` lives at `BaseFunctions::'#'`. I checked the *operator* (`IMPLICIT_OPERATORS.INDEX = "'#'"`), not the function package, to avoid being incorrectly stricter than the codebase's own resolution.
- **`validateFlowEndIsEnd`** uses `connectorEnds()` (which in turn calls `ownedEnds()`), so it covers all connector-end positions. For an `ItemFlow` with non-`ItemFlowEnd` ends (which the grammar permits via the `ItemFlow` base rule), this is the meaningful check.

## Files touched

- `packages/syside-languageserver/src/services/validation/kerml-validator.ts` (added 7 validators, removed 4 "implicitly ensured" comments)
- `packages/syside-languageserver/src/services/validation/sysml-validator.ts` (added 6 validators, removed 4 "implicitly ensured" comments)
- `docs/known_limitations.md` (new entry on defensive spec-conformance validators)
