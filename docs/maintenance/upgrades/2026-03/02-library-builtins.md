# Chunk 2 — Library / built-ins (2026-03 upgrade)

> **Per-upgrade artifact.** Cross-reference of standard-library and built-in changes from [`release-notes-digest.md`](release-notes-digest.md) against this repo.
>
> **Method:** Library content compared between upstream `Systems-Modeling/SysML-v2-Release` tags `2024-12` (commit `f49ea19a`) and `2026-03` (commit `cd99f7ca7…`). Repo coupling assessed by grepping `packages/` for old/new element names. Bundled stdlib (in this repo at `SysML-v2-Release/sysml.library/`, sourced from `arminzavada/SysML-v2-Release` ≈ tag `2024-12`) cross-checked against upstream `2024-12` to surface fork customizations.
>
> **Status legend:** `missing` — repo references old name only · `partial` — repo references both or new name absent · `present` — already aligned · `unclear` / `consult-Armin`.

## Headline findings

1. **73 of ~115 library files changed** between `2024-12` and `2026-03` (1515 insertions / 1422 deletions). One file added (`Flows.sysml`), one deleted (`FlowConnections.sysml`), the rest in-place edits.
2. **Repo couples heavily to old library names.** `FlowConnection*` referenced across **~25 source/grammar/model/printer/validator files**. Three dedicated model classes are named after the old terminology: [`flow-connection-definition.ts`](../../../packages/syside-languageserver/src/model/SysML/flow-connection-definition.ts), [`flow-connection-usage.ts`](../../../packages/syside-languageserver/src/model/SysML/flow-connection-usage.ts), [`succession-flow-connection-usage.ts`](../../../packages/syside-languageserver/src/model/SysML/succession-flow-connection-usage.ts).
3. **Central stdlib file registry** at [`packages/syside-base/src/stdlib.ts`](../../../packages/syside-base/src/stdlib.ts) names library files by path (e.g. `"Systems Library/FlowConnections.sysml"` at line 30). One-stop update for the file-rename.
4. **🚩 Bundled stdlib has fork customizations that are not benign.** At least 20 files in this repo's bundled `SysML-v2-Release/sysml.library/` differ from upstream `2024-12` — and the diffs are **workarounds for language-server limitations**, not stylistic changes. Examples below. Wiping these at upgrade will likely resurface the issues they patch over. **This needs a deliberate decision before the upgrade runs.**
5. **None of the new library elements are referenced** in repo code: `sourceEvent`, `targetEvent`, `subSpatialItems`, `subSpatialParts`, `componentParts`, `constructorEvaluations` — all 0 hits.
6. **`.kpar` archives** (introduced 2025-11) live in a separate top-level `sysml.library.kpar/` tree at the upstream Release. Not consumed by this repo today (clone script fetches `sysml.library/` source). No change needed unless we decide to switch ingestion mode.

---

## Summary

| # | Item | Status | Repo touchpoints |
|---|------|--------|------------------|
| 1 | `FlowConnections.sysml` → `Flows.sysml` (file rename) | **missing** | `syside-base/src/stdlib.ts:30` |
| 2 | `FlowConnectionDefinition`/`Usage`/`SuccessionFlowConnectionUsage` → `Flow*` | **missing** | 3 model classes, grammar interfaces, generated, printer, validator (~25 files) |
| 3 | `Transfer::item` → `payload`; `MessageTransfer::sentItem` → `payload` | **missing** | 1 file references `Transfer::item`; new `payload` not referenced |
| 4 | `Transfer::sourceOutput`/`targetInput` retyped `Occurrence` → `Anything` | **partial** (refs exist; semantic-only change) | 5/4 files reference these names |
| 5 | `Clock::currentTime` declared `var` | **partial** | depends on Chunk 1 `var`/`const` work |
| 6 | `Performances::constructorEvaluations` added | **missing** | 0 hits in repo |
| 7 | `TradeStudyObjective::fn` → `eval` | **missing** | (need targeted check; `eval` is too generic to grep blindly) |
| 8 | `Message::source`/`target` now inherited; use `sourceEvent`/`targetEvent` | **missing** | 0 hits for `sourceEvent`/`targetEvent` |
| 9 | `transfers`/`messageTransfers` reclassified flows → steps | **unclear** / consult-Armin | semantic; visible at validator/typing layer |
| 10 | `Action::assignments` parameter `target` added | **missing** | (semantic/library-level; consumer impact tbd) |
| 11 | `TransitionPerformance::accept` reworked (`receive` parameter rebindable) | **unclear** / consult-Armin | ties to Chunk 1 item 8 (accept body) |
| 12 | `SpatialItem` gains `subSpatialItems`, `subSpatialParts`, `componentParts` | **missing** | 0 hits |
| 13 | Library reshuffles for diamond-collision (Occurrences, Objects, VectorFunctions, Connections, Items, Metadata, Parts, Ports, Views, SI, USCustomaryUnits, …) | **content-only at upgrade time** | wiped wholesale on stdlib re-fetch |
| 14 | `.kpar` packaged archives shipped from 2025-11 | **N/A** | repo consumes source `.kerml`/`.sysml`, not `.kpar` |

