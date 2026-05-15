# Chunk 5 — Expressions & evaluation (2026-03 upgrade)

> **Per-upgrade artifact, exploration phase.** Cross-reference of expression-and-evaluation items from [`release-notes-digest.md`](release-notes-digest.md).
>
> **Method:** Static survey of the repo's evaluator and function-library directories, plus targeted greps. No new probes for this chunk.

## Summary

| # | Item | Status | Confidence |
|---|------|--------|------------|
| 1 | Constructor expressions parsed and model-level-evaluated; non-behavior invocation-as-constructor errors (2025-02, 2025-04) | **missing** at all layers | understood |
| 2 | `ControlFunctions::collect`/`select` model-level evaluable; `seq.{…}`/`seq.?{…}` (2025-11) | **partial** — model classes exist, evaluator entries TBD | structurally-clear |
| 3 | All `SequenceFunctions`, `CollectionFunctions`, `ControlFunctions`, `min`/`max`, collection `==`/`!=` evaluable (2025-12) | **partial** — function families exist, completeness unverified | structurally-clear |
| 4 | All `TrigFunctions` evaluable (2026-01) | **missing entirely** — no `trig.ts` in functions/ | understood |
| 5 | Reduced model-level-evaluable set per spec: `prod`/`sum`/`excludes`/`includes`/`isEmpty`/`notEmpty`/`size`/`Length`/`Substring` no longer model-level evaluable (2025-11) | **needs-deeper-trace** — repo's set unverified | structurally-clear |
| 6 | Filter-expression qualified-name feature refs now invalid; must use `(as T).f` (2026-03) | **likely already in shape** — `checkConnectorTypeFeaturing` exists by name | structurally-clear |

---

## 1. Constructor expressions *(2025-02 / 2025-04)*

**Pilot release-notes claim:** `new T(args...)` is a parsed-and-evaluated expression. An invocation expression whose target is a non-behavior/non-step/non-expression is now an error (was implicitly a constructor).

**Repo:**
- Grammar: zero hits for `'new'` (Chunk 1 item 3 — confirmed missing).
- AST: no `InstantiatedTypeMember` rule.
- Evaluator: search for `Constructor` returns 1 hit in [`utils/scopes.ts`](../../../packages/syside-languageserver/src/utils/scopes.ts) — likely incidental, not constructor-expression handling.

**Status: missing.** Three-layer gap: grammar (Chunk 1), AST (Langium-generated), evaluator (this chunk).

**Implementation impact:** new `InstantiatedTypeMember` AST node, new evaluator entry (`ConstructorExpression` evaluation builds an instance of the named type with bound args), new validator rejecting old "implicit constructor" forms.

## 2. `collect` / `select` *(2025-11)*

**Pilot release-notes claim:** `ControlFunctions::collect` and `ControlFunctions::select` are now model-level evaluable, enabling `seq.{…}` and `seq.?{…}` shorthand.

**Repo:**
- Model classes exist: [`packages/syside-languageserver/src/model/KerML/expressions/collect-expression.ts`](../../../packages/syside-languageserver/src/model/KerML/expressions/collect-expression.ts) and [`select-expression.ts`](../../../packages/syside-languageserver/src/model/KerML/expressions/select-expression.ts).
- Function-library file: [`packages/syside-languageserver/src/model/expressions/functions/control.ts`](../../../packages/syside-languageserver/src/model/expressions/functions/control.ts).

**Status: partial.** AST and model machinery present; whether the evaluator actually evaluates `collect`/`select` (vs. erroring out) requires reading `control.ts` end-to-end. Not done in this chunk.

## 3. Sequence / Collection / Control functions evaluable; collection `==`/`!=` *(2025-12)*

**Repo function-library directory** (`src/model/expressions/functions/`):

```
arithmetic.ts  base.ts  boolean.ts  control.ts  index.ts
numerical.ts   sequence.ts          string.ts
```

