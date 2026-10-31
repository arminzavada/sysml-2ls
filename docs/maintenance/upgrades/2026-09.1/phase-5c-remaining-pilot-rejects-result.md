# Phase 5c — Remaining pilot-rejects result

Items 1–6 from [`plan.md`](plan.md) Phase 5c. Item 6 needs a grammar change for full parity (see below). Uncommitted on `main`.

## Verification

- `pnpm typecheck` (plus `tsc -b --force` in `syside-languageserver`), `pnpm lint`: clean.
- `pnpm test`: 90 files, 2479 passed, 6 expected fail, 7 skipped (baseline 88 / 2453 / 6 / 7). Two new files, 26 new tests.
- No snapshot changes. The stdlib-diagnostics snapshot stays `{}`. The Semantifyr models validate clean and the OXSTS snapshots are unchanged.
- Release models (310 under `sysml/src` and `kerml/src`), compared with a dump of all diagnostics and reference targets before and after:
  - No new diagnostics.
  - Gone: the 2 linking errors in `Expressions.kerml` (item 3) and the 5 featuring warnings in `TimeVaryingCarDriver.kerml` (item 5).
  - Changed reference targets are listed per item.

## 1. Transition source and target scoping, A11

- `services/references/scope-provider.ts`: a transition's source (`first …`, also as a feature chain) and the target end of its `then`/`else` succession resolve in the transition's owning namespace, as in the pilot's `SysMLScopeProvider`. The target is matched like the pilot: a reference subsetting of end 1 of the transition's succession.
- `sysml-validator.ts`: `validateTransitionUsageTriggerActions` ("A transition with an accepter must have a state as its source.", error, anchored on the `accept` membership). The source is the explicit `first` source, or the previous feature for target transitions (pilot `UsageUtil.getPreviousFeature`, without our recursion into the owner).
- Changed targets:
  - `Actions.sysml:236` `start`, `done` → `States::StateAction::start` / `done` (were `Actions::Action::*`).
  - `StateTest.sysml:24` `done` → `States::StateAction::done`.
- Tests: `__tests__/sysml/states.test.ts` (source, chained source and target in a transition typed by an action def with same-named members); `stdlib-scoping.test.ts` (the stdlib transition, `first start … then done` in a user state def); A11 cases in `sysml-validator.test.ts`; the pilot's `TransitionUsage_invalid` in `stdlib-validation.test.ts`.

## 2. Names in expressions, A10

- `scope-provider.ts`: references in expressions resolve from the pilot's non-expression namespace (`NamespaceUtil.getNonExpressionNamespaceFor`). This skips invocation expressions (operators and constructors included), feature reference expressions, and any feature an expression is the value of. It applies to feature references and to the types of invocations and type-reference features (`istype T`, `as T`). Our invocations reference their type by a typing where the pilot uses a membership; the walk starts at the invocation.
- The pilot also skips the valued feature (ST6RI-476, 2021). So `feature c : C = other;` with `other` only in `C` is now a linking error, as in the pilot.
- `kerml-validator.ts`: `validateInvocationExpressionInstantiatedType` ("Must invoke a behavior or a behavioral feature", error). Constructor expressions are excluded, since the pilot's `ConstructorExpression` is not an `InvocationExpression`.
- Changed targets (all resolved before in the valued feature's or the operator's scope):
  - `CollectionFunctions.kerml:66` `index` → `'array#'::index`, the private function (was `BaseFunctions::'#'::index`).
  - `ShapeItems.sysml` (7): `edges`, `vertices`, `shape`, `faces` in the values of `Path`, `Disc`, `ConeOrCylinder` and `Polyhedron` → the owning item def's redefinitions (were `StructuredSpaceObject::*` or `Item::shape`).
  - `ISQSpaceTime.sysml` (29): `mRefs`, `num`, `mRef` in attribute values → the owning attribute def's members. For example, `x : LengthValue = num#(1) [mRef.mRefs#(1)]` resolved `num` and `mRef` to `LengthValue`'s own.
  - `MetadataTest.kerml:49` `annotatedElement` → `M::annotatedElement`.
  - `7a1-Variant Configuration - General Concept-a.sysml:66, 75` `doX`, `doY` → the package-level actions (were the variants of the redefined `doXorY`). This follows the pilot's code; the variants perform these same actions.
  - `ArgumentResolution.kerml:8` `x` → `B::x` (was `A::x`), and `ServerSequence(Outside)Realization-3.sysml` `publication` → `delivering::publication` (was `Deliver::publication`). These are constructor arguments; see "Uncertain".
- Tests: `__tests__/kerml/kernel/expressions.test.ts` (invocation inside an argument, feature values, constructor argument); `stdlib-scoping.test.ts` (the stdlib `'array#'`, `a + y(a)`, `#(index(a))`); A10 cases in `kerml-validator.test.ts`; the `InvocationExpression_instantiatedType` probe in `stdlib-validation.test.ts`.

## 3. Implied parameter redefinitions (A6 gap)

- `metamodel-builder.ts`: the action-parameter builder now runs for all behaviors and steps, and matches base behaviors and steps. Owned parameters (`ownedParameters()`, excluding results) redefine the owned parameters of each base type by position.
  - Base parameters of a feature chain come from its last chaining feature, as the pilot's `getOwnedParametersOf` does. Perform-action parameters now redefine the performed action's.
  - Subjects are left to `redefineSubject`. The builder no longer pre-links each parameter: that resolved a requirement subject's type during import resolution and broke `12b-Allocation-1.sysml`.
  - Non-owned feature memberships (e.g. the target of `request.topic`) are no longer treated as owned parameters.
