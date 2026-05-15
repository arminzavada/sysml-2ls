# 2026-03 upgrade — plan

> **Per-upgrade artifact, planning phase.** Distills the [exploration synthesis](00-exploration-synthesis.md) and Armin's strategic answers into an ordered roadmap. The plan is reviewable and can be redirected; it does not yet represent committed implementation.
>
> **Date:** 2026-05-04. **Target tag:** pilot `2026-03` (commit `3a1be5b87`), `SysML-v2-Release` `2026-03` (commit `cd99f7ca7`).
>
> **Adheres to:** [conformance-over-compatibility](../../../) hard rule, with the [stricter-than-pilot is OK if documented](../../../) refinement; [authoring-not-execution](../../../) scope rule; [design-thinking phases](../../../) sequencing.

## What this plan is

A reviewable ordering of the work the [exploration deliverables](00-exploration-synthesis.md) identified, with concrete decisions on each strategic choice, a first-prototype spec, and an explicit out-of-scope list. The next phase is **prototype** — small targeted changes that validate this plan's assumptions; if those changes show the plan is wrong, the plan changes before implementation begins.

## Resolved strategic decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Fork-patch disposition | **Drop the 2 contradiction patches** ([Cat. F, G](02-library-builtins-fork-patches.md)) immediately. **Convert the rest to versioned `.patch` files** applied by [`clone-sysml-release.mjs`](../../../packages/syside-languageserver/scripts/clone-sysml-release.mjs). **Each patch becomes a tracked LSP bug**, retired when the underlying gap is fixed. **Long-term goal: zero patches.** |
| B | Sequencing | **Grammar work first** (critical path), **multi-spec scoping fix in parallel** once a track is freed up, **then type-inference cluster**, **then validations as fill-in**. Prerequisite phase: **Langium upgrade** before any of the above. |
| C | First prototype | **Default-value type propagation** — small, isolated, validates workflow without grammar surgery. |
| D | Model API design | **Defer until after the migration**. Couple the API design with the Semantifyr-integration update; the API surface is informed by the post-migration shape of scoping, typing, and evaluator. |
| E | Validation philosophy | **Mechanical translation of all 13** 2026-01 validations, **prioritized by what the standard library needs to parse cleanly**. Use stdlib parseability as the forcing function for sequencing, not user-visible-diagnostic value or spec order. |
| Pkg | Langium upgrade | **Required prerequisite phase** (current `~1.2.0`, multiple majors behind). Done before SysML grammar work to derisk it. |
| Pkg | pnpm setup | **Defer to post-migration cleanup**. "Seems too complex" is a vague concern; address only if it actively impedes migration work. |

## Phased roadmap

Five phases. Each ends with an explicit success criterion that gates moving to the next.

### Phase 0 — Langium upgrade (prerequisite)

**Revised 2026-05-04 after [P2](prototypes/02-langium-1-to-2-hop.md).** The 1→2 hop is **not mechanical**. Three findings that change Phase 0's shape:

1. **Langium 2.0+ is ESM-only.** The repo is workspace-wide CJS. ~398 of 426 TS files have relative imports that will need module-system attention. ESM migration is a sub-prerequisite for any Langium upgrade past 1.x.
2. **`createParser` removed from public API.** The repo's `SysMLParser` subclasses `LangiumParser` and bootstraps via this symbol; 2.x exposes only `createLangiumParser`/`prepareLangiumParser` with hard-coded base classes. Requires a parser-wiring refactor, not a rename.
3. **API surface reshuffles** (43 TS errors across 12 files after mechanical fixes): `BuildOptions.validationChecks → validation: ValidationOptions`, `IndexManager.isAffected` signature change, `CompletionContext` reshape, `ValidationRegistry` rename + tightened generics, stricter `AstNode.$container` nullability, langium-cli's new `$type` discriminated unions.

**Realistic effort:** **2–3 weeks for the full 1→4 path**, not "one focused week" as the audit estimated. Largest single piece is the workspace ESM migration; the per-hop work after that is ~2 working days each.

**Why first:** the SysML grammar work in Phase 1 may rely on newer Langium features, and conflating Langium-upgrade breakage with SysML-grammar-upgrade breakage would be expensive. Doing Langium upgrade as a clean separate change isolates failure modes.

**Work items:**
1. Determine target Langium major (latest stable). Read its migration guide for breaking changes.
2. Update `langium` and related deps in [`packages/syside-languageserver/package.json`](../../../packages/syside-languageserver/package.json).
3. Apply migration steps from the Langium changelog (grammar syntax changes, API changes, scope-provider API changes).
4. Regenerate AST from `.langium` grammar files; resolve any compilation failures.
5. Run existing test suite; resolve regressions.
6. Update [`docs/langium.md`](../../langium.md) with the new version.

