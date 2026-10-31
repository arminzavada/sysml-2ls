# Phase 4 — Validation result

Validation items V1, V5, V6, V8, V10, V11, V12, inventory A1–A5 and ST6RI-856 from [`plan.md`](plan.md). Uncommitted on `main`.

## Verification

- `pnpm typecheck` (plus `tsc -b --force` in `syside-languageserver`), `pnpm lint`: clean.
- `pnpm test`: 88 files, 2335 passed, 7 expected fail, 7 skipped (baseline 87 / 2290). Three tests rewritten for the new anchors and code; 45 net added.
- No snapshot changes. The stdlib-diagnostics snapshot stays `{}`. The Semantifyr models validate clean. The four OXSTS snapshots are unchanged.
- Three full runs. The only failures were the three rewritten tests, in the first run before the rewrite. The transient expressions-printer and `execute-command-handler.test.ts` failures did not recur.
- Every chunk 6 probe now reports what the pilot reports: the same codes, anchors and severities. The pilot's Xpect models for these rules give the same errors (see Tests).
- None of the new rules fires on the 310 release models under `sysml/src` and `kerml/src` (examples, training, validation).

Tests:

- New `__tests__/integration/stdlib-validation.test.ts` builds each probe against the pinned stdlib. For each probe it compares every coded error diagnostic, by code and anchor text, with the pilot's result.
  - Probes: the chunk 6 probes (`AssignmentActionUsage_invalid`, `Assign`, `RedefinitionEnd`, `AssociationTest_CrossFeatures_invalid` A4, `MultiplicityAlias_valid`, `EndsAreUsages`, `FlowUsage_Invalid`, `Variable`, `VariableK`).
  - Pilot Xpect models: `Feature_variable_invalid`, `ReferenceSubsetting_Invalid`, `Type_Multiplicity_invalid`, `Subsetting_constant_invalid`.
  - It also covers ST6RI-856 (see A3).
- `services/validation/__tests__/kerml-validator.test.ts` and `sysml-validator.test.ts` have positive and negative cases for each rule that needs no stdlib. Rules that cannot fire on parsed text (V6, A1 in KerML, owned non-usage ends for V11) are tested on models built in code.

## Items

### V1 — `validateAssignmentActionUsageReferentIsTimeVarying`

- `sysml-validator.ts`: error "Referent must be time varying." when the referent's `featureTarget.isVariable` is false. For usages, `isVariable` is Phase 3's `mayTimeVary`.
- Anchor: the last chaining feature (`d` in `i.d`), otherwise the referent membership. This matches the pilot, whose grammar splits `i.d` into the target `i` and the referent `d`.
- Referents whose chain does not fully resolve are skipped. The pilot's Xpect test reports only the linking error there.

### V5 — `validateRedefinitionEndConformance`

- `kerml-validator.ts`: error "Redefining feature must be an end feature" when an end is redefined by a non-end whose owning type is an `Association` or `Connector` (KERML11-68). In SysML this covers connection, interface, allocation and flow defs and their usages.
- Implied redefinitions are visited too. The pilot's `KerMLResourceValidator` transforms all elements before validating, so it appears to validate implied relationships as well; not confirmed by running it. No implied redefinition fires on the stdlib or the release models.

### V6 — `validateAttributeDefinitionFeatures` / `validateAttributeUsageFeatures`

- `sysml-validator.ts`: error on composite owned features, with the pilot's messages. The "blocked by KERML-4" TODOs are removed.
- After T2, parsed text cannot trigger them, in the pilot or here.

### V8 — owned cross/reference subsetting anchors

- `kerml-validator.ts`: both rules now flag every subsetting after the first, as the pilot does.
- **Beyond the brief:** `validateFeatureOwnedReferenceSubsetting` was a warning; the pilot gives an error (`ReferenceSubsetting_Invalid`). It is now an error. Chunk 6 missed this severity difference.

### V10 — `validateTypeOwnedMultiplicity`

- Severity warning → error. Aliases never counted here, and a test now covers that.

### V11 — `validateConnectionDefinitionEndsAreUsages_` / `validateFlowDefinitionEndsAreUsages_`

- `sysml-validator.ts` `validateDefinitionEndsAreUsages`: ports the pilot's `checkEndsAreUsages` on `allEnds()`. Errors go on the owned non-usage ends, or on the definition when all of them are inherited.
- The connection rule also covers interface and allocation defs. 0 stdlib offenders on the 2026-09 library.

### V12 — `validateFlowDefinitionConnectionEnds`

- Replaces `validateFlowEnd` (code and message renamed to the pilot's).
- It counts `allEnds()`. With more than 2 ends and at most 2 owned ones, the error is on the definition. Otherwise it is on each end from index 2.
- `FlowUsage_Invalid` now reports `end c;` and `J` only, as the pilot does.

### A1 `validateFeatureConstantIsVariable`, A4 `validateFeatureIsVariable`, A5 `validateFeaturePortionNotVariable`

- `kerml-validator.ts`, on every feature, with the pilot's messages.
- A1 fires on SysML `constant` usages that cannot vary, for example at package level or in attribute defs. It never fires in KerML, because `const ⇒ var`.
- A4 and A5 can only fire on KerML features. Usages vary only when owned by an occurrence, and never when they are portions.

### A2 `validateFeatureValueIsInitial`

- `kerml-validator.ts`: `:=` on a feature that is not variable, for example a package-level usage, an attribute-def member, or KerML `feature x := 1;` without `var`.

### A3 `validateSubsettingConstantConformance` and ST6RI-856

- `kerml-validator.ts`: error on any subsetting (redefinitions and reference/cross subsettings included, implied ones too) where a variable, non-constant feature subsets a constant one.
- ST6RI-856:
  - `UsageMeta.isConstant` is derived: explicit `constant`, or an end that may vary (pilot `UsageAdapter.doTransform`).
  - `FeatureMeta.isConstant` became an accessor. The new `UsageMeta.isConstantExplicitly` feeds the SysML printer (`usageBasicModifiers`), so a derived `constant` is never printed.
  - `ast-to-model.ts` sets KerML `const ⇒ var` from the AST flag instead of reading the getter.
- ST6RI-856 is required. Without it, A3 flags `CausationConnections::Causation` (`theCause :> causes`, `theEffect :> effects`) in the stdlib. A test run with the derivation removed confirmed this.
- Visible effects:
  - A non-end feature that subsets an end of a connection def (`part s :> a;` in a connection def or usage typed by it) is now an error, as in the pilot.
  - Time-varying end usages carry the `readonly` semantic-token modifier, like the derived `abstract` on messages in Phase 3.

## Deferred and uncertain

- **T3 interplay (Phase 5):** owned flow usages are still referential here and composite in the pilot. So `constant flow f …` (A1) and an assignment to a flow usage (V1) pass here, where the pilot rejects them.
- **Positional `allEnds()`:** V11 and V12 count ends by position, while the pilot drops ends that are redefined. The two agree on all probes. They can differ when one owned end redefines several inherited ends.
- **Implied relationships:** A3 and V5 visit implied subsettings and redefinitions, assuming the pilot does too (see V5). Our implied relationships are not identical to the pilot's. No difference shows on the stdlib or the release models.
- **Found, not changed (pre-existing, stricter than the pilot):** in the pilot's full `AssociationTest_CrossFeatures_invalid` model, `end y : C2 crosses x.a;` (in `A2`) also gets `validateFeatureCrossFeatureType`, which the pilot does not report. `checkFeatureCrossingSpecialization` in `A3` is anchored on `y.b`, where the pilot anchors on `x1 [0..1]`.
