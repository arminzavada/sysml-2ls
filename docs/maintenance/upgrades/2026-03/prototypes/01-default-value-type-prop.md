# Prototype P1 — Default-value type propagation

> **Subagent brief.** Self-contained; read the linked memories and chunk docs before starting. Stop and report if scope expands beyond what's specified here.

## Goal

When a feature is declared with a default value but **no explicit type**, the feature's type should be inferred from the return type of the default expression. Example:

```kerml
feature x default 5;     // should infer x : Integer
feature y default "hi";  // should infer y : String
```

This retires one or more fork patches in the bundled stdlib that add explicit `: Type` ascriptions to work around this inference gap.

## What this prototype answers

**Question:** Does the simplest type-inference rule end-to-end (code change + test + patch-retirement) work? If yes, fan out to the other ~3 inference rules in [Chunk 4 §9](../04-type-system.md#9-type-inference-gaps-from-chunk-2-fork-patches-carry-forward-chunk-2-b) is straightforward. If no, we learn what blocks it.

## In scope

- Locate where [`FeatureMeta`](../../../packages/syside-languageserver/src/model/KerML/feature.ts) computes its declared/effective type today.
- Add the rule: **when no declared type is set**, fall back to the default-value expression's return type.
- Write a small Jest test that exercises the rule (under `packages/syside-languageserver/src/__tests__/`).
- Verify a representative fork patch becomes unnecessary — pick the simplest one in [`02-library-builtins-fork-patches.md` Cat. B](../02-library-builtins-fork-patches.md#b-type-ascription--cast-addition), e.g. one of the `: ScalarValue` additions in `TradeStudies.sysml` or a `as Positive` cast in `VectorFunctions.kerml`. Run the test suite against the un-patched library to confirm.

## Out of scope

- Multi-step inference (e.g. type from a default that itself references another defaulted feature).
- Redefinition-derived type inference (separate rule, separate prototype later).
- Implementing the broader set of Cat. B inference rules (`size(...)` narrowing, etc.).
- Touching the grammar.
- Updating any docs beyond your results writeup.
- Committing the changes. Leave them as uncommitted work on a branch `proto/p1-default-value-type-prop`.

## Success criteria

- New Jest test that exercises `feature x default 5;` and asserts `x.type` resolves to `Integer`. **Test passes.**
- Existing test suite still green (no regressions).
- One identified fork patch (your pick from the catalogue) confirmed unnecessary — i.e., if removed, the library content parses without the previous patched line, because the inference fills the gap.

## Required reading

Read these before doing anything:

1. [`project_overview.md`](../../../) memory — project context.
2. [`feedback_conformance_over_compat.md`](../../../) memory — never permit more than pilot.
3. [`feedback_stricter_than_pilot_ok_if_documented.md`](../../../) memory.
4. [`project_authoring_not_execution.md`](../../../) memory — scope of "type inference" for an authoring tool.
5. [`feedback_calibration_on_complexity.md`](../../../) memory.
6. [`04-type-system.md` §9](../04-type-system.md#9-type-inference-gaps-from-chunk-2-fork-patches-carry-forward-chunk-2-b).
7. [`02-library-builtins-fork-patches.md` Cat. B](../02-library-builtins-fork-patches.md#b-type-ascription--cast-addition).

## Where the work lives in the repo

- **Likely target file:** [`packages/syside-languageserver/src/model/KerML/feature.ts`](../../../packages/syside-languageserver/src/model/KerML/feature.ts). Look for where the feature's typing is computed — methods named `types()`, `effectiveType()`, `declaredType()`, `featureTypings()` or similar. The default-value expression is reachable via the feature's `value` or `defaultValue` property.
- **Test location:** `packages/syside-languageserver/src/__tests__/kerml/core/` is the conventional spot. Use existing tests in that directory as templates ([`features.redefinition.test.ts`](../../../packages/syside-languageserver/src/__tests__/kerml/core/features.redefinition.test.ts), [`feature-membership.test.ts`](../../../packages/syside-languageserver/src/__tests__/kerml/core/feature-membership.test.ts)).
- **Test runner:** `cd packages/syside-languageserver && npx jest <path>`.

## Method

1. Read the required-reading list.
2. Locate the typing-computation code path.
3. Decide: where exactly does the fall-back rule fit? (Likely a single short conditional that says "if there are no FeatureTypings, look at the default value's expression and use its return type.")
4. Write a small failing Jest test that captures the expected behavior.
5. Implement the rule.
6. Verify the new test passes and the existing suite is green.
7. Pick one fork patch from Cat. B, remove the patch (just for verification), and confirm the un-patched library parses cleanly thanks to your inference. Then restore the patch (we'll convert the whole batch to `.patch` files in P3; don't change library content here).
8. Write the results doc.

## Output

Two artifacts:

**1. Code changes**, uncommitted, on a branch `proto/p1-default-value-type-prop`:
- The rule implementation (probably <30 LoC).
- The new Jest test.

**2. Results writeup** at `docs/maintenance/upgrades/2026-03/prototypes/results/01-default-value-type-prop-result.md`. Include:
- What you changed (file paths, ~5 lines of summary per change).
- The new test (verbatim).
- Which fork patch you verified unnecessary, and the diff that "would have been needed" without your change.
- Any unexpected complexity encountered: did the typing code path lead through other systems? Did you have to touch metamodel-builder? Anything that surprised you.
- Recommendation for fan-out: do the other ~3 Cat. B inference rules look mechanically similar to this one, or are they each a separate architectural problem?

## Report back

A ~300-word summary in your tool-output reply with: scope completed, test results, fork-patch verification, fan-out recommendation. Detail goes in the results writeup, not the reply.

## If scope expands

If you find that implementing the rule requires changes to multiple files, touches scoping or evaluator code, or surfaces architectural questions about how typing is computed, **stop**. Write a results doc explaining what you found and why scope expanded. The whole point of the prototype is to learn cheaply; running to completion at the cost of context is the wrong outcome.
