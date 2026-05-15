# Fix `validateUsageOwningType` for flow-connector ends

## Problem

The P4-introduced `validateUsageOwningType` validator rejected 5 of 9
Semantifyr `TestModels` integration cases, including `crossroads.sysml`:

    flow from controller.controlA to trafficLightA.control;
    flow from controller.controlB to trafficLightB.control;

Each line produced two diagnostics:

    156: The owningType of a Usage must be a Definition or a Usage. [validateUsageOwningType]

## Failing AST shape

`flow from <path> to <path>` desugars (in sysml-2ls, mirroring the pilot
metamodel) to a `FlowConnectionUsage` with two ends of type `ItemFlowEnd`,
each carrying an inner `ReferenceUsage` that names the feature chain
(`controller.controlA`, `trafficLightA.control`, …):

    FlowConnectionUsage              (SysML Usage)
      └─ EndFeatureMembership
           └─ ItemFlowEnd            (KerML Feature, NOT a SysML Usage/Definition)
                └─ FeatureMembership
                     └─ ReferenceUsage  ← node being validated
                          owningType = ItemFlowEnd

The `ReferenceUsage`'s `owningType` resolves to the synthesised
`ItemFlowEnd`, which is a KerML `Feature` (per the pilot:
`org.omg.sysml/syntax-gen/.../FlowEnd.java`: `interface FlowEnd extends
Feature`). The validator's predicate `!isAny(Definition, Usage)` then fired
on a legitimate construct.

## Spec basis

SysML v2 §8.3.6.4 (2026-03) defines `Usage::/owningType` as the derived
union of two derived properties:

> `/owningDefinition : Definition [0..1] {subsets owningType, featuringDefinition}`
>
> `/owningUsage : Usage [0..1] {subsets owningType}`

i.e. a `Usage`'s spec-level `owningType`, when present, is necessarily
either a `Definition` or a `Usage`. The validator therefore should fire
only when the *eventual* enclosing Type along the ownership chain is
neither. Synthetic KerML-Feature ends (`ItemFlowEnd`, etc.) that the
language uses to model connector ends are transparent for this purpose —
the spec rule is about the enclosing SysML Definition/Usage, and walking
through KerML-Feature owners is the metamodel-conformant way to find it.

The pilot does not implement `validateUsageOwningType` at all (no hits
under `org.omg.sysml/`), so there is no pilot reference behaviour to
contradict; this is a metamodel-implied rule we enforce on the
authoring side.

## Fix

`packages/syside-languageserver/src/services/validation/sysml-validator.ts`

Before:

```ts
@validateSysML(ast.Usage.$type)
validateUsageOwningType(node: UsageMeta, accept: ModelValidationAcceptor): void {
    const owningType = node.owningType;
    if (owningType && !owningType.isAny(ast.Definition.$type, ast.Usage.$type)) {
        accept("error", "The owningType of a Usage must be a Definition or a Usage.", {
            element: node,
            code: "validateUsageOwningType",
        });
    }
}
```

After:

```ts
@validateSysML(ast.Usage.$type)
validateUsageOwningType(node: UsageMeta, accept: ModelValidationAcceptor): void {
    const owningType = node.owningType;
    if (!owningType) return;
    // KerML Features (e.g. synthetic ItemFlowEnd ends on a FlowConnectionUsage)
    // can legitimately own Usages. Walk up the KerML-Feature chain to find
    // the enclosing SysML Definition/Usage that the spec's owningType refers
    // to (see SysML 2026-03 §8.3.6.4: owningType = owningDefinition ∪ owningUsage).
    let current: TypeMeta | undefined = owningType;
    while (
        current &&
        current.is(ast.Feature.$type) &&
        !current.isAny(ast.Definition.$type, ast.Usage.$type)
    ) {
        current = (current as FeatureMeta).owningType;
    }
    if (!current || !current.isAny(ast.Definition.$type, ast.Usage.$type)) {
        accept("error", "The owningType of a Usage must be a Definition or a Usage.", {
            element: node,
            code: "validateUsageOwningType",
        });
    }
}
```

The P4 unit test (`Usages owned by KerML types trigger validation`) still
passes: that test builds a root `FeatureMeta` whose own `owningType` is
undefined, so the walk terminates with `current === undefined` and the
diagnostic fires as before.

## Test results

All 9 Semantifyr models now parse and validate cleanly. `KNOWN_FAILING_MODELS`
was removed and all entries merged into `MODELS`.

Full suite, after fix:

    Test Files  75 passed (75)
         Tests  2152 passed | 7 skipped (2159)

Compared with the P4 baseline (2147 / 12 / 2159), the net change is +5
passing tests / -5 skipped, matching the predicted impact.

## Deeper-design assessment

The bug is narrower than "the validator is wrong" — it's a
**metamodel-level mismatch** between the predicate (`owningType is a
Definition/Usage`) and how the AST represents legitimate SysML constructs
(synthetic KerML-Feature ends). Two related questions worth flagging:

1. Other validators that read `node.owningType` (or otherwise inspect the
   immediate owning Type) may have the same blind spot for connector
   ends. The current pass through `sysml-validator.ts` does not show
   other obvious candidates among the metamodel-implied validators, but
   any future "implicit"-style validator added by reading P4-style spec
   prose should be aware that the KerML-Feature owner is the
   *implementation* `owningType`, not the spec's
   `owningDefinition ∪ owningUsage`.

2. An alternative fix would be to redefine `UsageMeta.owningType` itself
   to walk through KerML-Feature owners and only return Definition/Usage
   (matching the spec's derived union exactly). That would be a more
   invasive change touching every `node.owningType` reader, and risks
   silently changing semantics in other readers (typing-resolution,
   featuring, etc.). The localised validator fix is the lower-risk
   choice; promoting it to `UsageMeta.owningType` is worth revisiting if
   we discover other consumers that want the spec-narrow definition.
