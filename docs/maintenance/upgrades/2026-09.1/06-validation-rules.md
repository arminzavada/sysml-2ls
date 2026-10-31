# Chunk 6 — Validation rules (2026-09.1 upgrade)

> **Per-upgrade artifact.** Every validator change in the pilot between `2026-03` and `2026-09.1`, checked against `packages/syside-languageserver/src/services/validation/` (`kerml-validator.ts`, `sysml-validator.ts`), plus an inventory of older pilot validators with no counterpart here.
>
> **Method:**
>
> - Pilot: `git diff` per tag range over `KerMLValidator.xtend`, `SysMLValidator.xtend`, `KerMLResourceValidator.java`, `KerMLExpressionsValidator.xtend` and the Xpect validation tests. Each hunk was attributed with `git log`. Spec OCL bodies are quoted from the pilot's `org.omg.sysml/model/SysML.uml`. Pilot behavior is read from code and Xpect expectations; the pilot was not run.
> - Inventory: the pilot's validation-code constants at `2026-09.1`, matched against ours by name, then checked by hand for renames, dead constants and commented-out code on both sides.
> - Probes: a scratch Node script loads the built `lib/` of the language server, builds each snippet with all checks, and prints diagnostics. It uses the pinned (`2026-03`) stdlib, or the pilot's `2026-09.1` `sysml.library` where the library matters (marked "new stdlib").
> - Scope split with chunk 4: derivations (`mayTimeVary`, compositeness, default multiplicity) are chunk 4 (T1–T11); here, only the validators that consume them.
>
> **Tags:** `understood` / `structurally-clear` / `needs-deeper-trace` / `consult-Armin`. **Gap** is our deviation from the pilot at `2026-09.1`.

## Range at a glance

- **2026-03→04:** license headers only (all three validator files).
- **2026-04→05:** new time-varying referent rule; referent rule skips metadata; send payload rule renamed; library-package check refactored. Spec OCL (not code) drops the send parameter-count rule and relaxes the accept one.
- **2026-05→07:** multiplicity-domain special case removed; end-redefinition rule narrowed; attribute-feature rules enabled.
- **2026-07→08:** cross-subsetting error anchor fixed; `TypeUtil` utility refactors (ST6RI-944); message typo.
- **2026-08→09:** owned-multiplicity rule counts owned members only; two new ends-are-usages rules; flow-definition message texts; state-subaction refactor.
- **2026-09→09.1:** binding-connector proxy resolution.

`KerMLExpressionsValidator` is empty (all commented out) at both tags. `KerMLResourceValidator` changes only in its license header.

## Summary

| # | Tag | Pilot rule | Ours | Gap | Depends on | Size | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1 | 2026-05 | `validateAssignmentActionUsageReferentIsTimeVarying` (new, error) | none | **we accept what the pilot rejects** | chunk 4 T9 | ~1 h on top of T9 | `structurally-clear` |
| V2 | 2026-05 | `validateAssignmentActionUsageReferent` skips metadata (SYSML21-15) | `validateAssignmentActionUsageReferent` | none | — | 0 | `understood` |
| V3 | 2026-05 | `validateSendActionUsagePayloadArgument` (SYSML21-459) | none; our grammar admits payload-less state/effect sends | **we accept what the pilot rejects** (pilot: grammar layer; pre-existing) | — | 1–2 h, grammar | `understood` |
| V4 | 2026-05 (OCL) | send `≥ 3` parameters dropped; accept `≥ 2` → `notEmpty` | `validateSendActionParameters`, `validateAcceptActionUsageParameters` | none observable (ours never fire) | — | < 30 min cleanup | `understood` |
| V5 | 2026-07 | `validateRedefinitionEndConformance` narrowed to Association/Connector owners (KERML11-68) | none | **we accept what the pilot rejects** (pre-existing, scope narrowed) | — | ~1 h | `understood` |
| V6 | 2026-07 | `validateAttributeDefinitionFeatures` / `validateAttributeUsageFeatures` enabled (SYSML21-19) | TODO comments | none today; enabling before T2 would reject what the pilot accepts | chunk 4 T2 | < 30 min | `structurally-clear` |
| V7 | 2026-07 | `validateFeatureMultiplicityDomain`: cross-feature special case removed (KERML11-3) | `validateMultiplicityDomain` | none | — | 0 | `structurally-clear` |
| V8 | 2026-08 | `validateFeatureOwnedCrossSubsetting` anchor fix (ST6RI-966) | `validateFeatureOwnedCrossSubsetting` | anchor only (we also flag the first) | — | 1 line | `understood` |
| V9 | 2026-05/08 | refactors: library-package check (ST6RI-926), `TypeUtil` utils (ST6RI-944), message typo | — | none | — | 0 | `understood` |
| V10 | 2026-09 | `validateTypeOwnedMultiplicity` counts owned members only (ST6RI-975) | `validateTypeOwnedMultiplicity` | conformant; pre-existing severity warning vs error | — | 1 line | `understood` |
| V11 | 2026-09 | `validateConnectionDefinitionEndsAreUsages_` / `validateFlowDefinitionEndsAreUsages_` (new, error) | none | **we accept what the pilot rejects** | stdlib 2026-09 swap; chunk 4 T8 | 1–2 h | `understood` |
| V12 | 2026-09 | `validateFlowDefinitionConnectionEnds`: message only | `validateFlowEnd` | pre-existing: we miss inherited overflow, over-report owned ends | chunk 4 T8 | ~30 min | `understood` |
| V13 | 2026-09 | `checkStateSubactions` refactor | `validateStateSubactionKind` | none | — | 0 | `understood` |
| V14 | 2026-09.1 | binding-connector proxy resolution (ST6RI-984) | `validateBindingConnectorTypeConformance` | n/a (no proxies) | — | 0 | `understood` |
| G5 | chunk 1 | `validateConnectorRelatedFeatures` on end-less connector usages | `validateRelatedTypes` counts `allEnds()` | **we accept what the pilot rejects** (pre-existing) | chunk 4 (binary classification) | ~1 h + regressions | `needs-deeper-trace` |
| TV | pre-existing | the `isVariable` readers (`validateFeatureConstantIsVariable`, `validateFeatureValueIsInitial`, `validateSubsettingConstantConformance`, `effectiveFeaturingTypes`) | none (last one: n/a) | **we accept what the pilot rejects** | chunk 4 T9 (SysML half) | 2–3 h | `structurally-clear`, scope `consult-Armin` |