---

## 1. `FlowConnections.sysml` → `Flows.sysml` (file rename)

**Upstream diff:**
```
D  sysml.library/Systems Library/FlowConnections.sysml
A  sysml.library/Systems Library/Flows.sysml
```

**Repo:** [`packages/syside-base/src/stdlib.ts:30`](../../../packages/syside-base/src/stdlib.ts) registers `"Systems Library/FlowConnections.sysml"`. After upgrade, this path will not exist — must be replaced with `"Systems Library/Flows.sysml"`.

**Status: missing.** Single-line fix in the registry; coupled with renames below.

## 2. `FlowConnection*` → `Flow*` (type renames)

Renames per digest:
- `FlowConnections::FlowConnection` → `Flows::Flow`
- `FlowConnectionDefinition` → `FlowDefinition`
- `FlowConnectionUsage` → `FlowUsage`
- `SuccessionFlowConnectionUsage` → `SuccessionFlowUsage`

**Repo coupling (file count, source + grammar; tests excluded for clarity):**

| File | Notes |
|------|-------|
| [`syside-base/src/stdlib.ts`](../../../packages/syside-base/src/stdlib.ts) | path string |
| [`syside-languageserver/src/grammar/SysML.langium`](../../../packages/syside-languageserver/src/grammar/SysML.langium) | grammar rule type |
| [`syside-languageserver/src/grammar/SysML.interfaces.langium`](../../../packages/syside-languageserver/src/grammar/SysML.interfaces.langium) | AST interface |
| [`syside-languageserver/src/model/SysML/flow-connection-definition.ts`](../../../packages/syside-languageserver/src/model/SysML/flow-connection-definition.ts) | dedicated model class |
| [`syside-languageserver/src/model/SysML/flow-connection-usage.ts`](../../../packages/syside-languageserver/src/model/SysML/flow-connection-usage.ts) | dedicated model class |
| [`syside-languageserver/src/model/SysML/succession-flow-connection-usage.ts`](../../../packages/syside-languageserver/src/model/SysML/succession-flow-connection-usage.ts) | dedicated model class |
| [`syside-languageserver/src/model/printer/connectors.ts`](../../../packages/syside-languageserver/src/model/printer/connectors.ts) | printer handler |
| [`syside-languageserver/src/model/printer/print.ts`](../../../packages/syside-languageserver/src/model/printer/print.ts) | dispatch |
| [`syside-languageserver/src/services/shared/workspace/metamodel-builder.ts`](../../../packages/syside-languageserver/src/services/shared/workspace/metamodel-builder.ts) | metamodel registration |
| [`syside-languageserver/src/services/validation/sysml-validator.ts`](../../../packages/syside-languageserver/src/services/validation/sysml-validator.ts) | validator references |
| (`generated/` directory + tests under `__tests__/` + compiled `lib/`) | follow-on |

**Status: missing.** This is a non-trivial mechanical rename touching **AST, grammar, model classes (file rename + class rename), printer, metamodel-builder, validator**. The class names (`FlowConnectionUsage` etc.) presumably mirror Langium-generated AST node names from `SysML.interfaces.langium`; the AST changes drive the rest.

**Question for you:** the dedicated model classes have file paths that mirror their old names. After rename, do we want filenames to change too (`flow-usage.ts`, `flow-definition.ts`)? I'd say yes — files-mirror-classes is a useful invariant — but flagging since it's a wider blast radius.