So `sequence.ts` and `control.ts` exist. **`collection.ts` does not exist as a separate file** — collection-specific functions may be merged into `sequence.ts` or `base.ts`. The 2025-12 release notes treat `SequenceFunctions` and `CollectionFunctions` as distinct families; whether the repo's organization preserves that distinction is unverified.

**Status: partial.** Need a per-function audit against the spec's `CollectionFunctions` and `SequenceFunctions` libraries to determine which are missing. The 2025-12 change is about *expansion of the evaluable set* — items already present remain evaluable; new ones (e.g. collection equality) need entries.

**Collection equality:** the digest mentions `==`/`!=` working on collections — this is potentially a special case in the evaluator's binary-op dispatch rather than a function entry. Not yet checked.

## 4. `TrigFunctions` *(2026-01)*

**Repo:** the function-library directory has no `trig.ts`. Zero hits for `TrigFunctions`, `arctan`, `arccos`, `arcsin`, `sinh`, `cosh`, `tanh`, etc. in production code (a search returns only test snapshots and library text).

**Status: missing entirely.** A new `trig.ts` file under `functions/` plus evaluator entries.

## 5. Reduced evaluable set *(2025-11)*

**Pilot release-notes claim:** `prod`, `sum`, `excludes`, `includes`, `isEmpty`, `notEmpty`, `size`, `Length`, `Substring` are no longer model-level evaluable (per spec they shouldn't be).

**Repo:** the repo's evaluable set is implicit in which functions register evaluator entries. A targeted grep in [`packages/syside-languageserver/src/model/expressions/functions/`](../../../packages/syside-languageserver/src/model/expressions/functions/) for these names is the natural next step but I have not done it in this chunk.

**Status: needs-deeper-trace.** Per the conformance rule, if any of these names *are* currently evaluated, they should be removed.

**Risk:** removing them breaks user models that depend on them being evaluable. Per the conformance rule, that's acceptable — the spec is the source of truth. Still, this is a *visible* breakage worth flagging when planning.

## 6. Filter-expression qualified-name feature refs *(2026-03)*

**Pilot release-notes claim:** feature references in filter expressions using qualified names now violate `checkConnectorTypeFeaturing`; must rewrite as feature chains using `(as T).f`.

**Repo:** [`kerml-validator.ts`](../../../packages/syside-languageserver/src/services/validation/kerml-validator.ts) has a `checkConnectorTypeFeaturing` rule with code `"checkConnectorTypeFeaturing"` (line 912). The validator existed before 2026-03; whether its current implementation enforces the new constraint depends on what it actually checks.

**Status: likely already in shape, but needs verification.** This is a small, focused validator — reading the full rule (~30 lines around line 911) and comparing to the pilot's would close it.

---

## What I have *not* done

- **Per-function audit** of which `SequenceFunctions` / `CollectionFunctions` / `ControlFunctions` are evaluable in the repo vs. the spec's intended set. Recommended pre-implementation; ~1–2 hours of focused reading.
- **Read the evaluator entry points** (`evaluator.ts`, 353 lines) end-to-end. Important for understanding how the evaluable-set is wired and how new functions get registered.
- **Compared the repo's `checkConnectorTypeFeaturing` to pilot.**
- **Spec PDF cross-reference** for the exact set of model-level-evaluable functions (which is a normative table somewhere in the KerML spec).

## Open questions for Armin

1. **Collection equality (`==`/`!=`):** binary-op concern or function-library entry?
2. **`Length`/`Substring`** (now non-evaluable per 2025-11): historical evaluable status?
3. **Constructor expression evaluation depth:** opaque instance, or full structural?

## Resolved (2026-05-04)

1. **Function-library entry.** These operators are usually defined as functions in the library (KerML or low SysML), so collection equality lands as a registered evaluator function entry, not a special-case in binary-op dispatch.
2. **Still pending** — small spec-PDF cross-check sufficient.
3. **Opaque instance is enough.** Per the [authoring-not-execution](../../../) principle: full structural evaluation is not needed for authoring diagnostics. Build an instance of the named type with bound args; do not run the constructor body.
