# Prototype P1 — Default-value type propagation — Results

> Worktree branch: `proto/p1-default-value-type-prop`. Uncommitted; the
> main agent reviews the diff in place.

## Scope completed

End-to-end implementation of the rule **"when a feature has a default value
and no explicit specialization, infer its type from the value's return
type"**, plus a Jest test that exercises the rule, plus a fork-patch
verification against the bundled stdlib.

## What I changed

### 1. `packages/syside-languageserver/src/services/shared/workspace/metamodel-builder.ts` — `addFeatureValueTypings`

The method already existed but bailed out when the value's return type
wasn't itself a `Feature`. Since literals (`5`, `"hi"`, `true`, `1.5`) and
many other expressions resolve their `returnType()` to a **non-Feature
Type** (e.g. `ScalarValues::Integer`, a `DataType`), the inference never
fired for the canonical P1 case.

```diff
- if (!type || !type.is(Feature)) return;
-
- const specialization = SubsettingMeta.create(...);
- node.addHeritage([specialization, type]);
+ if (!type) return;
+
+ const specialization = type.is(Feature)
+     ? SubsettingMeta.create(this.util.idProvider, document, { isImplied: true })
+     : FeatureTypingMeta.create(this.util.idProvider, document, { isImplied: true });
+ node.addHeritage([specialization, type]);
```

Net change: 3 lines logical, plus a longer doc comment. The early-return
condition (`direction !== "none"`, no explicit specialization) is
unchanged — the rule still fires only when there is no other
specialization (FeatureTyping, Subsetting, Redefinition, Conjugation) and
the feature is not a parameter.

### 2. `packages/syside-languageserver/src/model/KerML/expressions/literal-number.ts` — `returnType()`

While wiring up the P1 test I hit a pre-existing bug: `LiteralNumber.returnType()`
returned `"ScalarValues::Rational"` for integer literals and
`"ScalarValues::Integer"` for non-integers — the branches were swapped.
The pilot's `Performances.kerml` (lines 132–148) is clear:
`LiteralIntegerEvaluation` returns `Integer[1]` and `LiteralRationalEvaluation`
returns `Real[1]`. Fixed the swap.

```diff
- return this.isInteger ? "ScalarValues::Rational" : "ScalarValues::Integer";
+ return this.isInteger ? "ScalarValues::Integer" : "ScalarValues::Real";
```

