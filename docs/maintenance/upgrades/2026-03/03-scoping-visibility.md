# Chunk 3 — Scoping & visibility (2026-03 upgrade)

> **Per-upgrade artifact.** Cross-reference of scoping-and-visibility items from [`release-notes-digest.md`](release-notes-digest.md) against this repo.
>
> **Calibration note:** the scoping engine is the densest, most subtle part of either codebase. Items in this chunk are flagged with one of **`understood`** (I have traced both sides and am confident), **`structurally-clear`** (the API surface and gap are clear, but the semantic depth has not been fully traced), or **`needs-deeper-trace`** (recorded as a gap with citations but the implementation work cannot be fully scoped from this analysis alone).
>
> **Method:** Repo source paths cited inline. Pilot referenced via `~/work/systems-modeling/SysML-v2-Pilot-Implementation/` at tag `2026-03`. Pilot scoping lives mostly in `org.omg.sysml/src/org/omg/sysml/delegate/invocation/Namespace_*.java`, since the Xtext layer delegates to model-class methods.

## Summary

| # | Item | Status | Confidence |
|---|------|--------|------------|
| 1 | `$::` global-scope qualifier (2025-02) | **missing at all layers** (grammar / AST / scope) | understood |
| 2 | `protected` blocked through feature chains (`p.b`) (2025-10) | **likely missing** — visibility infrastructure exists, feature-chain enforcement unclear | needs-deeper-trace |
| 3 | Name resolution under diamond/multi-specialization, redefinition targets order-independent (2025-09) | **likely incorrect** — Chunk 2 fork patches manually expand redefinitions, suggesting LSP can't resolve them | structurally-clear |
| 4 | Qualified-name redefinition target resolves through inherited element, not self (2025-11) | **needs-deeper-trace** | needs-deeper-trace |
| 5 | Accept-body redefinition of `receiver` (Chunk 1 item 8 carry-forward) | **likely missing** — same family as item 3 | structurally-clear |

## Carry-forward resolutions from earlier chunks

### Chunk 1 Q2 — how does this repo currently parse qualified names?

**Resolved.** [`packages/syside-languageserver/src/grammar/KerML.expressions.langium:163-164`](../../../packages/syside-languageserver/src/grammar/KerML.expressions.langium):

```
fragment QualifiedReferenceChain:
    parts+=[Element:Name] ('::' parts+=[Element:Name])*;

ElementReference returns ElementReference: QualifiedReferenceChain;
NamespaceReference returns NamespaceReference: QualifiedReferenceChain;
TypeReference returns TypeReference: QualifiedReferenceChain;
ClassifierReference returns ClassifierReference: QualifiedReferenceChain;
FeatureReference returns FeatureReference: QualifiedReferenceChain;
MetaclassReference returns MetaclassReference: QualifiedReferenceChain;
MembershipReference returns MembershipReference: QualifiedReferenceChain;
```

A qualified name is a list of cross-references separated by `::`. There is **no `$`-prefix handling**, no `GlobalQualification` AST property — implementing item 1 below requires a grammar change here, an AST flag on `ElementReference`, and scoping changes downstream. The Chunk 1 finding "`$::` is missing in grammar" is now triangulated: there is no place in the grammar where `$` is even a token.

---

## 1. `$::` global-scope qualifier *(status: missing at all layers)*

**Pilot (`Namespace_resolveGlobal_InvocationDelegate.java`):**
```java
@Override
public Object dynamicInvoke(InternalEObject target, EList<?> arguments) ... {
    Namespace self = (Namespace) target;
    String qualifiedName = (String) arguments.get(0);
    Element element = SysMLLibraryUtil.getLibraryElement(self, qualifiedName);
    return element.getOwningMembership();
}
```

The pilot's "global" scope is **specifically the standard library tree** (`SysMLLibraryUtil.getLibraryElement`). `$::Foo` resolves into the library, bypassing any local namespaces (and any user-defined `Foo` that would otherwise shadow a library `Foo`).

**Repo (`scope-provider.ts:87, 222`):**
```typescript
return makeLinkingScope(context.container.$meta, {}, this.indexManager.getGlobalScope());
```

The repo's `globalScope` is **all named elements indexed across all loaded documents** (see [`packages/syside-languageserver/src/services/shared/workspace/index-manager.ts:48-55`](../../../packages/syside-languageserver/src/services/shared/workspace/index-manager.ts)). This includes user documents, not just library elements.

**Gap analysis:** three layers of missing work.

| Layer | Gap |
|-------|-----|
| Grammar | `$::` not a parse-able prefix (Chunk 1 item 4). |
| AST | No `isGlobal: boolean` on `ElementReference` / `QualifiedReferenceChain`. |
| Scoping | No path to switch the resolution scope to "library only" — and "library only" is not even a distinct scope today; `globalScope` is union-of-documents. |

**Implementation impact:** Chunk 1 grammar work + an AST flag + a new "library-only" sub-scope used when the flag is set. The `index-manager.ts` would need either a separate `libraryScope` or a way to filter `globalScope` to only library-owned descriptions (which `scope-computation.ts:109-114` already tracks via `isStandardElement`).

