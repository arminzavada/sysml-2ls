# Pilot release-notes digest: 2026-03 → 2026-09.1

> **Per-upgrade artifact.** Inventory of what changed in the pilot between this repo's baseline (`2026-03`, commit `3a1be5b87`) and the target (`2026-09.1`, commit `d81b2ad50`). Historical record after the cycle.
>
> **Sources:** GitHub release notes for pilot tags `2026-04`, `2026-05`, `2026-07`, `2026-08`, `2026-09`, `2026-09.1` (no `2026-06`) and SysML-v2-Release tags `2026-04`…`2026-09` (no `2026-09.1`), cross-checked against the pilot repo's code diff per tag range: `*.xtext`, `*.ecore`, `sysml.library/`, `KerMLValidator.xtend`/`SysMLValidator.xtend`, and the semantic logic (`org.omg.sysml.logic/.../{adapter,delegate,util}`, `org.omg.{kerml,sysml}.xtext/.../postprocessing`).
>
> **Compiled:** 2026-10-30.
>
> **Tags:** `[chunk·confidence]` — chunks: 1 grammar-keywords, 2 library-builtins, 3 scoping-visibility, 4 type-system, 5 expressions-evaluation, 6 validation-rules. Confidence: `understood` / `structurally-clear` / `needs-deeper-trace` / `consult-Armin`. **(unannounced)** = visible in code, not in the release notes.

## Per-release headlines

- **2026-04** — Infrastructure only: EMF metamodel split into `org.omg.sysml.model`, LGPL→EPL relicense. No language change. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-04)
- **2026-05** — KerML 1.1 / SysML 2.1 Beta 1: two grammar fixes (enum annotating-member visibility, `frame concern` body), assignment referent must be time-varying, `ownedMetadata`/`nestedMetadata` fixed, `Collections` library revised. Logic extracted into `org.omg.sysml.logic`. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-05)
- **2026-07** — Beta 2: six grammar widenings (summarized in notes only as "BNF non-conformities"), attribute-owned features become referential + validation enabled, subrequirement rule narrowed, end-redefinition rule narrowed, `TransitionPerformance::accept` reworked. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-07)
- **2026-08** — Bug fixes + Xtext post-processing refactor; port usages get occurrence-usage semantics. No grammar/ecore/library change. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-08)
- **2026-09** — Default multiplicity rule changed; connection/flow def ends must be usages; `Flows::messages` becomes an action usage (unannounced). [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-09)
- **2026-09.1** — One proxy/reference-linking fix for a 2026-09 regression. [link](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation/releases/tag/2026-09.1)

## Ecore verdict

Compared with an order-insensitive normalization of the ecore (classes, supertypes, abstract flags, features with type/bounds/flags, operations and parameters, `subsets`/`redefines` annotations, enum literals; separately also doc/OCL bodies).

- The merged metamodel is `org.omg.sysml/model/SysML.ecore`. From 2026-04 an identical copy also lives at `org.omg.sysml.model/src/main/resources/model/SysML.ecore` (byte-identical at every later tag).
- **2026-03→04 (+8844/−3303): noise only.** Classifiers re-sorted alphabetically, `types.ecore` (UML primitives) deleted, its datatypes swapped for Ecore built-ins (`String→EString`, `Boolean→EBoolean`, `Integer`/`UnlimitedNatural→EInt`, `Real→EDouble`). The +5556 is the new copy. Structure *and* doc/OCL text identical after normalization.
- **2026-04→05:** one structural change: `SendActionUsage::payloadArgument` lower bound 1→0. Everything else (including the ±2365 in the `kerml.ecore`/`sysml_clean.ecore` intermediates) is Beta 1 OCL/doc text.
- **2026-05→07:** zero structural change; OCL/doc only (KERML11-1, -3, -68, SYSML21-300, `featureMembership`, `nestedMetadata`).
- **2026-07→09.1:** ecore untouched.
- nsURI stays `https://www.omg.org/spec/SysML/20250201` throughout.
- **Net: no metaclass/property additions, removals or renames in the whole range.** AST/interface impact comes only from the grammar.

## 2026-04 (plugin 0.59.0)

- Grammar: license header only. Validators: license header only. `[1·understood]`
- Library: `.meta.json` index regeneration only (e.g. `USCU` alias entry for `USCustomaryUnits`). We don't consume `.meta.json`. `[2·understood]`
- Not relevant: `org.omg.sysml.model` module, EPL relicense, Sysand index util, Maven/bundle versions.

