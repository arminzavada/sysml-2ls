# Chunk 4 — Type system (2026-09.1 upgrade)

> **Per-upgrade artifact.** Changes in range to compositeness, implicit specializations, default multiplicity and the derived properties validation depends on, checked against `packages/syside-languageserver/src/model/` and `services/shared/workspace/metamodel-builder.ts`.
>
> **Method:**
>
> - Pilot: license-stripped file diff of the logic module across its 2026-05 move (`org.omg.sysml/src/org/omg/sysml/...` at `2026-03` vs. `org.omg.sysml.logic/src/main/java/org/omg/sysml/...` at `2026-09.1`), plus the new `org.omg.{kerml,sysml}.xtext/.../postprocessing/` packages. Each hunk was attributed with `git log`. Pilot behavior is read from code and from the pilot's own Xpect/JUnit expectations; the pilot was not run.
> - Probes: a scratch Node script loads the built `lib/` of the language server with the pinned (`2026-03`) stdlib, builds each snippet with all validation checks, and prints diagnostics and each type's specializations (`{composite}`/`{ref}` = our derived `isComposite`). A second script ran our model over the whole stdlib to simulate the pilot's default-multiplicity rule.
> - Scope split with chunk 6: here, what the model *derives*. Validators that only consume a derivation are named but go to chunk 6.
>
> **Tags:** `understood` / `structurally-clear` / `needs-deeper-trace` / `consult-Armin`. **Gap** is our deviation from the pilot at `2026-09.1`.

## Summary

| # | Tag | Item | Gap | Size | Confidence |
| --- | --- | --- | --- | --- | --- |
| T1 | 2026-09 | Default multiplicity `1..1` (ST6RI-947, provisional on SYSML21-185) | we never add one, so we miss conformance warnings the pilot gives (pre-existing, widened) | 0.5–1 day | `consult-Armin` |
| T2 | 2026-07 | Usages owned by an attribute def/usage are referential (SYSML21-19) | ours composite; no visible specialization change | < 1 h | `structurally-clear` |
| T2b | 2026-05 | Variants of a variation with a featuring type are composite (ST6RI-937) | ours always referential (digest said "no work"; wrong) | < 1 h | `needs-deeper-trace` |
| T3 | pre-existing | Composite defaults (ST6RI-950 cross-check) | ours forces connection, interface, allocation and flow usages referential; pilot composite | small code, wide snapshot impact | `consult-Armin` |
| T4 | 2026-08 | Port usages get occurrence-usage semantics (ST6RI-965) | in-range delta already conformant; pre-existing `ownedPort` misclassification | < 1 h | `understood` |
| T5 | 2026-07 | `isSubrequirement` excludes every `RequirementConstraintMembership` (SYSML21-300) | ours: framed concerns still subset `subrequirements` | < 1 h | `understood` |
| T6 | 2026-07 | End-redefinition rule narrowed (KERML11-68) | typing unchanged; validator missing on our side (chunk 6) | — | `understood` |
| T7 | pre-existing | F1: which flow usages are messages | `message m of X;` / `flow f of X;` misclassified; no abstract marking | 1–2 h | `structurally-clear` |
| T8 | pre-existing | F2: `FlowDefinition` base supertype `Flows::MessageAction` | ours `Flows::Message`; gives a spurious error on 3-ended flow defs | < 1 h | `understood` |
| T9 | 2026-05 | `Usage::mayTimeVary` (feeds the new time-varying-referent rule) | no derivation; we accept assignments the pilot rejects | 0.5 day with rule | `structurally-clear` + `consult-Armin` on scope |
| T10 | pre-existing | Semantic-metadata base type on a classifier (chunk 3 S2) | classifier subclassifies the base-type feature itself | < 1 h | `structurally-clear` |
| T11 | 2026-05…09 | Smaller items (KERML11-1/3/6/7, ST6RI-961/964, SYSML21-419) | mostly OCL-only or API-only | — | see section |

