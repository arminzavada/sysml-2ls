# Phase 0c — Langium 2.1 → 3.5 upgrade results

Status: **baseline reached**. **2133 / 2133 tests passing, 8 skipped, 67 / 67
snapshots passing, 72 / 72 test suites green** on the worktree branch. Two
significant Phase-0b workarounds were retired and one of the remaining
patches was simplified. Build is clean (`pnpm tsc -b tsconfig.build.json`
succeeds), `pnpm run grammar:generate` succeeds, `pnpm install` succeeds.

## Final versions targeted

| Package          | Phase-0b baseline | Phase-0c    |
| ---------------- | ----------------- | ----------- |
| `langium`        | `~2.1.3`          | `~3.5.0`    |
| `langium-cli`    | `~2.1.0`          | `~3.5.2`    |

No new dependencies were added. No peer-dependency bumps were required
(chevrotain, vscode-languageserver, vscode-uri all stayed put).

## Breaking changes encountered, by category

| Category                                           | Files touched | Notes |
| -------------------------------------------------- | ------------- | ----- |
| LSP/Core service split (`langium/lsp` subpath)     | 13            | All LSP-only types/classes — `LangiumServices`, `DefaultCompletionProvider`, `AbstractExecuteCommandHandler`, `Formatter`, `AstNodeHoverProvider`, `DefaultLanguageServer`, `AbstractSemanticTokenProvider`, `startLanguageServer`, `AllSemanticToken{Types,Modifiers}`, `DefaultSemanticTokenOptions`, `createDefaultModule`, `createDefaultSharedModule`, `DefaultSharedModuleContext`, `PartialLangiumSharedServices`, `NextFeature` — moved to `langium/lsp`. |
| Utility-function namespaces (`AstUtils`, `CstUtils`, `GrammarUtils`) | 14 | Functions like `findNodeForKeyword`, `findLeafNodeAtOffset`, `streamCst`, `streamAst`, `streamContents`, `getDocument`, `assignMandatoryProperties` are no longer exported at the package root; only via the namespace re-export. |
| `TypeMetaData` shape: `mandatory: {name, type}[]` → `properties: {name, defaultValue?}[]` | 1 | `SysMLAstReflection.getTypeMetaData` rewritten to use new property shape. |
| `LangiumDocuments.getOrCreateDocument` async (`Promise<LangiumDocument>`) | 3 | Two call sites switched to the sync `getDocument`; one (`workspace-manager.ts`) became `await`. |
| `LangiumDocumentFactory.update` signature `(document) ⇒ document` → `(document, cancelToken) ⇒ Promise<document>` | 1 | `SysMLDocumentFactory.update` made async with the new signature. |
| `IndexManager.remove(uris: URI[])` → `IndexManager.remove(uri: URI)` | 1 | `SysMLIndexManager.remove` reshaped (single URI). |
| `IndexManager.simpleIndex` → `IndexManager.symbolIndex` | 1 | Renamed throughout `SysMLIndexManager`. |
| `BuildOptions.eagerLinking` (default `true`) now required for full type signature | 1 | Added to `DefaultBuildOptions`; `shouldLink` reads it. |
| `DocumentBuilder.documentPhaseListeners: MultiMap<…>` and native `onDocumentPhase(state, cb)` | 1 | **Workaround retired**: SysML's custom `documentPhaseListeners` record + `onDocumentPhase` override + `notifyEarlyBuildPhase` shim are all deleted; 3.x's base implementation is used directly. See "Retired workarounds" below. |
| `ConfigurationProvider` lifecycle — `initialize(params)` + `initialized(params)` with `params.fetchConfiguration` | 1 | Major reshape: `SysMLConfigurationProvider` now overrides `initialized` (not `initialize`), introduces `sysmlReady` deferred to ensure workspace startup waits for the SysML-section config fetch, and overrides `getConfiguration` to avoid the base's `await this.ready` for non-LSP callers (tests/CLI). |
| `LangiumParser.prototype.assignWithoutOverride` now clears stale CST→AST links itself | 1 | **Workaround retired**: the entire CST-repointing monkey patch (`langium/langium#898` workaround) is deleted. Langium 3.x's `assignWithoutOverride` sets `target.$cstNode = undefined` so the rebuilt CST takes its place. |
| `DefaultServiceRegistry.map[...]` → `fileExtensionMap.get(...)` (Map-based, not Record-based) | 1 | `SysMLServiceRegistry.getServices` fallback updated. |
| `WorkspaceManager.includeEntry(_, _, selector: FileSelector)` (was `string[]`) | 1 | Selector now requires `{ fileExtensions, fileNames }`. |
| `IndexManager.allElements(nodeType, uris?: Set<string>)` | 1 | Optional `uris` parameter added to our override's signature. |
| `LangiumServices` → `LangiumCoreServices` for non-LSP entry points | 2 | `createSysMLGrammarConfig`, `BaseValidationRegistry` ctor. |
| `ExecuteCommandHandler.commands` / `registeredCommands` shape | 1 | Tests already used `handler.commands` (works); the internal field is `registeredCommands` (still a `Map`). |