## 2026-05 (plugin 0.60.1) — Beta 1

Grammar:

- SysML `AnnotatingMember` gains `MemberPrefix`. It is only used in `EnumerationBody`, so comments/docs in `enum def` bodies may carry visibility (SYSML21-319). Our `EnumerationItems` uses `AnnotatingMember` without `Visibility?`. `[1·understood]`
- SysML `FramedConcernUsage`, keyword form (`frame concern …`): `CalculationBody` → `RequirementBody` (SYSML21-366). Ours still `CalculationBody`. `[1·understood]`

Validation:

- New `validateAssignmentActionUsageReferentIsTimeVarying` (error): `referent.featureTarget.isVariable` must hold; for usages that is the derived `Usage::mayTimeVary` (SYSML21-17). **Pilot now rejects assignment to non-time-varying features.** We have no `mayTimeVary` derivation, so this depends on chunk 4. `[6·needs-deeper-trace]`
- `AssignmentActionUsage::referent` derivation and `validateAssignmentActionUsageReferent` skip `MetadataFeature` members (SYSML21-15). Ours checks the dedicated `targetMember` slot, so it is probably already equivalent. `[6·structurally-clear]`
- `validateSendActionPayloadArgument` renamed `validateSendActionUsagePayloadArgument` (SYSML21-459). OCL: a payload is required only for sends owned via `StateSubactionMembership`/`TransitionFeatureMembership`. The pilot implementation tests `TypeUtil.getFeatureMembershipOf(usg)` (a list) with `instanceof`, so the check appears never to fire. `[6·consult-Armin]`
- Send/accept parameter OCL relaxed: `SendActionUsage` loses `inputParameters()->size() >= 3`; `AcceptActionUsage` goes from `>= 2` to `notEmpty()`. The pilot has no send-parameter check at all. Our `validateSendActionParameters` (payload+sender+receiver) and `validateAcceptActionUsageParameters` (payload+receiver) may now be **stricter than pilot**. `[6·needs-deeper-trace]`

Type system:

- `Definition::ownedMetadata` / `Usage::nestedMetadata` fixed (were always empty) (SYSML21-419). OCL says `ownedMember`; the impl uses `getMember()`. We don't expose these. `[4·needs-deeper-trace]` low priority
- Composite-variants regression fix: variants had become referential. Our `UsageMeta.isComposite` ignores containment, so no work. `[4·understood]`
- `checkFeatureParameterRedefinition` OCL (KERML11-6): positional implicit parameter redefinition only against supertypes that are Behaviors/Steps, and only for the owner's non-return parameters. `[4·needs-deeper-trace]`
- `ConstraintUsage` assumption/requirement specialization OCL now gated on `isComposite`. `[4·structurally-clear]`
- `deriveFeatureFeaturingType` (KERML11-7): `owningType` → `owningNamespace` (features owned by a feature via non-feature membership, e.g. cross features). `[4·needs-deeper-trace]`
- Pilot reports these Beta 1 resolutions as already implemented before 2026-03: SYSML21-4, -299, -301, -309, KERML11-2. Our viewpoint names (`Views::ViewpointCheck`/`viewpointChecks`) already match. `[4·structurally-clear]`

Scoping:

- `Namespace::resolve`/`resolveLocal`/`resolveGlobal` re-implemented per spec OCL in the logic module: `resolveLocal` recurses to the owning namespace, and a `$` qualification goes global. The Xtext linker and scope providers are unchanged (see cross-cutting), so this is API/evaluation-side only. `[3·understood]`

Library:

- `Collections.kerml` (KERML11-144):
  - `Map` gains a key-uniqueness `inv` (imports `SequenceFunctions::equals`; nested `forAll{…}`/`exists{…}` bodies).
  - `OrderedMap :> Map, OrderedCollection` with `elements :>> Map::elements, OrderedCollection::elements`, a new diamond on `elements`.
  - Docs and whitespace changes otherwise.

  Probe: the library must still validate clean. `[2·structurally-clear]`
- `VectorCalculations`/`TensorCalculations` `'['` `elements` now `ordered nonunique` (SYSML21-362). `[2,5·understood]`
- Doc-only changes: `Time::Clock`, `Transfer::isInstant`, `Actions` (SendAction, AcceptMessageAction, MergeAction, DecisionAction), `SysML.sysml`. `[2·understood]`

Not relevant: `org.omg.sysml.logic` extraction, KPAR metamodel/build tags, outline ordering of implicit relationships, `instantiatedType` NPE, resource IRIs.