**Headline:** the in-range semantic shifts are small to port: T2, T5 and T9 are a few lines each; T4's delta is already in place. The bigger findings are **pre-existing deviations** surfaced while verifying them:

- T3: connection-like usages are never composite.
- T4: part-owned ports never get `Parts::Part::ownedPorts`.
- T2b: variants are never composite.
- T1: no SysML default multiplicity at all.
- T7/T8: flow/message classification.
- T10: semantic metadata on classifiers.

None of them raises a diagnostic in the probes except T8, which gives a spurious error, and T1/T9, where the pilot warns or errors and we stay silent. T1 and T9 are the two items where **the pilot rejects or warns and we do not**.

**Ordering note for the plan:** T9 (`mayTimeVary`) is a prerequisite for chunk 6's `validateAssignmentActionUsageReferentIsTimeVarying`. Several older pilot validators also read the same derivation (`validateFeatureConstantIsVariable`, `validateFeatureValueIsInitial`, `validateSubsettingConstantConformance`, `effectiveFeaturingTypes` in the redefinition featuring-type check), and we implement none of them. Land T9 before chunk 6 work.

---

## T1. Default multiplicity (2026-09, ST6RI-947; SYSML21-185 pending)

**Pilot `2026-09.1`:** `org.omg.sysml.xtext/.../postprocessing/UsageParserPostProcessor.java`:

```java
protected boolean isAddDefaultMultiplicity() {
    Usage target = getTarget();
    return target.isEnd() ||
           target.getOwningType() != null &&
           target.getOwnedRelationship().stream().
                filter(rel->!rel.isImplied()).
                noneMatch(Redefinition.class::isInstance);
}
protected boolean isAddMultiplicity() { return getTarget().isEnd(); }
```

- `AttributeUsage`, `ItemUsage` and `PortUsage` post-processors override `isAddMultiplicity()` to `isAddDefaultMultiplicity()`. Through the EMF switch this covers enumeration, part, rendering, view and metadata usages.
- `ConnectionUsageParserPostProcessor` restricts it to ends again, which also covers interface and allocation usages. Flow usages go through the action-usage post-processor, so they get no default.
- `TypeUtil.addMultiplicityTo` adds an empty `Multiplicity` in an `OwningMembership` unless one is already owned. Its implicit supertype is `Base::exactlyOne` (`ImplicitGeneralizationMap`: `Multiplicity` "feature"), and `FeatureUtil.getMultiplicityRangeOf` follows that subsetting to `[1..1]`.
- **Before 2026-09** the same rule lived in `UsageAdapter.isAddDefaultMultiplicity` at transform time. There, any owned subsetting of a feature *with an owning type* suppressed the default. Now only an explicit owned **redefinition** does.
- The commit and the JUnit test (`MultiplicityPreparationTest`) mark the rule "TODO: update after final resolution of SYSML21-185".

**Where it shows:** `KerMLValidator.checkSubsetting` compares the *owned* multiplicities of both features, which the default now supplies:

- `validateSubsettingMultiplicityConformance`: upper bound.
- `validateRedefinitionMultiplicityConformance`: lower bound, redefinitions only.

The pilot's `DefaultMultiplicity_invalid.sysml.xt` expects 8 warnings:

```sysml
package DefaultMultiplicity {
    attribute a1; item i1; part p1; port t1;
    part def P {
        attribute a2 :> a1;          // default [1..1] despite the subsetting
        attribute a3[*] :> a2;       // warning: larger upper bound (likewise i3, p3, t3)
        attribute a4;
        attribute a5[*] :> a4;       // warning (likewise i5, p5, t5)
    }
    part def Q { action n1; action n2[*] :> n1; }   // no default for actions: no warning
}
```

**Ours:** no SysML default multiplicity anywhere.

