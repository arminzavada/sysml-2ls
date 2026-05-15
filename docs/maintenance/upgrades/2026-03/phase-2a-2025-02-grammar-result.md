# Phase 2a — 2025-02 grammar & AST result

Implements the surface-syntax and AST changes the pilot's 2025-02 release introduced. Stdlib content stays at upstream 2024-12; library-name fallout will be addressed in Phase 2b.

Branch: `phase-2a-2025-02-grammar` (no commits — main agent commits after review).

## Per-keyword changes

### 1. `var` / `const` (KerML) replacing `readonly`

**Before** (`KerML.expressions.langium`):

```
fragment Readonly:
    isReadOnly='readonly'
;
```

**After**:

```
fragment ConstantOrVariable:
    isVariable?='var' | isConstant?='const'
;
```

`BasicFeaturePrefix` rewritten in `KerML.langium` to match pilot ordering — `direction`, `derived`, `abstract`, `composite|portion`, `var|const`. Note: `EndFeaturePrefix` does not exist yet in 2025-02 (it lands in 2025-11), so `const end feature` is *not* yet a valid form and was deferred.

### 2. `constant` (SysML) replacing `readonly`

`RefPrefix` in `SysML.langium`:

```
fragment RefPrefix:
    ( direction=FeatureDirectionKind )?
    Derived?
    BasicDefinitionPrefix?
    ( isConstant?='constant' )?
;
```

### 3. `derived` keyword position