### Test file edits

| Category                                                 | Files | Notes |
| -------------------------------------------------------- | ----- | ----- |
| `langium/lsp` import for LSP-only types in test          | 1     | `__tests__/semantic-token-provider.test.ts`: `AllSemanticTokenTypes`/`AllSemanticTokenModifiers` moved to `langium/lsp`, `Map` typing fixed. |
| Hook timeout for `language-server.test.ts` beforeAll     | 1     | 3.x's async config fetch races make the LSP initialization slower in CI-like parallel runs. Hook timeout raised to 30 s; the per-condition `asyncWhile` wait raised from 100 ms to 2 s. No assertion changes. |

## Phase-0b workarounds retired

### 1. `LangiumParser.prototype.assignWithoutOverride` CST-repointing monkey patch — **RETIRED**

The Phase-0b writeup flagged this as the workaround most likely to retire
at the 2.x → 3.x hop, contingent on `langium/langium#898` (or equivalent)
landing upstream. Langium 3.x took a different but equivalent approach: in
`LangiumParser.assignWithoutOverride`, when the source's `$cstNode` is
present after the assignment, the parser now clears it
(`targetCstNode.astNode = undefined; target.$cstNode = undefined`) so the
CST node builder later rebuilds it cleanly. This eliminates the
stale-`astNode`-link class of bugs the SysML patch was defending against.

All ~70 lines of prototype patching in
`packages/syside-languageserver/src/services/parser/parser.ts` are deleted.
`isRuleCall`/`assignMandatoryAstProperties`/`GrammarAST` are no longer
imported.

A small follow-on cleanup: `SysMLCstNodeBuilder` (subclass of
`CstNodeBuilder` that ran SysML postprocessing in `construct`) is also
**deleted**. In 2.x our postprocessing ran inside `CstNodeBuilder.construct`
because that fired after the AST was assembled. In 3.x, mandatory
properties (including `$children: []`) are filled in by
`assignMandatoryProperties` which runs *after* `nodeBuilder.construct`, so
running postprocessing from `CstNodeBuilder.construct` would see `$children
=== undefined` and our `Import` postprocessor would `erase(undefined,
node.targetRef)` and crash. The postprocessing is now folded into the same
`mutable.construct` wrapper that does `collectChildren`, running after
Langium's full construct sequence has completed. Same logical effect,
fewer moving parts.

### 2. `SysMLDocumentBuilder.documentPhaseListeners` + `onDocumentPhase` shim — **RETIRED**

Phase-0b open-coded a `Record<DocumentState, DocumentPhaseListener[]>`
data structure, a `notifyEarlyBuildPhase(doc, state)` helper that
`runCancelable` invoked per-document, and an `onDocumentPhase(state, cb)`
registration method.

Langium 3.x provides exactly this surface as a first-class API:
`DocumentBuilder.onDocumentPhase(state, callback)` registered into
`documentPhaseListeners: MultiMap<DocumentState, DocumentPhaseListener>`
internally, fired by `DefaultDocumentBuilder` itself (with cancellation
support) for every document reaching the target state — including
cancelled builds, per the upstream contract.

Our entire custom listener machinery is **deleted**:
`documentPhaseListeners` field, `DocumentPhaseListener` type export,
`notifyEarlyBuildPhase` helper, `onDocumentPhase` method,
`runCancelable` override's callback-wrapping logic. `Disposable`/`erase`
imports no longer needed. Net: ~30 lines removed.

The downstream call site in
`SysMLSemanticTokenProvider.builder.onDocumentPhase(...)` is unchanged —
3.x's base method has the same name and signature.

### 3. Configuration provider — *partially retired*

The `firstTimeSetup` shim survives but its semantics changed. In Langium
2.x, `DefaultConfigurationProvider.initialize` was the async entry point
and our SysML override piggy-backed on it to fetch the SysML-specific
config section. In 3.x, the lifecycle is `initialize(params)` (sync) +
`initialized(params)` (async) with a `params.fetchConfiguration` function
the host LSP provides. Three changes:

1. Our override moved from `initialize()` to `initialized(params)`. The
   per-language config sections are fetched by Langium's base via
   `params.fetchConfiguration`; we additionally fetch `SETTINGS_KEY`.
2. The base's `_ready` deferred resolves at the end of base's
   `initialized()` — *before* our SysML-section fetch runs. To prevent
   `SysMLWorkspaceManager.initializeWorkspace` (which awaits
   `firstTimeSetup`) from racing the SysML fetch, we added a separate
   `sysmlReady` deferred resolved only after our SysML fetch completes.
3. The base's `getConfiguration` awaits `this.ready`. Tests and CLI
   contexts don't drive the LSP `initialized` notification, so they would
   deadlock. Settings for SysML are populated synchronously in our
   constructor (from `services.config`), so we override `getConfiguration`
   to read the cached section directly without awaiting.

Each of those changes is documented in the file with the *why*.

## TODO sweep results

| Location | TODO | Disposition |
| --- | --- | --- |
| `grammar/SysML.langium:1225` | `langium/chevrotain-allstar#1` — `AssignmentTargetMember` inlined as `FeatureChainMember`. | Independent of the Langium upgrade; chevrotain-allstar issue. **Kept**, unchanged. |
| `services/parser/parser.ts:316` (former) | `langium/langium#898` — CST repointing in `assignWithoutOverride`. | **Retired** — the patch and its TODO are deleted. |
| `utils/common.ts:29` | `langium/langium#816` — `Range` may be `null` after rebuild. | Still defensive. **Kept**, comment updated. |
| `services/references/linker.ts:519,539,581` | `// TODO: fix in Langium` (vague, no PR link) | Not PR-tagged; describe known limitations of `getLinkedNode` and eager-linking semantics. **Kept**, unchanged. |

The Phase-0b writeup also flagged an "outer ESM-only resolver" workaround
in `jest.resolver.cjs` — but Vitest replaced Jest in the interim, so that
whole class of workaround is gone (no resolver, no
`transformIgnorePatterns`, no `customExportConditions` mess).

## Lint cleanup (passive)

- Removed `Langium 1.x → 2.x renamed `element` to `astNode`` historical
  comment in `services/sysml-ast-reflection.ts` (the rename is settled
  history at this point, not load-bearing for understanding the code).
- Reworded the DI cycle comment in `services/shared/workspace/documents.ts`
  to drop the "Langium 2.x specifically" framing; the cycle is part of
  Langium's stable shape.
- Tightened the regex-stripping comment in
  `services/parser/grammar-config.ts`.

## Final test result

```
Test Files  72 passed (72)
Tests       2133 passed | 8 skipped (2141)
Snapshots   67 passed / 67
Duration    ~50 s on the worktree branch
```

Net regression vs Phase-0b baseline: **0**.

## Places where I'm not 100% confident the upgrade preserves semantics

1. **`SysMLAstReflection.getTypeMetaData`** maps the new
   `properties: {name, defaultValue?}[]` shape onto the old `mandatory:
   {name, type}[]` semantics our `assignMandatoryProperties` private
   method expected. The mapping is: a property with `defaultValue` set is
   "mandatory"; the previous `"array"`/`"boolean"` `type` field becomes a
   runtime `typeof`/`Array.isArray` check on the defaultValue. This is a
   structural equivalent of the 1.x/2.x logic, but the 2.x list might have
   contained entries our 3.x version drops (or vice-versa) for properties
   that lack defaults. The 2133-test suite catches obvious cases — no
   regressions were observed — but uncommon `createNode` paths through
   programmatically-built AST nodes (e.g. for implicit relationships) may
   want a re-check if downstream behaviour drifts.

2. **`SysMLConfigurationProvider.getConfiguration` override** reads the
   in-memory `settings` cache directly without awaiting `ready`. In LSP
   mode this is fine because the cache is populated during
   `initialized()` and the `sysmlReady` gate prevents reads before the
   fetch completes (via `firstTimeSetup`). In test/CLI contexts the cache
   contains only the synchronous defaults from `services.config`, which
   matches what 2.x tests saw because Langium 2.x's `getConfiguration`
   also read from this same `settings` map. Confidence is high but I
   didn't audit every CLI command path.