- `TypeMeta.multiplicity` holds only an explicit `MultiplicityRange` (`model/KerML/type.ts` line 102).
- `KerMLValidator.validateSubsettingMultiplicityConformance` (`services/validation/kerml-validator.ts` line 620) returns unless both features have explicit bounds.
- The probe of the model above plus `part def R :> P { attribute :>> a4[0..1]; part p6[*] :> p2; }` gives **no diagnostics**; the pilot gives 10 warnings.

Our model has never applied the pre-2026-09 rule either, so the 2026-09 change does not open a new gap; it widens the existing one by the subsetting-only usages.

**Library simulation:** our model over the 2026-03 stdlib, with the 2026-09 rule applied to explicit subsettings and redefinitions:

- 129 usages are eligible for the default; 4 of them only because the subsetting exemption was dropped.
- Zero conformance warnings would result. The user-model simulation reproduces exactly the pilot's 8 Xpect warnings plus the 2 extra cases.

**Implementation shape** (not decided):

- (a) Mirror the pilot and synthesize an empty `Multiplicity` child post-parse. This touches the `multiplicity` slot type, the printer, `validateTypeOwnedMultiplicity` (`kerml-validator.ts` line 291) and `validateFeatureEndMultiplicity` (line 501).
- (b) Derive an "effective owned multiplicity" (explicit range, or `1..1` when eligible) and read it in the two conformance checks.

(b) is smaller and keeps the AST honest. (a) follows the pilot's grain.

Differences that need tracing before porting:

- Our `validateSubsetting` skips implied subsettings (line 731) and connector-owned features. The pilot's check has the connector skip commented out, and it is unclear whether Xtext visits implied subsettings.
- The pilot's `validateFeatureEndMultiplicity` reads inherited multiplicities (`f.multiplicities`); ours reads only the explicit one.

**Gap:** we stay silent where the pilot warns. These are warnings, not rejections. **Size:** 0.5–1 day with (b), including the Xpect cases as tests and a stdlib-diagnostics snapshot check. **Status:** `consult-Armin` (port now while the rule is provisional, or wait for SYSML21-185).

## T2. Attribute-owned usages are referential (2026-07, SYSML21-19)

**Pilot:** `UsageParserPostProcessor.postProcess`:

```java
Type featuringType = UsageUtil.getExpectedFeaturingTypeOf(target);
if (target.getDirection() != null || target.isEnd() || featuringType == null ||
        featuringType instanceof AttributeDefinition || featuringType instanceof AttributeUsage) {
    target.setIsComposite(false);
}
```

The same commit enables `checkAllNotComposite(ownedFeature, …)` for `validateAttributeDefinitionFeatures`/`validateAttributeUsageFeatures` in `SysMLValidator`. After post-processing these can fire only on non-usage owned features, which SysML text cannot produce.

**Ours:** `model/SysML/usage.ts` line 67: `isComposite = _isComposite && direction === "none" && !isEnd && owningType`. There is no attribute check. `services/validation/sysml-validator.ts` lines 236–237 keep both validators as "blocked by KERML-4" TODOs.

**Probe:**

```sysml
attribute def AD { part p; item i; action a; occurrence o; port pt; constraint c { true } calc k { 1 } }
attribute av { part p2; }
part def PD { attribute atr { part p3; } }
```

All of `p, i, a, o, c, k, p2, p3` are `{composite}` here (`pt` is referential through the port rule). Their implied supertypes are the plain base ones (`Parts::parts`, `Items::items`, `Actions::actions`, …). The pilot's composite-dependent supertypes all require Structure/Class/Behavior/Item owners, which an attribute def/usage is not. So making them referential **changes no specialization**, which agrees with chunk 2's library count of 14 affected stdlib usages. It does change `isComposite`, which T9 (`mayTimeVary`) and any future consumer read.

**Fix:** add `owningType?.isAny(AttributeDefinition, AttributeUsage)` to `UsageMeta.isComposite`. Enable the two validators as unreachable spec-traceability checks, like the 2026-01 batch in `docs/known_limitations.md`, or delete the TODOs. **Status:** `structurally-clear`.

### T2b. Variants (2026-05, ST6RI-937)

