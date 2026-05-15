# Chunk 3 sub-deliverable — pilot multi-specialization resolution mini-spec

> **Per-upgrade artifact, exploration phase.** Description of how the Eclipse SysML v2 pilot resolves names — particularly under multi-specialization. Not a port plan; an input to future planning.
>
> **Method:** Read of pilot resolution code at tag `2026-03`. The "true" algorithm lives in `org.omg.kerml.xtext/src/org/omg/kerml/xtext/scoping/KerMLScope.xtend` (Xtend, not pure Java) — the `org.omg.sysml/src/org/omg/sysml/delegate/invocation/Namespace_*.java` delegates I originally pointed at are mostly thin forwarders. Citations verified by sample (line 209 = `resolve()`, line 380 = the "all specializations are traversed" comment, line 246 = `addName` redefinition tie-break).
>
> **Confidence:** sub-agent reading + spot-verification by me. Domain expert (Armin) review still required before this becomes a planning input — the comment-flagged "open questions" below particularly need a second eye.

## 0. Where the algorithm actually lives

The named delegate entry points I had originally identified (`Namespace_resolve_InvocationDelegate.java`, etc.) are extremely thin in this build: most just unwrap arguments and forward to a `*Util` static helper, which forwards into an EMF *adapter* (singleton mutable companion of an EObject), which eventually delegates into the **Xtext scope provider** (`KerMLScope` / `KerMLScopeProvider`).

The "true" resolution algorithm — the multi-specialization walk — lives in **`KerMLScope.xtend`** (504 lines, at `org.omg.kerml.xtext/src/org/omg/kerml/xtext/scoping/KerMLScope.xtend`), reached via:

```
Namespace::resolve(qn)
  → NamespaceUtil.getNamedMembershipFor(ns, name)
    → SysMLScopeUtil.getElementFor(ns, Namespace_Membership, name)
      → IScopeProvider.getScope(ns, ref).getElement(name)
        → KerMLScope.getSingleElement(qn)
          → KerMLScope.resolveInScope(qn, true) → resolve()
```

Below: the entry-point delegates I originally asked about, then the algorithm.

| Delegate | Forwards to | Algorithm body? |
|---|---|---|
| `Namespace_resolve` | `NamespaceUtil.getNamedMembershipFor` | No — into `SysMLScopeUtil` → `KerMLScope` |
| `Namespace_resolveLocal` | escape name; if no parent → `resolveGlobal`, else `getNamedMembershipFor` | No |
| `Namespace_resolveGlobal` | `SysMLLibraryUtil.getLibraryElement` | Library lookup only |
| `Namespace_resolveVisible` | `self.visibleMemberships(...).filter(name match).findFirst` | Trivial filter |
| `Namespace_visibleMemberships` | `NamespaceUtil.getVisibleMembershipsFor` → `NamespaceAdapter.getVisibleMemberships` | Yes (small) |
| `Namespace_membershipsOfVisibility` | → `NamespaceAdapter.getMembershipsOfVisibility` | Yes (small) |
| `Namespace_importedMemberships` | → `NamespaceAdapter.getImportedMembership` | Tiny — loops `ownedImport` |
| `Namespace_qualificationOf` | `ElementUtil.parseQualifiedName` then drop last | Pure string |
| `Feature_redefines` | `FeatureUtil.getRedefinedFeaturesWithComputedOf(self).contains(other)` | Predicate over computed redefs |
| `Feature_namingFeature` | same list, `findFirst` | Trivial |

The two pieces of algorithmic code in `*Util` that matter for resolution are `TypeUtil.getFeaturesRedefinedBy` and `TypeUtil.getAllFeaturesRedefinedBy` (used by `KerMLScope.gen` to compute "already-redefined" sets that prune the inherited walk).

---

## 1. Top-level dispatch — how a qualified name is split

**There is no per-segment dispatch in the pilot resolution code.** A qualified name is converted once to an Xtext `QualifiedName` (a list of segments produced by `ElementUtil.parseQualifiedName`, which splits on `::` honouring `'…'` quoting), and the entire `QualifiedName` is then passed through resolution as a *single* atomic search. Matching segment-by-segment happens implicitly inside `KerMLScope.checkQualifiedName` via prefix testing:

```xtend
// KerMLScope.xtend:328
protected def checkQualifiedName(QualifiedName elementqn, boolean checkIfAdded) {
    (targetqn === null || targetqn.startsWith(elementqn)) &&
    (!checkIfAdded || !visitedqns.contains(elementqn))
}
```

