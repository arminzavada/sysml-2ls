# Phase 3 — Typing result

Typing items T2, T2b, T4, T5, T7/F1, T8/F2, T9 and T10 from [`plan.md`](plan.md). Uncommitted on `main`.

## Verification

- `pnpm typecheck` (plus `tsc -b --force` in `syside-languageserver`), `pnpm lint`: clean.
- `pnpm test`: 87 files, 2290 passed, 7 expected fail, 7 skipped (baseline 86 / 2234). 56 tests added, none removed.
- No snapshot changes: the stdlib-diagnostics snapshot stays `{}`, the Semantifyr models validate clean and the four OXSTS snapshots are unchanged.
- One full run failed transiently in two unrelated files (`model/printer/__tests__/expressions.test.ts` at file level, `execute-command-handler.test.ts`). Two more full runs and three isolated runs of those files passed.

Tests:

- New `__tests__/integration/stdlib-typing.test.ts` builds small models against the pinned stdlib and checks implied supertypes and derived flags per item. Implicit supertypes need the real library, so these sit next to the other stdlib integration tests.
- `__tests__/kerml/core/features.test.ts`: `const` implies `var`.
- `model/printer/__tests__/namespaces.test.ts`: `var feature` prints `var`. The existing `const` printer test now also guards the const-before-var order.
- `model/printer/__tests__/connectors.test.ts`: an explicitly abstract message keeps `abstract`. The existing end-less message tests now guard that derived abstractness is not printed.

## Items

### T2 — usages featured by an attribute def/usage are referential (SYSML21-19)

- `model/SysML/usage.ts`: `isComposite` is false when the expected featuring type (see T2b) is an `AttributeDefinition` or `AttributeUsage`.
- No implied supertype changes: the composite-dependent supertypes need structure, class, behavior or item owners.
- The `validateAttributeDefinitionFeatures`/`validateAttributeUsageFeatures` TODOs stay for Phase 4 (V6).

### T2b — variants take the featuring type of their variation (ST6RI-937)

- `UsageMeta.expectedFeaturingType()` mirrors the pilot's `UsageUtil.getExpectedFeaturingTypeOf`: the owning type for `FeatureMembership` members, else the expected featuring type of an owning variation usage. `UsageMeta.isComposite` and `PortUsageMeta.isComposite` read it instead of `owningType`.
- A variant of a variation usage with a featuring type is now composite. Variants of variation definitions, of package-level variations and of variations in attribute defs stay referential.

Consumers of variant `isComposite`:

- The pilot gates every composite-dependent supertype on `owningType`, which is null for variants. Ours used `owner()`, which is the variation. Each of these now reads `owningType`:
  - `FeatureMeta.isSubobject`, `isSuboccurrence`, `isStructureOwnedComposite` (subobjects, suboccurrences, ownedPerformances).
  - `FeatureMeta.isBehaviorOwnedComposite` (subperformances): gated on `owningType` being set. `isBehaviorOwned` itself stays on `owner()`, because operand expressions are not `FeatureMembership`-owned here.
  - `UsageMeta.isActionOwnedComposite`/`isPartOwnedComposite` (subactions, ownedActions).
  - `ItemUsageMeta.isSubitem` (subitems, subparts), `ConstraintUsageMeta.isCheckedConstraint`, `RequirementUsageMeta.isSubrequirement`, `StateUsageMeta.isSubstate`, `TransitionUsageMeta.isActionTransition`/`isStateTransition`.
  - `isSubcalculation`, `isSubcase`, `isSubAnalysisCase`, `isSubVerificationCase`, `isSubUseCase`.
  - `PortUsageMeta.isSubport` (T4).
- For non-variant usages this is behavior-preserving: a composite usage always had an `owningType`, which is then its `owner()`.
- `UsageMeta.mayTimeVary` (T9) reads `owningType`, so variants never vary, as in the pilot.
- Validators:
  - `validatePortUsageIsReference` reads `owningType`, as the pilot does. A variant port of a variation port in a port def or port usage is now composite without an owning type, so it gets "A PortUsage that is not a subport must have isReference = true". The pilot reports the same ("A port usage must be referential"). This looks like a pilot quirk; flagged for Armin.
  - `validatePortOwnedUsagesNotComposite`, `validateRequirementConstraintMembershipIsComposite` and `validateObjectiveMembershipIsComposite` only see `FeatureMembership` members: unaffected.