**Pilot:** `UsageUtil.getExpectedFeaturingTypeOf` returns the owning type for `FeatureMembership`-owned usages, and **for a variant, the expected featuring type of its variation usage**. A variant inside `part def PD { variation part q { variant part r; } }` is therefore composite. The 2026-03 code used `eContainer instanceof FeatureMembership`, which made all variants referential; that was the regression ST6RI-937 fixed.

**Ours:** a variant is owned through a `VariantMembership`, so `FeatureMeta.owningType` is unset (`feature.ts` `onOwnerSet`) and `UsageMeta.isComposite` is always false. The probe shows `PD::q::r : PartUsage {ref}`. The digest's "our `UsageMeta.isComposite` ignores containment, so no work" is **wrong**: it requires `owningType`.

**Visible effect:** none found. The variant's implied supertypes (`PD::q`, `Parts::parts`) don't depend on it, because the pilot's composite-dependent supertypes also need a non-null `owningType`, which variants lack there too. **Size:** a few lines. **Status:** `needs-deeper-trace` (downstream consumers of variant compositeness not enumerated).

## T3. Composite defaults (ST6RI-950 cross-check; pre-existing)

**Pilot:** `UsageParserPostProcessor.NON_COMPOSITE_USAGE_TYPES` = AttributeUsage, BindingConnectorAsUsage, EventOccurrenceUsage, ExhibitStateUsage, IncludeUseCaseUsage, PerformActionUsage, ReferenceUsage, SuccessionAsUsage. Every other usage is composite unless `ref` or one of the contextual rules (T2, ports) applies. ST6RI-950 only moved these defaults from constructors to post-processing; it changes no behavior.

**Ours:** per-class `isComposite` overrides force `false` for all eight, but also for:

- `ConnectorAsUsageMeta` (`connector-as-usage.ts` line 38), inherited by `FlowUsageMeta` and `SuccessionFlowUsageMeta`;
- `ConnectionUsageMeta` (`connection-usage.ts` line 39), and with it interface and allocation usages.

**Probe:**

```sysml
part def S {
    part a1 : A; part a2 : A;
    connection c connect a1 to a2;
    flow f from a1 to a2;
}
```

Ours: `c {ref}` → `Connections::binaryConnections` only; `f {ref}` → `Flows::flows` only. Pilot (by code): both composite, so:

- `c` also gets `Items::Item::subparts` (`ConnectionUsageAdapter`/`ItemUsageAdapter.isSubitem`);
- `f` also gets `Parts::Part::ownedActions` and `Objects::Object::ownedPerformances` (`FlowUsageAdapter`).

No diagnostic difference observed.

**Gap:** missing implicit supertypes on every owned connection/interface/allocation/flow usage. Out of range, but it sits next to T2/T2b in the same getter. **Size:** small code change, but many printer/snapshot expectations may move. **Status:** `consult-Armin` (this cycle or later).

## T4. Port usages get occurrence-usage semantics (2026-08, ST6RI-965)

**Pilot:**

- `PortUsageAdapter` now extends `OccurrenceUsageAdapter`, whose `addDefaultGeneralType` adds `dataValue`, `object`/`subobject` (structure-typed) or else `suboccurrence`, and `snapshot`/`timeslice` per `portionKind`.
- For ports typed by port defs (structures) the only new supertypes are the portion ones; `subobject` was already added by `PortUsageAdapter` for structure-owned composites.
- `PortUsageAdapter.getDefaultSupertype` is unchanged: `ownedPort` when the owning type is a `PartDefinition`/`PartUsage` (no composite check), `subport` when composite and owned by a port def/usage, else `base`.

**Ours:** `PortUsageMeta extends OccurrenceUsageMeta` (`model/SysML/port-usage.ts`), whose `defaultGeneralTypes` pushes `portionKind`. The probe confirms the in-range delta:

```text
PortsP::Pp::ts : PortUsage {ref,timeslice}  -> Ports::ports, Occurrences::Occurrence::timeSlices
PortsP::Pp::ss : PortUsage {ref,snapshot}   -> Ports::ports, Occurrences::Occurrence::snapshots
```

**Pre-existing deviations found by the same probe:**

- `isOwnedPort()` (line 47) requires `isComposite` and checks `PartDefinition | PortUsage`. Our `isComposite` is false outside port contexts, so **a port in a part def or part usage never gets `Parts::Part::ownedPorts`**: `Pp::p` and `pu::p2` → `Ports::ports`.
- A port nested in a *port usage* would be classified `ownedPort` instead of `subport`.
- Subports get `Occurrences::Occurrence::suboccurrences` (our generic `isSuboccurrence`) where the pilot gives `Objects::Object::subobjects`.

**Fix:** `isOwnedPort` = `owningType` is `PartDefinition | PartUsage`, no composite check. Drop `suboccurrence` for structure-typed occurrence usages, or add `subobject`. **Status:** `understood` (delta conformant; deviations small).

## T5. `isSubrequirement` excludes all requirement-constraint memberships (2026-07, SYSML21-300)

**Pilot:** `UsageUtil.isSubrequirement` = composite and owned by a requirement def/usage and `!(owningFeatureMembership instanceof RequirementConstraintMembership)` (was `!isAssumptionConstraint`). In the grammar, `RequirementConstraintUsage returns SysML::ConstraintUsage`, so `require`/`assume` never own a `RequirementUsage`. The only `RequirementUsage` in such a membership is a **framed concern**: `FramedConcernMembership` specializes `RequirementConstraintMembership`, kind `requirement`, owning a `ConcernUsage`. Net effect: **framed concerns are no longer subrequirements.** `ConcernUsageAdapter` still gives them `Requirements::RequirementCheck::concerns`.

**Ours:** `model/SysML/requirement-usage.ts` line 44 excludes only `requirementConstraintKind() === "assumption"`. `ConcernUsageMeta.defaultGeneralTypes` (`concern-usage.ts` line 39) pushes `subrequirement` too. Probe:

```sysml
requirement def R { frame concern c1; concern c2; }
concern cc : CD;
requirement def R2 { frame cc; }
```

`R::c1` and `R2::cc` both get `Requirements::RequirementCheck::subrequirements` (plus `concerns`); the pilot no longer adds it. `c2` is correctly a subrequirement in both.

**Fix:** `isSubrequirement` returns false when `parent()?.is(RequirementConstraintMembership)`. **Status:** `understood`.

## T6. End-redefinition rule narrowed (2026-07, KERML11-68)

**Pilot:** `KerMLValidator.checkRedefinition`: "redefining feature must be an end" now fires only when the redefining feature's `owningType` is an `Association` or `Connector`. In a plain classifier, `feature :>> e;` against an inherited `end e` is now legal. The typing side is unchanged: the implicit end redefinition logic (`FeatureAdapter.getEndRelevantFeatures`) is only refactored (`TypeUtil.getEndFeatureOf`).

**Ours:** no `validateRedefinitionEndConformance` at all. The implicit end redefinitions (`metamodel-builder.ts` `redefineEnds`, line 742) are untouched by the range.

**Status:** `understood`. Nothing to change in typing; chunk 6 implements the narrowed validator.

## T7. F1: message classification (pre-existing, chunk 2)

**Pilot:** `UsageUtil.isMessage` = `FlowUsage` with no owned end features. `FlowUsageAdapter.getDefaultSupertype` → `message` (`Flows::messages`) or `base` (`Flows::flows`). `makeMessageAbstract` (in `doTransform`) sets `isAbstract` on a message with fewer than two related features. `message … from a to b` uses `MessageEventMember`s (parameters, not ends), so it is still a message.

**Ours:** `FlowUsageMeta.isMessageConnection` (`flow-usage.ts` line 71) = has message events. Probe:

