# Phase 5b — Validation backlog result

Inventory A6–A11, G5, inventory B, the Phase 4 leftovers and the flow-end renames from [`plan.md`](plan.md). A10 and A11 are stopped (see below). Uncommitted on `main`.

## Verification

- `pnpm typecheck` (plus `tsc -b --force` in `syside-languageserver`), `pnpm lint`: clean.
- `pnpm test`: 88 files, 2453 passed, 6 expected fail, 7 skipped (baseline 2410 / 7 / 7). 42 tests added; the direction test that was `test.fails` now passes.
- No snapshot changes. The stdlib-diagnostics snapshot stays `{}`, the Semantifyr models validate clean and the OXSTS snapshots are unchanged.
- The 310 release models under `sysml/src` and `kerml/src` report the same diagnostics before and after.
- `allTypings()` of every feature in the stdlib and the release models is unchanged. End counts are unchanged except for the two bound connectors `abstract interface i = i1` (`InterfaceTest`) and `abstract connector c2 = c1` (`Connectors.kerml`). They now have no ends, as in the pilot.

## Items

### A6 — `validateRedefinitionDirectionConformance`

- `kerml-validator.ts`: ported, and the commented-out block removed. Explicit redefinitions are anchored on the redefinition and implied ones on the redefining feature, as in the pilot. It uses the pilot's effective featuring types: the owning type for variable features.
- `model/KerML/type.ts` `directionOf` now reverses directions across a `~P` typing. Our `ConjugatedPortTyping` targets `P` itself.
- Flow-end features are skipped. The pilot derives their direction from the feature they redefine (`FlowEndAdapter.addFlowFeatureDirection`), so the check cannot fail there. Our `setFlowEndDirections` sets `out`/`in` by position instead. Without the skip, 14 release-model flows were flagged.
- Gap: KerML behaviors and steps get no implied parameter redefinitions in our model. So the pilot's `Redefinition_DirectionConformance_invalid` gets only 3 of its 5 errors here: `in x1;` and `out x1;` are missing. SysML actions are covered.

### A7 `validateAssociationEndTypes`, A8 `validateAttributeUsageEnumerationType_`, A9 `validateUsageType_`

- A7 in `kerml-validator.ts`, A8 and A9 in `sysml-validator.ts`, with the pilot's codes, messages and anchors.

### A10 `validateInvocationExpressionInstantiatedType` — stopped

- It flags the stdlib: `CollectionFunctions.kerml:66` `index(arr, n, indexes)` inside `arr.elements#(...)`.
- Cause: our scoping resolves names in operator-expression operands against the operator function's parameters, here `BaseFunctions::'#'::index`. The pilot finds the private function `index`, because its argument features redefine those parameters.
- The rule needs that scoping fix first. It was removed again.

### A11 `validateTransitionUsageTriggerActions` — stopped

- It flags the stdlib: `Actions.sysml:236` `transition aTransition first start accept ...`. It would also flag `transition first start accept X then s;` in user state defs.
- Cause: our scope provider resolves a transition's source in the transition's own scope. `start` then resolves to `Actions::Action::start`, inherited by the transition. The pilot's `SysMLScopeProvider.getScope` resolves the source, and the succession target, in the transition's owning namespace, which gives `States::StateAction::start`.
- The rule was removed again. The wrong `first start` / `then done` linking is a pre-existing scoping bug.

### G5 and binary specialization

- `model/mixins/connector.ts`: `allEnds()` follows the pilot's `TypeUtil.getEndFeatureOf`:
  - owned ends, then ends inherited from every general type (types, and subsetted or redefined connectors) that nothing redefines;
  - the pilot's positional end redefinition per general type is emulated (see the typing deviations below);
  - the implied subsetting created from a bound feature value is skipped, because the pilot subsets the value's result chain, and that is not a supertype.
- This replaces the positional, association-only computation. It is uncached, because build-time callers saw partial models.
- `validateConnectorRelatedFeatures` counts related features. `validateAssociationRelatedTypes` counts end types. Both use the pilot's message.
- Now errors: non-abstract `connection c : C;`, `connection c2 = c1;`, `connection c default = c1;`, `interface i = i1;`. `connection :>> c1;` and `connection c :> c1;` stay valid.
- `validateConnectorBinarySpecialization` counts all ends. It flags the connector when at most 2 are owned, and otherwise the ends from index 2.
- `validateAssociationBinarySpecialization` follows the pilot's `checkAssociation` instead of the brief: it counts owned ends only and flags those from index 2.
- `InterfaceUsage_Invalid`'s "Cannot have more than two ends" xpect is an artifact of its partial library: without `Links.kerml`, `BinaryLink` is null and `conformsTo` is true. With the full stdlib, neither tool reports it.

### Inventory B

- `validateLibraryPackageNotStandard_`: now a warning, with the pilot's code and message.
- `validateItemUsageTyping`, `validatePartUsageTyping` and `validatePartUsagePartDefinition` are removed. `validateOccurrenceUsageTyping` now also covers item and part usages; like the pilot it excludes port, connection and metadata usages and steps. It uses the pilot's message.
- `validateRedefinitionFeaturingTypes`: set equality on effective featuring types, with the pilot's messages.