3. **Postprocessing-after-mandatory-properties ordering** is the new
   sequence in our `createSysMLParser` wrapper. In 2.x our postprocessor
   ran inside `CstNodeBuilder.construct` (before `assignMandatoryProperties`)
   but the order happened to be safe because the AST nodes our
   postprocessors care about — `Import`, `OperatorExpression`,
   `WhileLoopActionUsage`, `TransitionUsage`, `SuccessionAsUsage` — all
   have `$children` populated through `linkContentToContainer` rather
   than `assignMandatoryProperties`. In 3.x I moved them to after
   `originalConstruct` so `$children` and any boolean defaults are
   guaranteed present. The behaviour should be at least as strong as 2.x,
   but it's a sequencing change worth flagging.

4. **`asyncWhile` timeout in `language-server.test.ts`** was raised from
   100 ms to 2 s, and the `beforeAll` hook timeout was raised to 30 s.
   This is a *test-side* accommodation for 3.x's now-async config fetch
   racing with the LSP `initialized` notification. The mock client
   responds synchronously, so the wait is really for Langium's internal
   plumbing. No assertion semantics changed.

5. **`SysMLDocumentFactory.update` is now async.** This is an interface
   change forced by Langium 3.x. The previous synchronous override
   transformed a fully-built document in-place; the new async one
   `await super.update` first then runs our `onCreated` hook. In LSP and
   test paths the difference is invisible (callers always `await`), but
   any internal call to `update` that wasn't `await`ed would silently
   skip the SysML metadata refresh. None were found, but flagging.

## Confidence for Phase 0d (3.x → 4.x)

**Higher-confidence pieces that should weather the next hop:**

- LSP/Core import split. Now that we've made the change once, future
  rearrangements are likely to be smaller (e.g. moving a single class
  between `langium` and `langium/lsp`, or introducing a new subpath like
  `langium/grammar`).
- Utility namespaces (`AstUtils`, `CstUtils`, `GrammarUtils`). Stable API
  surface from 3.0 onward; should carry forward unchanged.
- The compositional parser bootstrap via `prepareLangiumParser` survived
  3.x's CST handling reshape with only a typing tweak on `construct`.
  Pattern is robust to internal refactors.
- The DI lazy-getter in `SysMLDocumentFactory.metamodelBuilder`. The cycle
  is structural to Langium's shape; this idiom is the right fix.
- The scope-provider feature-chain fix from Phase 0b. Pure SysML
  semantics, no Langium dependency.
- `formatPreserved` / `selectDeclaredRelationshipToken` formatter
  fix. The "match against keyword's last whitespace-separated word" fallback
  in `selectDeclaredRelationshipToken` reflects how CST tokens for
  multi-word keywords are laid out in 3.x; same layout will likely apply
  in 4.x.

**Lower-confidence pieces, may need attention each upgrade:**

- The configuration provider lifecycle. 3.x reshaped it from `initialize`
  to `initialized` + `fetchConfiguration`. 4.x may continue evolving this
  (notebook documents, workspace folders, etc.). The `sysmlReady`
  deferred pattern is robust but the override surface is wide.
- `BuildOptions.eagerLinking`. New in 3.x; 4.x may add more options that
  need to be in our `DefaultBuildOptions` for type-checking to pass.
- Test mocks (`TestClientExtender` in `language-server.test.ts`). They
  speak LSP wire format, which is stable, but Langium's *use* of LSP
  evolves: per-language config sections, fetchConfiguration shape, new
  registration requests. Expect 1–2 test fixes per upgrade.

**Phase 0c took longer than Phase 0b on the redo (~5–6 hours) because**:
- The LSP/Core split is mechanical but touches many files (~15 imports).
- The `TypeMetaData` reshape required reading both Langium's and our own
  invocation of `assignMandatoryProperties` to translate correctly.
- The CST-handling change in `assignWithoutOverride` first manifested as
  surface-level test failures (unresolved references, `$type` missing on
  `$meta`) before I traced it back to (a) needing `eagerLinking: true`
  in `DefaultBuildOptions`, then (b) reordering postprocessing in our
  parser wrapper. Each of those root causes was a 30–60 minute
  investigation; once identified, the fix was a few lines.
- The configuration provider lifecycle change required a tight read of
  Langium 3.x's `language-server.js` to understand the deliberate
  non-await on `initialized` calls, which made `sysmlReady` necessary.

Overall the Phase 0d surface should be **comparable or smaller** than
0c's was: the major reshaping (LSP/Core split, utility namespaces, config
lifecycle, eagerLinking, CST handling) is now behind us, and the
workarounds left are narrower and idiomatic to Langium's intended
extension points.