The walk descends into a member's namespace only if its name is a **prefix** of `targetqn`:

```xtend
// KerMLScope.xtend:343
protected def visitQualifiedName(QualifiedName elementqn, ... ) {
    ...
    if (addQualifiedName(elementqn, mem, memberElement)) return true
    if (targetqn != elementqn) {
        if (memberElement instanceof Namespace) {
            isShadowing = true;
            if (memberElement.resolve(elementqn, ownedVisited, visited, newHashSet, false, false, false, includeImplicitGen, includeAll)) {
                return true;
            }
        }
    }
    false
}
```

So `a::b::c` is resolved by: (1) find a member of *some* enclosing/inherited namespace whose name is `a`; (2) recursively resolve `b` *inside that member, with `isInsideScope=false`, `isInheriting=false`, no implicit gen* (note the `false, false, false` arguments above); (3) continue.

Crucially, the second-and-later segments are resolved as **`owned ∨ gen ∨ imp` of the resolved namespace itself** (see `resolve(Namespace, ...)` at line 225) — so qualified-name traversal *does* still walk specializations, but with `isInsideScope=false` (only `PUBLIC` members visible) and (since `includeImplicitGen=false` after the first hop) without implicit generalisations.

**Global resolution branch.** The first segment of `targetqn` is checked for the global symbol `$`:

```xtend
// KerMLScope.xtend:171
override getSingleElement(QualifiedName name) {
    if (QualifiedNameUtil.isGlobalScopeQualification(name)){
        parent.getSingleElement(name)
    } else {
        val result = resolveInScope(name, true);
        if (!result.isEmpty) result.get(0)
        else if (parent !== null && !isShadowing) parent.getSingleElement(name)
        else null
    }
}
```

The KerML local scope does *not* try to resolve `$::…` itself — it short-circuits straight to the `parent` Xtext scope (ultimately `KerMLGlobalScope`). The local-scope chain is also not consulted on shadowing once `$` is seen.

> **Open question.** `parseQualifiedName` recognises `$` only as a *prefix* (`if (qualifiedNameText.startsWith(GLOBAL_SCOPE_SYMBOL)) ...; i = 3; j = 3;`). Whether `Foo::$::Bar` is meaningful or a parse oddity is not clear from these files alone.

---

## 2. Per-segment resolution — `owned`, `gen`, `imp`

For a single namespace `ns`, lookup is the disjunction (`||` short-circuits on first `true`):

```xtend
// KerMLScope.xtend:225
protected def boolean resolve(Namespace ns, QualifiedName qn, ..., boolean isInsideScope, boolean isInheriting, boolean includeImplicitGen, boolean includeAll) {
    if (this.ns === ns || scopeProvider.libraryNamespaces.canContainMember(ns, qn, targetqn)) {
        ns.owned(qn, ownedVisited, visited, redefined, checkIfAdded, isInsideScope, isInheriting, includeImplicitGen, includeAll) ||
        ns.gen(qn, visited, redefined, isInheriting, includeImplicitGen) ||
        ns.imp(qn, visited, isInsideScope, includeImplicitGen, includeAll)
    } else false
}
```

### 2a. Visibility filter (in `owned`)

Visibility is checked per-membership:

```xtend
// KerMLScope.xtend:272
if (includeAll || isInsideScope || mem.visibility == VisibilityKind.PUBLIC ||
        mem.visibility == VisibilityKind.PROTECTED && isInheriting) {
```

So: when resolving inside the namespace's lexical scope (`isInsideScope=true`) all visibilities are allowed; when crossing into a generalisation (`gen` clears `isInsideScope` to `false` but sets `isInheriting=true`), `PUBLIC` and `PROTECTED` are visible; when crossing through a public import (`imp` calls into the imported namespace with `isInsideScope=false`, `isInheriting=false`), only `PUBLIC` is visible.

### 2b. Imports (in `imp`)

```xtend
// KerMLScope.xtend:417
protected def boolean imp(Namespace ns, ...) {
    for (e: ns.ownedImport) {
        if (!scopeProvider.visited.contains(e)) {
            if (includeAll || isInsideScope || e.visibility == VisibilityKind.PUBLIC) {
                ...
                val found = e.resolveImport(qn, visited, includeImplicitGen)
                ...
                if (found) return true
            }
        }
    }
    return false
}
```