(Note: `LiteralRationalEvaluation` returns `Real`, not `Rational`, per the
spec comment — "to allow easy type conformance of LiteralRationals when a
Real result is expected.")

This is technically out of scope ("don't gold-plate"), but the P1 test for
`feature x default 5;` cannot meaningfully assert `Integer` without it,
and the symmetric `1.5 → Real` case is the same one-character fix. I
reported it explicitly rather than hide it under the prototype label.

### 3. `packages/syside-languageserver/src/__tests__/kerml/core/features.default-value-type.test.ts` (new)

9 tests, all passing. Inlines minimal `Base` / `Performances` / `ScalarValues`
stubs (the existing convention in `features.test.ts` and
`implicits.test.ts` because `parseKerML` defaults to `standardLibrary: "local"`).

Tests covered:

| # | Case |
|---|------|
| 1 | `feature x default 5;` → `ScalarValues::Integer` |
| 2 | `feature x default "hi";` → `ScalarValues::String` |
| 3 | `feature x default 1.5;` → `ScalarValues::Real` |
| 4 | `feature x default true;` → `ScalarValues::Boolean` |
| 5 | `feature x = 5;` (initial/binding value, same path) → `Integer` |
| 6 | Explicit type wins: `feature x : String default 5` → only `String`, never `Integer` |
| 7 | Inferred relationship is an implicit `FeatureTyping` (not a Subsetting) |
| 8 | If the value is a *feature reference*, the inferred relationship is a `Subsetting` to that feature (pre-existing path preserved by the refactor) |
| 9 | Redefinition + default value: P1 does **not** fire (documents the strict scope) |

## Test results

- New file: 9/9 pass.
- Full languageserver suite: **71 suites, 2127 tests pass, 0 failures, 8
  skipped (unchanged)**. No regressions.

## Fork-patch verification — surprising finding

Per the brief I picked the two simplest Cat. B patches —
`TradeStudies.sysml` line 89 (`:>> alternatives: ScalarValue`) and
`Performances.kerml` line 45 (`dispatchScope : Performance`) — un-patched
them in the bundled stdlib, and ran a one-off Jest verification that
loaded the file with `standardLibrary: "standard"` and
`validationChecks: "all"`.

**Result:** both un-patched files produce **zero diagnostics**, with **or
without** the P1 change. Confirmed by temporarily reverting the
`addFeatureValueTypings` change and re-running.

So:

1. The P1 rule is correct and works end-to-end for the canonical
   "no-type, has-default" case.
2. **None of the catalogued Cat. B fork patches is actually retired by
   this rule.** They were applied at a time when the LSP rejected the
   un-patched form, but the repo has drifted since (probably via the same
   2025-09 / 2025-11-style name-resolution / typing fixes the digest
   discusses). At HEAD, *several* of the Cat. B patches appear to already
   be moot — like Category C in the catalogue.
3. The diff that "would have been needed" without my change is not a
   patch-retirement diff at all — it's an empty diff, because the patch
   isn't needed even without my change.

This is an unexpected outcome relative to what the catalogue predicted.
The catalogue (`02-library-builtins-fork-patches.md` §B) flagged these
files as "fork-only and will resurface" — but at HEAD they don't
resurface, at least not on the two examples I checked.

Recommendation: re-run the moot-vs-fork-only classification across all
Cat. B patches before fanning out, because the cheap fix may simply be
"drop the patch" rather than "implement the LSP rule".

The exploratory verification test was discarded after the experiment per
the brief ("do not commit") — it's not part of the prototype's
deliverable. I left an empirical anchor in
`features.default-value-type.test.ts` instead (test #9 above) which
documents the strict scope of P1 against the kind of pattern the patches
target (redefinition + default value).

## Unexpected complexity

- The P1 method already existed (`addFeatureValueTypings`). The fix was a
  3-line conditional inside it, not new wiring.
- Pre-existing `LiteralNumber.returnType()` swap (Integer ↔ Rational)
  blocked the test. Fixed in scope; called out explicitly above.
- The `LiteralRationalEvaluation` semantic — "Rationals return Real, not
  Rational, so that Real-typed features accept rational literals" — is a
  spec quirk worth noting if anyone re-derives typing logic from the
  literal-class names.
- The test had to inline its own `Base` / `ScalarValues` stubs because
  `parseKerML` defaults to `standalone: true, standardLibrary: "local"`,
  which doesn't pull in the real bundled stdlib. Existing tests
  (`features.test.ts`, `implicits.test.ts`) do the same — established
  pattern.

## Fan-out recommendation for the other ~3 Cat. B inference rules

Mechanically, **don't fan out P1's pattern directly to them** — they are
each a *different* problem:

| Patch family | Required rule | Same shape as P1? |
|---|---|---|
| Defaulted feature → infer type from default value | P1 (this prototype) | — |
| `size(...)` returning constrained `Positive` | **Function return-type narrowing**: an `InvocationExpression`'s `returnType()` would need to consult the callee's `result` parameter type rather than just `getFunction()?.returnType()`. Distinct architecture from P1 (no feature-value involvement). | No |
| `runToCompletionScope` implicitly usable as `Performance` | **Inheritance-based subtype acceptance**: when a feature is typed by `T` via inheritance and the context expects `T`, the LSP should accept the value without an explicit cast. Lives in the type-conformance/`validateAllTypings` layer, not the metamodel-builder. | No |
| Implicit-redefinition feature ascription (e.g. `feature redefines dispatchScope default thisPerformance` — needs to narrow type via the redefined feature's defaults) | **Redefinition-derived type propagation**: more delicate — needs to walk the redefinition chain and combine types. Could be added to `addFeatureValueTypings` by relaxing the "no explicit specialization" guard, but only after spec consultation on precedence. | Partly |

So my recommendation: **treat each as its own prototype**. The
fork-patch-retirement story should be revisited *first* with the
empirical re-classification (some of these Cat. B patches may already be
moot), before any of the four rules is implemented.

The cheap follow-up before more LSP work: run a per-file "un-patch +
validate" pass across all 26 fork-modified files. The cost is small (one
Jest test in the harness pattern I prototyped here), and the resulting
moot-vs-fork-only matrix will give a much sharper basis for prioritising
the remaining type-system work.

## Files changed (summary)

- `packages/syside-languageserver/src/services/shared/workspace/metamodel-builder.ts`
  (P1 rule, ~6 LoC of substantive change in `addFeatureValueTypings`).
- `packages/syside-languageserver/src/model/KerML/expressions/literal-number.ts`
  (one-character semantic fix in `returnType()` plus a comment).
- `packages/syside-languageserver/src/__tests__/kerml/core/features.default-value-type.test.ts`
  (new, 9 tests).