**Headline:** the in-range validator delta is small. Two new pilot rules reject models we accept: V1 (assignment to a non-time-varying feature) and V11 (connection/flow def ends that are not usages). V5 is an old rule the pilot narrowed but still enforces, and we never had it. V1 needs chunk 4's `mayTimeVary`. V11 needs the 2026-09 stdlib, or our own library would fail it.

The digest's two open validator questions resolve:

- **Send payload (V3):** the pilot check really never fires: it tests an `EList<FeatureMembership>` with `instanceof`. But the pilot does not need it, because its grammar requires a payload in exactly the contexts the rule covers (state entry/do/exit actions and transition effects). Our shared `SendNodeDeclaration` does not, so `entry send to r;` parses here and not in the pilot. This is a grammar-layer conformance bug, pre-existing since the pilot's 2024-11 send rework, not a validator choice.
- **Send/accept parameters (V4):** our checks read getters that fall back to default parameters, so they never fire. Ours is not stricter in practice. The send check enforces an OCL rule the spec has since retired.

The larger finding is the **pre-existing inventory**: 11 pilot validators reachable from ordinary text with no counterpart here, all in the "pilot rejects, we accept" direction. 5 of them read `isVariable`. A few of our validators are stricter than the pilot without documentation.

---

## V1. Assignment referent must be time-varying (2026-05, SYSML21-17)

**Pilot `2026-09.1`:** `SysMLValidator.checkAssignmentActionUsage`:

```xtend
// validateAssignmentActionUsageReferentIsTimeVarying
val referent = usg.referent
if (referent !== null && !referent.eIsProxy && !referent.featureTarget.isVariable) {
    error("Referent must be time varying.", usg.ownedRelationship.get(1), null, ...)
}
```

- OCL: `referent <> null implies referent.featureTarget.isVariable`.
- For usages, `isVariable` is `isMayTimeVary()` (`UsageImpl.isVariable`). See chunk 4 T9 for the derivation.
- The error is anchored on `ownedRelationship[1]`, the referent membership (the `i.d` chain below).

Pilot's own test (`AssignmentActionUsage_invalid`), as a probe:

```sysml
package AssignmentActionUsage_invalid {
    item i {
        attribute a;
        protected attribute b;
        private attribute c;
        action d;
    }
    action def A {
        assign i.a := null;
        assign i.b := null;   // pilot + ours: cannot resolve 'b'
        assign i.c := null;   // pilot + ours: cannot resolve 'c'
        assign i.d := null;   // pilot: "Referent must be time varying."
    }
}
```

Ours reports the two resolution errors and nothing on `i.d`. `d` is a composite action, so the `isComposite && specializes(Actions::Action)` clause of `mayTimeVary` excludes it. Chunk 4 T9's probe adds:

- assignment to a package-level attribute;
- assignment to a feature of an attribute def (`assign d.x := 1` where `d : D`, `D` an attribute def).

The pilot rejects both. We accept both.

**Ours:** `validateAssignmentActionUsageReferent` (`sysml-validator.ts` line 630) only checks that `targetMember` exists. There is no time-varying check.

**Port:**

- The validator is about 15 lines on top of T9's `UsageMeta.mayTimeVary`: read `targetMember.element().featureTarget.isVariable`, anchor on `targetMember`.
- KerML referents (library features) read the plain `var` flag. The pilot also sets `isVariable` for KerML `const` features; ours does not (see TV).

**Prerequisites:**

- T9 is the real prerequisite.
- T2 (attribute-owned usages referential) does not change `mayTimeVary` in practice: an attribute owner never specializes `Occurrences::Occurrence`, so those usages are not time-varying either way.
- T3 does matter at the edge. Our connection-like usages are referential where the pilot's are composite. A flow usage is an action, so in the pilot an owned flow usage is not time-varying; with our `isComposite` it would be. That matters only for assigning to a flow usage.
- T2b: our variants have no `owningType`, so `mayTimeVary` would be false for them and assigning to a variant would be rejected. The pilot rejects that too, because its variants also lack an owning type (T2b). Not traced further.

**Repo impact:**

- Semantifyr models assign only to attributes of part defs, which are time-varying (chunk 4).
- The stdlib's only assignments are in `Actions::ForLoopAction`: `index` (an attribute) and the `var` parameter, both owned by an action def. They stay clean.

**Gap:** we accept what the pilot rejects. **Layer:** validator, same as the pilot. **Status:** `structurally-clear`.

## V2. Referent skips metadata features (2026-05, SYSML21-15)

**Pilot:** the referent derivation and `validateAssignmentActionUsageReferent` now skip `MetadataFeature` members. Before, a prefix `#M` (an `OwningMembership` before the referent) became the referent. The error anchor moved from the usage to `ownedRelationship[1]`.