**Confidence:** understood.

---

## 2. `protected` blocked through feature chains (2025-10) *(status: likely missing; needs-deeper-trace)*

**Pilot release-notes claim:** `p.b` where `b` is `protected` should now error, where previously only qualified-name access (e.g. `p::b`) was blocked.

**Repo:**
- Visibility infrastructure exists. [`packages/syside-languageserver/src/utils/scope-util.ts:25-32`](../../../packages/syside-languageserver/src/utils/scope-util.ts):
  ```typescript
  /** For example, to check if an `element` is visible from protected use
   *  `element.visibility <= Visibility.protected` */
  export enum Visibility { public = 0, protected = 1, private = 2 }
  ```
- The visibility filter is presumably applied during scope traversal in [`scopes.ts`](../../../packages/syside-languageserver/src/utils/scopes.ts) — but I have **not** confirmed whether the feature-chain code path (`p.b`) actually applies the same filter that the qualified-name code path does.

**The likely gap:** if the filter is applied uniformly to both `::` and `.` chains, the 2025-10 change is already conformant. If the filter is only applied to the qualified-name path (mirroring the *previous* spec behavior), then the feature-chain path leaks `protected` members and needs alignment.

**To resolve:** trace `localScope()` in `scope-provider.ts:235-246` and the scope it produces (`makeScope` with `CHILD_CONTENTS_OPTIONS`) to confirm whether visibility filtering is applied. Approximate ~30–60 minutes of code reading I have not done in this chunk.

**Confidence:** needs-deeper-trace. Recording gap with concrete next step.

---

## 3. Name resolution under diamond/multi-specialization (2025-09) *(status: likely incorrect; structurally-clear)*

**Pilot release-notes claim:** redefinition target resolution under multi-specialization is now order-independent. Previously, the order of `:>` specializations affected which inherited feature was found.

**Repo:**
- [`scopes.ts:387-433`](../../../packages/syside-languageserver/src/utils/scopes.ts) defines `TypeScope` which walks specializations and inheritance. (Detailed inspection deferred; ~614 lines of `scopes.ts` would need full read for confidence.)
- **The Chunk 2 fork-patch catalogue is the strongest signal here.** The fork manually expands implicit redefinitions in 9+ library files (Category A), e.g. `:>> length` → `:>> revolvedCurve::length, Rectangle::length`. These patches exist *because* the LSP cannot resolve the inherited feature without explicit enumeration. That class of bug is a clear instance of incorrect multi-specialization redefinition resolution.

**Gap analysis:** The repo's resolution under multi-specialization is **demonstrably incomplete** in cases where the same inherited feature reaches the redefining class through multiple paths. Whether the deficit is (a) failing to walk all specialization paths, (b) order-dependent picking, or (c) both — distinguishing these requires reading `TypeScope` end-to-end and producing a small failing-case test set.

**Implementation impact:** `TypeScope`'s specialization walk needs to be made order-independent and complete. The fork patches are documented evidence of which constructs surface the issue — a useful test harness once a fix lands.

**Confidence:** structurally-clear (the gap is real and observable; the specific algorithm to ship has not been produced).

---

## 4. Qualified-name redefinition target resolves through inherited element, not self (2025-11) *(status: needs-deeper-trace)*

**Pilot release-notes claim:** when a redefinition target is given as a qualified name (e.g. `:>> x::y`), the segment `x` is now resolved to the inherited `x` rather than to `self`'s own `x`. This affects how editor outline, validation, and Jupyter all see the redefinition target consistently.

**Repo:**
- The scope-provider's `getElementReferenceScope(container, index)` ([`scope-provider.ts:99-128`](../../../packages/syside-languageserver/src/services/references/scope-provider.ts)) uses `container.found.at(index - 1)` for segments after the first. The first segment uses `getContext(container)` or `initialScope(...)`.
- For a redefinition reference inside a feature declaration, `initialScope` is invoked. `initialScope` (lines 141-224) has a special case:
  ```typescript
  if (owner?.isAny(Specialization, Conjugation)) {
      // ...
      options.skip = owner.source();
  }
  ```
  This *skips* the source of the specialization to avoid name-resolution bugs where the declaring element has the same name as the reference. Whether this correctly implements the 2025-11 change ("resolve through inherited element rather than self") I cannot tell without tracing what `owner.source()` is and how `options.skip` propagates.

**Gap analysis:** the *infrastructure* for the right behavior may already be present (the `skip` mechanism), but whether the rule the repo implements matches the pilot's 2025-11 rule is unverified.

**To resolve:** construct a small test case that distinguishes the two behaviors (a feature whose inherited and self-owned `x` differ) and verify which the repo picks. Then either confirm conformance or list the fix.

**Confidence:** needs-deeper-trace.

---

## 5. Accept-body redefinition of `receiver` (Chunk 1 item 8 carry-forward) *(status: likely missing; structurally-clear)*