**Success criteria:**
- Test suite green on Langium `4.2.x`, no SysML-content changes.
- `pnpm audit` reports **0 critical vulnerabilities** outstanding.
- Heisenbug pre-migration manifestation documented for retrospective comparison ([`pre-migration-audit.md` §3](../pre-migration-audit.md#3-heisenbug-characterization)).

**Approach:** done in **four sub-phases**, with green tests between each:

- **Phase 0a — Workspace ESM migration.** Convert `tsconfig`, Jest config, build outputs, and import style across all 6 workspace packages to ESM. Stay on Langium 1.2 throughout this phase. **Largest single chunk; ~1 week.**
- **Phase 0b — Langium 1.2 → 2.x hop.** Now feasible. Includes the `createParser` refactor and the 43-error API surface translation. ~2 days.
- **Phase 0c — Langium 2.x → 3.x hop.** Same shape, smaller. ~2 days.
- **Phase 0d — Langium 3.x → 4.x hop.** ~2 days. Confirmed breaking changes that will touch this repo at known steps ([`pre-migration-audit.md` §1](../pre-migration-audit.md#1-langium-upgrade-target)):
- `References` typed as `Reference | MultiReference` — affects [`linker.ts`](../../../packages/syside-languageserver/src/services/references/linker.ts).
- `findDeclaration` → `findDeclarations` (returns array).
- AST type accessor change: `<typeName>` → `<typeName>.$type`. Mechanical sweep.
- Grammar/rule-name uniqueness rules.

**Effort:** **one focused week**, not "small-to-medium" — the multi-major hop and the sweep of every `langium`-importing file across ~400 TS files is real work. Don't underbudget.

### Phase 1 — Stdlib pin migration + fork-patch infrastructure

**Revised 2026-05-04 after [P1a](prototypes/01a-reclassify-patches.md).** Scope dramatically reduced: only **1 patch** is actually load-bearing; **23 are moot** (drop at re-fetch); **2 contradict upstream** (drop on principle).

**Why before grammar work:** lets us actually load `2026-03` library content during grammar development. Without it, Phase 2 grammar testing has nothing realistic to parse.

**Work items:**

1. Repoint [`clone-sysml-release.mjs`](../../../packages/syside-languageserver/scripts/clone-sysml-release.mjs) to upstream `Systems-Modeling/SysML-v2-Release` at tag `2026-03` (commit `cd99f7ca7`).
2. Build a `patches/` directory adjacent to the script.
3. Convert the **one** load-bearing patch (`Occurrences.kerml`, end-keyword cross-feature participant) to a `.patch` file with a header explaining (a) what it works around (`checkFeatureCrossingSpecialization` firing falsely), (b) the issue ticket tracking the LSP fix.
4. Modify the clone script to apply patches after `git checkout`.
5. Re-run the script; verify the patched library is what the language server consumes.
6. File **one** LSP issue for `checkFeatureCrossingSpecialization` false-firing on end-feature cross-specialization patterns.

**Success criteria:**

- Existing test suite still passes against the new library + the one patch.
- The 23 moot and 2 contradicts patches are not re-applied — confirmed by `pnpm test` running clean with only the one patch in `patches/`.

**Effort:** **small**. ~half a day. Down from "medium" pre-P1a.

### Phase 2 — Grammar + AST (Chunk 1 work)

**Work items, in dependency order:**
1. **AST interfaces** ([`KerML.interfaces.langium`](../../../packages/syside-languageserver/src/grammar/KerML.interfaces.langium), [`SysML.interfaces.langium`](../../../packages/syside-languageserver/src/grammar/SysML.interfaces.langium)): rename `isReadOnly?` → `isVariable?` / `isConstant?`; add `isGlobal?` to `ElementReference` (for `$::`); other Chunk 1 attribute shape changes. **Hard cutover** — no `isReadOnly` alias.
2. **Grammar files** ([`KerML.langium`](../../../packages/syside-languageserver/src/grammar/KerML.langium), [`KerML.expressions.langium`](../../../packages/syside-languageserver/src/grammar/KerML.expressions.langium), [`SysML.langium`](../../../packages/syside-languageserver/src/grammar/SysML.langium)): all 10 Chunk 1 items.
   - `var`, `const`, `constant` (drop `readonly`).
   - `new` constructor expression.
   - `$::` global qualifier (`GlobalQualification` rule + flag in `QualifiedReferenceChain`).
   - `derived` ordering constraint at parser layer (existing models with bad ordering will fail to parse — accepted).
   - `const` on end features (`EndFeaturePrefix` with optional `'const'`).
   - Send/accept body forms: full `ActionBody` form, empty-payload-with-receiver form.
   - Control nodes (`fork`/`join`/`decide`/`merge`) with full `ActionBody`.
3. **AST regeneration**, then sweep TypeScript references to `isReadOnly` etc. — they all need updating.
4. **Model classes** (`packages/syside-languageserver/src/model/`): rename `flow-connection-*` files to `flow-*` per the FlowConnection→Flow rename; update class names; update file references. Combine with grammar/AST work since they share AST renames.
5. **Update existing tests** that exercise `readonly` etc.

**Success criteria:**
- Grammar-level tests pass for new keywords.
- Existing tests pass after rename sweep.
- `$::Foo`-style references parse into the right AST shape with `isGlobal` set.
- The 7 parameterized skipped tests in [`implicits.test.ts`](../../../packages/syside-languageserver/src/__tests__/kerml/kernel/implicits.test.ts) un-skipped and updated to match pilot behavior at `2026-03`.

**Effort:** medium-to-large — grammar items themselves are scoped, the rename sweep touches many files.

**Out of scope for Phase 2 (deferred to Phase 3):** semantic effects of new keywords (`var` time-domain, `protected` semantics, etc.). Phase 2 is parser-and-AST only.

### Phase 3 — Scoping fix + type-inference cluster

These two can run in parallel once Phase 2 lands. Both depend on Phase 2; neither depends on the other.

**Track 3a — Multi-specialization scoping (Chunk 3 items 3, 4, 5):**
1. Implement the pilot's `gen()` algorithm in this repo's scope provider per [`03a-multi-spec-resolution-pilot.md`](03a-multi-spec-resolution-pilot.md):
   - Traverse all owned specializations even after a match.
   - Propagate a `redefined` accumulator into the inheritance walk.
   - Tie-break in `addName`-equivalent: replace when the new feature redefines the existing one.
2. Implement the `isRedefinition` short-circuit: when resolving a redefinition target, route the first-segment lookup through `gen` (inherited), not `owned` (self).
3. Implement `$::` global resolution: a library-only sub-scope (filter `globalScope` by `isStandardElement`).
4. Convert [`probe-redef-target-resolution.test.ts`](../../../packages/syside-languageserver/src/__tests__/kerml/core/probe-redef-target-resolution.test.ts) probes 1–3 from logging-only to assertion-based regression tests.
5. As patches' underlying issues are fixed, retire them from `patches/`.

**Revised 2026-05-04 after [P1a](prototypes/01a-reclassify-patches.md).** Diamond patches turned out to be already moot — that benefit has been collected. Phase 3a now targets specifically Probe 2's still-failing case and the accept-body receiver redefinition.

**Success criteria:**

- Probe 2 in [`probe-redef-target-resolution.test.ts`](../../../packages/syside-languageserver/src/__tests__/kerml/core/probe-redef-target-resolution.test.ts) passes with `resolvedQN === 'A::X::y'`.
- **Heisenbug** ([`pre-migration-audit.md` §3](../pre-migration-audit.md#3-heisenbug-characterization)) verified either *cleared* (best case) or *shifted with a documented residual* (acceptable; recorded for separate work).

**Track 3b — Type-inference cluster (Chunk 4 §9, prototype-first):**
1. **First prototype: default-value type propagation** (see "First prototype" below).
2. After prototype validates the approach, fan out to other Cat. B inference rules:
   - `size(...)` return-type narrowing to `Positive`.
   - Implicit subtyping inference for redefinition-inherited types.
   - Nested-type implicit subtyping (`runToCompletionScope` as `Performance`).

**Success criterion:** Each rule retires its corresponding fork patch.

**Effort:** Track 3a is the largest single piece of work in the migration. Track 3b is a series of smaller pieces.

### Phase 4 — Validations + spec-cross-reference items

**Track 4a — 13 missing 2026-01 validations (Chunk 6):**
1. Sequence by **what the standard library needs to parse cleanly** — load the library, see which validations would fire if enabled, and start with those. Then validations relevant to common user patterns. Then the rest.
2. For each of the 13: read the spec predicate, write the validator, add tests against representative models, retire any "implicitly ensured by the model" comment.
3. Document any deviations where we choose to be stricter than the pilot/spec ([known_limitations.md](../../known_limitations.md)).

**Track 4b — Smaller items:**
- KERML11-191 (`deriveTypeFeatureMembership`): per Armin's recall, "mostly a library change — derive-able type-feature-membership at the metamodel level." Investigate by re-reading the pilot commit if it surfaces a real gap.
- 2025-07 corrections: `validateConnectorBinarySpecialization` semantic check vs. pilot.
- Diamond distinguishability warnings (2025-07).
- Implicit `subject`/`objective` insertion removal (2025-07).
- Filter-expression rewrite check (2026-03): verify `checkConnectorTypeFeaturing` matches pilot.

**Success criteria:**
- Standard library loads with zero validation errors.
- Existing user-model tests run without spurious diagnostics.
- The skipped `validateUsageOwningType` test in [`sysml-validator.test.ts`](../../../packages/syside-languageserver/src/services/validation/__tests__/sysml-validator.test.ts) un-skipped and passing.

### Phase 5 — Expression evaluator catch-up

Per [`05-expressions-evaluation.md`](05-expressions-evaluation.md):
1. Constructor expressions (Chunk 5 §1) — opaque-instance evaluation, no body execution.
2. `collect` / `select` evaluator entries (§2) — verify present or implement.
3. Per-function audit of `SequenceFunctions` / `CollectionFunctions` / `ControlFunctions` (§3).
4. Add `trig.ts` for trigonometric functions (§4).
5. Remove `prod`, `sum`, `excludes`, `includes`, `isEmpty`, `notEmpty`, `size`, `Length`, `Substring` from the evaluable set (§5) — per spec. Document if user-model breakage is a concern.
6. Collection equality `==`/`!=` as **function-library entries** (per Armin's resolution).

**Success criterion:** standard library expressions evaluate without runtime errors; existing tests retain coverage of the evaluable surface.

**Effort:** medium. Mostly mechanical once §3 audit is complete.

## First prototype: default-value type propagation

The smallest concrete validation of the plan-prototype-implementation workflow.

**The case:** a feature with no declared type but a default value should infer its type from the default. Example:
```kerml
feature x default 5;        // should infer x : Integer
feature y :>> x;            // should infer y : Integer (via redefinition + default)
```

The repo currently does not infer either. The fork patches in `Performances.kerml` and `TradeStudies.sysml` add explicit type ascriptions to work around the gap.

**Prototype scope:**
1. Locate where `FeatureMeta` computes its declared/effective type today.
2. Add: when no declared type is set, fall back to the default-value expression's return type.
3. Add a small test: `feature x default 5; expect(x.type).toBe(Integer)`.
4. Verify a representative fork patch (e.g. one in `Performances.kerml`) is no longer needed.
5. Document the exact algorithm and any edge cases (chained redefinitions, default-of-default, etc.).

**What "success" looks like:** the test passes; one patch from `patches/` retires; the algorithm is documented well enough that fanning out to other inference rules in Phase 3b is mechanical.

**What success doesn't require:** end-to-end editor-diagnostic improvement (that's later); covering all edge cases (we explicitly under-scope the first prototype).

If the prototype hits an unexpected wall — say, the `FeatureMeta` shape doesn't admit the change cleanly — the **plan returns to revision** before more implementation work proceeds.

## Out of scope for the 2026-03 upgrade cycle

Explicitly deferred:
- **Model API design** — couple with Semantifyr integration update, post-migration.
- **`.kpar` ingestion** — not on roadmap.
- **`pnpm` setup overhaul** — defer; address only if it actively impedes migration work.
- **Full `var` time-domain semantics** — propagate flag only per [authoring-not-execution](../../../).
- **Constructor full-body evaluation** — opaque instance is enough.
- **Sysml→kerml transformation** — never in scope; deliberate non-goal of this tool.
- **Eclipse-pilot semantic equivalence beyond authoring needs** — explicit non-goal.

## Open work tracks running after this migration

- **Semantifyr integration update**, coupled with **model API design** — kicks off after migration is complete and stable.
- **pnpm review** — if it remains a concern after migration; no current commitment.
- **Per-`patches/` retirement** — ongoing, as scoping/typing/evaluator work lands.
- **Documenting stricter-than-pilot constraints** in [`known_limitations.md`](../../known_limitations.md) — ongoing as we surface them.

## Items still pending Armin's review

- **Item 6 of Chunk 4** (item-usage typing): keep stricter rule, document in `known_limitations.md`. Awaiting confirmation that the entry should be added now or alongside the validation work.
- **Effort estimates per phase** are subjective; happy to refine if you'd prefer concrete time blocks.

## What ends with this plan

- Five strategic decisions resolved.
- Five phases defined with explicit work items, sequencing, and success criteria.
- First prototype concretely specified.
- Out-of-scope list explicit.

## What begins next

- **Prototype phase.** Start the default-value type propagation prototype. If it succeeds, scale to Phase 3b. If it surfaces a wrong assumption, this plan revises.
