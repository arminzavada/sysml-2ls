# Pilot release-notes digest: 2024-12 → 2026-03

> **Per-upgrade artifact.** This file is the inventory of what changed in the Eclipse pilot implementation between this repo's previous baseline (`2024-12`) and the upgrade target (`2026-03`). It is **not** evergreen — it should be referenced for the 2026-03 upgrade and then read as a historical record.
>
> **Source:** [`Systems-Modeling/SysML-v2-Pilot-Implementation` GitHub releases](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases). Each item links the release tag whose notes claim the change.
>
> **Compiled:** 2026-05-04. No raw pilot source was read while building this digest — only the author-curated release notes. Items flagged as ambiguous below are explicitly *not* spec interpretations.

## Per-release headlines

- **2025-02** — Major language additions: `var`/`const`/`constant` (replacing `readonly`), `new` constructor expressions, global-scope `$::…` qualifier; flow renames; restructured send/accept syntax. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)
- **2025-04** — Control nodes (`fork`/`join`/`decide`/`merge`) may now have full action bodies with parameters; constructor expression evaluation implemented. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-04)
- **2025-06** — Bug-fix release; metamodel `.uml`/`.ecore` realigned to Beta 4; minor library corrections. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-06)
- **2025-07** — Library-wide diamond-inheritance name-collision fixes; subject/objective auto-insertion removed; `Message` end features become inherited; `transfers` reclassified from flows to steps. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)
- **2025-09** — Name-resolution fix for redefinition under multi-specialization (order-independent). [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-09)
- **2025-09.1** — Same as 2025-09 plus a feature-typing regression fix. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-09.1)
- **2025-10** — SysML usages can no longer be typed by other usages; `protected` members now correctly hidden in feature chains. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-10)
- **2025-11** — `collect`/`select` (and `seq.{…}`/`seq.?{…}`) now evaluable; several numeric/sequence/string functions de-listed from model-level evaluation. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)
- **2025-12** — Full evaluation for `SequenceFunctions`, `CollectionFunctions`, `ControlFunctions`, plus `min`/`max`; collection equality. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-12)
- **2026-01** — `TrigFunctions` evaluable; major in-memory/XMI metamodel cleanup (no textual-syntax change). [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-01)
- **2026-02** — `nonunique` keyword reimplemented without metamodel alteration; small bug fixes. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-02)
- **2026-03** — Filter-expression feature references using qualified names now invalid; must use feature-chain `(as T).f`. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-03)

## Cumulative grouped impact

### Grammar / new keywords

