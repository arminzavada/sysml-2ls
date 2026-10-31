# Chunk 2 — Library / built-ins (2026-09.1 upgrade)

> **Per-upgrade artifact.** Every `sysml.library/` change between pilot `2026-03` and `2026-09` (the library is identical at `2026-09` and `2026-09.1`), the places in this repo that couple to the changed elements, and an empirical run of the test suite with the stdlib pin advanced.
>
> **Method:**
>
> - Library diff: `git diff 2026-03..2026-09 -- sysml.library` on the pilot, with `git log` to attribute each hunk to an issue and tag. Cross-checked against upstream SysML-v2-Release tag `2026-09` (commit `b7a6b77000c9136f8f24822fc9d2cb237c76267f`).
> - Coupling: grep of `packages/` for every changed element and file name, plus an existence check of all 198 library qualified names quoted in `packages/syside-languageserver/src/{model,services,utils}` against the `2026-09` library.
> - Probe: in a throwaway worktree, pin bumped in `scripts/clone-sysml-release.mjs`, `SysML-v2-Release/` deleted and re-cloned, `pnpm install` + `pnpm build`, full `pnpm test` at both pins. A scratch vitest file (not kept) loaded the stdlib at each pin, dumped the specializations of the changed library elements and of small user models (flows/messages, collections, transitions, attribute-owned usages, requirements), and diffed the dumps.
>
> **Tags:** `understood` / `structurally-clear` / `needs-deeper-trace` / `consult-Armin`.

## Summary