- Printer: reads `isReferenceExplicitly`/`isCompositeExplicitly`: unaffected.
- Pre-existing, unchanged: ungated `owner()` checks still treat variants as owned by their variation, where the pilot uses `owningType`.
  - Affected: `isBehaviorOwned` (enclosedPerformances), the assert-constraint override, `isPerformedAction`, `isExclusiveState`, the event-occurrence `isSuboccurrence`, `isSubrendering`, `isSubview`, `isSatisfiedViewpoint`, part actor/stakeholder checks and `hasRelevantSubjectParameter`.
  - Example: a variant action of a variation action still subsets `Performances::Performance::enclosedPerformances`.
  - The pilot also gives variants implicit featuring types. Ours gives none; `featuredBy` is untouched.

### T5 — `isSubrequirement` excludes every `RequirementConstraintMembership` (SYSML21-300)

- `model/SysML/requirement-usage.ts`: returns false for any `RequirementConstraintMembership` parent.
- Framed concerns lose `Requirements::RequirementCheck::subrequirements`.
- Chunk 4 missed one case: `RequirementVerificationMembership` also specializes `RequirementConstraintMembership`, in our AST and in the pilot metamodel. So `verify requirement r;` in an objective now gets `Requirements::requirementChecks` instead of `subrequirements`, still alongside `requirementVerifications`. This matches the pilot.

### T4 — port classification and 2026-08 occurrence semantics (ST6RI-965)

- `model/SysML/port-usage.ts`:
  - `isOwnedPort`: owning type is a `PartDefinition`/`PartUsage`, with no composite check (was composite and `PartDefinition`/`PortUsage`). Ports in part defs and part usages get `Parts::Part::ownedPorts`; ports nested in port usages are subports again.
  - `isSubport` reads `owningType`.
  - Occurrence semantics from the pilot's `OccurrenceUsageAdapter`/`PortUsageAdapter`: `subobject` when composite in a structure or a structure-typed feature, else `object` when typed by a structure. `suboccurrence` only applies when the port is not structure-typed.
  - Typical results: a typed port in a part def gets `ownedPorts` and `Objects::objects`; a typed subport gets `subports` and `Objects::Object::subobjects` instead of `suboccurrences`.
  - The structure check reads owned (including implied) typings only, as the pilot's `FeatureAdapter.hasStructureType` does. Our `FeatureMeta.hasStructureType` also reads inherited types, so it is not reused.
- Not ported: the `dataValue` branch, which applies to ports typed by data types; those are already invalid (`validatePortUsageTyping`).
- Found, not changed: the same `OccurrenceUsageAdapter` additions (`object`/`subobject`/`dataValue`) are missing for all other occurrence usages (parts, items, occurrences, connections). For example, `part a : A;` gets `Parts::parts` only; the pilot also adds `Objects::objects`. Fixing it needs the owned-typing structure check across `OccurrenceUsageMeta` and a check of every subclass against its adapter. Proposed for the Phase 5 backlog.

### T7/F1 — message classification

- `model/SysML/flow-usage.ts`:
  - `isMessage` means no owned end features (pilot `UsageUtil.isMessage`), and it selects `Flows::messages`. `isMessageConnection` (has `from … to` message events) still drives printing and `collectDeclaration`.
  - `isAbstract` is derived: explicit, or a message with fewer than two related features (pilot `makeMessageAbstract`).
  - Message events are parameters, not ends, so `message m of X from a.e to b.e;` is abstract too, as in the pilot. End-less succession flows are also abstract; their supertype is `Flows::successionFlows` either way.
- Printer: `UsageMeta.isAbstractExplicitly` feeds `usageBasicModifiers`, so the derived flag is not printed.
- Visible effects:
  - Messages now carry the `abstract` semantic-token modifier, like variations.
  - `validateRelatedTypes` already skipped messages, since they inherit two ends; once Phase 5 moves `validateConnectorRelatedFeatures` to related features (G5), the abstract marking keeps messages valid.