**Background:** the 2025-02 release notes describe `accept trig { in receiver = …; }` — i.e., redefining the `receiver` parameter inside the body of an accept action. From Chunk 1, this is a *semantic* affordance (no grammar change), expressed via the body's general feature-redefinition mechanism.

**The connection to scoping:** the body of an accept action is a `TypeBody` that — via redefinition — needs to find the inherited `receiver` parameter from `AcceptActionUsage`. This is the same family of problem as items 3 and 4: resolving a name to an inherited feature.

**The Chunk 2 evidence:** `Actions.sysml` carries a fork patch (Category J) that explicitly hides inherited `receiver` to disambiguate. That patch implies the LSP cannot pick the right `receiver` among inherited ones — this would block the 2025-02 affordance from working correctly even after the upstream library is updated.

**Status: likely missing.** Will be resolved as part of items 3/4 (multi-specialization resolution + redefinition target resolution).

**Confidence:** structurally-clear.

---

## Cross-chunk dependencies

Items 3, 4, and 5 all depend on the same underlying mechanism: **correctly walking specializations to resolve inherited features**, including under multi-specialization. Fixing that single mechanism is likely to:
- close items 3, 4, 5 of this chunk,
- make Chunk 2's Category A and J fork patches obsolete (~10 of the ~16 fork-only patches),
- and leave Chunk 2's Category B/E/H patches (~6) for separate type-inference / operator-resolution work.

This makes "fix the LSP scoping engine for multi-specialization" the **highest-leverage single piece of LSP work** in the upgrade scope: it touches the largest number of independent observed defects.

## Open questions

1. **Item 2 (protected through feature chains):** want me to do the ~30-min trace of `makeScope`/`localScope` to confirm whether the visibility filter applies on `.` chains? It's the smallest of the unresolved items.
2. **Item 4 (qualified-name redefinition target):** same — small test-case-driven verification. I'd construct one of `class A { x; } class B :> A { x; ref :>> A::x; }` style and check what `:>> A::x` resolves to.
3. **Item 3 (multi-specialization resolution):** this is the biggest item, with ramifications across Chunks 2/3/4/5. Want me to produce a dedicated mini-spec for "what the resolver should do" by reading the pilot's `TypeUtil` / `FeatureUtil` (where the algorithm lives) before moving on, or note as carry-forward and continue chunking?

## Resolved (2026-05-04)

3. **Done — produced as [`03a-multi-spec-resolution-pilot.md`](03a-multi-spec-resolution-pilot.md).** Headline finding: the algorithm lives not in the `Namespace_*_InvocationDelegate.java` files I originally pointed at, but in `org.omg.kerml.xtext/src/org/omg/kerml/xtext/scoping/KerMLScope.xtend`. Three load-bearing mechanisms together make resolution diamond-correct: `gen()` traverses **all** owned specializations even after a match (does not early-return); a `redefined` accumulator (seeded from `TypeUtil.getFeaturesRedefinedBy`) is propagated into the specialization walk and filters in `owned()`; and `addName()` performs a final tie-break where a feature that redefines another already in the result-set replaces it. The 2025-11 redefinition-target change appears to be the `if (ns instanceof Type && isRedefinition) ns.gen(...)` short-circuit at `KerMLScope.xtend:213`. Mini-spec also documents `$::` global resolution, naming-feature semantics, and visibility flow through `gen`/`imp` — feeds directly into items 1, 2, 4, 5 of this chunk.

1. **Done — produced as [`03b-visibility-filter-trace.md`](03b-visibility-filter-trace.md).** Static trace shows both `::` and `.` chain segments converge on `localScope()` ([`scope-provider.ts:235-246`](../../../packages/syside-languageserver/src/services/references/scope-provider.ts)), which applies `CHILD_CONTENTS_OPTIONS` with `inherited.visibility = Visibility.public`. **Likely already conformant** with the 2025-10 pilot change; behavioral probe still recommended to confirm. Item 2 status updated from "likely missing" to "likely already present (confirmation pending)."

2. **Done — produced as [`03c-redef-target-probe.md`](03c-redef-target-probe.md).** Three Jest-driven parse probes confirm the repo exhibits **pre-2025-11 buggy behavior**: when the first segment of a qualified-name redefinition target has a self-collision (a self-`X` in `B :> A`, target `:>> X::y`), the resolver picks self-`X` and then fails to find `y` (silent linking failure, `target = undefined`). Item 4 status confirmed **missing**; the fix collapses into the same body of work as item 3 — both want the `isRedefinition` short-circuit from `KerMLScope.xtend:213` mirrored in this repo's `initialScope()`.

## Items not yet checked

- The visibility filter's exact location and whether it is applied uniformly across `::` and `.` chain segments (item 2 above).
- The full algorithm walked by `TypeScope` for inherited members — only structurally surveyed, not traced end-to-end.
- The interaction between `import` resolution (`MembershipImportScope`, `NamespaceImportScope`) and the new `$::` semantics — whether libraries imported via `import` interact with `$::` in any nontrivial way.
- The pilot's `Feature_redefines_InvocationDelegate.java` and `NamespaceUtil.getNamedMembershipFor` — known relevant code paths I have flagged but not read in this chunk.