## 2026-07 (plugin 0.61.0) — Beta 2

Grammar (PR #781, itemized only in code) **(unannounced detail)**. All of these widen the accepted language:

- KerML `FeatureConjugation`: adds `| ownedRelatedElement += OwnedFeatureChain`, e.g. `feature f ~ a.b;`. Ours is `targetRef=FeatureReference`; add `targetChain=OwnedFeatureChain` as in `OwnedSubsetting`. The AST gains a chain option. `[1·structurally-clear]`
- KerML `MetadataFeatureDeclaration`: `Identification?` before `:`/`typed by`, so `@ : M;` is legal (SysML already allowed it). Ours is `( Identification TypedByToken )?`. `[1·understood]`
- SysML `InterfaceUsageDeclaration`: `UsageDeclaration? ValuePart? ( connect InterfacePart )?`. Interface usages may carry a feature value; ours lacks `ValuePart?`. `[1·understood]`
- SysML `GuardedSuccessionMember` gains `MemberPrefix` (visibility). Ours has none. `[1·understood]`
- SysML `RequirementConstraintUsage`, `FramedConcernUsage`, `ViewRenderingUsage` reference-subsetting forms: `FeatureSpecialization*` → `FeatureSpecializationPart?`, which admits a multiplicity (`require c [1];`). Ours is `FeatureSpecialization*` in all three. `[1·understood]`

Validation / type system:

- SYSML21-19 **(unannounced as incompatible)**: two changes that go together.
  - `validateAttributeDefinitionFeatures` and `validateAttributeUsageFeatures` are enabled ("Features of an attribute … must be referential").
  - Usage post-processing now forces `isComposite=false` on every usage whose expected featuring type is an attribute def/usage.

  In textual models the check is thus effectively unreachable. The observable change is that `attribute def A { part p; }` makes `p` referential, which changes its implicit specialization. Our `sysml-validator.ts` has TODOs for both checks ("blocked by KERML-4"), and `UsageMeta.isComposite` ignores attribute owners. `[4,6·structurally-clear]`
- `checkRequirementUsageSubrequirementSpecialization` (SYSML21-300): `isSubrequirement` now excludes any `RequirementConstraintMembership` (`require` as well as `assume`). Our `RequirementUsageMeta.isSubrequirement` excludes only `assumption`; `ConcernUsageMeta` reuses it. `[4·understood]`
- `validateRedefinitionEndConformance` narrowed (KERML11-68): "end redefined only by end" applies only when the redefining feature's owner is an Association/Connector. We don't implement the check at all (pre-existing gap). `[6·structurally-clear]`
- `checkMultiplicityRangeExpressionTypeFeaturing` (KERML11-3): bounds of an owned cross feature's multiplicity take the owning end's featuring types. The special case moved from the validator into `ExpressionAdapter`; OCL updated. `[4,6·needs-deeper-trace]`
- `Feature::ownedCrossFeature()` (KERML11-1): also excludes `BindingConnector` and `FeatureValue`-owned members, and requires `owningType != null`. Our `FeatureMeta.findOwnedCrossFeature` (exact `OwningMembership` children) already excludes `FeatureValue`, but not binding connectors or the owning-type guard. `[4·structurally-clear]`
- `featureMembership` derivation OCL: inherited memberships filtered by `self.specializes(mem.owningType)` (KERML11-191; pilot code since 2026-03). Confirm our inherited-member computation agrees. `[3,4·needs-deeper-trace]`
- `IndexExpression` OCL: `Collections::Array` → `Collections::Collection` (KERML11-69; pilot code earlier). Our evaluator special-cases `Collections::Array`. Evaluator-only, low priority. `[5·needs-deeper-trace]`

Library:

- `TransitionPerformances` (KERML11-79): `triggerTarget` default `this` → `accept.receiver ?? this`; `binding accept.receiver = triggerTarget` removed. Our transition implicit redefinitions (`metamodel-builder.ts`) don't touch `receiver`/`triggerTarget`. `[2,4·structurally-clear]`
- `Objects`: `StructuredSurface`/`StructuredCurve`/`StructuredPoint` add `intersects` of their two supertypes (KERML11-76). This exercises intersecting validation on the library. `[2·understood]`
- `Actions::Action::assignments::target` gains a doc body (SYSML21-327). `[2·understood]`

Spec (SysML-v2-Release `2026-07`): Beta 2 documents plus `doc/changes` comparison PDFs. That release also lists **SYSML21-311** ("Substates may potentially inherit 'this' twice"), which is absent from the pilot notes and pilot commit log in range. `[4·consult-Armin]`

Not relevant: XMI `StackOverflowError` (TransitionUsage), derived-property NPE on unresolved chains, `RenderingUsage::namingFeature` null-safety, `.uml`/ecore regeneration.

## 2026-08 (plugin 0.62.0)

Notes: no language or library changes. Code agrees: grammar and ecore untouched, library diff is `.project.json` version bumps only.

- `PortUsageAdapter` now extends `OccurrenceUsageAdapter` (ST6RI-965): `timeslice`/`snapshot` port usages specialize `Occurrence::timeSlices`/`snapshots`. Our `PortUsageMeta extends OccurrenceUsageMeta`, whose `defaultGeneralTypes` pushes `portionKind`, so this is probably already conformant. `[4·structurally-clear]` probe
- Duplicate implicit subsettings for structurally equivalent feature chains suppressed (ST6RI-961, transition usages). `[4·needs-deeper-trace]` low
- `Type::ownedDisjoining` was always empty; fixed. `[4·needs-deeper-trace]` low
- Cross-subsetting validator no longer throws; error anchored on the cross subsetting (ST6RI-966). `[6·understood]`
- Usage composite defaults preserved via parser post-processing (ST6RI-950). Non-composite-by-default list: AttributeUsage, BindingConnectorAsUsage, EventOccurrenceUsage, ExhibitStateUsage, IncludeUseCaseUsage, PerformActionUsage, ReferenceUsage, SuccessionAsUsage. Behavior-preserving; useful cross-check for our per-class `isComposite` overrides. `[4·understood]`
- Parse post-processing moved out of the semantic adapters into `org.omg.kerml.xtext.postprocessing` / `org.omg.sysml.xtext.postprocessing` (ST6RI-953). These packages are now the single map of parse-time semantics: composite defaults, default multiplicity, variation→abstract, expression results. Reference for our AST→model conversion. `[1,4·understood]`
- Not relevant: `featureMemberships` cache invalidation (validators now call `TypeUtil.get*Of`, no behavior change), XMI `isComposite` round-trip, `FeatureAdapter::getTypes` NPE.

## 2026-09 (plugin 0.63.0)

- **Default multiplicity** (ST6RI-947, PR #815/#821): attribute, item (incl. part) and port usages get `1..1` unless they have an explicit (non-implied) owned **redefinition**; end usages always get it. Previously any owned subsetting of a feature with an owning type suppressed it. The default is inserted post-parse as an empty `Multiplicity` member. Notes: only interpretation-level incompatibility; spec pending SYSML21-185. Our repo has no SysML default-multiplicity insertion, which matters for `validateSubsettingMultiplicityConformance`/`validateRedefinitionMultiplicityConformance`. `[4·consult-Armin]`
- `Type::multiplicity` and `validateTypeOwnedMultiplicity` count only `ownedMember` multiplicities, so aliases to multiplicities no longer count (ST6RI-975). Our KerML check filters `OwningMembership` children, so probably already conformant. Probe with the pilot's `MultiplicityAlias_valid` model. `[6·structurally-clear]`
- New `validateConnectionDefinitionEndsAreUsages_` / `validateFlowDefinitionEndsAreUsages_` (PR #805). All end features, inherited included, of a `connection def`/`flow def` must be usages. The error goes on each owned offending end, or on the def if all offenders are inherited. **Pilot now rejects** e.g. a `connection def` specializing a KerML `assoc` whose ends are plain features. Not in our validator. `[6·understood]`
- `Flows.sysml` (SYSML21-681) **(unannounced; notes say "Model Libraries: None")**:
  - `Message` re-declares owned `end occurrence source/target` usages redefining `Transfer::source/target`. These were removed in 2025-07.
  - `messages` changes from `abstract message` (a FlowUsage) to `abstract action` with its own owned ends.

  Both changes are required for the new ends-are-usages check to pass on the library. Our `FlowUsageMeta` "message" supertype `Flows::messages` now resolves to an ActionUsage. `[2,4·structurally-clear]`
- Model-level evaluation of enumeration-typed meta-properties (ST6RI-971). Evaluator-only; matters only for metadata filter conditions. `[5·needs-deeper-trace]` low
- Self-annotating metaclass/metadata def (`metadata def M { metadata M; }`) caused a `StackOverflowError`; fixed (ST6RI-976). Probe our LSP for the same recursion. `[3,6·needs-deeper-trace]`
- Not relevant: standalone-setup idempotency, getter-mutation removal (expression result parameters now created post-parse), library `.index.json` regeneration, state-subaction check refactor.

## 2026-09.1 (plugin 0.63.1)

- Only change: reference-linking fixes for proxies exposed by 2026-09 (ST6RI-984). `FeatureAdapter`/`ConnectorUtil` no longer cache proxies, and binding-connector type conformance resolves end proxies. No grammar, ecore or library change. `[3·understood]`
- The new pilot `NestedResolutionTest` has two cases that are good probes for our scoping. `[3·structurally-clear]`
  - A metadata value resolved through a wildcard import that itself resolves via an earlier import: `import VerificationCases::*; import VerificationMethodKind::*; @VerificationMethod { kind = test; }`.
  - A redefinition through a semantic-metadata implicit supertype: `#service def Service` with `baseType default interfaces meta SysML::PortUsage`, then `port def Endpoint :> Service, Interface`.

## Cross-cutting observations

- **AST impact is grammar-only.** No metaclass changes in range. Shape changes:
  - `Conjugation` with an owned chain.
  - Optional name in KerML metadata.
  - `ValuePart` on interface usages.
  - Multiplicity in the reference-subsetting forms of requirement constraints, framed concerns and view renderings.
  - Visibility on enum annotating members and guarded successions.
  - `RequirementBody` for keyword `frame concern`.
- **Pilot now rejects** (we must too):
  - Assignment to a non-time-varying referent (2026-05; needs `mayTimeVary`).
  - Connection/flow defs with non-usage ends (2026-09).
- **Pilot now accepts more** (our grammar/validators must widen): the six grammar widenings, narrowed end-redefinition conformance, multiplicity aliases. Our send/accept parameter checks may be stricter than pilot.
- **Silent semantic shifts** (no new errors, different implicit relationships):
  - Attribute-owned usages are referential (2026-07).
  - `require` members are no longer subrequirements (2026-07).
  - `1..1` default multiplicity for subsetting-only attribute/item/port usages (2026-09).
  - `Flows::messages` is an ActionUsage (2026-09).
  - Transition `triggerTarget` default changed (2026-07).
- **Release-notes gaps:**
  - 2026-07 grammar changes collapsed into "BNF non-conformities".
  - SYSML21-19 enables a validation and changes compositeness, yet the notes list "Backward Incompatibilities: None".
  - The `Flows.sysml` change in 2026-09.
  - SYSML21-311 appears only in the SysML-v2-Release notes.
- **Scoping algorithm unchanged.** Across the range the Xtext linker, scope and scope-provider diffs are licensing plus the post-processing hook. No name-resolution algorithm to port; chunk 3 is probes only.
- **Library swap scope:**
  - 10 `.sysml`/`.kerml` files change: TensorCalculations, Time, VectorCalculations, Collections, Objects, Transfers, TransitionPerformances, Actions, Flows, SysML.
  - No files are added or removed, so the `syside-base` stdlib file list is unaffected.
  - SysML-v2-Release `2026-09` is commit `b7a6b77000c9136f8f24822fc9d2cb237c76267f`; the pilot's `sysml.library/` is identical at `2026-09` and `2026-09.1`.
  - The stdlib pin lives in `scripts/clone-sysml-release.mjs`. `upstream-sources.md` cites a stale path under `packages/syside-languageserver/`.
- **Where pilot logic now lives:** `org.omg.sysml.logic/src/main/java/org/omg/sysml/{adapter,delegate,util}` plus `org.omg.{kerml,sysml}.xtext/src/.../postprocessing`, no longer `org.omg.sysml/src/...`. Code moved in 2026-05 with minimal semantic edits; this matters for every chunk's pilot-side reading.
- **Evaluator-only items** (low priority, authoring focus): IndexExpression on any `Collection`, enum-typed meta-property evaluation, `Namespace::resolve*` OCL operations.

## Consult-Armin

- Send payload check: implement `validateSendActionUsagePayloadArgument` per spec OCL, which is stricter than the pilot's apparently dead check, or mirror the pilot?
- Default multiplicity: model SysML default multiplicities now, given the pilot rule is provisional pending SYSML21-185?
- SYSML21-311 (substates inheriting `this` twice): in Beta 2 docs, no visible pilot change. Track or ignore?
- `mayTimeVary`: port the full SysML derivation to support the time-varying referent check? It is a prerequisite for a pilot-rejects rule.