## 3. `Transfer::item` → `payload`; `MessageTransfer::sentItem` → `payload`

**Upstream diff (`Transfers.kerml`):**

```
- feature item: Anything[1..*] {
- feature itemNum: Natural [1] = size(item);
+ feature payload: Anything[1..*] {
+ feature payloadNum: Natural [1] = size(payload);
- feature redefines item = sentItem;
+ (gone — sentItem retired in favor of payload)
```

**Repo:** 1 file references `Transfer::item` literally. 0 references to `currentItem` or `sentItem`. 0 references to `payload` in this sense.

**Status: missing.** Small scope, but worth checking the one referencing file actually consumes the *meaning* of `item` (some refs may be in tests or comments).

## 4. `Transfer::sourceOutput` and `targetInput` retyped `Occurrence` → `Anything`

**Upstream diff:**
```
- feature sourceOutput: Occurrence[0..*];
+ feature sourceOutput: Anything[0..*];
- feature targetInput:  Occurrence[0..*];
+ feature targetInput:  Anything[0..*];
```

**Repo:** 5 files reference `sourceOutput`, 4 reference `targetInput`. The names persist; the change is purely the typing.

**Status: partial.** The names still exist. The semantic effect (transfers can now carry non-occurrences) flows into the type-system / validator and is best evaluated in **Chunk 4 (Type system)** — listing here as a tie-point.

## 5. `Clock::currentTime` declared `var`

**Upstream diff (`Clocks.kerml`):**
```
- feature currentTime : NumericalValue[1] {
+ var feature currentTime : NumericalValue[1] {
- feature :>> currentTime : Real;
+ var feature :>> currentTime : Real;
```

**Status: depends on Chunk 1.** Cannot land until `var` is parseable (Chunk 1 item 1). Once that lands, this is a stdlib-content change handled by re-fetch.

## 6. `Performances::constructorEvaluations` added

**Upstream diff (`Performances.kerml`):**
```
+ abstract expr constructorEvaluations [0..*] nonunique subsets evaluations { ... }
```

**Repo:** 0 hits. **Status: missing.** Likely consumed by the expression evaluator when constructor expressions land (Chunk 5).

## 7. `TradeStudyObjective::fn` → `eval`

**Upstream diff (`TradeStudies.sysml`):**
```
- in calc fn : EvaluationFunction { ... }
+ in calc eval : EvaluationFunction { ... }
- require constraint { fn(selectedAlternative) == best }
+ require constraint { eval(selectedAlternative) == best }
```

**Status: missing** at the library level (handled by stdlib re-fetch). Repo code likely doesn't reference `fn` by that bare name (too generic). No targeted hit. Treat as content-only.

## 8. `Message::source`/`target` now inherited; `sourceEvent`/`targetEvent` introduced

**Where the new names live in 2026-03:** `sysml.library/Systems Library/Flows.sysml` (the renamed-from-FlowConnections file).

**Repo:** 0 hits for `sourceEvent` or `targetEvent`.

**Status: missing.** Combined with item 9 (transfers/messageTransfers reclassification) this represents a meaningful semantic shift that needs Chunk 4 (Type system) attention.

## 9. `transfers`/`messageTransfers` reclassified flows → steps

**Status: unclear / consult-Armin.** The release notes describe this as a metamodel reclassification. Whether the repo *currently* treats them as flows (in scoping or validation) requires looking at the validator and metamodel-builder. Logging here; will revisit in Chunk 4 / Chunk 6.

## 10–12. Library content additions (`Action::assignments::target`, `TransitionPerformance::accept` rework, `SpatialItem` sub-elements)

These are stdlib-content additions wholly inside the library files. They land via the stdlib re-fetch. No code changes required *in the language server itself* unless the repo hardcodes references. We've confirmed 0 hits on the new names — so the repo neither consumes nor obstructs them.

**Status:**
- 10 (Action::assignments::target): **content-only**, no code change.
- 11 (TransitionPerformance::accept): **content-only at the library**; semantic ramifications tie to Chunk 1 item 8 (accept-body receiver redefinition) — already flagged for Chunk 3/4.
- 12 (SpatialItem additions): **content-only**, no code change.

## 13. Library reshuffles for diamond-collision (2025-07)

