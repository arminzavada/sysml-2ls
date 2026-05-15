# Chunk 4 — Type system (2026-03 upgrade)

> **Per-upgrade artifact, exploration phase.** Cross-reference of type-system items from [`release-notes-digest.md`](release-notes-digest.md) against this repo.
>
> **Calibration note:** type-system semantics in SysML v2 are dense and partially documented in the spec PDFs rather than the release notes. This chunk marks several items as `unclear` or `needs-deeper-trace` rather than over-claiming — depth here will need Armin's review and likely a prototype-phase pass before the planning phase converges.
>
> **Scope split with Chunk 6:** items that change *typing relations* (what types features have, what is typed by what) live here. Items that fire as *validation diagnostics* on otherwise-typed models live in Chunk 6. Where the digest's "Type system" group includes both kinds, the validation half is forwarded to Chunk 6 and the typing half stays here. The 2026-01 batch of new validation constraints is entirely Chunk 6.

## Summary

| # | Item | Status | Confidence |
|---|------|--------|------------|
| 1 | Association/connection end features restricted to a single type (2025-02) | **needs-deeper-trace** | structurally-clear |
| 2 | End features can be redefined only by other end features (2025-02) | **likely missing** — `validateEndFeatureMembershipIsEnd` is explicitly commented out | structurally-clear |
| 3 | Var-feature semantics (KerML `var` snapshot domain; SysML auto-time-varying) (2025-02) | **missing** — repo has no time-domain awareness at all | understood |
| 4 | Time slice / snapshot auto-typing removed (2025-02) | **missing** at runtime | structurally-clear |
| 5 | SysML usages must be typed by definitions (2025-10) | **missing** — `ref x : a, A` where `a` is a usage is not currently rejected | structurally-clear |
| 6 | Item-usage validation softening — old "ItemUsage typed by ItemDef" rule removed (2025-11) | **partially mismatched** — repo has `validateItemUsageTyping`, but per the digest the *over-strict* form was removed | needs-deeper-trace |
| 7 | KERML11-191 (`deriveTypeFeatureMembership`) (2026-03) | **missing concept** — repo has no `TypeFeatureMembership` | structurally-clear |
| 8 | (carry-forward Chunk 2 §9) `transfers`/`messageTransfers` reclassified flows → steps | **needs-deeper-trace** | structurally-clear |
| 9 | (carry-forward Chunk 2 fork patches §B) Type-inference gaps requiring `as Type`/`: Type` patches | **multiple gaps** — see below | structurally-clear |

---

## 1. End-feature single-type restriction *(2025-02)*

**Pilot release-notes claim:** an end feature of an association/connection may be typed by at most one type.

**Repo:**
- [`packages/syside-languageserver/src/model/KerML/connector.ts:55-58`](../../../packages/syside-languageserver/src/model/KerML/connector.ts) holds ends in `_ends: EndFeatureMembershipMeta[]` — the *number* of ends is enforced by validators (`validateBindingConnectorIsBinary`, `validateRelatedTypes`), but the *number of types per end* is not visibly checked.
- The grammar's end feature has the same shape as a regular feature for type lists, so `end p : A, B` would parse.

**Status: needs-deeper-trace.** The constraint is missing in name (no `validateEndFeatureSingleTyping` or similar found by grep). The validation needs to be added; whether it should be at the validator layer or grammar layer is an open question (the pilot enforces it via spec-derived constraints, which historically map to validator code).

## 2. End-features-redefined-only-by-end-features *(2025-02)*

**Pilot release-notes claim:** an end feature cannot be redefined by a non-end feature, and vice versa.

**Repo:** [`packages/syside-languageserver/src/services/validation/kerml-validator.ts:306`](../../../packages/syside-languageserver/src/services/validation/kerml-validator.ts) explicitly comments out the relevant rule:

```typescript
// validateEndFeatureMembershipIsEnd - model implicitly ensures this, no
```

The "model implicitly ensures this" claim was likely true under the pre-2025-02 grammar where `end` was tightly coupled to its position; with 2025-02 grammar changes (Chunk 1 items 6 and 9), it may no longer hold. Worth re-checking once the grammar work lands.

**Status: likely missing.** Re-evaluate after Chunk 1 grammar implementation.

## 3. Var-feature semantics *(2025-02)*

**Pilot release-notes claim:** a KerML `var` feature has its featuring domain set to *snapshots* (i.e. its value is a function of time). In SysML, time-varying semantics is auto-applied to most features unless explicitly excluded (time slices, snapshots, bindings, successions, composite subactions).

