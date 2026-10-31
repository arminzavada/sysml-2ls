# Phase 5a — Typing backlog result

Typing backlog from [`plan.md`](plan.md): T3, occurrence-usage supertypes, association default supertype, variant owner checks. Uncommitted on `main`.

## Verification

- `pnpm typecheck` (plus `tsc -b --force` in `syside-languageserver`), `pnpm lint`: clean.
- `pnpm test`: 88 files, 2391 passed, 7 expected fail, 7 skipped (baseline 88 / 2335). 56 tests added, none removed or rewritten.
  - The last full run was fully green before the final probe case was added.
  - Two later full runs, on a machine at load 25–45 from other jobs, failed only on test and setup-hook timeouts, with no assertion failures. Every file that timed out passes when run alone.
- No snapshot changes. The stdlib-diagnostics snapshot stays `{}`. The four OXSTS snapshots are unchanged; the Semantifyr mapper reads `allTypings()`, which drops redundant general types, so the added supertypes cannot change what it picks.
- The 310 release models under `sysml/src` and `kerml/src` report exactly the same diagnostics before and after (compared against a reconstructed Phase 4 tree).
- Pilot oracle: the release ships `sysml.library.xmi.implied`, the pilot's own serialization of the stdlib with implied relationships. A scratch script matched 8312 stdlib usages and definitions by path:
  - `isComposite`: 0 mismatches, including the 27 library connection usages that became composite here.
  - No pilot implied supertype is missing on the usage kinds this phase touched. The remaining differences are pre-existing: implicit redefinitions of expression parameters and connector ends, and implied supertypes we keep although an explicit supertype makes them redundant.

Tests:

- `__tests__/integration/stdlib-typing.test.ts`: new blocks for connection and flow compositeness, occurrence usages, default supertypes by owned ends, and variants.
- `__tests__/integration/stdlib-validation.test.ts`: new `FlowConstant` and `PortDefinitionConnections` probes (see T3).
- `model/printer/__tests__/connectors.test.ts`: `ref` on connection and flow usages.

## Items

### T3 — connection, interface, allocation and flow compositeness

- `model/SysML/connector-as-usage.ts`, `connection-usage.ts`: the forced `isComposite = false` overrides are gone, so these usages follow `UsageMeta.isComposite`.
- `binding-connector-as-usage.ts`, `succession-as-usage.ts`: now carry the non-composite override themselves, matching the pilot's `NON_COMPOSITE_USAGE_TYPES`.
- Supertypes that follow, per the pilot adapters:
  - `ConnectionUsageAdapter`: `Items::Item::subparts` when owned by an item def/usage. The `object` key maps to `Objects::objects`: the pilot resolves it through `FeatureImpl`, while our type index resolved it through `Connector` (`linkObjects`).
  - `FlowUsageAdapter` (not an `OccurrenceUsageAdapter`): `suboccurrences`, portion kind, `subactions`/`ownedActions`, `ownedPerformances`/`subperformances`/`enclosedPerformances`. `flow-usage.ts` now builds exactly that list instead of relying on the mixin chain.
- Phase 4 follow-up confirmed: an owned flow is a composite `Action`, so it is not time-varying. `constant flow …` and `constant message …` report `validateFeatureConstantIsVariable`, and `assign f := …` reports `validateAssignmentActionUsageReferentIsTimeVarying`, as in the pilot. A `constant connection` stays valid.
- Consequence, matching the pilot's `checkPortDefinition`/`checkPortUsage`: a non-`ref` connection or flow owned by a port def or port usage now reports `validatePortDefinitionOwnedUsagesNotComposite` / `validatePortUsageNestedUsagesNotComposite` (new `PortDefinitionConnections` probe).
- Printer (`model/printer/connectors.ts`): `ref` on a connection or flow usage with a featuring type now decides compositeness. It is kept even when the `connection_usage_reference_keyword` / `connector_as_usage_reference_keyword` options say `never`, like the existing port-usage rule. Elsewhere the options still apply.

### Occurrence usages: `object` / `subobject` / `dataValue`

- `model/SysML/occurrence-usage.ts` ports `OccurrenceUsageAdapter.addDefaultGeneralType`:
  - `dataValue` when typed by a data type;
  - `subobject`/`object` when typed by a structure, otherwise `suboccurrence`;
  - then the portion kind.