**Ours:** the referent has a dedicated `targetMember` slot, so metadata can never be taken for it. Probe:

```sysml
package AssignMeta {
    metadata def M;
    part def P {
        attribute y : ScalarValues::Integer;
        action act {
            #M assign y := 1;
            assign y := 2 { @M; }
        }
    }
}
```

No diagnostics. Messages differ ("An assignment must have a Feature referent." vs the pilot's "An assignment must have a referent."). The check is unreachable from text on both sides. **Status:** `understood`, nothing to port.

## V3. Send payload argument (2026-05 rename, SYSML21-459)

**Spec OCL** (renamed from `validateSendActionParameters`, same rule id in `SysML.uml`, new body):

```ocl
owningFeatureMembership <> null and
(owningFeatureMembership.oclIsKindOf(StateSubactionMembership) or
 owningFeatureMembership.oclIsKindOf(TransitionFeatureMembership)) implies
    payloadArgument <> null
```

**Pilot implementation** (`checkSendActionUsage`):

```xtend
// validateSendActionUsagePayloadArgument
val featureMembership = TypeUtil.getFeatureMembershipOf(usg)   // 2026-05..07: usg.featureMembership
if ((featureMembership instanceof StateSubactionMembership ||
     featureMembership instanceof TransitionFeatureMembership) &&
    usg.payloadArgument === null) {
    error(INVALID_SEND_ACTION_USAGE_PAYLOAD_ARGUMENT_MSG, usg, null, INVALID_SEND_ACTION_USAGE_PAYLOAD_ARGUMENT_MSG)
}
```

**Verified dead:**

- `TypeUtil.getFeatureMembershipOf(Type)` returns `EList<FeatureMembership>`: the usage's own feature memberships as a type, not its owning membership. A list is never an instance of either membership class.
- The 2026-03 code (`usg.featureMembership`) has the same shape, so the check has been dead throughout.
- The issue code passed is the message constant; the code constant is unused.

**The pilot does not rely on it.** The grammar enforces the rule:

```text
PerformedActionUsage returns SysML::ActionUsage :            // state entry/do/exit, transition effect
      {SysML::PerformActionUsage} PerformActionUsageDeclaration
    | {SysML::AcceptActionUsage} AcceptNodeDeclaration
    | {SysML::SendActionUsage} SendNodeDeclaration
    | {SysML::AssignmentActionUsage} AssignmentNodeDeclaration ;

fragment SendNodeDeclaration returns SysML::ActionUsage :
    ActionNodeUsageDeclaration? 'send'
    ownedRelationship += NodeParameterMember SenderReceiverPart? ;   // payload required

SendNode returns SysML::SendActionUsage :                     // action bodies only
    OccurrenceUsagePrefix ActionNodeUsageDeclaration? 'send'
    ( ActionBody
    | ( => ( ownedRelationship += NodeParameterMember SenderReceiverPart?
           | ownedRelationship += EmptyParameterMember SenderReceiverPart )
        ActionBody ) ) ;
```

So a send without payload is only possible in action bodies (`SendNode`), where the rule does not apply. This is unchanged since `d4f25bcbf` (2024-11, SYSML2_-159).

**Ours:** `SysML.langium` uses one `SendNodeDeclaration` with an optional payload for `SendNode`, `StateActionUsage_4` and `EffectBehaviorUsage_4`:

```text
fragment SendNodeDeclaration:
    ActionNodeUsageDeclaration? 'send'
    ( payload=NodeParameterMember SenderReceiverPart?
    | 'to' receiver=NodeParameterMember
    )?
;
```

Probes:

```sysml
package SendPayload1 {
    item def Sig;
    part def P {
        port r;
        state def S {
            entry send to r;
            state s1;
            state s2;
            transition first s1 accept Sig do send to r then s2;
        }
    }
}
```

Ours parses this; the only diagnostics are the two "send via instead of to" warnings. The pilot rejects both sends at parse time.

```sysml
package SendPayload2 {
    part def P {
        port r;
        action def Act {
            action snd send via r;
        }
    }
}
```

The pilot accepts this through `SendNode` (`EmptyParameterMember SenderReceiverPart`). Ours gives a parse error at `via`. The same holds for `send via r to r;`.

**Gap:** both directions, at the grammar layer, pre-existing. It belongs to the same rule family as chunk 1 X1 (bodied `send { … }`).

**Port:**

- Split our fragment into a node form (payload optional; add the payload-less `via` alternative) and a performed-action form (payload required) for `StateActionUsage_4` / `EffectBehaviorUsage_4`.
- One repo test relies on the current leniency: `model/SysML/__tests__/action-derived.test.ts` ("payloadInvocation() is undefined for empty payload") uses `entry send to p;`. It can move to an action body.
- No Semantifyr model or stdlib file uses a payload-less state send.

**Validator:** with the grammar fixed, a `validateSendActionUsagePayloadArgument` validator can only fire on programmatic ASTs. It is optional, in the defensive style of the 2026-01 batch. **Size:** 1–2 h with parse tests. **Status:** `understood`.

## V4. Send/accept parameter counts (2026-05, spec OCL only)

**Spec:**

- `validateSendActionParameters` (`inputParameters()->size() >= 3`) is gone; its rule id now carries V3's payload rule.
- `validateAcceptActionUsageParameters` went from `inputParameters()->size() >= 2` to `inputParameters()->notEmpty()`.

**Pilot implementation:** unchanged in range. There is no send parameter check. The accept check is `usg.inputParameters.empty`, which the grammar never produces, because `AcceptNodeDeclaration` requires a payload.

**Ours:**

- `validateSendActionParameters` checks payload, sender and receiver.
- `validateAcceptActionUsageParameters` checks payload and receiver.
- Both go through `checkParameters` (`sysml-validator.ts` line 1560), which tests `node[key]`. `SendActionUsageMeta` and `AcceptActionUsageMeta` return a default empty parameter when the slot is unset, so the test never fails. The `send to r;` probes above give no parameter error.

**Gap:** none observable. Ours is not stricter in practice. **Cleanup:**

- Retire `validateSendActionParameters`; it enforces a retired spec rule.
- Reduce the accept check to the payload (the spec's `notEmpty`), keeping it as a defensive check.

Under 30 min. **Status:** `understood`.

## V5. End-redefinition conformance narrowed (2026-07, KERML11-68)

**Pilot `2026-09.1`:** `KerMLValidator.checkRedefinition`:

```xtend
// validateRedefinitionEndConformance
if (redefinedFeature.isEnd && !redefiningFeature.isEnd) {
    val redefiningOwner = redefiningFeature.owningType
    if (redefiningOwner instanceof Association || redefiningOwner instanceof Connector) {
        error("Redefining feature must be an end feature", redef, redefinition_RedefinedFeature, ...)
    }
}
```

Before 2026-07 the owner condition was absent. The pilot's `Redefinition_End_Invalid` test, as a probe:

```kerml
package RedefinitionEnd {
    classifier A { end feature e; }
    classifier B :> A {
        feature :>> e;                 // 2026-03: error; 2026-07+: ok
    }
    assoc R { end a : A; end b : B; }
    abstract connector r : R { end a; end b; }
    abstract assoc R1 :> R {
        feature a1 :>> a;              // error
    }
    abstract connector r1 :> r {
        feature a1 :>> a;              // error
    }
}
```

**Ours:** no such validator. We have never had it. The probe gives no diagnostics. The narrowing removed one pilot error we were already missing; the Association/Connector errors remain.

**SysML reach:**

- Connection, interface, allocation and flow defs are Associations; their usages are Connectors.
- So `connection def C2 :> C1 { part x :>> a; }` or `connection c : C1 { attribute :>> a = …; }` (redefining an end with a non-end) is rejected by the pilot.

**Port:** a `@validateKerML(ast.Redefinition.$type)` check of about 15 lines. Before porting, decide whether our registry also visits implied redefinitions; the pilot's check effectively covers explicit ones (implicit end redefinitions are ends themselves). **Gap:** we accept what the pilot rejects. **Size:** ~1 h with tests. **Status:** `understood`.

## V6. Attribute features must be referential (2026-07, SYSML21-19)

**Pilot:** `checkAttributeDefinition` / `checkAttributeUsage` now run `checkAllNotComposite(ownedFeature, …)` (OCL `feature->forAll(not isComposite)`). In the same commit, usage post-processing makes every usage whose expected featuring type is an attribute def/usage non-composite. So the check cannot fire on parsed text (chunk 4 T2).

**Ours:** `sysml-validator.ts` lines 236–237 carry "blocked by KERML-4" TODOs. Our `UsageMeta.isComposite` does not yet exclude attribute owners (T2). With the stdlib loaded, `attribute def AD { part p; }` gives `p {composite}`. Enabling the validators before T2 would therefore reject models the pilot accepts.

**Port:** land T2, then add both checks as unreachable spec-traceability validators, as in the 2026-01 batch, or delete the TODOs. **Size:** under 30 min. **Status:** `structurally-clear`.

## V7. Multiplicity domain (2026-07, KERML11-3)

**Pilot:**

- `validateFeatureMultiplicityDomain` lost its owned-cross-feature special case. It now compares `f.featuringType` with `m.featuringType` (OCL `multiplicity.featuringType = featuringType`).
- The same commit moved the cross-feature featuring rule from the multiplicity (`MultiplicityAdapter`) to the multiplicity's bound expressions (`ExpressionAdapter`).
- Validator and derivation changed together, so the rule stays satisfied by construction.

**Ours:** `validateMultiplicityDomain` (`kerml-validator.ts` line 327, KerML only) never had the special case. Our multiplicities carry no featuring types unless written explicitly, so the check effectively never fires. Probe:

```kerml
package CrossMult {
    class X; class Y;
    class Owner { assoc A { end [0..1] feature a : X; end [1..*] feature b : Y; } }
    assoc B { end [0..1] feature a : X; end [1] feature b : Y; }
}
```

No diagnostics. We do not model expression featuring types, so the bound-expression half has no counterpart and no validator reads it. **Status:** `structurally-clear`, nothing to port.

## V8. Cross-subsetting anchor (2026-08, ST6RI-966)

**Pilot:** `validateFeatureOwnedCrossSubsetting` indexed `refSubsettings` by mistake, so with two cross subsettings and fewer reference subsettings it threw. It now reports every cross subsetting after the first. The pilot's new test case, as a probe:

```kerml
package AssociationTest_CrossFeatures_invalid {
    class C3 { feature x : C3; feature y : C3; }
    assoc A4 {
        end a : C3;
        end b : C3 crosses a.x crosses a.y;   // pilot: error at "a.y"
    }
}
```

**Ours:** errors at `a.x` **and** `a.y`. `this.apply` over all cross subsettings (`kerml-validator.ts` line 514) flags the first too. Both reject the model; only the anchor differs. The same pattern (apply to all) is in `validateFeatureOwnedReferenceSubsetting`, which the pilot also reports from the second. **Port:** skip the first element in both. **Status:** `understood`.

## V9. Refactors with no behavior change (2026-05, 2026-08)

- `checkLibraryPackage`: the path test moved to `SysMLLibraryUtil.isLibraryResource` (ST6RI-926), same logic. Ours (`checkStandardLibraryPackage`) uses `document.isStandard`. **Pre-existing:** ours is an error, the pilot's a warning (see inventory B).
- ST6RI-944: `c.connectorEnd`, `type.feature`, `type.input`, `featuringType.featureMembership` → `TypeUtil` equivalents in the binary-specialization, constructor/invocation, at-most-one and subject-parameter checks. The setting delegates already delegated to the same utilities, so this is a caching refactor.
- Message typo "package-lebel" → "package-level" in `validateUsageIsReferential`.

**Status:** `understood`.

## V10. Owned-member multiplicities (2026-09, ST6RI-975)

**Pilot:**

- Was: `ownedMembership.filter[memberElement instanceof Multiplicity]`, error on the membership.
- Now: `ownedMember.filter(Multiplicity)` (OCL `ownedMember->selectByKind(Multiplicity)->size() <= 1`), error on each multiplicity after the first.
- Aliases to multiplicities therefore no longer count.

**Ours:** `validateTypeOwnedMultiplicity` (`kerml-validator.ts` line 290, KerML only) filters `OwningMembership` children, so aliases never counted. The pilot's `MultiplicityAlias_valid` model, plus one invalid class, as a probe:

```kerml
package MultiplicityAlias_valid {
    private import ScalarValues::*;
    class T;
    class K { feature f : T { multiplicity m [1..2]; } }
    class C { alias m for K::f::m; }
    class E {
        multiplicity em [1..4];
        feature k : Integer { alias a for em; }
        feature v : Natural = em;
    }
    class M [0..1] { alias for Base::exactlyOne; }
    class M2 [0..1] { multiplicity extra [2]; }   // added
}
```

The pilot's part is clean here, as in the pilot. `M2::extra` is flagged, but as a **warning**; the pilot's `checkAtMostOne` gives an error, before and after the range. **Gap:** pre-existing severity only. **Port:** `"warning"` → `"error"`. **Status:** `understood`.

## V11. Connection and flow definition ends must be usages (2026-09, PR #805)

**Pilot `2026-09.1`:**

```xtend
@Check def checkConnectionDefinition(ConnectionDefinition cdef) {
    checkEndsAreUsages(cdef, "A connection definition end must be a usage.", "validateConnectionDefinitionEndsAreUsages_")
}
@Check def checkFlowDefinition(FlowDefinition cdef) {
    val ends = checkEndsAreUsages(cdef, "A flow definition end must be a usage.", "validateFlowDefinitionEndsAreUsages_")
    ...
}
protected def checkEndsAreUsages(Type type, String msg, String errorId) {
    val ends = TypeUtil.getAllEndFeaturesOf(type)              // owned + inherited, redefined ones removed
    val nonUsageEnds = ends.filter[end | !(end instanceof Usage)]
    val ownedNonUsageEnds = nonUsageEnds.filter[end | end.owner === type]
    if (!nonUsageEnds.isEmpty) {
        if (ownedNonUsageEnds.isEmpty()) error(msg, type, null, errorId)
        else for (end: ownedNonUsageEnds) error(msg, end, null, errorId)
    }
    return ends;
}
```

- The trailing `_` is the pilot's convention for rules not in the spec. Neither rule is in `SysML.uml`.
- The `ConnectionDefinition` check also covers interface and allocation defs.
- In SysML text an owned end is always a usage, so in practice the error lands on the def when it inherits a KerML end.

**Probe** (pilot's two Xpect models plus specializations of a KerML association):

```kerml
package EndsK { assoc A { end feature a; end feature b; } }
```

```sysml
package EndsAreUsages {
    abstract connection def B1 :> Links::BinaryLink;   // pilot: error on def
    abstract flow def B2 :> Links::BinaryLink;         // pilot: error on def
    part def X;
    connection def C2 :> Links::BinaryLink { end part s : X :>> source; end part t : X :>> target; }   // ok
}
package EndsAreUsages2 {
    private import EndsK::*;
    connection def D1 :> A;                                   // pilot: error on def
    connection def D2 :> A { end part p :>> a; end part q :>> b; }   // ok
    connection def D3 :> A { end part p :>> a; }              // pilot: error on def (b inherited)
    flow def G1 :> A;                                         // pilot: error on def
}
```

Ours reports nothing. Our `allEnds()` matches `getAllEndFeaturesOf` on every case (new stdlib):

```text
B1: Links::BinaryLink::source<Feature>, Links::BinaryLink::target<Feature>
C2: C2::s<PartUsage>, C2::t<PartUsage>
D1: EndsK::A::a<Feature>, EndsK::A::b<Feature>
D2: D2::p<PartUsage>, D2::q<PartUsage>
D3: D3::p<PartUsage>, EndsK::A::b<Feature>
G1: EndsK::A::a<Feature>, EndsK::A::b<Feature>
```

So the port is a filter over `allEnds()`.

**Stdlib ordering:** the rule must not land before the 2026-09 stdlib swap. Scanning every connection/flow def in the stdlib with the same filter:

- Pinned `2026-03` stdlib: `Flows::MessageAction` and `Flows::Message` have non-usage ends (`Transfers::Transfer::source/target`). Every user `flow def` without owned ends also inherits them, through our `Flows::Message` base supertype (chunk 4 T8).
- `2026-09` stdlib: 13 defs, 0 offenders. The SYSML21-681 `Flows.sysml` change (owned `end occurrence` usages) exists for exactly this rule.

**Gap:** we accept what the pilot rejects. **Size:** a shared helper of about 25 lines plus two decorators and tests; 1–2 h. **Status:** `understood`.

## V12. Flow definition end count (2026-09 messages; pre-existing shape)

**Pilot:** `validateFlowDefinitionConnectionEnds`. In range only the messages changed ("A flow definition can have at most two ends.", "A flow usage must be typed by flow definitions."). `getAllEndFeaturesOf` is the same derivation as the former `endFeature`. Rule:

- with more than 2 ends (inherited included) and at most 2 owned ends, the error is on the def;
- otherwise it is on every end from index 2.

**Ours:** `validateFlowEnd` (`sysml-validator.ts` line 541) checks owned ends only and flags all of them. The pilot's `FlowUsage_Invalid` model, as a probe:

```sysml
package FlowUsage_Invalid {
    part def A;
    abstract flow def F;
    abstract flow def G;
    abstract flow def H { end a; }
    flow def I :> H { end a; end b; end c; }   // pilot: error at "end c;" only
    flow def J :> I;                           // pilot: error on J
    part apart : A {
        part b; part c;
        message : F from b to c;
        message : F, G from b to c;
        message :A from b to c;                // pilot + ours: typing error
        message :apart from b to c;            // pilot + ours: typing error
    }
}
```

Ours (old and new stdlib alike):

- `validateFlowEnd` on `end a;`, `end b;` and `end c;`;
- an extra `validateAssociationBinarySpecialization` on `I`. That one comes from our `Flows::Message` base supertype (chunk 4 T8); the pilot gives `H` the non-binary `MessageAction`.
- Nothing on `J`.

**Gap:** pre-existing. We miss `J` (we accept what the pilot rejects) and over-report `a`/`b`. **Port:** about 30 min. Reuse V11's `allEnds()` and land with T8. **Status:** `understood`.

## V13, V14. No-op for us

- **V13** (2026-09): `checkStateSubactions(type)` → `checkStateSubactions(type, errorId)`. Same checks, same codes. Ours is `validateStateSubactionKind`. `understood`.
- **V14** (2026-09.1, ST6RI-984): `doCheckBindingConnector` resolves both related-feature proxies before the type-conformance warning. We have no proxies; our check skips unresolved features (chunk 3 S1). `understood`.

## G5. Non-abstract connector usages without related features (chunk 1 question)

**Pilot:** `KerMLValidator.checkConnector`:

```xtend
// validateConnectorRelatedFeatures
if (!c.isAbstract) {
    val relatedFeatures = c.getRelatedFeature
    if (relatedFeatures !== null && relatedFeatures.size < 2)
        error("Must have at least two related elements", c, relationship_RelatedElement, ...)
}
```

`relatedFeature` (`ConnectorUtil.getRelatedFeaturesOf`) maps every end, owned or inherited, to its owned or implied *reference subsetting* target, and drops ends without one.

- `interface i = i1;` has no owned ends. Its default supertype is the non-binary `Interfaces::interfaces` (the pilot counts *owned* ends for binary vs base), which has no ends.
- So `relatedFeature` is empty, and a **non-abstract `interface i = i1;` is an error in the pilot**. This is why the pilot's `InterfaceTest` writes `abstract interface i = i1;`.
- The same reading gives an error for `connection c2 = c1;` and for `connection c3 : C1;`. Inherited `C1` ends have no reference subsetting.
- The pilot's example models contain no non-abstract connector usage without `connect` or `::>` ends. That supports this reading but does not prove it.

**Ours:** `validateRelatedTypes` (`kerml-validator.ts` line 838) counts `allEnds()`, not related features. Probe:

```sysml
package Relationship_invalid_relatedElement {
    part def X;
    connection def C1 { end part a : X; end part b : X; }
    part v {
        part b0;
        part b1;
        connection { end ::> b0; }            // pilot + ours: error
        abstract connection { end ::> b0; }   // ok
        connection c1 : C1 connect b0 to b1;
        connection c2 = c1;                   // pilot (by code): error; ours: ok
        connection c3 : C1;                   // pilot (by code): error; ours: ok
        abstract connection c4 = c1;
    }
}
```

`c2` and `c3` pass here because they inherit two ends. A second deviation adds to that: our `ConnectionUsageMeta` picks `Connections::binaryConnections` from the *total* end count, while the pilot's `ConnectionUsageAdapter.getDefaultSupertype` counts owned ends:

```text
c2 : ConnectionUsage {ref}  implied Subsetting -> v::c1, Connections::binaryConnections
c3 : ConnectionUsage {ref}  FeatureTyping -> C1, implied Subsetting -> Connections::binaryConnections
```

The pilot gives both `Connections::connections`. This is a typing item for chunk 4.

After the G5 grammar port, `interface i = i1;` would behave like `c2`: accepted here, rejected by the pilot.

**Gap:** we accept what the pilot rejects. Pre-existing, out of range. **Port:** count ends whose first reference subsetting resolves (owned, or implied once modeled). Run the full suite and the Semantifyr models, since user models with `connection c : C;` would start failing. **Status:** `needs-deeper-trace`: the pilot was not run to confirm `c3`.

## TV. Validators reading `isVariable` (chunk 4 T9)

Chunk 4 named four older pilot validators that read the derivation. All are pre-existing, since KERML_-57 (2025-03). None has a counterpart here.

| Pilot rule | Message | Fires on (pilot, by code) | Needs T9? |
| --- | --- | --- | --- |
| `validateFeatureConstantIsVariable` (`checkFeature`) | "Only a variable feature can be constant" | SysML `constant` usage at package level or in an attribute def. KerML: never, since `const` sets `isVariable`. | yes |
| `validateFeatureValueIsInitial` (`checkFeatureValue`) | "Initialized feature must be variable" | `:=` on a package-level usage or an attribute-def member; **KerML `feature x := 1;` without `var`** | SysML half |
| `validateSubsettingConstantConformance` (`checkSubsetting`) | "Subsetting/redefining feature must be constant if subsetted/redefined feature is constant" | non-constant variable feature subsetting a constant one, e.g. `attribute s :> k` with `constant attribute k` in a part def | SysML half |
| `effectiveFeaturingTypes` (`validateRedefinitionFeaturingTypes`, `validateRedefinitionDirectionConformance`) | — | substitutes the owning type for the synthetic `<Owner>_snapshots` featuring type of variable features | **no gap** (see below) |

Two more pilot checks read `isVariable`:

- `validateFeatureIsVariable` ("Must be owned by an occurrence type");
- `validatePortionNotVariable` ("A portion cannot be variable").

They cannot fire on usages, because `mayTimeVary` already requires an Occurrence owner and excludes portions. They fire on KerML `var`/`const` features in non-occurrence types and on `portion var`.

Probes (pinned stdlib; ours reports nothing on any line):

```sysml
package Variable {
    private import ScalarValues::Integer;
    constant attribute k0 : Integer = 0;        // pilot: ConstantIsVariable
    attribute g0 : Integer := 0;                // pilot: FeatureValueIsInitial
    attribute def D {
        constant attribute k1 : Integer = 1;    // pilot: ConstantIsVariable
        attribute x1 : Integer := 1;            // pilot: FeatureValueIsInitial
    }
    part def P {
        constant attribute k2 : Integer = 2;
        attribute x2 : Integer := 2;
        attribute s2 : Integer :> k2;           // pilot: SubsettingConstantConformance
        part q { attribute :>> k2; }            // pilot: SubsettingConstantConformance
    }
}
```

```kerml
package VariableK {
    var feature v0;                                         // pilot: FeatureIsVariable
    datatype D { var feature v1; const feature c1; }        // pilot: FeatureIsVariable (both)
    class C { var feature v2; const feature c2; portion var feature pv; }   // pilot: PortionNotVariable on pv
    struct S { const feature c3; feature f3 subsets c3; var feature f4 subsets c3; }   // pilot: SubsettingConstantConformance on f4
    class K { feature x := 1; }                             // pilot: FeatureValueIsInitial
}
```

**`effectiveFeaturingTypes` is not a gap.** The pilot gives each variable feature a synthetic featuring type, an `<Owner>_snapshots` feature redefining `Occurrence::snapshots` (`FeatureAdapter.computeFeaturingType`). `effectiveFeaturingTypes` maps that back to the owning type for the redefinition checks. Our `FeatureMeta.featuredBy` is already the owning type when no explicit featuring exists. We do not model snapshot featuring, so we already behave as if `effectiveFeaturingTypes` were applied. T9 must keep `featuredBy` untouched when it makes `UsageMeta.isVariable` derived.

`validateRedefinitionDirectionConformance` itself is missing (see inventory A), and our `validateRedefinitionFeaturingTypes` uses a subset test where the pilot uses set equality (inventory B).

**KerML derivation to mirror:** the pilot's `FeatureParserPostProcessor.setIsVariableIfConstant` makes `const` imply `var`. Ours keeps the two flags independent (`ast-to-model.ts` line 140).

**Size:** about 2–3 h for the five validators with tests, once T9 exists. The KerML half could land without T9. **Status:** `structurally-clear` from code. Scope is `consult-Armin` (chunk 4 open question 2). These reject user-visible patterns: `constant` at package level, `:=` in attribute defs, and plain KerML `feature x := 1;`.

---

## Pre-existing gap inventory (pilot `2026-09.1` vs ours, out of range)

Not analysed deeply. One line each so the plan can choose a scope.

### A. Missing here, reachable from ordinary text (pilot rejects, we accept)

All are errors in the pilot. The "probe" marks mean our build accepted the snippet.

1. `validateFeatureConstantIsVariable` (TV). Probe.
2. `validateFeatureValueIsInitial` (TV). Probe.
3. `validateSubsettingConstantConformance` (TV). Probe.
4. `validateFeatureIsVariable`: a `var`/`const` KerML feature whose owner does not specialize `Occurrence`. Probe.
5. `validateFeaturePortionNotVariable`: `portion var`. Probe.
6. `validateRedefinitionDirectionConformance`: redefinition must keep an `in`/`out` direction, and give `inout` some direction. It is commented out in `kerml-validator.ts` (lines 545–569, "broken until linking …"). Probe: `action def A { in x; } action def B :> A { out :>> x; }`.
7. `validateAssociationEndTypes`: an association end must have exactly one type. Probe: `assoc A2 { end a : X, Y; end b : X; }`.
8. `validateAttributeUsageEnumerationType_`: an enumeration-typed attribute cannot have a second type. Probe: `attribute ce : Color, Extra;`.
9. `validateUsageType_`: non-attribute, non-occurrence usages must be typed by classifiers. Probe: `part pp; ref r : pp;`.
10. `validateInvocationExpressionInstantiatedType`: an invocation must invoke a behavior, or a feature typed by one. Probe: `attribute inv1 = P();` with `P` a part def.
11. `validateTransitionUsageTriggerActions`: a transition with an `accept` trigger must have a state as its source. Probe: `transition t first a1 accept Sig then s2;` with `a1` an action in a state def.

### B. Present here, with a different shape (pre-existing)

- `validateConnectorRelatedFeatures`: we count ends; the pilot counts related features (G5). We accept what the pilot rejects.
- `validateConnectorBinarySpecialization` / `validateAssociationBinarySpecialization`: we count owned ends and flag the type. The pilot counts all ends, flags the type when at most 2 are owned, and otherwise flags ends from index 2. Already noted in the 2026-03 cycle.
- `validateFlowDefinitionConnectionEnds` (V12).
- `validateRedefinitionFeaturingTypes`: our condition is "redefining featuring types ⊆ redefined ones". The pilot's is set equality. With featuring types `{A}` vs `{A, B}` we reject and the pilot accepts. Edge case.
- `validateTypeOwnedMultiplicity`: warning here, error in the pilot (V10).
- `validateFeatureOwnedCrossSubsetting` / `validateFeatureOwnedReferenceSubsetting`: we also flag the first (V8). Anchor only.
- `validateLibraryPackageNotStandard`: **error here, warning in the pilot**, so we are stricter. Undocumented.
- `validateItemUsageTyping` / `validatePartUsageTyping`: the pilot has `checkItemUsage`/`checkPartUsage` commented out and only requires Class types for occurrence usages. So `part p2 : O;` / `item i1 : O;` with `O` an `occurrence def` are errors here and accepted by the pilot. **Stricter, undocumented.**
- `validateUsageIsReferential`: our predicate (`isReference && isComposite`, 2026-01 batch) is not the spec's (`direction <> null or isEnd or featuringType->isEmpty() implies isReference`). Both are unreachable after compositeness defaults, so there is no observable difference.
- `validateFeatureTyping`: `docs/known_limitations.md` calls it "not in the spec, stricter than the pilot". The pilot has the same non-spec rule as `validateFeatureHasType_` ("Features must have at least one type", over all types including implicit ones). The entry's framing is inaccurate.

### C. Missing here, but not reachable from text in the pilot either

- **Declared but never raised by the pilot:**
  - `validateFeatureEndIsConstant`, `validateSubsettingPortionConformance`, `validateAssociationStructureIntersection`, `validateDefinitionVariationIsAbstract`, `validateOccurrenceUsageIsPortion`;
  - `validateAssignmentActionUsageArguments`, `validateUseCaseUsageReference`, `validateFunctionResultExpressionMembership`;
  - the 8 control-node succession rules (our TODOs say "not in pilot", which is accurate);
  - `validateBindingConnectorArgumentTypeConformance` (commented out).
- **Implemented by the pilot but ensured by its grammar or post-processing:**
  - `validateUsageVariationIsAbstract`, `validateClassifierDefaultSupertype_`, `validateAnnotationAnnotatingElement`, `validateAnnotationAnnotatedElementOwnership`, `validateMultiplicityRangeBounds`, `validateExposeIsImportAll`;
  - `validateFramedConcernMembershipConstraintKind`, `validateRequirementVerificationMembershipKind`, `validateConjugatedPortDefinitionConjugatedPortDefinition`;
  - the for/if/while parameter rules, `validateFeatureReferenceExpressionResult`, `validateInstantiationExpressionResult`;
  - `validateFeatureEndNoDirection`, `validateFeatureEndNotDerivedAbstractCompositeOrPortion`: the `end` prefix excludes those modifiers in both grammars.
  - Several of these carry "implicitly ensured" comments in our validators.
- **Partially covered:**
  - The constructor-expression rules (`validateConstructorExpressionNoDuplicateFeatureRedefinition`, `checkConstructorExpressionResultFeatureRedefinition`): `new P(x = 1, x = 2)` is caught by our `validateInvocationExpressionNoDuplicateParameterRedefinition`. An unknown name fails to link.
  - `validateInstantiationExpressionInstantiatedType`: an unresolved type gives a linking error.
  - `validateInvocationExpressionOwnedFeatures` / `validateConstructorExpressionOwnedFeatures` (owned features must be `in` parameters): not probed.

**Size:** 11 reachable gaps (A), 10 shape differences (B, 3 of them stricter on our side: library package, part/item occurrence typing, redefinition featuring types), about 40 unreachable or partially covered (C). A1–A5 share chunk 4's T9 and the KerML `const ⇒ var` rule. A6–A11 are independent, each well under an hour.

---

## Open questions

1. **TV scope** (`consult-Armin`, also chunk 4 Q2): with `mayTimeVary` in place, port only V1, or also the five `isVariable` readers (A1–A5)? They are pre-existing pilot rejections of common-looking text: package-level `constant`, `:=` in attribute defs, plain KerML `feature x := 1;`. The KerML half needs no T9.
2. **V3 send grammar** (`consult-Armin` on timing only; the direction is clear): fix `SendNodeDeclaration` in this cycle's grammar phase, with chunk 1 X1? It is pre-existing, but the pilot rejects `entry send to r;` at parse time and accepts `send via r;`. A defensive payload validator afterwards is optional.
3. **V11 ordering** (`structurally-clear`): land the ends-are-usages rules in or after the stdlib-swap phase, ideally with chunk 4 T8 (`Flows::MessageAction` base). With the pinned 2026-03 library, both our stdlib and every end-less `flow def` would fail.
4. **G5 related features** (`consult-Armin`): align `validateConnectorRelatedFeatures` with the pilot's related-feature count? That makes non-abstract `connection c : C;` / `interface i = i1;` errors, which may surprise users. It pairs with chunk 4's owned-vs-total end count for binary classification.
5. **Undocumented stricter checks** (`consult-Armin`): document the part/item occurrence-typing errors and the library-package error in `docs/known_limitations.md`, or align them with the pilot? Also correct the `validateFeatureTyping` entry, since the pilot has the same rule.
6. **Inventory A6–A11** (`structurally-clear`): include the six independent missing validators in this cycle's validation phase (each small, all pilot-rejects), or defer?
