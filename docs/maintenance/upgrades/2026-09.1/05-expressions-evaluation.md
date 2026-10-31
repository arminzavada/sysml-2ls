# Chunk 5 — Expressions & evaluation (2026-09.1 upgrade)

> **Per-upgrade artifact.** Evaluator and expression-typing changes in the pilot between `2026-03` and `2026-09.1`, checked against `packages/syside-languageserver/src/model/expressions/` and the expression metaclasses in `src/model/KerML/expressions/`.
>
> **Method:**
>
> - Pilot: license-stripped diffs of `org.omg.sysml.logic/.../expressions/` (model-level evaluator and its function library), `util/EvaluationUtil.java`, `util/ExpressionUtil.java`, the expression adapters, and `org.omg.sysml.execution/src` (the full evaluator), each attributed with `git log`.
> - Probes: a scratch Node script loads the built `lib/` of the language server with the pinned (`2026-03`) stdlib and prints diagnostics and implied specializations; snippets are quoted below.
>
> **Priority:** authoring, not execution. Evaluator-only items are low priority unless an authoring diagnostic, implicit typing or scoping depends on them.
>
> **Tags:** `understood` / `structurally-clear` / `needs-deeper-trace` / `consult-Armin`.

## Summary

| # | Tag | Item | Gap | Priority | Confidence |
| --- | --- | --- | --- | --- | --- |
| E1 | 2026-05 (library) | `OrderedMap :> OrderedCollection` changes what `#` returns on maps | none: `IndexFunction` logic is the same on both sides | low | `understood` |
| E2 | 2026-07 (OCL), pre-existing | `IndexExpression` result typing skips any `Collections::Collection` (KERML11-69) | ours types `c#(i)` as the collection, so `.elements` etc. resolve; we accept more | low–medium | `needs-deeper-trace` |
| E3 | 2026-09 | Enumeration-typed reflective meta-properties (ST6RI-971) | not applicable: we have no reflective metaclass access | low | `understood` |
| E4 | 2026-09 | Expression result parameters created at parse time (ST6RI-979) | internal pilot refactor | none | `understood` |
| E5 | 2026-05…09 | Function library, model-level evaluable set, full evaluator | unchanged in range | none | `understood` |

**Headline:** the range is quiet. No model-level function was added, removed or changed. `LibraryFunctionFactory` and the `functions/` classes differ only in license headers and imports, and the pilot's `IndexFunction` is byte-identical at both tags. The `OrderedMap` concern from chunk 2 resolves to "conformant". The one item with authoring reach, E2, is pre-existing, and only the OCL changed in range. Nothing here gates other chunks.

**Size:** E2 is about an hour if taken. Everything else is zero.

---

## E1. Indexing an `OrderedMap` (library change 2026-05, KERML11-144)

**Pilot:** `org.omg.sysml.logic/.../expressions/functions/base/IndexFunction.java`, unchanged in range:

- `isArray` (specializes `Collections::Array`) → `indexArray`;
- otherwise, with one integer index, `isOrderedCollection` (specializes `Collections::OrderedCollection`) → `indexCollection` over `Collection::elements`;
- else `indexSequence`.

**Ours:** `model/expressions/functions/base.ts` `IndexFunction` (line 105) has the same three branches in the same order. Once the library makes `OrderedMap :> Map, OrderedCollection`, both implementations take the `OrderedCollection` branch, so `om#(1)` yields the first `KeyValuePair` in both.

Pre-existing evaluator differences, out of range:

- An out-of-bounds index throws here; the pilot returns the empty sequence.
- A non-integer or mismatched index throws here; the pilot returns the invocation unevaluated.

Both surface only where model-level evaluation reports errors (semantic-metadata base types, filter conditions).

**Status:** `understood`. No gap from the range.

## E2. `IndexExpression` result typing (KERML11-69)

**Pilot:** `adapter/IndexExpressionAdapter.addResultTyping` adds an implied `Subsetting` from the result to the first argument's result *only if that does not specialize `Collections::Collection`*. For a collection argument the result keeps only `'#'::result : Anything[0..1]`. The implementation already used `Collection` before `2026-03`; in range only the OCL moved from `Collections::Array` to `Collections::Collection`, and the TODO was dropped.

**Ours:** `model/KerML/expressions/operator-expression.ts` `returnType()` (line 98) returns `typeOf(this.args[0])` for `#` unconditionally. This return type drives three things:

- the implicit typing of a feature from its value (`metamodel-builder.ts` `addFeatureValueTypings`, line 1211);
- scoping of a chain after an expression (`scope-provider.ts` `resolveChainPrevious`, line 347);
- several `kerml-validator.ts` checks.