- `isSuboccurrence` adds the pilot's clause for composite usages owned by an occurrence usage.
- `model/SysML/usage.ts`: `isStructureOwnedComposite`, `isSubobject`, `isSuboccurrence` and `isBehaviorOwned` follow `FeatureAdapter`/`FeatureUtil.isPerformanceFeature`. They read `owningType`, and a feature owner's owned (and implied) typings, not its inherited types. `hasOwnedTyping` replaces the port-local helper.
- `item-usage.ts`: `isSubobject` excludes subitems (`ItemUsageAdapter`).
- `port-usage.ts`: now only adds the `PortUsageAdapter` extra (`subobject` when structure-owned composite) on top of the shared logic. Port results are unchanged.
- `rendering-usage.ts`, `view-usage.ts`: `Items::Item::subparts` when owned by an item def/usage (`RenderingUsageAdapter`, `ViewUsageAdapter`).
- `action-usage.ts`: adds the missing `subperformances` branch of `ActionUsageAdapter` for composite behavior-owned actions (was `enclosedPerformances`), and drops the unused, misspelled `subPerformance` key.
- `services/shared/workspace/metamodel-builder.ts`: `getImplicitSpecializations` skips a general type already added with the same specialization kind, as the pilot's `addImplicitGeneralType` does. This also removes the doubled `timeEnclosedOccurrences` on event occurrences.

Typical changes:

- Typed parts, items, metadata usages and occurrences typed by a structure gain `Objects::objects` or `Objects::Object::subobjects`.
- A part typed by a structure inside an occurrence def or an action def is `objects`, no longer `suboccurrences`.
- An untyped occurrence or action inside an occurrence usage gains `suboccurrences`.
- Owners that only subset or redefine a structure-typed feature no longer count as structure-typed. For example, an assert constraint in `part v :> vehicle { … }` loses `ownedPerformances`.

We do not prune redundant implied supertypes (the pilot's `removeUnnecessaryImplicitGeneralTypes`), so most of these additions are redundant there. That matches how ports were already handled.

### Association default supertype by owned ends

- `model/KerML/association.ts` (associations, association structures, connection/interface/allocation defs): `binary` only with exactly two owned ends (`AssociationAdapter`, `ConnectionDefinitionAdapter`).
- **Beyond the brief:** the same rule applied to connectors (`connector.ts`, `ConnectorAdapter`) and connection usages (`ConnectionUsageAdapter`). For example, `connector k : As1;` and `connection c : C;` without owned ends now get `links`/`connections` instead of the binary features.
- `ConnectorMixin.isBinary()`/`totalEnds()` lost their last callers and are removed.

### Variants owned by a variation

Now read `owningType` like the pilot, so variants no longer get owner-dependent supertypes:

- `UsageMeta.isBehaviorOwned` and the assert-constraint override (`enclosedPerformances`, `subperformances`);
- `isPerformedAction`;
- the event-occurrence `isSuboccurrence`;
- `isSubrendering`, `isSubview`, `isSatisfiedViewpoint`.

`state-usage.ts`: `isExclusiveState`/`isSubstate` are replaced by the pilot's `isSubstateUsage(isParallel)`. It requires a composite state with an owning state of the given parallelism, outside a `StateSubactionMembership`. Beyond variants, this means `ref state` and state subactions are no longer exclusive states. In the stdlib, `States::StateAction::self/start/done` lose `exclusiveStates`; the oracle agrees.

Left as is:

- The part actor/stakeholder checks already require an actor/stakeholder membership, so they are equivalent.
- `IncludeUseCaseUsageMeta.hasRelevantSubjectParameter` has no callers.
- Implicit featuring types of variants (`featuredBy`) stay out of scope, as in Phase 3.

## Deferred and uncertain

- **Implied typing of portion usages (pre-existing):** `addImplicitOccurrenceUsageTyping` types `snapshot`/`timeslice` usages by their owning occurrence def/usage. The pilot at 2026-09.1 has no such typing; it dates from before ST6RI-643 (2023).
  - With this phase, that implied typing also feeds the structure check. `timeslice part t;` in a part def gets `Objects::objects`, and `snapshot occurrence s;` there gets `subobjects` where the pilot gives `suboccurrences`.
  - Not changed, because name resolution through portions may rely on it. Needs a decision.
- **Non-occurrence usages and KerML features:** reference usages, plain `#keyword` usages and attribute usages still choose their default supertype with our classifier-based check, which includes inherited types; the pilot checks owned typings only. Owner checks now match the pilot for all usages. KerML features are unchanged.
- **Pilot quirk not copied:** the pilot's `FeatureAdapter.hasClassType(owningType)` combines the owner's owned typings with the target's own implicit typings. We use the owner's typings only. It only differs when the target itself has implicit typings and an owning type, which no probe reaches.
- **Performance:** the extra redundant subsettings cost little. On a heavily loaded machine, the stdlib validation run took 57–61 s CPU, against 45–58 s for the Phase 4 tree. That is within noise.
