# Prototype P5 (revised) — qualified-name redefinition target resolution

> Outcome of the P5 redo: implement the 2025-11 pilot `isRedefinition` short-circuit so that the first segment of a qualified-name redefinition target (`:>> a::b`) is resolved through the owning type's *inherited* members rather than its *owned* members.

## TL;DR

- Probe 2 (the self-collision case from `03c-redef-target-probe.md`) now passes: `:>> X::y` in `B :> A` resolves to `A::X::y` instead of failing.
- Probes 1 and 3 still pass. Full vitest suite: 2136 pass / 13 skipped — no regression versus baseline (`c6a0cde`). The one failing file (`stdlib-loading.test.ts`) is pre-existing and unrelated; it fails on both the baseline and the prototype because the worktree lacks the `SysML-v2-Release/sysml.library` submodule.
- Probe 2 is now an actual regression test (asserts `resolvedQN === "A::X::y"`).

## The fix

Two files touched:

### 1. `packages/syside-languageserver/src/utils/scopes.ts`

New exported class `InheritedTypeScope` — a `TypeScope` variant whose `getLocalElement` and `getAllLocalElements` are empty, so only inherited (and imported) scopes are reachable. Mirrors the pilot's `if (ns instanceof Type && isRedefinition) ns.gen(...)` body at `KerMLScope.xtend:213`.

```ts
export class InheritedTypeScope extends TypeScope {
    protected override getLocalElement(_name: string): MembershipMeta | undefined {
        return;
    }
    protected override getAllLocalElements(): Stream<ExportedMember> {
        return EMPTY_STREAM;
    }
}
```

### 2. `packages/syside-languageserver/src/services/references/scope-provider.ts`

Inside `initialScope`, before the existing `Specialization/Conjugation` branch mangles `owner`, capture the owning type when the surrounding relationship is a `Redefinition`. Then at the return site, prepend an `InheritedTypeScope` over that type to the resulting `ScopeStream`.

Before (load-bearing return):

```ts
return makeLinkingScope(
    owner,
    options,
    this.indexManager.getGlobalScope(document as LangiumDocument<Namespace> | undefined)
);
```

After:

```ts
// Pilot conformance (`KerMLScope.xtend:213`): when resolving the first
// segment of a redefinition target (`:>> a::b`), look up `a` through
// the owning type's inherited members rather than its owned members,
// so a self-collision in the owning type doesn't shadow the inherited
// element. The remaining segments are resolved via the regular
// per-context scope walk in `getElementReferenceScope`.
let redefinitionOwningType: ElementMeta | undefined;
if (owner?.is(Redefinition.$type)) {
    const redefiningFeature = owner.source();
    const owningType = (redefiningFeature as FeatureMeta | undefined)?.owningType;
    if (owningType?.is(Type.$type)) {
        redefinitionOwningType = owningType;
    }
}
// ... existing branches (Specialization/Conjugation, etc.) unchanged ...

const linkingScope = makeLinkingScope(
    owner,
    options,
    this.indexManager.getGlobalScope(document as LangiumDocument<Namespace> | undefined)
);

if (redefinitionOwningType) {
    const inheritedOpts = fillContentOptions({
        ...PARENT_CONTENTS_OPTIONS,
        aliasResolver: options.aliasResolver,
        inherited: { visibility: Visibility.private, depth: 1 },
        imported: { visibility: Visibility.private, depth: 1 },
    });
    const inheritedScope = new InheritedTypeScope(
        redefinitionOwningType as TypeMeta,
        inheritedOpts
    );
    return new ScopeStream(
        (function* () {
            yield inheritedScope;
            yield linkingScope;
        })()
    );
}

return linkingScope;
```

The `Redefinition` AST detection is precise: the existing `Specialization` branch is broader (covers `Subsetting`, `FeatureTyping`, `Subclassification`, `Redefinition`, etc.) and is intentionally unchanged — only `Redefinition` triggers the inherited-first short-circuit, matching `KerMLScopeProvider.xtend:141-150` which only sets `isRedefinition=true` when the context EReference is `redefinition_RedefinedFeature` (feature chaining is already handled in this repo by the recently landed `2c324de` fix and so is *not* re-routed here).

## Probe results

| Probe | Model | Before | After |
|-------|-------|--------|-------|
| 1 | `B :> A`, both have `x`; `:>> A::x` | `A::x` (ok) | `A::x` (ok) |
| 2 | `B :> A`, both have `classifier X`; `:>> X::y` | `undefined` (bug) | `A::X::y` (ok) |
| 3 | `B :> A`, only A has `X`; `:>> X::y` | `A::X::y` (ok) | `A::X::y` (ok) |

Probe 2 is now a real assertion:

```ts
expect(heritage[0].$type).toBe(Redefinition.$type);
expect(heritage[0].targetRef?.$meta?.to?.target?.qualifiedName).toBe("A::X::y");
```

## Full test suite

- Baseline at `c6a0cde`: 1 suite fail (`stdlib-loading.test.ts`, missing submodule, pre-existing) / 73 pass; 2136 tests pass / 13 skipped.
- After the fix: identical numbers. Same one unrelated suite still fails for the same submodule reason.

## Honest uncertainty

- Probe 1 still routes through the regular linking scope: in B's scope, `A` is not found (A isn't inherited from B's perspective — B specializes A but `A` itself is a sibling element in B's parent namespace). The prepended `InheritedTypeScope` over B returns nothing for `A`, then the parent linking scope finds the top-level `A`. This is correct, and matches Probe 1's pre-existing pass. I have not constructed an adversarial case where the inherited scope would prematurely shadow a legitimately self-owned outer namespace name (e.g., the redefining feature's class also containing a nested type whose name shadows a top-level package). The pilot doesn't have such a case because its `resolve()` walk continues into parents after `gen()` fails — which is what `linkingScope` then does here. I'm reasonably but not 100% confident this composes correctly in every edge case.
- The fix only fires when `owner.source()?.owningType` is a `Type`. If the redefining feature is owned by something that doesn't satisfy `is(Type)`, the short-circuit silently doesn't apply and the legacy behavior remains. This is consistent with the pilot's `if (ns instanceof Type && isRedefinition)` guard.
- I did not exercise the broader multi-specialization diamond case (Chunk 3 item 3 — "all specializations traversed, redefinition tie-break in addName"). Probe 2 alone doesn't probe diamonds, only single-inheritance self-collision. The TypeScope `getInheritedScopes` in this repo already traverses all specializations (see `scopes.ts:402-435`), but the redefinition tie-break in `addName` from the pilot is *not* mirrored here. Whether the diamond ordering is now order-independent post-fix is unverified.

## Chunk 3 items 4 and 5

- **Item 4 (qualified-name redefinition target resolves through inherited):** closed by this prototype.
- **Item 5 (accept-body receiver / similar self-vs-inherited puzzles):** not closed. The fix here is narrowly scoped to `Redefinition`. The accept-body receiver scope likely needs its own analysis — it's a different context-detection path (a TransitionFeatureMembership/accept payload, not a Specialization), and reusing `InheritedTypeScope` may or may not be the right ingredient. Recommend a follow-up probe before extending.