Probe:

```sysml
package Idx {
    private import Collections::*;
    private import ScalarValues::*;
    attribute om : OrderedMap;
    attribute arr : Array;
    attribute xs : Real[*];
    attribute a1 = om#(1);                  // ours: implied Subsetting -> Idx::om
    attribute a2 = (om#(1)).elements;       // ours: resolves to Collections::OrderedMap::elements
    attribute a3 = (arr#(1)).dimensions;    // ours: resolves to Collections::Array::dimensions
    attribute a4 = xs#(1);                  // ours: implied Subsetting -> Idx::xs (agrees with pilot)
}
```

No diagnostics here. In the pilot, `om#(1)`/`arr#(1)` would not subset `om`/`arr`, and `.elements`/`.dimensions` on an `Anything`-typed result should fail to link. That pilot-side outcome is read from code and was not run.

**Gap:** pre-existing. For collection arguments we type the indexed value as the whole collection: wrong implicit subsetting, and chains the pilot rejects get accepted. **Fix:** in `returnType()`, return the function's result type, not `typeOf(args[0])`, when the argument conforms to `Collections::Collection`. **Size:** about an hour with tests. **Status:** `needs-deeper-trace` (confirm the pilot's chain-scoping outcome).

## E3. Enumeration-typed reflective meta-properties (2026-09, ST6RI-971)

**Pilot:**

- `util/EvaluationUtil.java`: `results`/`elementFor` take a context element. A reflective value that is a Java enum is mapped by the new `enumUsage` to the library's enumeration usage (`KerML::Root::…`, `KerML::Core::…`, `KerML::Kernel::…` or `SysML::Systems::<Enum>::<literal>`); before, it became `null`.
- `ModelLevelExpressionEvaluator.evaluateFeature` passes the feature as context.
- Test: `(P meta SysML::PartDefinition).owningMembership.visibility` evaluates to `public`.

**Ours:** `model/expressions/evaluator.ts` `evaluateFeature` returns `[]` for any feature of a metaclass feature (`// TODO: reflection`, line 324). Only `annotatedElement` is evaluated. With no reflective attribute access at all, there is nothing to map.

**Gap:** pre-existing and wider than the range. Filter conditions or semantic metadata that read metaclass attributes (`visibility`, `isAbstract`, …) evaluate to empty here. **Status:** `understood`, low.

## E4. Result parameters created at parse time (2026-09, ST6RI-979)

**Pilot:**

- `TypeUtil.addResultParameterTo` moved from the `addAdditionalMembers` of `InvocationExpressionAdapter`, `FeatureReferenceExpressionAdapter` and `ConstructorExpressionAdapter` into the `FeatureReferenceExpression`/`InstantiationExpression` post-processors.
- `EvaluationUtil` and `ExpressionEvaluator` now add a result parameter to expressions they synthesize.

The goal is that read access no longer mutates the model. Results are unchanged.

**Ours:** result parameters are modeled separately (`resultParameter()`/`returnType()`), so there is nothing to mirror. **Status:** `understood`.

## E5. Unchanged areas

- `org.omg.sysml.logic/.../expressions/functions/**` and `LibraryFunctionFactory`: license only, so the model-level evaluable set is unchanged in range. The 2026-03 cycle's chunk 5 items (trig functions, collection functions, constructor expressions) are not affected.
- `org.omg.sysml.execution/src`: license and `addResultParameterTo` only (E4). `MaximizeFunction`/`MinimizeFunction` change only an import (`SysMLLibraryUtil` moved package).
- `ExpressionUtil`: new `getArgumentOf(InstantiationExpression)` (moved from the setting delegate) and `Objects::nonNull` refactors.
- Library expressions in range need no evaluator support for authoring:
  - the `Collections::Map` key-uniqueness `inv` (we don't evaluate invariants);
  - the `'['::elements` `nonunique` change (our `OPERATORS.QUANTITY` handling ignores uniqueness, see chunk 2 L2);
  - `TransitionPerformance::triggerTarget default accept.receiver ?? this` (default values are not evaluated for diagnostics).
- `Namespace::resolve*` (evaluation-side API) is covered in chunk 3 S3.

**Status:** `understood`.

---

## Open questions

1. **E2:** fix the index result typing in this cycle (an hour, removes an accept-more case), or defer with the other evaluator-adjacent typing gaps? Confirming the pilot's chain-scoping outcome first would take a pilot run.
2. **E1/E3:** align out-of-bounds/unevaluable index behavior and add reflective metaclass attributes only when an authoring feature needs them (metadata filters)? Recommendation: defer; record nothing new, since both are pre-existing evaluator gaps.