- About 720 stdlib and 170 release-model features gain implied redefinitions. They are mostly invocation arguments, KerML function and step parameters, constraint and requirement usage parameters, and action parameters of KerML base behaviors (e.g. `IfThenAction::thenClause` → `IfThenPerformance::thenClause`).
- Changed targets:
  - `OccurrenceFunctions.kerml:107` `index` → `addNewAt::index` (was `addAt::index`, now hidden by the step parameter `startIndex` that redefines it).
  - `Expressions.kerml:31–32` `startingAt`, `accessedFeature` now resolve, through `onOccurrence` redefining `FeatureWritePerformance::onOccurrence`.
- The pilot's `Redefinition_DirectionConformance_invalid` now reports all 5 errors.
- Tests: `implicits.test.ts`; the direction case in `kerml-validator.test.ts`; the full xpect model in `stdlib-validation.test.ts`.

## 4. `validateFeatureEndFeatureMultiplicity`

- `kerml-validator.ts`: warns when none of the end's multiplicities is `[1..1]`. These are the owned multiplicity, otherwise the nearest ones along the general types (pilot `TypeUtil.getMultiplicitiesOf`, last chaining feature included).
- SysML end usages without a multiplicity are skipped: the pilot gives them a default `[1..1]` (our T1 gap).
- No new warnings on the stdlib or the release models.
- Tests: inherited and owned cases in `kerml-validator.test.ts`.

## 5. Featuring checks as errors

- Why `TimeVaryingCarDriver.kerml` was flagged: our accessibility check lacked the pilot's `TypeUtil.isCompatible`. In the pilot, two features without owned features that redefine a common feature (there: hand-written features redefining `Occurrence::snapshots`) are compatible featuring contexts if their own featuring types are. `Car1_` features are featured by such snapshot features.
- `model/KerML/feature.ts`: `isFeaturedWithin` and `isCompatible` follow the pilot, including the variable-feature clauses. A variable feature's pilot featuring type is a synthetic `<Owner>_snapshots` feature, which we do not model; `isFeaturedWithin` emulates compatibility with it.
- `kerml-validator.ts`:
  - `validateSubsettingFeaturingTypes` uses the pilot's `canAccess`, is an error, and uses the pilot's message. It now also checks connector-end reference subsettings, as the pilot does.
  - The connector check is now `validateConnectorTypeFeaturing` (was `checkConnectorTypeFeaturing`), an error with the pilot's message. Like the pilot, it is skipped when the subsetting check already reports the end.
- No diagnostics on the stdlib or the release models.
- Tests: connector cases (including a connector featured by two types) and snapshot features in `kerml-validator.test.ts`; `TimeVaryingCarDriver` (`Person1_`, `Car1_`) and `VariableSnapshotFeaturing` in `stdlib-validation.test.ts`.

## 6. `assign (p).x := 1;`

- The pilot parses it: its `TargetBinding` accepts any base expression before `.`. Our grammar takes only a feature chain, so we report a parse error. The parser's error recovery then left `targetMember` unset, which crashed `astToModel`.
- `utils/ast-to-model.ts`: tolerates the missing members. The input now gives a parse error and `validateAssignmentActionUsageReferent`, with no crash.
- Parity needs a grammar change (the commented-out `AssignmentTargetMember` in `SysML.langium`), so it was not made. The `known_limitations.md` `assign` entry is corrected: feature chains parse, expressions do not.
- Test: `__tests__/sysml/actions.test.ts`.

## Remaining deviations

- Stricter than the pilot: `assign (expr).x := …` fails to parse (documented).
- We accept what the pilot rejects:
  - Invocation arguments beyond the invoked type's inputs. The pilot reports `validateInvocationExpressionParameterRedefinition`. Documented in `known_limitations.md`.
- Typing deviations, not documented:
  - Implied parameter redefinitions use the base types' owned parameters; the pilot uses all their parameters, inherited ones included.
  - Implied parameter redefinitions are skipped when an explicit redefinition exists; the pilot adds them regardless outside invocations. This is the same deviation 5b noted for ends.
  - Either can hide an A6 error the pilot reports.
- Messages: our `validateInvocationExpressionParameterRedefinition` and `…NoDuplicateParameterRedefinition` messages differ from the pilot's ("Must correspond to one input parameter of the invoked type", "Parameter already bound"). In `TransitionUsage_invalid`, the parallel-state and guard rules use our spec-named codes and messages. Neither was changed.

## Uncertain

- Constructor arguments (`ArgumentResolution.kerml`, `ServerSequence*-3.sysml`): we resolve past the constructor, as spec 8.2.3.5.2 states (skip the `ownedFeature`s of the constructor's result). The pilot's code stops at the result feature, whose argument features take their names from the features they redefine. It may therefore resolve `x` to the argument itself. Not verified by running the pilot; our constructor has no result feature (the deferred 5a3 AST change).
- `num` in `ISQSpaceTime.sysml` now resolves to `Quantities::3dVectorQuantityValue::num` through our inherited-member resolution, which this phase did not change.