`NamespaceImport` recursively resolves through the imported namespace; `MembershipImport` checks whether the imported membership's name matches the next segment. Recursion is guarded by `scopeProvider.visited` (per-scope) and by the `Set<Namespace> visited` passed down (per-traversal).

### 2c. Inheritance (in `gen`) — the multi-specialization case

This is the load-bearing part. The **2025-09 fix**: `gen()` does *not* return early on the first found match across specializations:

```xtend
// KerMLScope.xtend:362
protected def boolean gen(Namespace ns, QualifiedName qn, Set<Namespace> visited, Set<Element> redefined, boolean isInheriting, boolean includeImplicit) {
    var isFound = false
    if (ns instanceof Type) {
        val conjugator = ns.ownedConjugator
        if (conjugator !== null && !scopeProvider.visited.contains(conjugator)) {
            scopeProvider.addVisited(conjugator)
            val found = conjugator.originalType.resolveIfUnvisited(qn, false, visited, newHashSet, false, false, includeImplicit, false)
            scopeProvider.removeVisited(conjugator)
            if (found) { return true }
        }
        val newRedefined = new HashSet()
        if (redefined !== null) {
            newRedefined.addAll(redefined)
            newRedefined.addAll(TypeUtil.getFeaturesRedefinedBy(ns, if (skip instanceof Redefinition) skip.owningFeature else null))
        }

        // Note: All specializations are traversed, even if a resolution is found, in order to check for possible redefinitions inherited
        // from subsequent specializations. If findFirst = true, the selection of a single element is handled in addName.

        for (e: ns.ownedSpecialization) {
            if (!scopeProvider.visited.contains(e)) {
                scopeProvider.addVisited(e)
                val found = e.general.resolveIfUnvisited(qn, false, visited, newRedefined, isInheriting, false, includeImplicit, false)
                scopeProvider.removeVisited(e)
                if (found) { isFound = true }   // <-- accumulates, does not return
            }
        }
        if (includeImplicit && !scopeProvider.visited.contains(ns)) {
            scopeProvider.addVisited(ns);
            var implicitTypes = TypeUtil.getImplicitGeneralTypesFor(ns);
            scopeProvider.removeVisited(ns)
            for (type : implicitTypes) {
                val found = type.resolveIfUnvisited(qn, false, visited, newRedefined, isInheriting, false, true, false)
                if (found) { isFound = true }
            }
        }
        if (ns instanceof Feature) {
            val chainingFeature = FeatureUtil.getLastChainingFeatureOf(ns)
            if (chainingFeature !== null &&
                chainingFeature.resolveIfUnvisited(qn, false, visited, newRedefined, isInheriting, false, true, false)) {
                isFound = true;
            }
        }
    }
    return isFound
}
```

Two things to notice — both relevant to the diamond / order-independence fix:

1. **Every owned specialization is visited.** A naïve "first wins" walk would `return true` inside the loop. Here, `for (e: ns.ownedSpecialization)` always runs to completion when `findFirst=true`, and conflicts are reconciled later.

2. **The `redefined` accumulator** (`newRedefined`) is computed by `TypeUtil.getFeaturesRedefinedBy(ns, …)` — features owned by `ns` that already redefine something — and propagated *into the specialization walk*. In `owned()` (line 318) members whose memberElement is in `redefined` are filtered out. So a feature inherited via `A` that is redefined by something owned by the subtype is filtered before it can shadow. (Note: `getFeaturesRedefinedBy` uses `getRedefinedFeaturesWithComputedOf`, i.e. it includes implicit redefinitions, not only explicit `:>>`.)

3. **Final disambiguation in `addName`** — when `findFirst=true` and several inherited features collide on the same QN, the one that is *not* redefined by another in the set wins:

```xtend
// KerMLScope.xtend:234
protected def boolean addName(QualifiedName qn, Membership mem, Element elm) {
    ...
    val el = if (findFirst && referenceType === SysMLPackage.eINSTANCE.membership) mem else elm
    val elms = elements.get(qn)
    if (elms === null) {
        elements.put(qn, newHashSet(el))
    } else if (findFirst && el instanceof Feature) {
        // If findFirst = true then the only time multiple elements will be added for the same qualified
        // name is during the traversal of general types. In this case, the chosen element should be one
        // that is not redefined by any other element for the qualified name.
        if (elms.exists[old | FeatureUtil.getAllRedefinedFeaturesOf(el as Feature).contains(old)]) {
            elements.put(qn, newHashSet(el))
        }
    } else {
        elms.add(el)
    }
    return true
}
```