Moved from the end of the prefix to immediately after `direction`, before `abstract`/`composite`/etc. Models that put `derived` last (the repo's prior position) will now fail to parse — accepted per conformance-over-compatibility.

### 4. `new` constructor expression

Added `ConstructorExpression` AST interface (subtype of `InvocationExpression`) plus parser rule in both `KerML.langium` and `SysML.langium`:

```
ConstructorExpression returns ConstructorExpression:
    'new' heritage+=OwnedFeatureTyping ArgumentList
;
```

Wired into `BaseExpression` alternative. New `ConstructorExpressionMeta` model class delegates to `InvocationExpressionMeta` for printing/evaluation; printer entry added in `print.ts`. **Deferred** (TODO in source): validating that the legacy "implicit constructor call" (calling a non-behavior/non-step/non-expression as if it were a constructor) is rejected — not in scope for this phase.

### 5. `$::` global-scope qualifier

Added to `QualifiedReferenceChain`:

```
fragment QualifiedReferenceChain:
    ( isGlobal?='$' '::' )?
    parts+=[Element:Name] ('::' parts+=[Element:Name])*;
```

The `isGlobal` flag is set on `ElementReference` (added to AST interface). **Scope-resolution semantics deferred** — models with `$::Foo` parse correctly, but the global qualifier is currently ignored at resolution time. TODO marker placed in the grammar fragment.

### 6. Expanded `send` action notation

`SendNode` / `SendNodeDeclaration` (used in three sites: standalone, `StateActionUsage_4`, `EffectBehaviorUsage_4`) rewritten to:

```
fragment SendNodeDeclaration:
    ActionNodeUsageDeclaration? 'send'
    ( payload=NodeParameterMember SenderReceiverPart?
    | 'to' receiver=NodeParameterMember
    )?
;

fragment SenderReceiverPart:
    'via' sender=NodeParameterMember ( 'to' receiver=NodeParameterMember )?
    | 'to' receiver=NodeParameterMember
;
```

Now supports: `send { … }` (bodied), `send T`, `send T via S`, `send T via S to R`, `send T to R`, `send to R`. The `payload` field on `SendActionUsage` was made optional in the interface to allow the bodied / empty-payload forms. A guard was added in `SemantifyrActionMapper.mapSendActionUsage` for the now-optional payload, with a TODO to lower the new forms properly.

### 7. `accept` action body redefining `receiver`

No grammar change — confirmed semantic-only per chunk-1 audit. Deferred to whichever phase handles scoping/redefinition.

### 8. `nonunique`

No surface-syntax change in 2025-02. No work.

## AST interface changes

- `KerML.interfaces.langium`: `Feature.isReadOnly` removed; `isConstant`, `isVariable` added.
- `KerML.interfaces.langium`: `ElementReference.isGlobal` added.
- `KerML.interfaces.langium`: `ConstructorExpression` interface added, included in the `InlineExpression` union.
- `SysML.interfaces.langium`: `SendActionUsage.payload` made optional.

## Model-class & code-rename scope

`isReadonly` was a single boolean flag on `FeatureMeta`/`UsageMeta`. It split into:
- `isConstant` — for `const` (KerML) and `constant` (SysML); the strict-immutable form.
- `isVariable` — for `var` (KerML only); explicit time-varying form.

**Mapping rule used:** the old `isReadonly` → `isConstant` semantically; no auto-promotion to `isVariable`. The semantic-token "readonly" modifier now fires on `isConstant` only. The printer in KerML emits `const`/`var`; the SysML printer emits `constant`.

Files touched for the rename (source — not tests):

- `model/KerML/feature.ts` — option/property split.
- `utils/ast-to-model.ts` — populate both flags from the AST.
- `model/semantic-tokens.ts` — semantic-token modifier driven by `isConstant`.
- `model/printer/namespaces.ts` — KerML feature printer.
- `model/printer/definition-usages.ts` — SysML usage printer.
- `model/printer/print.ts` — new `ConstructorExpression` dispatch.
- `services/lsp/semantifyr/SemantifyrActionMapper.ts` — optional-payload guard.
- `model/KerML/expressions/constructor-expression.ts` — new metamodel class.
- `model/KerML/_internal.ts`, `model/KerML/expressions/index.ts` — barrel exports.

Total source files changed: 9 (plus 5 grammar files and generated artifacts).

## Tests touched

- **Modified** to match new keywords / ordering: `__tests__/kerml/core/features.test.ts`, `__tests__/kerml/kernel/implicits.test.ts`, `model/KerML/__tests__/factories.test.ts`, printer tests (`namespaces`, `definition-usages`, `connectors`, `successions`, `actions`), `services/lsp/__tests__/semantic-token-provider.test.ts`, `model/printer/__tests__/utils.test.ts`.
- **Added** test row: `var feature a;` in `features.test.ts`.
- **Updated snapshots**: keyword-list snapshot in `utils.test.ts.snap`, semantic-token snapshot.

## Final test result

```
Test Files  74 passed (74)
Tests       2143 passed | 7 skipped (2150)
```

Net +1 vs baseline (2142 → 2143) from the added `var` test case. No regressions.

`pnpm run build` clean. `pnpm run lint` produces only pre-existing errors in untouched files (`stdlib-loading.test.ts`, `probe-redef-target-resolution.test.ts`, `scope-provider.ts`); verified by stashing the phase-2a diff and re-running.

## Deferred items (TODO markers in source)

| Item | Location | Note |
|------|----------|------|
| `$::` scope-resolution semantics | `grammar/KerML.expressions.langium` (`QualifiedReferenceChain` fragment) | Parsed but ignored; revisit in Chunk 3 (Scoping). |
| Validator: reject old implicit-constructor form | not yet wired | Pilot 2025-02 promotes this to an error; we still silently accept. |
| `accept` body redefining `receiver` | not in grammar | Semantic affordance; phase that handles redefinition. |
| `send { … }` / `send to R` AST lowering for Semantifyr | `SemantifyrActionMapper.mapSendActionUsage` | Guard added; full mapping pending. |
| `const end feature` (2025-11) | not in grammar | Out of scope for 2025-02. |
| Control nodes with full action bodies (2025-04) | not in grammar | Per chunk-1 audit, Phase 2a covers 2025-02 only. |

## Uncertainty / calibration notes

- **`isReadonly` → `isConstant` mapping.** The split is asymmetric: old `isReadonly` was "this feature's value cannot change", which lines up most naturally with `const`. Did not auto-set `isVariable`; the explicit-`var` semantics in 2025-02 is a *new* declarative choice, not a rename of the old behavior. If downstream code needs "either flag means restricted mutability", that combined check should be added explicitly at the consumer rather than baked into one of the flags. Flagged for review.
- **Pilot `EndFeaturePrefix`.** The 2026-03 grammar uses a dedicated `EndFeaturePrefix` fragment with an optional `const` modifier, but 2025-02 does not — it inlines `isEnd ?= 'end'` directly. I matched the 2025-02 shape (no `const` on end features in this phase).
- **`derived` ordering.** Pilot puts `derived` before `abstract`; the printer now matches that. Tests that previously asserted `out abstract composite readonly derived feature c` style ordering were updated.
- **`payload` optional on `SendActionUsage`.** The pilot grammar makes the payload optional; I reflected this on the AST interface. There may be downstream code paths (besides the Semantifyr mapper I touched) that *assume* payload is present in plain-`send T` cases — those still work; only the new bodied / `send to R` forms produce a missing-payload AST.