The diamond-name-collision fixes affect many files: `Occurrences.kerml`, `Objects.kerml`, `Transfers.kerml`, `VectorFunctions.kerml`, `Actions.sysml`, `Connections.sysml`, `Flows.sysml`, `Items.sysml`, `Metadata.sysml`, `Parts.sysml`, `Ports.sysml`, `Views.sysml`, `SI.sysml`, `USCustomaryUnits.sysml`, and others.

**Status: content-only at upgrade time.** These are stdlib edits, replaced wholesale on stdlib re-fetch. **However**, they introduce *new* validation warnings (digest §Breaking changes — "new distinguishability warnings on diamond inheritance"), which is a Chunk 6 (Validation) concern.

## 14. `.kpar` archives (2025-11)

**Upstream `2026-03`:** a separate top-level `sysml.library.kpar/` tree containing 10 `.kpar` archive files (e.g. `Kernel_Semantic_Library-1.0.0.kpar`). The `sysml.library/` source tree is unchanged in shape.

**Repo:** the clone script fetches by commit and the language server consumes source `.kerml`/`.sysml` files via [`syside-base/src/stdlib.ts`](../../../packages/syside-base/src/stdlib.ts).

**Status: N/A unless we choose to switch ingestion.** No change needed for the 2026-03 upgrade. Worth flagging for a future strategic decision (Chunk 5 / out-of-scope here): does this repo eventually want to load `.kpar` archives instead of source files? Faster startup, but additional unpack logic.

---

## 🚩 Prominent finding: bundled stdlib has load-bearing fork customizations

The bundled `~/work/sensmetry/sysml-2ls/SysML-v2-Release/sysml.library/` (sourced from the deprecated `arminzavada/SysML-v2-Release` fork) **differs from upstream `2024-12`** in at least the following library files (representative sample, not exhaustive — full list available via `git diff` per file):

```
sysml.library/Domain Libraries/Analysis/SampledFunctions.sysml
sysml.library/Domain Libraries/Analysis/TradeStudies.sysml
sysml.library/Domain Libraries/Cause and Effect/CauseAndEffect.sysml
sysml.library/Domain Libraries/Geometry/ShapeItems.sysml
sysml.library/Domain Libraries/Geometry/SpatialItems.sysml
sysml.library/Domain Libraries/Metadata/RiskMetadata.sysml
sysml.library/Domain Libraries/Quantities and Units/ISQSpaceTime.sysml
sysml.library/Domain Libraries/Quantities and Units/Quantities.sysml
sysml.library/Domain Libraries/Quantities and Units/Time.sysml
sysml.library/Kernel Libraries/Kernel Function Library/CollectionFunctions.kerml
sysml.library/Kernel Libraries/Kernel Function Library/ControlFunctions.kerml
sysml.library/Kernel Libraries/Kernel Function Library/NumericalFunctions.kerml
sysml.library/Kernel Libraries/Kernel Function Library/RationalFunctions.kerml
sysml.library/Kernel Libraries/Kernel Function Library/SequenceFunctions.kerml
sysml.library/Kernel Libraries/Kernel Function Library/VectorFunctions.kerml
sysml.library/Kernel Libraries/Kernel Semantic Library/Objects.kerml
sysml.library/Kernel Libraries/Kernel Semantic Library/Occurrences.kerml
sysml.library/Kernel Libraries/Kernel Semantic Library/Performances.kerml
sysml.library/Kernel Libraries/Kernel Semantic Library/StatePerformances.kerml
sysml.library/Systems Library/Actions.sysml
```

**Sample customizations (not stylistic — substantive):**

`TradeStudies.sysml`:
```
- in ref :>> alternatives;
+ in ref :>> alternatives: ScalarValue;
```
The fork *adds* a type ascription that the upstream does not have.

`VectorFunctions.kerml`:
```
+ private import CollectionFunctions::'#';
- :>> dimension = size(components);
+ :>> dimension = size(components) as Positive;
- cartesianZeroVector#(3);
+ cartesianZeroVector#(3) as CartesianThreeVectorValue;
- (1..w.dimension)->collect{in i : Positive; v#(i) + w#(i)}
+ (1..w.dimension)->collect{in i : Positive; v->'#'(i) + w->'#'(i)}
```
Multiple changes — added explicit `as` casts, an explicit `private import`, and rewritten indexing syntax (`v#(i)` → `v->'#'(i)`). These look like **workarounds for limitations in this language server's name resolution / type inference / parser** — not stylistic edits.

