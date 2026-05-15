# Chunk 6 — Validation rules (2026-03 upgrade)

> **Per-upgrade artifact, exploration phase.** Cross-reference of validation-rule items.
>
> **Method:** Targeted greps + reading the explicit "commented-out" sections in the repo's validators.

## Headline

The repo's KerML and SysML validators contain a recurring comment pattern:

```typescript
// validateXxx - implicitly ensured by the model
```

This is the **same pattern** that the pilot's 2026-01 cleanup eliminated. The pilot release-notes describe constraints "formerly silently satisfied via getter overrides" — i.e., the EMF metamodel had getter overrides that always returned validity-preserving values, so the validation was effectively a no-op. This repo's "implicitly ensured by the model" comments are the editor-side analogue: a deliberate choice not to validate because the AST construction was assumed to make the constraint trivially true.

The 2026-01 fix is to **make these constraints actually fire**, including for cases the implicit assumption did not cover.

## Summary

For each of the 13 KerML/SysML validations called out in the 2026-01 batch:

| # | Validation | Repo presence | Status |
|---|------------|---------------|--------|
| 1 | `validateEndFeatureMembership` | commented as "implicitly ensured" ([`kerml-validator.ts:306`](../../../packages/syside-languageserver/src/services/validation/kerml-validator.ts)) | **missing** |
| 2 | `validateParameterMembership` | partially: `validateParameterMembershipOwningType` exists ([`kerml-validator.ts:931`](../../../packages/syside-languageserver/src/services/validation/kerml-validator.ts)) | **partial** |
| 3 | `validateCollectExpressionOperator` | commented as "implicitly ensured" ([`kerml-validator.ts:995`](../../../packages/syside-languageserver/src/services/validation/kerml-validator.ts)) | **missing** |
| 4 | `validateFeatureChainExpressionOperator` | not present | **missing** |
| 5 | `validateIndexExpressionOperator` | commented as "implicitly ensured" ([`kerml-validator.ts:997`](../../../packages/syside-languageserver/src/services/validation/kerml-validator.ts)) | **missing** |
| 6 | `validateSelectExpressionOperator` | not present | **missing** |
| 7 | `validateFlowEndIsEnd` | not present | **missing** |
| 8 | `validateUsageIsReferential` | not present | **missing** |
| 9 | `validateReferenceUsageIsReferential` | not present | **missing** |
| 10 | `validateAttributeUsageIsReferential` | not present | **missing** |
| 11 | `validateEnumerationDefinitionIsVariation` | commented as "implicitly ensured" ([`sysml-validator.ts:190`](../../../packages/syside-languageserver/src/services/validation/sysml-validator.ts)) | **missing** |
| 12 | `validateEventOccurrenceUsageIsReference` | commented as "implicitly ensured" ([`sysml-validator.ts:207`](../../../packages/syside-languageserver/src/services/validation/sysml-validator.ts)) | **missing** |
| 13 | `validatePortUsageIsReference` | commented as "implicitly ensured" ([`sysml-validator.ts:399`](../../../packages/syside-languageserver/src/services/validation/sysml-validator.ts)) | **missing** |

**Aggregate: all 13 are effectively missing.** 6 commented out as "implicitly ensured", 6 not present at all, 1 partially present (a related but differently-named constraint).

This matches the pilot's pre-2026-01 state. The fix is straightforward in shape: implement each of the 13 as a real validator. The work is bounded — the spec defines each constraint precisely — but it's 13 distinct rules to write.

## Other validation items

### `validateConnectorBinarySpecialization` corrected *(2025-07)*

**Repo:** the validator exists at [`kerml-validator.ts:802`](../../../packages/syside-languageserver/src/services/validation/kerml-validator.ts) and rejects "more than two ends":

```typescript
"error",
`Invalid binary ${isConn ? ast.Connector : ast.Association} - cannot have more than two ends.`,
{ element: node, code: isConn ? "validateConnectorBinarySpecialization" : "validateAssociationBinarySpecialization" }
```

The 2025-07 fix according to the digest: "some previously valid (or invalid) binary connector/connection declarations flip." This implies the *implementation* of the rule changed (likely a different conformance test), not the rule's existence. **Status: needs-deeper-trace.** Compare repo's binary-specialization check to pilot's at 2026-03.

### Diamond distinguishability warnings *(2025-07)*

**Pilot release-notes claim:** new warnings on diamond inheritance distinguishability (e.g. `Vehicle`→`Car`/`Truck`→`SUV`). **Repo:** zero hits for `validateDistinguishability` or `distinguishabilityOfNamesIn` — likely missing. **Status: missing.** Spec-defined; implementable.

### Filter-expression rewrite *(2026-03)*

Already covered in [Chunk 5 §6](05-expressions-evaluation.md#6-filter-expression-qualified-name-feature-refs-2026-03). `checkConnectorTypeFeaturing` exists in the repo by name; whether the algorithm matches the 2026-03 fix is unverified.

### Implicit `subject`/`objective` insertion removed *(2025-07)*

**Pilot release-notes claim:** any `requirement def`/`use case`/`concern` with stakeholders/actors/extra params now requires explicit `subject;` or `objective;`. **Repo:** would land in [`sysml-validator.ts`](../../../packages/syside-languageserver/src/services/validation/sysml-validator.ts) — search for `validateRequirementDefinitionSubject` / `validateUseCaseSubject` / similar. Not done in this chunk.

---

## Implementation pattern

For Chunk 6's 13 validations, the implementation pattern is uniform:

```typescript
@validateKerML(ast.SomeNode)
validateXxx(node: SomeNodeMeta, accept: ModelValidationAcceptor): void {
    if (/* the spec-defined predicate fails */) {
        accept("error", "Spec-mandated message", {
            element: node,
            code: "validateXxx",
        });
    }
}
```

Each validator's predicate is described in the OMG specification PDFs (KerML spec for items 1–7, SysML spec for items 8–13). The 2026-01 cleanup essentially says "translate each spec constraint into running code" — the work is largely mechanical once the spec text for each constraint is in hand.

A reasonable prototype-phase target: **pick one** (e.g. `validateUsageIsReferential`), implement it end-to-end with tests, validate the pattern, then template the remaining 12.

## What I have *not* done

- **Read the spec PDFs** to extract the exact predicate for each of the 13 validations. This is the precondition for writing the actual code; should be a planning-phase or prototype-phase activity.
- **Verified `validateConnectorBinarySpecialization`** semantically against the 2025-07 fix (only confirmed it exists by name).
- **Searched for diamond-distinguishability validation** beyond a top-level grep.
- **Checked the implicit-`subject`/`objective` rule** beyond what the digest states.

## Open questions for Armin

1. **The "implicitly ensured by the model" pattern is consistent.** Was the original design intent to defer all validation to runtime/typing rather than encode each spec constraint? If so, the 2026-01 catch-up is also a small philosophical shift — happy to have you steer on whether we keep that bias and only enable when the validation matters in user-visible diagnostics, or commit to mechanical spec-to-validator translation for all.
2. **Order of implementation:** the 13 validations vary in user-visible importance. A subset (e.g. `validateFlowEndIsEnd`, `validatePortUsageIsReference`) likely catches frequent user mistakes; others may matter mostly for tool conformance. Worth your sense of priority before we sequence.