- KerML: `var`, `const` added; `readonly` removed [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- SysML: `constant` added; `readonly` removed [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- `new` keyword for constructor expressions in both languages [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Global-scope qualifier `$::…` allowed as initial segment of qualified names [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Expanded `send` action notation: bodied `send { in payload=…; in sender=…; in receiver=…; }` and mixed forms; `send via…to…` now also implicitly redefines `payload` [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- `accept` action may now redefine `receiver` in body via `accept trig { in receiver = …; }` [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Control nodes (`fork`, `join`, `decide`, `merge`) accept regular action bodies with `in`/`out` parameters [[2025-04](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-04)].
- KerML grammar fix: `const` permitted on end features (was disallowed by grammar) [[2025-11](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)].
- `derived` keyword position constrained: must immediately follow direction keyword and precede `abstract`/other prefixes [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- `nonunique` keyword internally re-modeled as a data-type singleton driving normative `isUnique`; no surface-syntax change [[2026-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-02)].

### Scoping & visibility

- Global-scope resolution for `$::…` qualified names; useful to bypass shadowing of library packages [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- `protected` members are no longer reachable through feature chains (`p.b`); previously only blocked in qualified names [[2025-10](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-10)].
- Name resolution under diamond/multi-specialization made order-independent for redefinition targets [[2025-09](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-09)].
- Qualified-name redefinition targets (e.g. `x::y`) now resolve consistently in editor outline, validation, and Jupyter; resolves through inherited element rather than self [[2025-11](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)].

### Type system

- Association/connection end features restricted to a single type [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- End features can be redefined only by other end features [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Variable-feature semantics: KerML `var` features have featuring domain = snapshots; SysML auto-applies time-varying semantics except for time slices, snapshots, bindings, successions, composite subactions [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Time slices and snapshots no longer auto-typed by their individual definition; standalone time slice/snapshot declarations no longer allowed [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- SysML usages must be typed by definitions (or KerML classifiers); `ref x : a, A` (where `a` is a usage) now errors [[2025-10](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-10)].
- Item-usage validation that demanded item-definition typing was overly strict and removed [[2025-11](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)].
- `validateConnectorBinarySpecialization` corrected; some previously valid (or invalid) binary connector/connection declarations flip [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- New/now-checked validation constraints in 2026-01 (formerly silently satisfied via getter overrides): `validateEndFeatureMembership`, `validateParameterMembership`, `validateCollectExpressionOperator`, `validateFeatureChainExpressionOperator`, `validateIndexExpressionOperator`, `validateSelectExpressionOperator`, `validateFlowEndIsEnd`; plus SysML `validateUsageIsReferential`, `validateReferenceUsageIsReferential`, `validateAttributeUsageIsReferential`, `validateEnumerationDefinitionIsVariation`, `validateEventOccurrenceUsageIsReference`, `validatePortUsageIsReference` [[2026-01](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-01)].
- KERML11-191 (`deriveTypeFeatureMembership`) resolved [[2026-03](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-03)].

### Expressions & evaluation

- Constructor expressions parsed and model-level-evaluated; an invocation expression whose target is a non-behavior/non-step/non-expression is now an error (was implicitly a constructor) [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)] [[2025-04](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-04)].
- `ControlFunctions::collect`/`select` evaluable, enabling `seq.{…}` / `seq.?{…}` [[2025-11](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)].
- All `SequenceFunctions`, `CollectionFunctions`, `ControlFunctions` and `DataFunctions::min`/`max` now evaluable; `==`/`!=` work on collections [[2025-12](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-12)].
- All `TrigFunctions` evaluable [[2026-01](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-01)].
- Reduced model-level-evaluable set per spec: `prod`, `sum`, `excludes`, `includes`, `isEmpty`, `notEmpty`, `size`, `Length`, `Substring` no longer model-level evaluable [[2025-11](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)].
- Filter expressions: feature references using qualified names now violate `checkConnectorTypeFeaturing`; must rewrite as feature chains using `(as T).f` [[2026-03](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-03)].

### Library / built-ins

- Renames: `FlowConnections` → `Flows`; `FlowConnectionDefinition`/`Usage`/`SuccessionFlowConnectionUsage` → `FlowDefinition`/`FlowUsage`/`SuccessionFlowUsage`; `Transfer::item` and `*entItem` → `payload` [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- `Transfer::source::sourceOutput` and `target::targetInput` retyped from `Occurrence` to `Anything` [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- `Clock::currentTime` declared `var` [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- `Performances::constructorEvaluations` added [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- `TradeStudyObjective::fn` → `eval` [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Library reshuffles to break diamond name-collisions across `Occurrences`, `Objects`, `Transfers`, `VectorFunctions`, `Actions`, `Connections`, `Flows`, `Items`, `Metadata`, `Parts`, `Ports`, `Views`, `SI`, `USCustomaryUnits`, etc. [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- `transfers`/`messageTransfers` are steps, not flows [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- `Message::source`/`target` now inherited and not occurrence usages; use `sourceEvent`/`targetEvent` [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- `Action::assignments`: parameter `target` added, fixing assignment parameter ordering [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- `TransitionPerformance::accept` reworked so transition `receive` parameter can be redefined and bound [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- `SpatialItem` gains `subSpatialItems`, `subSpatialParts`, `componentParts` to absorb diamond redefinitions of `localClock` [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- Libraries shipped as `.kpar` archives starting 2025-11 [[2025-11](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)].

### Breaking changes (cumulative — things that change parsed text or accept/reject decisions)

- `readonly` keyword removed; replaced by `const` (KerML) / `constant` (SysML) [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Invocation-as-constructor no longer allowed; must use `new` [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Single-type restriction on association/connection ends; end-redefines-end constraint [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Standalone time slice / snapshot declarations rejected [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- `derived` ordering constraint [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Flow library renames break explicit references [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- Implicit `subject`/`objective` insertion removed: any `requirement def`/`use case`/`concern` with stakeholders/actors/extra params now requires explicit `subject;` or `objective;` [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- New distinguishability warnings on diamond inheritance (e.g. `Vehicle`→`Car`/`Truck`→`SUV`) [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- Subitem-of-`SpatialItem` now warns unless `subSpatialItems` etc. are used [[2025-07](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-07)].
- Multi-type usage typing tightened; `protected` feature-chain access blocked [[2025-10](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-10)].
- Name-resolution algorithm change (redefinition under multi-spec; qualified-name redefinition target) — may flip both error/no-error cases [[2025-09](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-09)] [[2025-11](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)].
- New validation constraints actually fire [[2026-01](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-01)].
- Filter-expression qualified-name feature references now error [[2026-03](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-03)].

## Open questions / ambiguities (do not assume away — confirm with pilot source or with Armin)

- **`var`/`const`/`constant` semantics**: notes describe the snapshot-domain semantics for KerML and the auto-time-varying rules in SysML, but the validation rules — particularly which exact `is*` flags propagate to redefinitions and to end features under `assoc struct` — are described informally [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- **Constructor expression parsing**: notes say constructor expressions are "parsed as an expression whose instantiated type is instantiated by its result parameter." The exact AST shape (vs. invocation expressions) needs source-level confirmation [[2025-04](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-04)].
- **Send/accept body forms**: the multi-form send notation (bodied, mixed, `via`/`to`) and the implicit redefinition of `payload` and `receiver` need explicit grammar rules; the notes show only examples [[2025-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-02)].
- **Control-node bodies**: which subset of action body members is actually allowed (parameters explicitly; what about `then`/successions inside the node, calc/state nesting, etc.)? [[2025-04](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-04)]
- **Name-resolution algorithm changes**: descriptions are example-driven only; implementing Langium scoping symmetrically will need an algorithmic spec or source comparison [[2025-09](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-09)] [[2025-11](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)].
- **Model-level evaluability**: which exact set of functions is now considered model-level evaluable (after both 2025-11 removals and 2025-12/2026-01 additions) is not summarized in one place — derive from the spec, not the notes [[2025-11](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-11)] [[2025-12](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2025-12)] [[2026-01](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-01)].
- **Filter-expression rewrite**: 2026-03 changes accept/reject behaviour but the underlying `checkConnectorTypeFeaturing` rule is what matters; need to confirm whether the constraint is now identical to the spec and if existing library models were updated [[2026-03](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-03)].
- **2026-01 metamodel cleanup**: the notes are explicit that textual notation is unaffected, but several previously silent invariants now become validated. There is risk that user models conformant under the old behaviour now error (the constraints listed are a checklist for the Langium validator, not a replacement spec) [[2026-01](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-01)].
- **`nonunique` representation**: 2026-02 changes the in-memory representation but says no syntax change. Worth checking whether the Pilot's parser actions for `nonunique` change in a way the Langium port had hard-coded [[2026-02](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-02)].