### Explicit relationships only

- The pilot validates only explicit relationships, because `KerMLResourceValidator` calls `ElementUtil.transformAll(resource, false)` and implicit specializations are never inserted. Phase 4 had assumed the opposite.
- `validateRedefinitionFeaturingTypes`, `validateRedefinitionEndConformance` (V5) and `validateSubsettingConstantConformance` (A3) now skip implied relationships.

### V11/V12 end counting

- Both now use the new `allEnds()`, so redefined ends are dropped. Tests: `abstract flow def H { end a; end b; end c; } flow def K :> H { end z :>> c; }` flags only `H`. In `EndsAreUsages2`, `D4 :> A { end part p :>> b; }` reports no inherited non-usage end.

### Cross features (pilot's `AssociationTest_CrossFeatures_invalid`)

- `model/KerML/feature.ts`: `allTypings()` no longer follows cross subsettings. The pilot's `typingFeatures` excludes crossed features. This removes the extra `validateFeatureCrossFeatureType` on `A2::y`, and leaves the stdlib and release-model typings unchanged.
- `checkFeatureCrossingSpecialization` is anchored on the owned cross feature (`x1 [0..1]`) and uses the pilot's message.

### Renames

- `validateFlowItemFeature` ("Only one item feature is allowed"): now flags the item features after the first.
- `validateFlowEndNestedFeature`, `validateFlowEndOwningType`, `validateFlowEndSubsetting` and `validateFlowEndImplicitSubsetting`: the pilot's codes and messages. `validateFlowEndIsEnd`: "Must be an end feature".
- `validateFeatureEndMultiplicity` → `validateFeatureEndFeatureMultiplicity` (renamed in the pilot in 2024-07), "End feature must have multiplicity 1", anchored on the feature.

### `known_limitations.md`

- The `validateFeatureTyping` entry is corrected: the pilot has the same rule, `validateFeatureHasType_`.
- T1 (no default multiplicity) is added.

## Tests

- `kerml-validator.test.ts`, positive and negative cases:
  - direction, including conjugation;
  - featuring-type subsets;
  - constant conformance through a bound value;
  - cross-feature typing, and the crossing anchor;
  - binary specialization for owned, inherited and redefined ends;
  - related features and related types;
  - end types;
  - renamed codes, and the library-package warning.
- `sysml-validator.test.ts`: enumeration attribute types, usage typing, item and part occurrence typing, flow-def redefined ends, connection related features, and direction (implicit parameter, `~P`, flow ends).
- `features.test.ts`: cross subsettings contribute no types.
- `stdlib-validation.test.ts`, pilot xpect models:
  - the full `AssociationTest_CrossFeatures_invalid`;
  - `AssociationTest_EndTypes_invalid`;
  - `Relationship_invalid_relatedElement0` (extended with `c2`, `c3` and `i`) and `Relationship_invalid_relatedElement1`;
  - `Redefinition_OwningType_Invalid`, `PortUsage_Invalid`, `EnumerationUsage_invalid` and `UsageDefinition_invalid`.
  - `PortDefinitionConnections` gains `validateConnectorRelatedFeatures`, which the pilot reports through the same code path as `Relationship_invalid_relatedElement1`.

## Remaining deviations

- Stricter than the pilot: none known from this phase.
- We accept what the pilot rejects:
  - A10 and A11 (stopped, see above).
  - KerML implicit parameter redefinitions (A6 gap).
  - `validateSubsettingFeaturingTypes` and `checkConnectorTypeFeaturing` are warnings here and errors in the pilot. Making them errors flags `TimeVaryingCarDriver.kerml`, because we do not model snapshot featuring.
  - `validateFeatureEndFeatureMultiplicity` checks only an owned multiplicity. The pilot also warns when an end has no owned multiplicity and none of its inherited ones is `[1..1]`.
- Naming: our typing rules use `...Typing` codes where the pilot uses `..._Type_`, and many other codes follow the spec's constraint names. They are not old pilot names and were left alone.

## Typing deviations found, not changed

- Implied end redefinitions: ours are added only when the end has no explicit redefinition. The pilot redefines each general type's end at the same position regardless; for example, `InsideOf::smallerSpace` also redefines `SpaceLink::sourceOccurrence`. `allEnds()` emulates this.
- Bound values: ours subset the referent directly, even for `default` values. The pilot subsets the value's result chain, and only for non-default values.
- Flow-end features have a positional direction here and a derived one in the pilot (see A6).
- The pilot's `isStateTransition` also requires a state source; ours checks only the owner.

## Found incidentally

- `assign (p).x := 1;` throws in `astToModel` ("Cannot read properties of undefined (reading '$meta')"). `assign f().x := 1;` fails to parse. Feature chains (`assign p.x := 1;`) work, so the `known_limitations.md` entry on `assign` is partly out of date. It was left unchanged.