**Implication for the upgrade:** when the clone script is repointed to upstream and we re-fetch at `2026-03`, these patches go away. Two possibilities for what happens next:
1. **The original limitations have been fixed in this language server in the meantime** (during the revival work or pre-archive). Re-fetching restores upstream and everything works. Best case.
2. **The limitations still exist.** Re-fetching surfaces parse/type errors in the bundled stdlib that the patches were silently masking. We'd then either fix the language server (preferred per the conformance rule) or accept the breakage as the next concrete language-server bug list.

**Recommended action before running the upgrade:**
- Catalogue the fork patches systematically (a per-file diff dump committed alongside this report).
- For each, classify whether the underlying issue is plausibly fixed in `2026-03` upstream (e.g. the implicit-import patches in VectorFunctions may be moot if scoping has been fixed) or remains language-server work.
- The upgrade-checklist already says the upgrade should repoint to upstream and wipe the fork; no special pre-work changes that, but **the wipe may produce a list of new errors**, which is actually useful diagnostic information.

I have **not** done the systematic catalogue — that's a discrete piece of work I'd estimate at 1 focused session.

---

## Repo-coupling map (for the porting work)

When the renames land, these are the files (not exhaustive — based on grep) that touch old names:

```
# FlowConnection-family hot files
packages/syside-base/src/stdlib.ts                                           (path string)
packages/syside-languageserver/src/grammar/SysML.langium                     (grammar rule)
packages/syside-languageserver/src/grammar/SysML.interfaces.langium          (AST iface)
packages/syside-languageserver/src/model/SysML/flow-connection-definition.ts (model class)
packages/syside-languageserver/src/model/SysML/flow-connection-usage.ts      (model class)
packages/syside-languageserver/src/model/SysML/succession-flow-connection-usage.ts (model class)
packages/syside-languageserver/src/model/printer/connectors.ts               (printer)
packages/syside-languageserver/src/model/printer/print.ts                    (dispatch)
packages/syside-languageserver/src/services/shared/workspace/metamodel-builder.ts (registration)
packages/syside-languageserver/src/services/validation/sysml-validator.ts    (validator)
+ generated/ + tests/ + compiled lib/

# Transfer::item (1 file)
(grep target — check whether semantic or just incidental)

# sourceOutput/targetInput (5/4 files)
(continues to exist; only retyping changed)

# stdlib registry — central
packages/syside-base/src/stdlib.ts (line 30 specifically renames file path)
```

---

## Open questions for you

1. **Fork-customization disposition** (the 🚩 above) — produce a systematic per-file catalogue of fork patches?
2. **Model-class file renaming** — when `FlowConnectionUsage` becomes `FlowUsage`, do filenames follow?
3. **`.kpar` ingestion** — on roadmap or out of scope?
4. **Item 9 (`transfers`/`messageTransfers` reclassification)** — investigate before Chunk 4 or wait?

## Resolved (2026-05-04)

1. **Yes — produce the catalogue.** It will inform a strategic choice between three options: (a) fix the LSP to obviate the patches, (b) maintain `.patch` files re-applied by the clone script, or (c) handle each upgrade by hand. See [`02-library-builtins-fork-patches.md`](02-library-builtins-fork-patches.md).
2. **Yes — filenames follow class renames.** `flow-connection-usage.ts` → `flow-usage.ts`, etc.
3. **Out of scope.** No real benefit for this repo today; revisit only if performance becomes an issue.
4. **Defer to Chunk 4.** Per Armin: pilot changes typically ripple through the EMF metamodel, and we should not assume textual-only changes are no-ops here — but also no need to special-case item 9 ahead of the systematic Chunk 4 pass.

## Items not yet checked

- Whether the repo's hardcoded library-element references include any I missed beyond the digest list (e.g., implicit imports of stdlib types in scoping/typing code). A broader sweep would be appropriate before implementation work begins, but is outside the scope of this chunk.
- Whether the fork customizations include *additions* to library files (new abstract features added) vs only *modifications* to existing features. The diffs I sampled show modifications; I have not exhaustively confirmed there are no additions.
