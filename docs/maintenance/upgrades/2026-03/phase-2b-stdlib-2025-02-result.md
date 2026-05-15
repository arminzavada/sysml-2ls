# Phase 2b — stdlib advance to 2025-02 + library renames (result)

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`:

```
- const commit = "f49ea19a807a2aa45ad1afed0ed62afe41aabdf9"; // 2024-12
+ const commit = "b17ab0ed8c85e3713c8c27ab89f995d764f8974c"; // 2025-02
```

## Occurrences patch

Applied **cleanly** against 2025-02 without rebase. The hunk in
`sysml.library/Kernel Libraries/Kernel Semantic Library/Occurrences.kerml`
(adding the `end` keyword to `surroundedSpace`) still applies as-is. No
change to `scripts/patches/0001-occurrences-end-keyword.patch`.

## Stdlib content verification

- `Systems Library/Flows.sysml` present.
- `Systems Library/FlowConnections.sysml` absent.
- `Transfers.kerml` ships `Transfer::payload` (replacing `Transfer::item`).

## Renames performed

### File renames (3)

| Old | New |
|---|---|
| `model/SysML/flow-connection-definition.ts` | `model/SysML/flow-definition.ts` |
| `model/SysML/flow-connection-usage.ts` | `model/SysML/flow-usage.ts` |
| `model/SysML/succession-flow-connection-usage.ts` | `model/SysML/succession-flow-usage.ts` |

### Type / identifier renames

- `FlowConnectionDefinition` → `FlowDefinition`
- `FlowConnectionDefinitionMeta` / `…Options` → `FlowDefinition…`
- `FlowConnectionUsage` → `FlowUsage` (and Meta / Options)
- `SuccessionFlowConnectionUsage` → `SuccessionFlowUsage` (and Meta / Options)
- Grammar fragment `FlowConnectionDeclaration` → `FlowDeclaration`
- Printer helpers: `printFlowConnectionUsage` → `printFlowUsage`,
  `printGenericFlowConnectionUsage` → `printGenericFlowUsage`
- Validators: `validateFlowConnectionEnd` → `validateFlowEnd`,
  `validateFlowConnectionUsageTyping` → `validateFlowUsageTyping`
- Validator diagnostic strings updated to match.

### Hardcoded library-path / element-name string updates

- `Systems Library/FlowConnections.sysml` → `Systems Library/Flows.sysml`
  (in `packages/syside-base/src/stdlib.ts`)
- `FlowConnections::flowConnections` → `Flows::flows`
- `FlowConnections::messageConnections` → `Flows::messages`
- `FlowConnections::successionFlowConnections` → `Flows::successionFlows`
- `FlowConnections::MessageConnection` → `Flows::Message`
- `FlowConnections::MessageTransferConnection` → `Flows::Message`
  (2025-02 collapses the binary-vs-n-ary distinction at this level — no
  separate `BinaryMessage` exists in the new library; using the same
  `Flows::Message` for `binary` matches what's there)
- `Transfers::Transfer::item` → `Transfers::Transfer::payload` (in
  `model/KerML/item-feature.ts`, the `ItemFeatureImplicits.payload`
  registration — the only `Transfer::item` literal in the repo)

`MessageTransfer::sentItem`, `MessageTransfer::currentItem`, and
`TradeStudyObjective::fn` had **zero hits** in repo source; no edits
required there.

### Files touched (non-generated)

19 source files edited + 3 renamed + AST + grammar regenerated:

```
packages/syside-base/src/stdlib.ts
packages/syside-languageserver/scripts/clone-sysml-release.mjs
packages/syside-languageserver/src/grammar/SysML.langium
packages/syside-languageserver/src/grammar/SysML.interfaces.langium
packages/syside-languageserver/src/generated/ast.ts          (regenerated)
packages/syside-languageserver/src/generated/grammar.ts      (regenerated)
packages/syside-languageserver/src/model/KerML/item-feature.ts
packages/syside-languageserver/src/model/SysML/flow-definition.ts             (renamed)
packages/syside-languageserver/src/model/SysML/flow-usage.ts                  (renamed)
packages/syside-languageserver/src/model/SysML/succession-flow-usage.ts       (renamed)
packages/syside-languageserver/src/model/SysML/index.ts
packages/syside-languageserver/src/model/SysML/__tests__/factories.test.ts
packages/syside-languageserver/src/model/printer/connectors.ts
packages/syside-languageserver/src/model/printer/print.ts
packages/syside-languageserver/src/model/printer/__tests__/connectors.test.ts
packages/syside-languageserver/src/model/printer/__tests__/definition-usages.test.ts
packages/syside-languageserver/src/services/shared/workspace/metamodel-builder.ts
packages/syside-languageserver/src/services/validation/sysml-validator.ts
packages/syside-languageserver/src/services/validation/__tests__/sysml-validator.test.ts
packages/syside-languageserver/src/utils/ast-to-model.ts
```

## Verification

- `grep -rn "FlowConnection" packages/*/src/` → **0 hits** (post-rename).
- `pnpm run build` → clean.
- `pnpm run lint` → 13 errors / 6 warnings, **identical to the
  pre-change baseline on `bcef55c`** (verified via `git stash` + lint).
  All remaining lint issues are pre-existing in
  `__tests__/integration/*.test.ts`,
  `__tests__/kerml/core/probe-redef-target-resolution.test.ts`, and
  `services/references/scope-provider.ts` — none in files this phase
  touched.
- `pnpm test` → **2152 passed / 7 skipped (2159 total)**, matching the
  pre-change baseline exactly. All Semantifyr integration tests pass.

## Judgment calls

1. **`binary: "Flows::Message"`** for `FlowDefinitionMeta`. The
   2024-12 metamodel registered `binary: "FlowConnections::MessageTransferConnection"`,
   but 2025-02 does not define any binary-specific subtype of
   `Message`. Used the same fully-qualified name as `base` rather than
   inventing one or leaving a broken reference. If/when 2025-02
   introduces a binary variant (e.g. via diamond-collision splits),
   this should be revisited.
2. **Filename mirroring class renames** — confirmed by the resolved
   open question in Chunk 2 (filenames follow class names).
3. **Did not widen scope** to `Clock::currentTime` var-ness,
   `sourceOutput`/`targetInput` retyping, `Performances::constructorEvaluations`,
   or `TradeStudyObjective::fn` — these are content-only changes
   inherited from upstream with zero code coupling in the repo.

## Anything surprising

- The Occurrences patch applied without conflict despite being a
  surgical edit; 2025-02 did not touch the surrounding region.
- No `MessageConnection`/`MessageTransferConnection`-shaped binary
  variant in 2025-02 — flagged as judgment call (1) above.
- `lint --fix` over-eagerly reformatted three pre-existing test files
  (`semantifyr-models.test.ts`, `stdlib-loading.test.ts`,
  `probe-redef-target-resolution.test.ts`) that already had unrelated
  pre-existing lint debt; those autofixes were reverted to keep this
  phase's diff minimal.