```text
message m1 of X;              ours Flows::flows    pilot Flows::messages (+ abstract)
message m2 of X from a to b;  ours Flows::messages pilot Flows::messages
flow f1 of X;                 ours Flows::flows    pilot Flows::messages (+ abstract)
flow f2 of X from a.o to b.i; ours Flows::flows    pilot Flows::flows
```

Since the 2026-09 library `Flows::messages` is an action usage with owned ends, and the end-less usages are where the two disagree. No diagnostic difference observed.

**Fix:** split "is a message" (no owned ends) from "has message events". `collectDeclaration` (line 117), which serializes the message events, still needs the latter. Add the abstract marking. **Status:** `structurally-clear`.

## T8. F2: `FlowDefinition` base supertype (pre-existing, chunk 2)

**Pilot:** `FlowDefinitionAdapter.getDefaultSupertype`: exactly two *owned* ends → `binary` (`Flows::Message`), else `base` (`Flows::MessageAction`).

**Ours:** `flow-definition.ts` maps both keys to `Flows::Message`. Probe:

- `flow def F0;` → `Flows::Message`; the pilot gives `MessageAction`.
- `flow def F3 { end a : A; end b : B; end c : B; }` → our `validateFlowEnd` errors, as the pilot's `validateFlowDefinitionConnectionEnds` would. On top of that we raise **`validateAssociationBinarySpecialization` ("cannot have more than two ends")**, because `Message` is binary. That is stricter than the pilot only because of the wrong supertype.

**Fix:** `base: "Flows::MessageAction"`. **Status:** `understood`.

## T9. `Usage::mayTimeVary` (derivation for the 2026-05 time-varying-referent rule)

**Pilot:**

- The derivation is `org.omg.sysml.logic/.../adapter/UsageAdapter.java` `mayTimeVary()`, unchanged in range:

  ```java
  owningType != null &&
  specializes(owningType, Occurrences::Occurrence) &&
  !(isPortion() ||
    specializes(target, Links::SelfLink) ||
    specializes(target, Occurrences::HappensLink) ||
    isComposite() && specializes(target, Actions::Action))
  ```

- `UsageImpl.isVariable()` returns `isMayTimeVary()`. For usages, `isVariable` is derived; `constant` does not set it (`UsageParserPostProcessor.setIsVariableIfConstant` is a no-op).
- New in 2026-05: `SysMLValidator.checkAssignmentActionUsage` errors when `referent.featureTarget.isVariable` is false. `referent` is the first owned non-`FeatureMembership` feature member, skipping metadata features (SYSML21-15). For a chain `a.b` the target is `b`.
- Pre-existing pilot validators that read the same `isVariable` on usages:
  - `validateFeatureConstantIsVariable`: a `constant` usage that cannot vary is an error;
  - `validateFeatureValueIsInitial`: `:=` on a non-varying usage;
  - `validateSubsettingConstantConformance`;
  - `effectiveFeaturingTypes` in the redefinition featuring-type check.

**Ours:**

- `FeatureMeta.isVariable` is a plain field set from KerML `var` (`model/KerML/feature.ts` line 180; `utils/ast-to-model.ts`). SysML usages never set it.
- There is no `mayTimeVary`.
- `validateAssignmentActionUsageReferent` (`sysml-validator.ts` line 630) only checks that `targetMember` exists.
- None of the four older validators exists.

**Probe:**

```sysml
package Assign {
    private import ScalarValues::Integer;
    attribute def D { attribute x : Integer; }
    attribute g : Integer;
    part def P {
        attribute y : Integer;
        attribute d : D;
        constant attribute k : Integer = 0;
        action act {
            assign y := 1;     // pilot: ok
            assign k := 1;     // pilot: ok for this rule (constant does not affect mayTimeVary)
            assign g := 1;     // pilot: error (package-level, no owning type)
            assign d.x := 1;   // pilot: error (x owned by an attribute def, not an Occurrence)
        }
    }
}
```

We report nothing. **We accept what the pilot rejects.** All Semantifyr test models assign to attributes of part defs, which are time-varying, so they stay clean.

