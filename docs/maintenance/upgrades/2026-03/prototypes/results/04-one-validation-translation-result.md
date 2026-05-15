# P4 Result — One validation translation

## Target

`validateUsageOwningType` on `Usage` (SysML). Implemented in `packages/syside-languageserver/src/services/validation/sysml-validator.ts`. Existing skipped test at `packages/syside-languageserver/src/services/validation/__tests__/sysml-validator.test.ts:138` un-skipped and passing.

## Spec basis

The literal validator name `validateUsageOwningType` is **not** defined as a normative OCL constraint in the 2026-03 spec PDF (`SysML-v2-Release/doc/2a-OMG_Systems_Modeling_Language.pdf`). The string appears only once, in §8.3.1 as the **example** name used to illustrate the naming convention:

> Validation constraints have names that start with the word `validate`, followed by the name of the metaclass, followed by a descriptive word or phrase. For example, `validateUsageOwningType`.

The constraint it would name is a direct consequence of the Usage metamodel (§8.3.6.4). A `Usage`'s `owningType` is the union of two derived properties:

> `/owningDefinition : Definition [0..1] {subsets owningType, featuringDefinition}` — The Definition that owns this Usage (if any).
>
> `/owningUsage : Usage [0..1] {subsets owningType}` — The Usage in which this Usage is nested (if any).

So a Usage's `owningType`, if non-null, must be either a `Definition` or a `Usage`. The skipped test confirms this reading: it builds a root `FeatureMeta` (a plain KerML `Feature`, neither Definition nor Usage) containing a `FeatureMembership` → `Usage`, and expects exactly one diagnostic.

## Implementation

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

Sits next to `validateVariantMembershipOwningNamespace`, matching that file's existing decorator/accept idiom. `UsageMeta.owningType` is the existing `FeatureMeta` getter — no new infrastructure needed.

## Test outcome

- Test `Usage validation > Usages owned by KerML types trigger validation` un-skipped, passes.
- Baseline: `2136 passed | 13 skipped` (one stdlib integration suite fails because the worktree lacks the `SysML-v2-Release` submodule — pre-existing, unrelated).
- After: `2137 passed | 12 skipped`. Same single unrelated stdlib failure.

## Mechanical assessment

Mechanical, ~15 minutes once the spec search dead-end was resolved. The hidden complexity was **not** in the predicate but in locating it: the constraint's name in the spec is only used as a typographic example, and there is no OCL body for it. The "translation" was actually inferred from the metamodel (the union semantics of `{subsets owningType}`) plus the pre-existing test's shape.

## Deviation from spec / pilot

None substantive. The pilot does not appear to expose a Java-side `validateUsageOwningType` either (no hits under `~/work/systems-modeling/SysML-v2-Pilot-Implementation/`). We implement the metamodel-implied rule. No `docs/known_limitations.md` entry needed; this is stricter than nothing, not stricter than the spec.

## Fan-out recommendation

Cautiously optimistic, with a sharpened expectation. Of the 13, the ones in the "implicitly ensured by the model" / structural-only bucket should translate as cleanly as this one — once you know **where to look**. The catch this prototype exposed: not every named validator in the spec text has a normative OCL body — some are purely illustrative or are stated only as prose under a metamodel section. So the fan-out workflow should be:

1. Search the spec for the literal validator name.
2. If only a prose / metamodel reference, derive the predicate from the structural constraint and document it as such.
3. If a real OCL body exists (e.g. `validateUsageIsReferential` at line 17186), translate it directly.

I'd estimate the remaining 12 split roughly: ~6 mechanical OCL translations (e.g. `validateUsageIsReferential`, `validateUsageVariationIsAbstract`, `validateUsageVariationOwnedFeatureMembership`), ~4 metamodel-implied like this one, and ~2 that may need cross-feature analysis (the various `Library` specialization checks that call `specializesFromLibrary(...)` — those depend on stdlib resolution working). Recommend tackling the OCL-bodied ones next as the lowest-friction batch.
