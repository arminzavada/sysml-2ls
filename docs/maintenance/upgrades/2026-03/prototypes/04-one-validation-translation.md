# Prototype P4 — One validation translation

> **Subagent brief.** Validates the "13 validations are mechanical translations" claim from [`06-validation-rules.md`](../06-validation-rules.md).

## Goal

Pick one of the 13 missing 2026-01 validations, implement it from the spec, un-skip the corresponding skipped test, ensure no regressions.

## What this prototype answers

**Question:** Is translating a spec constraint to a validator function actually mechanical, or are there hidden complexities (cross-feature dependencies, evaluator-side concerns, lifecycle issues)?

## Recommended target

**`validateUsageOwningType`** — the skipped test at [`sysml-validator.test.ts:138`](../../../packages/syside-languageserver/src/services/validation/__tests__/sysml-validator.test.ts).

Reasoning:
- Already has a written-but-skipped test, so the "what to validate" question has a starting answer.
- The constraint is purely structural ("a SysML Usage cannot be owned by a KerML Type"), not requiring evaluator integration or complex feature traversal.
- One of the simplest of the 13 — good calibration baseline.

If the spec predicate proves more complex than expected, fall back to one of the other "exists by name as 'implicitly ensured'" validations from [the table in 06-validation-rules.md](../06-validation-rules.md#summary).

## In scope

- Implement `validateUsageOwningType` per the SysML spec's normative constraint.
- Un-skip the existing test in [`sysml-validator.test.ts:138`](../../../packages/syside-languageserver/src/services/validation/__tests__/sysml-validator.test.ts).
- Confirm the un-skipped test passes.
- Existing tests stay green.
- Document any deviation from the pilot (if you make the rule stricter than the pilot's; per the [stricter-than-pilot rule](../../../) it's OK with documentation).

## Out of scope

- The other 12 validations.
- Any spec-PDF-cross-reference work beyond reading the predicate for this one validator.
- Touching unrelated validators.
- Committing. Branch `proto/p4-one-validation`.

## Success criteria

- New code in [`sysml-validator.ts`](../../../packages/syside-languageserver/src/services/validation/sysml-validator.ts) (or `kerml-validator.ts` if you discover the constraint is actually a KerML-level rule).
- The skipped test in [`sysml-validator.test.ts:138`](../../../packages/syside-languageserver/src/services/validation/__tests__/sysml-validator.test.ts) un-skipped and passing.
- Test count moves from "8 skipped, 2118 passed" to "7 skipped, 2119 passed" (or equivalent — could be more if you add positive cases).
- Existing tests all green.

## Required reading

1. [`06-validation-rules.md`](../06-validation-rules.md).
2. [`feedback_stricter_than_pilot_ok_if_documented.md`](../../../) memory.
3. [`project_authoring_not_execution.md`](../../../) memory.
4. SysML v2 spec PDF — local copy at `~/work/systems-modeling/SysML-v2-Release/doc/2a-OMG_Systems_Modeling_Language.pdf` (per [`spec_pdf_locations.md`](../../../) memory). Search it for `validateUsageOwningType` or for the constraint about Usages and their owning Types.
5. Existing validator patterns in [`sysml-validator.ts`](../../../packages/syside-languageserver/src/services/validation/sysml-validator.ts). Look at neighbors like `validateUsageVariationSpecialization` (line 138-ish) for the decorator pattern and predicate style.

## Method

1. Read the SysML spec PDF for the formal definition of `validateUsageOwningType` (likely in chapter on "Usages" — search for "OwningType" or "Usage" constraints).
2. Translate the predicate into TypeScript using the existing decorator pattern (`@validateSysML(ast.Usage, ...)`).
3. Un-skip the test.
4. If the test passes as-is, great. If it doesn't (e.g. the model setup is incorrect), update either the test or the validator (whichever is wrong relative to the spec).
5. Run the full test suite.
6. Write the results doc.

## Output

**1. Code changes**, uncommitted, branch `proto/p4-one-validation`:
- New validator function in `sysml-validator.ts` or `kerml-validator.ts`.
- Test un-skipped.

**2. Results writeup** at `docs/maintenance/upgrades/2026-03/prototypes/results/04-one-validation-result.md`:
- Spec section quoted verbatim (the constraint text).
- Implementation (the validator function, ~10 LoC).
- Whether the implementation was indeed mechanical (1 hour or less) or had hidden complexity.
- Any deviation from the pilot or spec, with rationale.
- Recommendation for fan-out: do the other 12 validations look mechanically similar, or did this one reveal a pattern of variation we should expect?

## Report back

~300 words: target validation, spec excerpt, implementation summary, test outcome, mechanical-or-not assessment.

## If scope expands

If the constraint turns out to require cross-feature analysis (e.g. tracing through specializations, evaluator state, scope resolution), **stop**. The whole point of the prototype is to validate mechanical translation; non-mechanical constraints are a separate problem class.
