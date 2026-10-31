# Phase 5a3 — Typing tail result

The three items from the "not changed" list of [`phase-5a2-typing-followups-result.md`](phase-5a2-typing-followups-result.md). Items 2 and 3 are done. Item 1 is stopped: it needs an AST change. Uncommitted on `main`.

## Verification

- `pnpm typecheck` (plus `tsc -b --force` in `syside-languageserver`), `pnpm lint`: clean.
- `pnpm test`: 88 files, 2410 passed, 7 expected fail, 7 skipped (baseline 88 / 2405). 5 tests added. One probe expectation extended (see item 2).
- No snapshot changes. The stdlib-diagnostics snapshot stays `{}` and the four OXSTS snapshots are unchanged.
- Release models under `sysml/src` and `kerml/src`: the same diagnostics, and every reference resolves to the same target, before and after. Typing changes:
  - 196 flow ends lose `Base::things` and `Links::Link::participant`;
  - 30 KerML portion features become non-composite. 4 of them get `portions` instead of `suboccurrences`.
- Pilot oracle (`sysml.library.xmi.implied`), same method as Phase 5a, now also comparing `isComposite` on KerML features:
  - `isComposite` mismatches go from 18 to 0. All 18 were `portion` features.
  - Implied-supertype mismatches go from 1728 to 1727 (see item 3).

## Items

### Constructor-expression results — stopped

There is no constructor result feature in our AST, so there is nothing to type.

- Our grammar (2026-03 Phase 2a): `'new' heritage+=OwnedFeatureTyping ArgumentList`. The expression itself is typed by the instantiated type and owns the arguments.
- Pilot: `'new' InstantiatedTypeMember ConstructorResultMember`.
  - The instantiated type is referenced by a plain `Membership`.
  - A `ReturnParameterMembership` owns a result `Feature`, and the arguments are owned by that result.
  - `ConstructorExpressionAdapter.addResultTyping` types the result by the instantiated type.
- The 4 oracle differences reported in 5a2 come from mismatched paths, not from a typing regression:
  - Our `<ConstructorExpression#0>/<Feature#0>` is the first argument. In the pilot it is the result, and the argument sits one level below it.
  - The pilot gives a named argument only its explicit redefinition. Ours also gets `Base::things`, which is redundant. Before 5a2 the argument got `dataValues`, which happened to match the pilot's result.
- A faithful port needs the pilot's AST shape. That touches argument reading (`InvocationExpressionMeta.argumentMembers`), named-argument scoping, the evaluator, the printer, send-action payloads and the Semantifyr mapper. This is the stop clause, so nothing was changed.
- Related gaps with the same cause:
  - The pilot's constructor result redefines `Performances::constructorEvaluations::result` (`[1..1]`).
  - In the pilot, positional arguments redefine the instantiated type's public features (`getConstructorRelevantFeatures`, `checkConstructorExpressionResultFeatureRedefinition`). Ours have no redefinition.
  - Our expression is typed by the instantiated type; the pilot's is not. `returnType()` already gives the instantiated type, so type inference of `new P(...)` is not affected.
- Independent of the AST: the pilot's constructor expressions subset `Performances::constructorEvaluations`, and ours subset `Performances::evaluations` (7 in the stdlib). This could be ported alone, but it is outside this item.

### Flow ends: no default supertype

- `model/KerML/item-flow-end.ts`: `defaultGeneralTypes()` returns nothing. The pilot's `FlowEndAdapter.computeImplicitGeneralTypes` adds only computed redefinitions.
  - Flow ends lose `Base::things`.
  - They also lose `Links::Link::participant`, because the pilot's `addParticipantSubsetting` belongs to the `addDefaultGeneralType` step that is skipped.
  - They keep the end redefinition (`Flows::flows::source`, ...) and the implied flow-end subsetting.
- Consequence: with the stdlib loaded, `validateItemFlowEndSubsetting` ("Cannot identify ItemFlowEnd (use dot notation)") could never fire, because the default subsetting counted. It now fires on ends without dot notation whose redefined feature is not owned by a feature, as the pilot's `checkFlowEnd` does.
  - The pilot's xpect model `Relationship_invalid_relatedElement1` gets the same two errors here.
  - No release model has such ends.
- Probe change: `PortDefinitionConnections` (added in 5a) has `flow f of X from o to i;`, where `o` and `i` are owned by the port def. It now also reports `validateItemFlowEndSubsetting` on both ends. The pilot reports the same by the same code path. This comes from reading the pilot code; the pilot was not run.

Tests:

- `__tests__/integration/stdlib-typing.test.ts`, "flows": the implied supertypes of flow ends, and the pilot's xpect model.

### KerML portion features are not composite

- `utils/ast-to-model.ts`: `isComposite` comes only from `composite`, and `portion` sets only `isPortion`, as in the pilot grammar.
- `model/printer/namespaces.ts`: removed the stale "portion implies composite" comment. Printing is unchanged.
- Effects:
  - A class-typed portion in a class gets `Occurrences::Occurrence::portions` (was `suboccurrences`).
  - Structure-typed portions in a structure get `Objects::objects` (was `subobjects`). `Objects::Object::structuredSpaceBoundary` and `StructuredSpaceObject::structuredSpaceObjectCells` now match the pilot.
  - `Occurrence::portions` loses `suboccurrences`, as in the pilot.
  - Portions with an explicit subsetting also get an implied `portions`, where the pilot adds none. This is the existing difference that we do not prune redundant implied supertypes. For `timeSlices` and `spaceSlices` it repeats their explicit `subsets portions`, so the oracle counts 2 new mismatches.

Tests:

- `__tests__/kerml/core/features.test.ts`: `portion` does not imply `composite`.
- `stdlib-typing.test.ts`, "default supertypes by owned typings": a class-typed portion in a class gets `portions`.

## Deferred and uncertain

- Item 1 needs a decision on taking over the pilot's `ConstructorExpression` AST shape.
- On `Relationship_invalid_relatedElement1` the pilot also reports "Must have at least two related elements" (`validateConnectorRelatedFeatures`); we do not. This belongs to Phase 5b (G5).