This is what makes a diamond `T :> A, B` order-independent: if `T :> A, B` and both `A` and `B` declare `f`, but say in `A` we have `f` and in `B` we have `f :>> A::f`, then whichever traversal order is taken, when the second hit arrives `addName` checks `getAllRedefinedFeaturesOf(new).contains(old)` — if so, the new one wins (it redefines the old one). Compared to a naïve walk that takes the first match in declaration order, this is order-independent.

> **Open question / things I'm not 100% sure about.** The `addName` rule replaces only when *the new* element redefines something already in the set; if the *old* element redefines the new one, both end up in the set, and `getSingleElement` returns the first. I'd want to verify whether the iteration order of the `HashSet` matters here, or whether the `redefined` filter in `owned()` already prevents the symmetrical case from arising. The comment in `gen` strongly suggests the design intent is "all specializations traversed, redefinition filter in `owned` plus tie-break in `addName` together cover it" — but the precise correctness argument relies on the fact that any pair `(f_A, f_B)` reached via different specializations will be filtered, on the second visit, against the accumulated `newRedefined` set — and that set was seeded from the *subtype*'s own owned features, not from the prior specialization branch. The cross-branch dedup only happens via `addName`. That is worth re-deriving carefully — flagged for Armin.

---

## 3. Redefinition target resolution — `:>> a::b`

The redefinition reference is a `Redefinition` relationship with reference `redefinition_RedefinedFeature`. In `KerMLScopeProvider.scope_Namespace`:

```xtend
// KerMLScopeProvider.xtend:141
def scope_Namespace(Element element, Namespace namespace, EObject context, EReference reference, boolean isInsideScope) {
    if (namespace === null)
        super.getScope(element, reference)
    else
        namespace.scopeFor(reference, element, isInsideScope, true,
            context instanceof Redefinition &&
            (reference == SysMLPackage.eINSTANCE.redefinition_RedefinedFeature ||
             reference == SysMLPackage.eINSTANCE.featureChaining_ChainingFeature),
            if (context instanceof Element) context else null)
}
```

The fifth boolean is `isRedefinition`. When set, `KerMLScope.resolve()` skips `owned` at the outermost scope and starts directly with `gen`:

```xtend
// KerMLScope.xtend:209
protected def void resolve() {
    if (targetqn !== null && skip !== null) {
        scopeProvider.addVisited(skip)
    }
    if (ns instanceof Type && isRedefinition) {
        // For a redefinition within a type, start resolution search with inherited members.
        ns.gen(QualifiedName.create(), newHashSet, null, true, true)
    } else {
        ...
        ns.resolve(QualifiedName.create(), newHashSet, newHashSet, newHashSet, false, isInsideScope, isInsideScope, true, includeImplicitGen, includeAll)
    }
    ...
}
```

i.e. when feature `f :>> a::b` is declared inside type `T`, the `a` segment is resolved **starting from `T`'s inherited members** (via `gen`), *not* from `T`'s own owned members. The `skip` parameter is the `Redefinition` object itself, and `owned` further excludes the owning feature (line 270): `mem instanceof OwningMembership && skip instanceof Redefinition && (skip as Redefinition).owningType == mem.memberElement` — so the feature being declared cannot be the target of its own redefinition.

> The 2025-11 change — "resolve `a` relative to inherited rather than self" — is plausibly exactly this `if (ns instanceof Type && isRedefinition) ns.gen(...)` short-circuit (and the `Redefinition` skip handling in `owned`). But this cannot be confirmed from these files alone — only that it is the *current* code. Worth checking the file history.

---

## 4. Global resolution

```java
// Namespace_resolveGlobal_InvocationDelegate.java:40
public Object dynamicInvoke(...) {
    Namespace self = (Namespace) target;
    String qualifiedName = (String) arguments.get(0);
    // TODO: Resolve elements other than to owning membership.
    Element element = SysMLLibraryUtil.getLibraryElement(self, qualifiedName);
    return element.getOwningMembership();
}
```

