# Chunk 3 sub-deliverable — qualified-name redefinition target probe

> **Per-upgrade artifact, exploration phase.** Behavioral probe of how the repo resolves a redefinition target whose first segment has a self-collision in the declaring type. Addresses Chunk 3 follow-up (2).
>
> **Method:** Three Jest-driven parse probes against the language server. Probe file lives at [`packages/syside-languageserver/src/__tests__/kerml/core/probe-redef-target-resolution.test.ts`](../../../packages/syside-languageserver/src/__tests__/kerml/core/probe-redef-target-resolution.test.ts) and is **explicitly an exploration probe**, not a regression test. It logs but does not assert specific resolutions; it stays green so it doesn't blockade CI but has known wrong behavior baked into Probe 2's output.

## TL;DR

The repo exhibits the **pre-2025-11 buggy behavior**: when the *first segment* of a qualified redefinition target collides with a self-defined element, the resolver picks self over inherited and the target fails to link.

## Probe results

| Probe | Model | Target | Expected (2025-11) | Observed | Verdict |
|-------|-------|--------|--------------------|----------|---------|
| 1 | `B :> A`, both have `x`; `:>> A::x` | `A::x` | `A::x` | `A::x` | ✓ matches |
| 2 | `B :> A`, both have `classifier X`; `:>> X::y` | `A::X::y` (via inherited X) | `undefined` (link failed) | mismatch | ✗ buggy |
| 3 | `B :> A`, only `A` has `X`; `:>> X::y` | `A::X::y` | `A::X::y` | ✓ matches |

### Probe 2 — the bug case

```kerml
class A {
    classifier X { feature y; }
}
class B specializes A {
    classifier X { feature z; }     // self-X collides with inherited X
    feature :>> X::y;               // redefinition target — first segment `X` has self/inherited collision
}
```

Observed `heritage` entry:

```
{
  type: 'Redefinition',
  targetText: 'X::y',
  resolvedQN: undefined,
  resolvedName: undefined,
}
```

The resolver picks B's self-`X` for the segment `X`, then cannot find `y` inside it (B's `X` only has `z`), so the qualified-name resolution fails. No exception is thrown — silent linking failure, target left as unresolved.

Per the 2025-11 pilot fix, the segment `X` should resolve through inherited (A's `X`) — see [`03a-multi-spec-resolution-pilot.md`](03a-multi-spec-resolution-pilot.md), section "Redefinition target resolution", which describes the `if (ns instanceof Type && isRedefinition) ns.gen(...)` short-circuit at `KerMLScope.xtend:213` that starts redefinition-target resolution from inherited members rather than owned ones.

### Probe 1 — why it works despite a similar collision

```kerml
class A { feature x; }
class B specializes A { feature x; feature :>> A::x; }
```

This case **does** have a self-`x` in `B` — but the redefinition target is *explicitly outer-qualified* (`A::x`, where `A` is a top-level class). The first segment `A` has no collision in B's scope (A is at the package level, not redefined inside B), so the resolver finds A directly, then `x` inside A. The collision on `x` never matters because the chain reaches A first.

This is why probe 1 passes and probe 2 doesn't — they look superficially similar but exercise different code paths.

### Probe 3 — control

Same model as probe 2 but B has no self-`X`. Resolves correctly. Confirms the failure in probe 2 is specifically due to the self-collision and not some unrelated parse issue.

## Implication for the implementation work

**Item 4 of Chunk 3 (qualified-name redefinition target resolves through inherited element, not self) — confirmed `missing`.** Probe 2 shows the exact failure mode the 2025-11 fix addresses.

The fix collapses into the same body of work as **item 3 of Chunk 3** (multi-specialization resolution): both want `KerMLScope.resolve()`'s `if (ns instanceof Type && isRedefinition) ns.gen(...)` short-circuit to be mirrored in this repo's scope provider. Concretely, the repo's `initialScope()` at `scope-provider.ts:141-224` should detect when the surrounding context is a `Redefinition` (or a `FeatureChaining`-context for chains), and for the *first* segment of the qualified name, route the lookup through the inherited members of the owning type rather than its owned ones.

## Probe-test disposition

- **Keep the probe file** as an exploration artifact for now; it logs useful diagnostics and stays green.
- When the fix lands in the prototype/implementation phase, convert Probe 2 to a real assertion (`expect(resolvedQN).toBe('A::X::y')`) and rename the file out of the `probe-` namespace into a regular regression test.
- Probes 1 and 3 are useful as positive-case regression tests; bake those in too.

## What I have *not* done

- Probed the **multi-specialization order independence** case from item 3 of Chunk 3 (the diamond), which is the broader problem item 4 is a special case of. That deserves its own probe set, but is a larger undertaking — likely once the prototype phase begins and we have a concrete fix to test against.
- Probed `protected`-through-`.`-chain visibility (Chunk 3 follow-up (1)). The static trace concluded "likely already conformant"; a small probe — visible-from-public, hidden-from-protected access — would settle it. Skipped here for time.