- Edge case: `relatedFeatures()` is our positional approximation, which inherits ends only from associations. A message that subsets a connected flow usage stays abstract here; the pilot would count the inherited connected ends.

### T8/F2 — `FlowDefinition` base supertype

- `model/SysML/flow-definition.ts`:
  - `base` maps to `Flows::MessageAction`.
  - `defaultSupertype` counts owned ends: exactly two → `binary` (`Flows::Message`), else `base`, as in `FlowDefinitionAdapter`.
  - Before, the mixin's action-definition default always returned `base`. Both keys mapping to `Message` hid that.
- 3-ended flow defs no longer get `validateAssociationBinarySpecialization`.
- New diagnostic, not stricter than the pilot: a concrete `flow def F;` with no ends now reports `validateAssociationRelatedTypes`. Before, `Message`'s inherited ends masked it. The pilot's `checkAssociation` reports the same unless the def is abstract; its own tests write `abstract flow def F;`.
- Pre-existing, unchanged: `AssociationMeta.defaultSupertype` (KerML associations, connection, interface and allocation defs) still counts inherited ends, where the pilot counts owned ends.

### T9 — `mayTimeVary`, derived `isVariable`, KerML `const ⇒ var`

- `model/KerML/feature.ts`: `isVariable` became an accessor.
- `model/SysML/usage.ts`:
  - `mayTimeVary` is the pilot's `UsageAdapter.mayTimeVary`: the owning type conforms to `Occurrences::Occurrence`, and the usage is not a portion, not a `Links::SelfLink`, not an `Occurrences::HappensLink`, and not a composite `Actions::Action`.
  - `isVariable` returns it; its setter is a no-op.
- The pilot's setting delegate also excludes `SuccessionAsUsage` and `BindingConnectorAsUsage`. Their implied `happensBeforeLinks`/`selfLinks` supertypes already conform to the excluded link types, so no override was added.
- `utils/ast-to-model.ts`:
  - `const` sets `isVariable` (pilot `FeatureParserPostProcessor.setIsVariableIfConstant`).
  - A usage's `portionKind` sets `isPortion` (pilot `OccurrenceUsageParserPostProcessor`), which `mayTimeVary` reads.
- `model/printer/namespaces.ts`: KerML modifiers print `const` before `var`, so `const feature` round-trips.
- `featuredBy` is untouched. No validator reads the derivation yet; that is Phase 4.
- Not ported:
  - ST6RI-856 (`UsageAdapter.doTransform`): end usages that may vary become constant. Its only reader is `validateSubsettingConstantConformance` (Phase 4 A3). Without it, A3 would accept a variable feature subsetting a varying end that the pilot rejects, so it should land with A3. The SysML printer prints `constant` from `isConstant`, so porting it needs an explicit/derived split like `isAbstractExplicitly`.
- T3 interplay: owned flow, connection, interface and allocation usages are still referential here (Phase 5). An owned flow usage is therefore time-varying here and not in the pilot. This matters only for V1 assignments to flow usages.

### T10 — semantic-metadata base types (chunk 3 S2)

- `services/shared/workspace/metamodel-builder.ts` `addSemanticMetadata` now follows the pilot's `getBaseTypes` overrides:
  - classifier: a feature base type is replaced by that feature's types (`allTypings`, ≈ pilot `Feature.type`), keeping classifiers only;
  - feature: classifier base types are dropped;
  - metadata feature: no base types.
- `#service def Service` now subclassifies `Interface` instead of the port usage `interfaces`. `#iface port i` with a port-definition base type no longer subsets the definition.

## Open for Armin

- T2b: composite variant ports of variation ports in port defs/usages now report `validatePortUsageIsReference`, exactly as the pilot does.
- T8: concrete end-less flow defs now report `validateAssociationRelatedTypes`, as the pilot does.
- Backlog candidates found here:
  - occurrence-usage `object`/`subobject`/`dataValue` for non-port usages (T4);
  - owned-end counting in `AssociationMeta.defaultSupertype` (T8);
  - ungated `owner()` checks on variants (T2b);
  - ST6RI-856 end-constant derivation, to land with Phase 4 A3 (T9).
