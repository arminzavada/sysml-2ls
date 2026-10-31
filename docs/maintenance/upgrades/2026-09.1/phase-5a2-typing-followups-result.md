# Phase 5a2 — Typing follow-ups result

The two open typing items from [`phase-5a-typing-backlog-result.md`](phase-5a-typing-backlog-result.md). Uncommitted on `main`.

## Verification

- `pnpm typecheck` (plus `tsc -b --force` in `syside-languageserver`), `pnpm lint`: clean.
- `pnpm test`: 88 files, 2405 passed, 7 expected fail, 7 skipped (baseline 88 / 2391). 19 tests added; the 5 factory tests for the removed classifier flags are gone.
- No snapshot changes. The stdlib-diagnostics snapshot stays `{}` and the four OXSTS snapshots are unchanged.
- Release models under `sysml/src` and `kerml/src`: the same diagnostics, and every reference resolves to the same target, before and after (a scratch dump of all reference targets).
- Pilot oracle (`sysml.library.xmi.implied`), same method as Phase 5a: for usages and definitions the non-redundant implied supertypes are unchanged. Including KerML features, 13 stdlib elements differ (see item 2).

## Items

### Portion usages are no longer typed by their owner

- History: the pilot removed `addOccurrenceTyping` (and `addOccurrenceFeaturing`) in SYSML2_-158 (March 2025, first in tag `2025-02`), not in 2023 as `plan.md` says.
- `services/shared/workspace/metamodel-builder.ts`: `addImplicitOccurrenceUsageTyping` removed. `snapshot`/`timeslice` usages no longer get a typing by their owning occurrence def, or a subsetting of their owning occurrence usage.
- The Phase 5a knock-on is gone. `timeslice part t;` in a part def loses `Objects::objects`, and `snapshot s;` there gets `suboccurrences` instead of `subobjects`, as in the pilot.
- `individual snapshot s;` with no typing of its own, in an individual def, now reports `validateOccurrenceUsageIndividualUsage`. The pilot reports the same: its `occurrenceDefinition` is `FeatureUtil.getAllTypesOf`, which does not include the owner.

Name resolution:

- Pilot scoping (`KerMLScope.gen`) walks owned specializations, implicit general types and the last chaining feature. Nothing in the pilot adds owner members to a portion: `addAdditionalMembers` has no portion case. So a portion inherits only from its library supertypes (`snapshots`, `timeSlices`, `suboccurrences`, ...).
- Redefinitions: the pilot and we both search the owning type's inherited members first, then the enclosing scopes. `part def P { attribute a; snapshot s { attribute :>> a; } }` still redefines `P::a`. The same holds for `:>> mass` and `:>> leftFrontWheel` in the release individual/snapshot examples and the pilot's `IndividualUsage_Valid` xpect test.
- Chains to owner members through a portion no longer resolve, for example `p.s.q` or `o.ot.oa` where `q` and `oa` are features of the owner's type. The pilot does not resolve these either. This comes from reading the pilot code; the pilot was not run.

Tests:

- `__tests__/integration/stdlib-typing.test.ts`, "portion usages": implied supertypes, the redefinition still resolving to the owner's feature, and the unresolved `o.ot.oa`.
- `__tests__/integration/stdlib-validation.test.ts`: `IndividualUsage_Valid` (the pilot's xpect model, no errors) and `IndividualPortion`.

### Default supertypes by owned typings

- `model/KerML/feature.ts`: `hasStructureType`, `hasClassType` and `hasDataType` read the feature's own typings, including implied ones, as `FeatureAdapter` does. Before, they read flags collected from all inherited types at build time. This changes:
  - `FeatureMeta.defaultSupertype`, used by KerML features, reference usages, attribute usages, plain `#keyword` usages and flow ends;
  - the owner checks of `isStructureOwnedComposite`, `isSubobject` and `isSuboccurrence` for KerML features (Phase 5a already did usages);
  - **beyond the brief:** `ConnectorMeta.defaultSupertype`, because `ConnectorAdapter` uses the same check.
- `defaultSupertype` now uses `isPortionImpl()`, the pilot's `isPortion()` (a portion owned by a class or a class-typed feature), instead of the bare flag. `isPortionImpl` had no callers before.
- `isStructureOwnedComposite` holds the owner check and `isSubobject` delegates to it, as `UsageMeta` did, so the item override of `isSubobject` does not leak into it.
- `model/SysML/usage.ts`: the Phase 5a overrides and `hasOwnedTyping` are removed, since `FeatureMeta` now does the same. `occurrence-usage.ts` calls `hasDataType`/`hasStructureType`.
- Removed with their last reader:
  - the `collectFeatureClassifiers` builder;
  - `FeatureMeta.hasAssociation` (no callers);
  - `TypeMeta.classifier` and `classifierString`, and `_classifier` on the class, data type, structure, association and association structure metas;
  - `TypeClassifier` and `getTypeClassifierString` (`model/enums.ts`), `stringifyFlags` (`utils/common.ts`);
  - the classifier-flag cases in `model/KerML/__tests__/factories.test.ts`.

Typical changes:

- `ref r :> somePart;` gets `Base::things` (was `Objects::objects`), and `ref r :> someAttribute;` gets `Base::things` (was `Base::dataValues`).
- `#kw u;` with a feature base type gets `Base::things`.
- `attribute a :> somePart;` (invalid) gets `Base::dataValues` (was `Objects::objects`).
- KerML:
  - `composite feature f :> s;` in a struct, with `s : S`, gets `Base::things` (was `subobjects`);
  - a composite class-typed feature inside a feature that only subsets a struct-typed feature gets `occurrences` (was `suboccurrences`);
  - a class-typed portion whose owner has no class typing gets `occurrences` (was `portions`).
- `connector k2 subsets k1 from a to b;`, with `k1` typed by an association structure, gets `Links::binaryLinks` (was `Objects::binaryLinkObjects`).
- Feature-chain features (the targets of `a.b`) get `Base::things`.

Oracle:

- About 5700 implied supertypes change across the stdlib and the release models. In the stdlib, all changes on usages and definitions are redundant.
- The 13 KerML features that differ:
  - 2 now match the pilot: the owned feature of `Occurrences::Occurrence::portions`, and the one of `StatePerformances::StateTransitionPerformance::trigger`.
  - 7 feature-chain-expression source features swap one extra supertype for another. The pilot has `ControlFunctions::'.'::source`, which we lack (pre-existing).
  - 4 constructor-expression result features now get `Base::things`, where the pilot has `Base::dataValues`. We do not type constructor results by the instantiated type (`ConstructorExpressionAdapter.addResultTyping`). Before, the inherited-type check happened to agree with the pilot.

Tests:

- `stdlib-typing.test.ts`, "default supertypes by owned typings": SysML reference, attribute and plain keyword usages, KerML features, owner checks, a portion, and connectors.

## Deferred and uncertain

- Constructor result typing (`checkConstructorExpressionResultSpecialization`) is missing. It is the cause of the 4 oracle regressions above. Candidate for a follow-up.
- Flow ends: the pilot's `FlowEndAdapter` adds no default supertype at all. We add one (now `Base::things`, before `occurrences`/`objects`). Not changed.
- KerML `portion feature` is composite here (`utils/ast-to-model.ts`) but not in the pilot, whose grammar sets only `isPortion`. So a class-typed portion in a class gets `suboccurrences` here and `portions` in the pilot. Not changed; I am not sure whether the spec means portions to be composite.
- The pilot quirk in `FeatureAdapter.hasClassType(owner)` is still not copied, as in Phase 5a.
- `flagNames` (`utils/common.ts`) is now used only by a test.