| # | Tag | File | Change | Repo coupling | Confidence |
|---|-----|------|--------|---------------|------------|
| L1 | 2026-05 | `Collections.kerml` | `Map` key-uniqueness `inv`; `OrderedMap :> Map, OrderedCollection` with `elements` redefining both; doc rewrites | evaluator `IndexFunction` (`OrderedCollection` branch) | `understood` (library), evaluator `needs-deeper-trace` low |
| L2 | 2026-05 | `VectorCalculations.sysml`, `TensorCalculations.sysml` | `'['::elements` gains `nonunique` | none | `understood` |
| L3 | 2026-07 | `Objects.kerml` | `StructuredSurface`/`Curve`/`Point` add `intersects` of their two supertypes; doc | intersecting validators | `understood` |
| L4 | 2026-07 | `TransitionPerformances.kerml` | `triggerTarget` default `this` → `accept.receiver ?? this`; `binding accept.receiver = triggerTarget` removed | none (transition builders don't touch `triggerTarget`) | `understood` |
| L5 | 2026-05/07 | `Actions.sysml` | `Action::assignments::target` gets a doc body; doc rewrites on send/accept/merge/decision actions | `assignment-action-usage.ts` (shape unchanged) | `understood` |
| L6 | 2026-09 | `Flows.sysml` | `Message` owns `end occurrence source/target`; `messages` becomes `abstract action` with owned ends (unannounced) | `flow-usage.ts`, `flow-definition.ts`, `redefineEnds` | `structurally-clear` |
| L7 | 2026-05/07 | `Time`, `Transfers`, `SysML`, `Collections`, `Objects`, `Actions` | doc-only | hover text only | `understood` |
| L8 | all | `.meta.json`, `.project.json`, `.index.json`, `.kpar` | packaging metadata | not consumed | `understood` |
| F1 | pre-existing | — | message-usage classification differs from pilot `UsageUtil.isMessage` | `flow-usage.ts` | `needs-deeper-trace` |
| F2 | pre-existing | — | `FlowDefinition` `base` should be `Flows::MessageAction` | `flow-definition.ts` | `structurally-clear` |
| S1 | pre-existing | — | client/browser stdlib registry still serves 2024-12 | `syside-base/src/stdlib.ts`, `scripts/update-stdlib.mjs` | `consult-Armin` |

**Headline:** 10 `.kerml`/`.sysml` files change; no file is added, removed or renamed, and no named element is removed or renamed. The only element whose metaclass changes is `Flows::messages` (FlowUsage → ActionUsage). The test suite is **unchanged** at the `2026-09` pin: 79 files, 2165 passed, 7 skipped at both pins; the stdlib-diagnostics snapshot stays `{}`; all Semantifyr model and OXSTS snapshot tests pass. The probe shows the expected shape changes (L1, L6) and no new diagnostics. All 198 library names the repo quotes still resolve. The library hop needs no code change. The Flows change does expose two older deviations in our flow classification (F1, F2).

**Size of the hop:** a one-line pin bump, a re-clone, and doc bumps (`README.md`, `docs/maintenance/upstream-sources.md`), under an hour. F1/F2 are optional same-area conformance fixes of about half a day with tests. S1 needs a decision first.

---

## L1. `Collections.kerml` (2026-05, KERML11-144)

**Library:**

- `Map` gains `private import SequenceFunctions::equals` and
  ```
  inv {
      elements->forAll{ in e1 : KeyValuePair;
          not elements->exists{ in e2 : KeyValuePair;
              e1 != e2 and e1.key->equals(e2.key) }
      }
  }
  ```
- `datatype OrderedMap :> Map, OrderedCollection` (was `:> Map`), with `feature elements: KeyValuePair[0..*] ordered :>> Map::elements, OrderedCollection::elements`. This is a new diamond on `elements`: `OrderedCollection::elements` is `ordered nonunique`, while `Map::elements` is unique by default.
- Docs rewritten throughout. `Collection::elements`, `Array::dimensions`/`rank`/`flattenedSize` gain doc bodies. The plain `/* … */` comments in the `elements` bodies of `UniqueCollection`, `OrderedSet`, `Map` and `OrderedMap` become `doc`.

**Probe:** the stdlib still validates clean, so the nested `forAll`/`exists` bodies, `e1.key->equals(…)` and the diamond redefinition all link and pass our validators. Model shape at `2026-09`: `OrderedMap` has both subclassifications, and `OrderedMap::elements` redefines both `Map::elements` and `OrderedCollection::elements`. A user model with `attribute oc : OrderedCollection = om;` (where `om : OrderedMap`) and `om#(1)` gives no diagnostics.

**Coupling:** `packages/syside-languageserver/src/model/expressions/functions/base.ts` `IndexFunction.call` sends values conforming to `Collections::OrderedCollection` through `indexCollection` (via `Collections::Collection::elements`); any other single value goes through `indexSequence`. An `OrderedMap` now takes the first branch, so `om#(1)` evaluates to its first `KeyValuePair` and no longer to the map itself. This is evaluator-only. Whether it matches the pilot's index semantics belongs to chunk 5, together with the `IndexExpression` OCL move to `Collections::Collection` (KERML11-69).

**Status:** library `understood`. Evaluator delta `needs-deeper-trace`, low priority (authoring focus).

## L2. `'['::elements` nonunique (2026-05, SYSML21-362)

**Library:** `VectorCalculations::'['` and `TensorCalculations::'['`: `in elements: Number[1..n] ordered` → `ordered nonunique`.

**Coupling:** none. `OPERATORS.QUANTITY` handling (`model/KerML/expressions/operator-expression.ts`, `sysml-validator.ts`, `kerml-validator.ts`) never consults parameter uniqueness.

**Status:** `understood`.

## L3. `Objects.kerml` intersecting structured cells (2026-07, KERML11-76)

**Library:**

```
struct StructuredSurface specializes StructuredSpaceObject, Surface intersects StructuredSpaceObject, Surface { … }
```

`StructuredCurve` and `StructuredPoint` change the same way, and the `StructuredSpaceObject` doc is rewritten.

**Coupling:** `Intersecting` lands in `TypeMeta.typeRelationships`, not in `specializations()`. The only consumers are `validateTypeIntersectingTypesNotSelf` and `validateTypeOwnedIntersectingNotOne` (`services/validation/kerml-validator.ts`). Both pass, since there are two intersectings and neither is self. Intersecting carries no conformance semantics in our model. That costs nothing here, because both types are also explicit supertypes.

**Status:** `understood`.

## L4. `TransitionPerformance` trigger target (2026-07, KERML11-79)

**Library:**

```
-feature triggerTarget : Occurrence [1] default this;
+feature triggerTarget : Occurrence [1] default accept.receiver ?? this;
 …
-binding accept.receiver = triggerTarget;
```

The new default forward-references `accept`, which is declared later in the body.

**Coupling:** the `TransitionUsage` builders in `services/shared/workspace/metamodel-builder.ts` do three things:

- redefine `Actions::TransitionAction::accepter`, `TransitionPerformances::TransitionPerformance::guard` and `Actions::TransitionAction::effect` (`redefine(...)`, around line 1178);
- redefine `TransitionPerformances::TransitionPerformance::transitionLink` (around line 1465);
- subset the accepter payload parameter.

None touches `triggerTarget` or `receiver`. `Actions::TransitionAction` is unchanged in range: it still has `ref receiver :>> triggerTarget` and `bind receiver = accepter.receiver`. The default value matters only to evaluation.

**Probe:** the forward reference resolves, since the stdlib stays clean. A state with `accept Sig` and `accept sig : Sig via self` transitions gives no diagnostics and the same implicit redefinitions at both pins. All 9 Semantifyr models use accept-triggered transitions; they still validate clean, and the 4 OXSTS snapshots are byte-identical.

**Status:** `understood`.

## L5. `Actions.sysml` (2026-05 docs, 2026-07 SYSML21-327)

**Library:** `Action::assignments` changes `in target;` → `in target { doc /* … ensuring "target" remains the first parameter */ }`. Separately, the docs of `SendAction`, `AcceptMessageAction`, `MergeAction` and `DecisionAction` are rewritten (SYSML21-26/27/29/30).

**Coupling:** `model/SysML/assignment-action-usage.ts` (`subaction: "Actions::Action::assignments"`, `base: "Actions::assignmentActions"`). The probe shows `Actions::Action::assignments::target` still implicitly redefining `AssignmentAction::target` and `assignmentActions::target` at both pins, so the shape is unchanged.

**Status:** `understood`.

## L6. `Flows.sysml`: `Message` ends, `messages` becomes an action (2026-09, SYSML21-681, unannounced)

**Library:**

```
 abstract flow def Message :> MessageAction, Transfer {
     ref payload :>> MessageAction::payload, Transfer::payload;
+    end occurrence source: Occurrence :>> Transfer::source;
+    end occurrence target: Occurrence :>> Transfer::target;
 …
-abstract message messages: Message[0..*] nonunique :> transfers, actions {
+abstract action messages: Message[0..*] nonunique :> transfers, actions {
     doc /* messages is the base feature of all FlowUsages. */
+    end occurrence source: Occurrence :>> Message::source, transfers::source;
+    end occurrence target: Occurrence :>> Message::target, transfers::target;
 }
```

These owned end usages are what lets the library pass the pilot's new `validateFlowDefinitionEndsAreUsages_` / `validateConnectionDefinitionEndsAreUsages_` (chunk 6). SysML-v2-Release `2026-09` additionally fixes a typo in the `SuccessionFlow` doc. That is the only difference between the Release and pilot `.sysml`/`.kerml` files.

**Coupling:**

- `model/SysML/flow-usage.ts`: `message: "Flows::messages"`, `base: "Flows::flows"`. The lookup still resolves; it now finds an `ActionUsage` typed by `Message`. Specializing it is fine: the pilot's `ImplicitGeneralizationMap` is unchanged across the range (`FlowUsage` `message` → `Flows::messages`).
- `model/SysML/flow-definition.ts`: `base`/`binary` → `Flows::Message` (see F2).
- `model/SysML/succession-flow-usage.ts`: `Flows::successionFlows` for both keys. Unchanged, and matches the pilot.
- `metamodel-builder.ts` `redefineEnds` (line 742) uses `TypeMeta.basePositionalFeatures`. User `flow def` ends now redefine the owned `Flows::Message::source`/`target`. At `2026-03` they redefined the inherited `Transfers::Transfer::source`/`target`.

**Probe, shape changes between pins, no diagnostics at either:**

- `flow def F { end a : A; end b : B; }`: the implied redefinitions move from `Transfers::Transfer::source/target` to `Flows::Message::source/target`. This is the expected library-driven change.
- `Flows::flows::source` now redefines `Flows::messages::source` (owned) instead of the inherited `Transfers::Transfer::source`.
- **Our `2026-03` model had a specialization cycle in the library.** `Flows::messages` was a FlowUsage with neither ends nor message events, so `FlowUsageMeta.defaultSupertype()` gave it the implied supertype `Flows::flows`, while `flows :> messages` is explicit. The cycle produced no diagnostic. At `2026-09`, `messages` is an ActionUsage, the cycle is gone, and it gets the implied `Actions::actions`, which is redundant with its explicit `:> actions`. Redundant implied supertypes are an existing pattern here.
- `flow … from a.o to b.i` and `succession flow …` usages still specialize `Flows::flows`/`successionFlows`, and their ends redefine `flows::source`/`successionFlows::source`. Every Semantifyr `flow` has `from … to`, so none of them changes classification.
- `Flows::messages::source/target` don't subset `Links::Link::participant`. That is consistent with the pilot's `addParticipantSubsetting`, which only applies to association ends.

**Status:** `structurally-clear`. The library swap itself is clean; F1/F2 below are the follow-ups.

## L7. Doc-only edits

- `Time::Clock` ("montonically" typo, SYSML21-370).
- `Transfers::Transfer::isInstant` ("isInstance" typo, KERML11-9).
- `SysML.sysml` package doc ("KerML" → "SysML", SYSML21-526).
- The `Collections`, `Objects` and `Actions` docs noted above.

These are visible only in hover text. **Status:** `understood`.

## L8. Packaging metadata

`.meta.json` / `.project.json` (version bumps, the `USCU` alias for `USCustomaryUnits` in 2026-04), the pilot-only `.index.json` / `.workspace.json`, and the Release `sysml.library.kpar/` archives. None is consumed: the clone script fetches source files, and `.kpar` ingestion was ruled out of scope in the 2026-03 cycle. **Status:** `understood`.

---

## Pilot logic changes that reinterpret library content

These are not library-file changes, but they change how the pilot reads parts of the library. Their porting belongs to chunk 4; listed here is only what the library contains.

- **Attribute-owned usages become referential (2026-07, SYSML21-19).** The pilot's `UsageParserPostProcessor` forces `isComposite=false` on usages whose expected featuring type is an attribute def/usage. In our model 14 library usages are both attribute-owned and composite:
  - `AssertConstraintUsage`s in `MeasurementReferences` (`CoordinateTransformation::validSourceTargetDimensions`, `CoordinateFramePlacement::validOriginDimensions`/`validateBasisDirections` + 1 anonymous, `AffineTransformationMatrix3d::validSourceDimensions`, `MeasurementUnit::hasValidUnitPowerFactors`), `Quantities::TensorQuantityValue::orderSum`/`boundMatch`, and anonymous ones in `SampledFunctions::SampledFunction` and `RiskMetadata::Level`;
  - a `ConstraintUsage` in `StateSpaceRepresentation::StateDerivative`;
  - `CalculationUsage`s `Time::Iso8601DateTime::getElapsedUtcTime` and `Time::Iso8601DateTimeStructure::getElapsedUtcTime`;
  - the `ItemUsage` `SpatialItems::SpatialItem::componentUnion::elements`.

  All of them currently get only base supertypes (`assertedConstraintChecks`, `constraintChecks`, `calculations`, `items`), because our composite-dependent supertypes key on Structure/Behavior/Item/Action owners. So porting SYSML21-19 should not visibly change their specializations. `structurally-clear`.
- **`require` members are no longer subrequirements (2026-07, SYSML21-300).** The library has no `RequirementUsage`/`ConcernUsage` owned via a `RequirementConstraintMembership` (probe count 0). No library impact. `understood`.
- **Port usages get occurrence-usage semantics (2026-08, ST6RI-965).** No library port usage has a portion kind (probe count 0). No library impact. `understood`.
- **Default `1..1` multiplicity for subsetting-only attribute/item/port usages (2026-09).** This affects many library usages. It was not probed here and belongs to chunk 4. `needs-deeper-trace`.

## Pre-existing deviations surfaced by the Flows change

### F1. Which flow usages are "messages"

- **Pilot** (`UsageUtil.isMessage`, same logic as `isMessageConnection` at `2026-03`): a `FlowUsage` with no owned end features. Its default supertype is `Flows::messages`, otherwise `Flows::flows`.
- **Ours** (`FlowUsageMeta.isMessageConnection`, `flow-usage.ts` line 71): has `from … to` message event members.

So `message m of X;` and `flow f of X;` with neither ends nor events specialize `Flows::flows` here and `Flows::messages` in the pilot. The probe confirms it for `message m2 of X;`. This predates the range. Since 2026-09 the gap is wider: the pilot makes such a usage an action typed by `Message`, while we make it a `Flow` usage with `FlowTransfer` semantics. No diagnostic differs in the probe. The pilot also makes messages with fewer than two related features abstract (`makeMessageAbstract`), which we do not do. `needs-deeper-trace` (chunk 4).

### F2. `FlowDefinition` default supertype

The pilot's map has `FlowDefinition` `base` → `Flows::MessageAction` and `binary` → `Flows::Message`, unchanged since at least `2026-03`. Ours maps both to `Flows::Message`; the 2026-03 cycle's phase-2b result chose this deliberately, believing there was no separate base. A flow def with other than two ends (e.g. `flow def F3;`) therefore specializes `Message` and, as of 2026-09, inherits its owned ends. In the pilot it specializes `MessageAction`, which has no ends. This is a one-line fix with a test. `structurally-clear`.

## S1. Client/browser stdlib registry is stale (pre-existing, out of range)

`packages/syside-base/src/stdlib.ts` has `STDLIB.version: "2024-12"`, with `tree`/`raw` pointing at `daumantas-kavolis-sensmetry/SysML-v2-Release` branch `release/2024-12`. Consumers:

- `packages/syside-languageclient/src/sysml-language-client.ts`: stdlib download and the version check (`stdlibURL`, `stdlibFiles`, `versionToRepoZip` → upstream tag `2024-12` zip).
- `packages/syside-languageserver/src/browser/virtual-file-system-provider.ts`: fetches every file from `STDLIB.raw`.

The `files` list matches the `2026-03` and `2026-09` trees exactly (94 files). The URLs, however, serve 2024-12 content. `…/release/2024-12/sysml.library/Systems Library/Flows.sysml` returns 404, and `FlowConnections.sysml` returns 200. So the VS Code auto-download path and the browser build do not get the library the server is developed against. The generator, `scripts/update-stdlib.mjs`, is also legacy:

- `SUPPORTED_TAGS` ends at `2024-12`.
- The fork URLs are hard-coded.
- Its rewrite of `scripts/clone-sysml-release.mjs` is a no-op now that the script pins by commit.

The CLI and the tests are unaffected, since they read `SysML-v2-Release/` directly. `consult-Armin`.

## Repo-coupling map

Library names quoted in source that touch changed files:

```
packages/syside-languageserver/src/model/SysML/flow-usage.ts:46-47          Flows::flows, Flows::messages          (L6, F1)
packages/syside-languageserver/src/model/SysML/flow-definition.ts:27-28     Flows::Message (base, binary)          (L6, F2)
packages/syside-languageserver/src/model/SysML/succession-flow-usage.ts:32-33  Flows::successionFlows              (L6, unchanged)
packages/syside-languageserver/src/model/SysML/assignment-action-usage.ts:39-40  Actions::assignmentActions, Actions::Action::assignments  (L5)
packages/syside-languageserver/src/services/shared/workspace/metamodel-builder.ts:742   redefineEnds (positional end redefinition)  (L6)
packages/syside-languageserver/src/services/shared/workspace/metamodel-builder.ts:1178-1180, 1465   TransitionPerformance::guard/transitionLink, TransitionAction::accepter/effect  (L4, unaffected)
packages/syside-languageserver/src/model/expressions/functions/base.ts:140-201   Collections::Collection::elements, ::Array, ::OrderedCollection  (L1, evaluator)
packages/syside-languageserver/src/model/KerML/item-flow-end.ts, item-feature.ts, item-flow.ts, succession-item-flow.ts   Transfers::* (Transfers.kerml doc-only; unaffected)
packages/syside-languageserver/src/services/validation/kerml-validator.ts:218-275   intersecting NotSelf/NotOne  (L3)
packages/syside-base/src/stdlib.ts                                           file list (unchanged) + stale URLs  (S1)
```

To bump with the pin:

```
scripts/clone-sysml-release.mjs           commit → b7a6b77000c9136f8f24822fc9d2cb237c76267f (tag 2026-09)
README.md                                 "ships on the 2026-03 release"
docs/maintenance/upstream-sources.md      current pin; cites the stale path packages/syside-languageserver/scripts/
```

Name existence: 190 of the 198 quoted `X::Y` strings are owned library elements at `2026-09`. The other 8 are not regressions:

- `Actions::TransitionAction::guard` is inherited and resolves through scope.
- `KerML::Core::`, `KerML::Kernel::`, `KerML::Root::` and `SysML::Systems::` are prefixes.
- `Base::Anything::x`/`y` are test-fixture strings.
- `Performances::Performance::subPerformances` (`model/SysML/action-usage.ts:29`, key `subPerformance`) is a misspelled entry that nothing uses; the `subperformance` key inherited from `StepMeta` is used instead. It is dead and predates the range.

Tests and snapshots referencing changed names: the `messages` cases in `model/SysML/__tests__/factories.test.ts` and `model/printer/__tests__/connectors.test.ts` run without the stdlib, and `model/expressions/__tests__/base.test.ts` uses `Collections::Array`, which is unchanged. None is affected.

## Test-suite delta (`2026-09` pin)

| Suite | `2026-03` | `2026-09` |
|---|---|---|
| Full `pnpm test` | 79 files, 2165 passed, 7 skipped | identical |
| `stdlib-diagnostics` snapshot (all checks over all 94 files) | `{}` | `{}` |
| `stdlib-loading` (5) | pass | pass |
| `semantifyr-models` (9 models, built-in + fast checks) | pass | pass |
| `semantifyr-transformation` (4 OXSTS snapshots) | pass | pass, snapshots unchanged |

No test changes, so there is nothing to classify. Coverage of the changed areas is thin:

- Unit tests run with `standardLibrary: false`.
- No Semantifyr model uses `message`, end-less flows, or `Collections`.
- Only the integration tests and `language-server.test.ts` load the real stdlib.

The scratch probe filled that gap. Its only differences between pins are the L1 and L6 shape changes above, and it produced no diagnostics at either pin.

## Open questions

1. **S1 stdlib registry** (`consult-Armin`): retarget `STDLIB` to upstream `Systems-Modeling/SysML-v2-Release` at the pinned tag and move it in lockstep with the clone pin, derive it from the pin, or drop the client download/browser paths? Should `scripts/update-stdlib.mjs` be retired?
2. **F1/F2 scope** (`consult-Armin`): fix the message classification (`isMessage` = no owned ends, plus `makeMessageAbstract`) and the `FlowDefinition` `base` → `Flows::MessageAction` in this cycle's library phase, since they sit next to the 2026-09 Flows change? Or hand them to chunk 4 as pre-existing deviations?
3. **L1 evaluator** (`needs-deeper-trace`, chunk 5): `OrderedMap` indexing now returns a `KeyValuePair`. Confirm against the pilot's index semantics together with KERML11-69.