**Repo:** zero hits for `TimeSlice`, `Snapshot`, `currentTime`, `snapshotOf`, `timeSliceOf` outside of test data and printer snapshots. The repo has **no time-domain awareness** in production code. No `featuringDomain` computation responsive to `isVariable`/`var`.

**Status: missing.** Implementing this requires:
- AST flag (`isVariable`) — produced by Chunk 1 grammar work.
- A `FeatureMeta`-level computation of "featuring domain" — currently absent.
- Either a runtime model that distinguishes time-snapshots from time-slices, or a static treatment that's enough for editor/diagnostics needs.

The static treatment is probably the right scope for an editor (no need to actually evaluate over time); but determining what the static treatment should compute (e.g. just propagate the flag, or also propagate the featuring-domain inference into typing decisions) needs spec consultation.

## 4. Time slice / snapshot auto-typing removed *(2025-02)*

**Pilot release-notes claim:** time slices and snapshots are no longer auto-typed by their individual definition; standalone time-slice/snapshot declarations are no longer allowed.

**Repo:** see item 3 — no time-domain awareness. The constraint to "no longer allow standalone declarations" therefore neither applies (the repo doesn't recognize them) nor can it be tested against models.

**Status: missing at runtime; may be moot once item 3's broader work lands.** Library content that uses time slices / snapshots will arrive via the stdlib re-fetch.

## 5. SysML usages typed only by definitions *(2025-10)*

**Pilot release-notes claim:** a SysML usage must be typed by a Definition (or a KerML Classifier when context demands it). Specifically: `ref x : a, A` where `a` is a usage and `A` is a definition is now an error.

**Repo:** [`sysml-validator.ts`](../../../packages/syside-languageserver/src/services/validation/sysml-validator.ts) has typing validators for several usage kinds:

```typescript
// sysml-validator.ts:292-301
@validateSysML(ast.ItemUsage, [ast.PartUsage, ast.PortUsage, ast.MetadataUsage])
validateItemUsageTyping(node: ItemUsageMeta, accept: ModelValidationAcceptor): void {
    this.validateAllTypings(
        node, ast.Structure, accept,
        "ItemUsage must be typed by Structures only.",
        { code: "validateItemUsageTyping" }
    );
}
```

But these are kind-specific (ItemUsage, PartUsage, etc.) — they verify the *type kind*. The 2025-10 rule is more general: regardless of usage kind, types must be **definitions**, not usages. Spot search of the validator for "Definition" / "Usage" cross-checks turned up `validateUsageVariationSpecialization` (variation-related, not the same).

**Status: missing.** A `validateUsageTypedByDefinition` (or whatever the spec name is) would need to be added — verifying every type reference in a usage's type list resolves to a Definition, not another Usage.

## 6. Item-usage validation softening *(2025-11)*

**Pilot release-notes claim:** the validation that an `ItemUsage` must be typed by an `ItemDefinition` was overly strict and was *removed*.

**Repo:** [`sysml-validator.ts:293`](../../../packages/syside-languageserver/src/services/validation/sysml-validator.ts) currently enforces "ItemUsage must be typed by Structures only" (`validateItemUsageTyping`). This is *not* the rule the digest said was removed — the removed rule was about `ItemDefinition` specifically, while the repo's rule is about `Structure`.

These two constraints are related (ItemDefinition specializes Structure) but not identical. **Status: needs-deeper-trace.** The pilot at 2026-03 may still enforce the structural-typing constraint while having softened the definition-typing constraint; need to read pilot's `validateItemUsageTyping` (or equivalent) to compare.

## 7. KERML11-191 — `deriveTypeFeatureMembership` *(2026-03)*

**Pilot release-notes claim:** issue KERML11-191 about `deriveTypeFeatureMembership` resolved.

**Repo:** zero hits for `TypeFeatureMembership` anywhere in `packages/syside-languageserver/src/`. The concept does not exist in this repo's metamodel.

**Status: missing concept.** Without the concept implemented, the fix is moot; introducing the concept brings whatever computation `deriveTypeFeatureMembership` does. The release notes do not describe what the issue was — would need to consult the pilot's commit history or the OMG issue tracker. Recording as a known unknown.

## 8. `transfers`/`messageTransfers` reclassified flows → steps *(carry-forward Chunk 2 §9)*

**Pilot release-notes claim:** `transfers` and `messageTransfers` are now classified as **steps**, not flows.

**Repo:** the reclassification lives at the metamodel/library level. Strong repo coupling to old terminology was already documented in [`02-library-builtins.md`](02-library-builtins.md) (`FlowConnection*` family, ~25 files). Repo's `transfers` consumption is via the stdlib content, not via dedicated TS code, but the typing implications for connectors that previously referenced `transfers` as flows need re-examination once the stdlib re-fetch lands.

**Status: needs-deeper-trace** in this chunk — the AST/code impact is in the FlowConnection-family classes (already enumerated in Chunk 2), but the *semantic* impact of "is a step" vs "is a flow" propagating through scoping/typing isn't traced here.

## 9. Type-inference gaps from Chunk 2 fork patches *(carry-forward Chunk 2 §B)*

The fork-patch catalogue ([`02-library-builtins-fork-patches.md`](02-library-builtins-fork-patches.md)) documented Category B "type ascription / cast addition" patches that work around the LSP's type inference. Examples from there:

- `:>> alternatives` not inferring `: ScalarValue` → fork adds explicit ascription.
- `dispatchScope default thisPerformance` not inferring `: Performance` → fork adds explicit `: Performance`.
- `size(components)` not inferring `: Positive` → fork adds `as Positive`.
- `runToCompletionScope` not inferring usable-as `Performance` → fork adds `as Performance`.

Each represents a specific type-inference rule the repo doesn't implement:

| Patch family | Inference gap |
|--------------|---------------|
| Defaulted feature → inferred type from default | Default-value type not propagated to feature type |
| `size(...)` returning constrained natural | Function return-type narrowing for `size(X)` to `Positive` not encoded |
| Implicit subtyping of nested classifier types | `runToCompletionScope` (`Performance`-typed by inheritance) not being implicitly usable where `Performance` expected |
| Implicit-redefinition feature ascription | Redefining feature inheriting type from redefined feature |

**Status: structurally-clear, multiple specific gaps.** Each is a small fix in isolation, but together they're a meaningful piece of type-inference work. **This is the natural prototype target** when planning moves from exploration to prototype: pick one of these (e.g. function return-type narrowing for `size`) and implement it end-to-end to validate the broader approach.

---

## What I have *not* done

- **Read the SysML v2 spec PDFs** for items 1, 2, 5 to compare exact wording. The spec PDFs are at `~/work/systems-modeling/SysML-v2-Release/doc/` (per memory); for the items where the digest is example-driven, the spec is the authoritative source. I did not consult it in this chunk; flagged for later spec-cross-reference.
- **Traced the `validateAllTypings` helper** that several validators call — its behavior determines what each typing validator actually checks. Out of scope for this chunk's depth.
- **Verified items 7, 8 against pilot source.** Both are concepts I noted as missing or partially mismatched, but I haven't confirmed the pilot's exact form.
- **Probed any typing case behaviorally** the way Chunk 3 probed redefinition resolution. A type-inference probe (e.g. `feature x default 5; feature y :>> x;` → does y infer Integer?) would be useful but is in the same family as the prototype-phase work.

## Open questions for Armin

1. **Item 6 (item-usage validation softening):** is the repo's `validateItemUsageTyping` ("typed by Structures only") still correct in 2026-03, or did the 2025-11 softening also touch this rule?
2. **Item 7 (KERML11-191):** do you remember the substance of this issue?
3. **Item 3 (var-feature semantics):** propagate flag only, or compute featuring-domain implications?
4. **Item 9 (type-inference gaps):** which family is the highest-priority prototype target?

## Resolved (2026-05-04)

1. **Keep the stricter rule, document it.** Per the new [stricter-than-pilot-OK-if-documented](../../../) principle, our `validateItemUsageTyping` rejecting non-Structure types is acceptable even if the pilot/spec is now softer — but the deviation must be documented (likely in `docs/known_limitations.md`). Status: **partial → document and keep**.
2. **Mostly a library change.** Per Armin's recall: "Something's type is a feature defined using a membership, which could be derived in some cases." So `TypeFeatureMembership` is a small derive-able artifact at the library/metamodel level. Detailed substance still uncertain; can be settled by reading the pilot's commit for KERML11-191 if it surfaces a real implementation gap. Status remains **missing concept**, but scope is small.
3. **Propagate the flag, don't compute time-domain.** Per the [authoring-not-execution](../../../) principle: this tool is for authoring, not runtime simulation. The pilot likely doesn't do much here either. Just propagate `isVariable` through redefinitions in the AST and stop. Status: **scope reduced to flag propagation**.
4. **Default-value type propagation** is the proposed prototype target — pending Armin's go-ahead on proposal C in the planning discussion.
