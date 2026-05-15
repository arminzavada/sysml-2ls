# Chunk 3 sub-deliverable — visibility filter on `.` vs `::` chains

> **Per-upgrade artifact, exploration phase.** Targeted trace of how the repo applies the `public`/`protected`/`private` visibility filter when resolving members through qualified-name (`::`) and feature-chain (`.`) chains. Addresses Chunk 3 follow-up (1).
>
> **Method:** Static read of the repo's scope construction and visibility-filter code. **Not** a behavioral test — flagged as the necessary next step at the bottom.

## Headline

Static reading suggests the repo **may already be conformant** with the 2025-10 pilot change ("`protected` members no longer reachable through feature chains") — both `::` and `.` paths converge on `localScope()` in `scope-provider.ts:235-246`, which applies `CHILD_CONTENTS_OPTIONS` with `inherited.visibility = Visibility.public`. There is no second, less-strict path that I could find for feature-chain-expression resolution.

**Caveat:** Confirmed by static read only. There may be alternate scope-construction paths I missed; a behavioral probe is the right way to settle this.

## What's filtered, where

The visibility model: [`packages/syside-languageserver/src/utils/scope-util.ts:28-36`](../../../packages/syside-languageserver/src/utils/scope-util.ts):

```typescript
export const enum Visibility {
    public = 0,
    protected = 1,
    private = 2,
}

export function isVisibleWith(visibility: Visibility, constraint: Visibility): boolean {
    return visibility <= constraint;
}
```

The filter is applied per-scope inside `ImportScope.isVisible` ([`utils/scopes.ts:237-244`](../../../packages/syside-languageserver/src/utils/scopes.ts)):

```typescript
protected isVisible(exported: MembershipImportMeta | MembershipMeta): boolean {
    return (
        isVisibleWith(exported.visibility, this.options.inherited.visibility) &&
        ...
    );
}
```

For `localScope` (called for index > 0 segments of any chain — both `::` and `.`):

```typescript
// scope-provider.ts:235-246
localScope(node: Metamodel, document?: LangiumDocument, aliasResolver = DEFAULT_ALIAS_RESOLVER): SysMLScope {
    ...
    return makeScope(node, {
        ...CHILD_CONTENTS_OPTIONS,
        aliasResolver: aliasResolver,
    });
}
```

`CHILD_CONTENTS_OPTIONS` ([`scope-util.ts:82-93`](../../../packages/syside-languageserver/src/utils/scope-util.ts)) sets the filter to `public`:

```typescript
export const CHILD_CONTENTS_OPTIONS: DeepReadonly<PartialContentOptions> = {
    // only publicly visible contents by default
    imported: { visibility: Visibility.public, depth: 0 },
    inherited: { visibility: Visibility.public, depth: 0 },
    aliasResolver: undefined,
};
```

So any chain segment after the first — be it `p::b` or `p.b` — sees only `public` members. `protected` and `private` are filtered out at `isVisibleWith(visibility, public)`.

## Convergence point: both `::` and `.` go through `localScope`

`getElementReferenceScope(container, index)` ([`scope-provider.ts:99-128`](../../../packages/syside-languageserver/src/services/references/scope-provider.ts)) is called for every segment of an `ElementReference`-style chain. For `index === 0`, it uses `getContext()` or `initialScope()`. For `index > 0`:

```typescript
parent = container.found.at(index - 1);
...
return this.localScope(parent, container.document, aliasResolver);
```

The `getContext()` helper at the same file (lines 271-297) recognizes **both `::` and `.`** as the previous CST token to determine scope context:

```typescript
if (!previous || ![".", "::"].includes(previous.text)) {
    return;
}
```

That confirms: at the *qualified-reference* level, `::` and `.` are treated identically.

## What about feature-chain *expressions*?

Feature chains are also AST constructs distinct from qualified references — `FeatureChaining` appears in [`scope-provider.ts:153-158`](../../../packages/syside-languageserver/src/services/references/scope-provider.ts):

```typescript
// need to unwrap feature chaining
if (owner?.is(FeatureChaining)) {
    // if using `chains` notation, two levels up will be the feature
    // owner, otherwise 2 levels up is a type relationship which will be
    // handled by the next statement
    owner = owner.owner()?.owner();
}
```

This unwrap happens **inside `initialScope`**, which is the path for the *first* segment. After unwrapping, control falls through to the same `makeLinkingScope`/`localScope` plumbing as the qualified-name path. So feature-chain segments do not get a separate, less-strict scope.

## What I have *not* checked

- The behavioral case. The right next step is to author a tiny SysML model:
  ```
  package P {
      part def A {
          protected attribute b : Real;
      }
      part def C :> A {
          attribute c = self.b;   // should error: b is protected
          attribute c2 = self::b; // should error: b is protected
      }
  }
  ```
  and confirm both lines produce the same diagnostic (or both produce none — equally informative). Without this, we are reasoning from grammar+code alone and could miss a code path I didn't grep.
- Whether the `protected` filter interacts correctly with the 2025-10 change's *exact* semantic. The pilot release-notes describe blocking `p.b` for `protected b`; my trace shows the repo blocks both `p.b` and `p::b`. If the pilot pre-2025-10 was *too permissive on `.`*, the repo behavior may match post-2025-10 conformance. If, however, the spec also wants something subtler (e.g. visibility relaxation when the access is from a subtype), the simple `inherited.visibility = public` filter may be too strict.

## Status

**Item 2 of Chunk 3 (`protected` blocked through feature chains):** updated from **likely missing** to **likely already present** based on this trace. Confidence: structurally-clear (static read), not behaviorally verified. A small probe model would settle it.