Confirmed: `$::Foo` *as called by `resolveGlobal`* literally means "look up `Foo` in the standard library" via `SysMLLibraryUtil.getLibraryElement`. Note however this is only one of two paths. In *Xtext-based* resolution (`KerMLScope.getSingleElement`), a `$`-prefixed name short-circuits to `parent.getSingleElement(name)` — the Xtext global scope provider — which is broader than just the standard library; it covers everything Xtext indexed (other resources, the library, etc.). The pilot's `resolveGlobal` delegate is the narrower API surface used from model-evaluation paths; the parser's link resolution uses the wider one.

The TODO comment ("Resolve elements other than to owning membership") flags that `resolveGlobal` always returns the owning membership of the resolved element, never a different membership of it. Implications for non-owning memberships imported under `$::…` should be re-checked.

---

## 5. Naming feature

```java
// Feature_namingFeature_InvocationDelegate.java:40
public Object dynamicInvoke(...) {
    Feature self = (Feature) target;
    return FeatureUtil.getRedefinedFeaturesWithComputedOf(self).stream().
            findFirst().orElse(null);
}
```

A feature's *naming feature* is the **first** entry in its computed-redefinitions list — i.e. the principal feature it redefines. `Element::effectiveName` for an unnamed feature returns the naming feature's name, so when you write `f :>> g` and don't give `f` a name, `f` is named `g`. Two consequences for resolution:

- A redefining feature that lacks a `declaredName` may still answer to `g` because `effectiveName` falls through. `KerMLScope.owned` *deliberately uses `declaredName` (not `effectiveName`)* for the very feature being lexically declared at the point of resolution (lines 280–292), to avoid an unnamed `:>> g` shadowing the genuine `g`.
- The `getRedefinedFeaturesWithComputed` ordering puts explicit `ownedRedefinition` first, then the *implicit* redefinitions computed by `FeatureAdapter.addRedefinitions` (which pair parameters/ends/constructor-result features positionally against generalisations in `ownedSpecialization` order). So the naming feature is the first explicit `:>>` if any, otherwise the first implicit positional pairing in declaration order of supertypes.

---

## Things to verify against this repo's code (Chunk 3 follow-ups)

- Whether name resolution is per-segment or whole-`QualifiedName`-at-once. The pilot is the latter: prefix-matching inside a single scope walk. The repo's `getElementReferenceScope(container, index)` operates per-segment — is that really equivalent, or does it lose the cross-segment context the pilot's prefix walk preserves?
- Whether the repo's `TypeScope` or equivalent traverses **all** specializations even when a match is found (line 383 of `gen` does not `return`).
- Whether the repo has an equivalent of the `addName` redefinition tie-break (line 246: "replace iff `getAllRedefinedFeaturesOf(new).contains(old)`"). If not, the diamond patches in Chunk 2 are guaranteed to remain load-bearing.
- Whether the repo seeds a `redefined` accumulator equivalent to `TypeUtil.getFeaturesRedefinedBy(ns, skip.owningFeature?)` and propagates it into the specialization walk.
- Visibility rules: `PROTECTED` is visible across `gen` only when `isInheriting=true`; `imp` always sets `isInheriting=false` and `isInsideScope=false`, so an import never carries `PROTECTED` members through. (Compare to Chunk 3 follow-up (1).)
- The `isRedefinition` short-circuit in `KerMLScope.resolve` (line 213): when resolving `:>> a::b`, *skip* the owning type's `owned` and start at `gen`. (Compare to Chunk 3 follow-up (2).)
- `Conjugator` handling (line 365): a conjugated type resolves through `originalType` first; if found, it `return`s — unlike specialization traversal, this is "first match wins". Confirm syside matches.
- `Feature` chain: when `ns` is a `Feature`, `gen` also descends into `getLastChainingFeatureOf(ns)` — this is the link between feature-chain resolution and ordinary inheritance.
- `getRedefinedFeaturesWithComputed` ordering: explicit `ownedRedefinition` first (in source order), then implicit positional pairings via `getImplicitGeneralTypesOnly(Redefinition)` (in `ownedSpecialization` order). The naming feature is the first of this combined list.
- `parseQualifiedName` only recognises `$` as a prefix segment, with `i = 3; j = 3;` skipping past `$::`. Whether mid-name `$` segments are syntactically possible at all should be checked against the grammar.
- `resolveGlobal` (the delegate) returns `element.getOwningMembership()` — a deliberately narrow surface, with a `TODO` to support non-owning memberships. The Xtext path takes a wider route via `parent.getSingleElement(qn)`.