**Fix:**

- A `mayTimeVary` getter on `UsageMeta`, using `owningType.conforms("Occurrences::Occurrence")`, `isPortion`, `conforms("Links::SelfLink")`, `conforms("Occurrences::HappensLink")`, and `isComposite && conforms("Actions::Action")`. It must read T2's corrected `isComposite`.
- `UsageMeta` overrides `isVariable` to return it. The KerML printer's `var` path only runs for KerML features.
- Add the validator.

About 0.5 day with tests, including chain targets.

**Status:** `structurally-clear`. `consult-Armin`: land only the 2026-05 rule, or the four pre-existing `isVariable` validators too? They are out of range but share the derivation. `validateFeatureConstantIsVariable` would newly reject `constant attribute` at package level or inside attribute defs. That reading is from code only (`needs-deeper-trace`).

## T10. Semantic-metadata base type on a classifier (pre-existing; chunk 3 S2)

**Pilot:** `ClassifierAdapter.getBaseTypes` maps a feature base type to its types. **Ours:** `metamodel-builder.ts` `addSemanticMetadata` (line 599) subclassifies the feature itself (`#service def Service` → `implied Subclassification -> P::interfaces`, a `PortUsage`). **Size:** small. **Status:** `structurally-clear`.

## T11. Smaller in-range items

- **KERML11-1 `ownedCrossFeature`** (2026-07): the pilot adds an `owningType != null` guard and excludes `BindingConnector` members. The latter matters there because implied binding connectors became `OwningMembership`-owned (ST6RI-931). Our `FeatureMeta.findOwnedCrossFeature` (`feature.ts` line 370) does not materialize implied binding connectors, but it also has no `isEnd`/owning-type guard. Its callers are cross-subsetting validators and `metamodel-builder.ts` line 927. Tiny. `structurally-clear`.
- **KERML11-3** (2026-07): featuring types of multiplicity-bound expressions of owned cross features moved from `MultiplicityAdapter` to `ExpressionAdapter.addImplicitFeaturingTypesIfNecessary`. The bounds take the owning end's featuring types. Validator-facing; chunk 6. `needs-deeper-trace`.
- **KERML11-6, KERML11-7, ConstraintUsage requirement-subsetting composite gating** (2026-05): OCL-only in range; the pilot implementations are unchanged. No action. `understood`.
- **ST6RI-961** (2026-07): `TypeAdapter.isImplicitSpecializationFor` treats structurally equal feature chains as the same implicit general type (duplicate subsettings on transition usages). We dedupe implied specializations by identity, if at all; not probed. Low. `needs-deeper-trace`.
- **ST6RI-964 `ownedDisjoining`, SYSML21-419 `ownedMetadata`/`nestedMetadata`**: derived-property fixes in an API we don't expose. Low. `understood`.
- **KERML11-79 `TransitionPerformance::triggerTarget`**: library-only (chunk 2 L4). No builder change. `understood`.

---

## Open questions

1. **T1 default multiplicity** (`consult-Armin`): port the provisional 2026-09 rule now (and as model shape (a) or (b)), or wait for SYSML21-185? Today we already miss the pre-2026-09 warnings, so waiting keeps a known gap rather than avoiding churn.
2. **T9 scope** (`consult-Armin`): with `mayTimeVary` in place, add only `validateAssignmentActionUsageReferentIsTimeVarying`, or also the four older `isVariable`-dependent validators (chunk 6)?
3. **T3 composite defaults** (`consult-Armin`): fix connection, interface, allocation and flow compositeness this cycle, with T2/T2b in the same getter, or record it in `docs/known_limitations.md` and defer? Expect snapshot churn.
4. **Pre-existing deviations T4, T7, T8, T10** are each under two hours and local to one model class. Bundle them with the in-range T2/T5/T9 as one "implicit-specialization conformance" phase?
5. **T2b** (`needs-deeper-trace`): enumerate consumers of variant `isComposite` before changing it.
