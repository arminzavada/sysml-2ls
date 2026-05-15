# Phase 0b — Langium 1.2 → 2.1 upgrade results (redo)

Status: **baseline reached**. **2133 / 2141 tests passing, 8 skipped, 67 / 67
snapshots passing, 72 / 72 test suites green** on the worktree branch. The
first-pass workarounds (vendored Langium internals, custom Jest resolver
covering arbitrary ESM-only packages, single-context completion path,
incorrect feature-chain scope) have either been retired or scoped down to the
minimum the surface forces. Build is clean (`pnpm tsc -b tsconfig.build.json`
succeeds).

## Final versions targeted

| Package                                | Phase-0a baseline | First pass | Redo       |
| -------------------------------------- | ----------------- | ---------- | ---------- |
| `langium`                              | `~1.2.0`          | `~2.1.3`   | `~2.1.3`   |
| `langium-cli` (dev)                    | `~1.2.0`          | `~2.1.0`   | `~2.1.0`   |
| `chevrotain`                           | `~10.4.2`         | `~11.0.3`  | `~11.0.3`  |
| `vscode-languageserver`                | `~8.1.0`          | `~9.0.1`   | `~9.0.1`   |
| `vscode-languageserver-textdocument`   | `~1.0.8`          | `~1.0.11`  | `~1.0.11`  |
| `vscode-languageserver-types`          | `~3.17.3`         | `~3.17.5`  | `~3.17.5`  |
| `vscode-uri`                           | `~3.0.7`          | `~3.0.8`   | `~3.0.8`   |
| `jest` (+ siblings)                    | `^29.4.x`         | `^29.4.x`  | `^30.0.0`  |
| `@swc/jest`                            | `^0.2.24`         | `^0.2.24`  | `^0.2.39`  |
| `@types/jest`                          | `^29.4.0`         | `^29.4.0`  | `^30.0.0`  |
| `jest-junit`                           | `^15.0.0`         | `^15.0.0`  | `^16.0.0`  |

Pulled in transitively by the Langium bump (unchanged from first pass):
`chevrotain-allstar@0.3.1`,
`@chevrotain/{cst-dts-gen,gast,regexp-to-ast,types,utils}@11.0.3`,
`lodash-es@4.18.1`.

New dev dep added by the redo (used only by the Jest resolver):
`resolve.exports@^2.0.3`.

## Per-work-item results

### 1. Vendored parser-builder retired — DONE

The first pass shipped a verbatim copy of upstream's
`langium/lib/parser/parser-builder-base.ts` at
`packages/syside-languageserver/src/services/parser/create-parser.ts` because
Langium 2.x's `package.json#exports` blocks the deep import and
`prepareLangiumParser` hard-codes `new LangiumParser(services)`, leaving no
seam for a subclass.

After re-reading what `SysMLParser` actually contributes on top of
`LangiumParser`, it became clear we don't actually need a subclass:

- `SysMLParser.fillNode` was dead code (no callers in the repo).
- The only live override was `SysMLParser.construct(pop)`, which calls
  `super.construct(pop)` and then `collectChildren(value)`. Order matters —
  `collectChildren` must run *after* the base parser's mandatory-property
  assignment.
- The custom CST node builder (`SysMLCstNodeBuilder`) is installed on
  `LangiumParser.nodeBuilder`, a plain field on the parser instance.

We compose those two pieces onto the parser **instance** returned by the
public `prepareLangiumParser`:

```ts
// packages/syside-languageserver/src/services/parser/parser.ts
export function createSysMLParser(services: SysMLDefaultServices): LangiumParser {
    const parser = prepareLangiumParser(services);
    const mutable = parser as unknown as MutableLangiumParser;
    mutable.nodeBuilder = new SysMLCstNodeBuilder(services);

    const originalConstruct = parser.construct.bind(parser);
    mutable.construct = function (pop?: boolean): unknown {
        const value = originalConstruct(pop);
        if (isAstNode(value)) collectChildren(value);
        return value;
    } as LangiumParser["construct"];

    parser.finalize();
    return parser;
}
```

`SysMLParser` is now an alias (`export const SysMLParser = LangiumParser;
export type SysMLParser = LangiumParser;`) so existing imports in
`services.ts` continue to type-check, and `create-parser.ts` is **deleted**.

The remaining `LangiumParser.prototype["assignWithoutOverride"]` monkey-patch
also moved off `_astNode` `defineProperty` and onto the public `astNode`
setter, in the same file.

### 2. Jest 29 → 30 upgrade with focused resolver — DONE

The first pass's Jest 29 + custom resolver + broad `transformIgnorePatterns`
allowlist worked but was load-bearing on Langium's specific
`package.json#exports` shape plus a long list of indirect ESM deps.

Upgrade went to **jest@30.4.2** (and its `@jest/expect-utils`, `@jest/globals`,
`jest-snapshot`, `jest-matcher-utils`, `expect`, `@types/jest`, `jest-junit`
peers; `@swc/jest` to `0.2.39`).

What changed in the redo:
- `expect(...).rejects.toThrowError()` →`.toThrow()` (one test file;
  `toThrowError` is removed in Jest 30).
- Tried `testEnvironmentOptions.customExportConditions: ["node",
  "node-addons", "import"]` to let Jest's default resolver pick the `import`
  arm of Langium 2.x's exports map. **This breaks `synckit` and `@pkgr/core`**
  (transitives of `jest-snapshot@30`): both list `import` *before* `require`
  in their exports map, so adding `import` as an active condition globally
  routes their resolution to the ESM arm, which `@swc/jest`'s **async**
  transform path emits as ESM unconditionally (see `processAsync` in
  `@swc/jest@0.2.39/index.js`, which overrides `module.type` to `"es6"`).
  The result: their `lib/index.js` arrives at the CJS test runtime still
  as `import` syntax.
- Reverted to the custom resolver, narrowed to **only** the named ESM-only
  packages we actually depend on (Langium core + parser stack). `synckit`,
  `@pkgr/core`, etc. fall through to Jest's default resolver under `node` /
  `require` conditions and pick up their CJS entries. The flag-day list of
  indirect ESM deps in `transformIgnorePatterns` stays — those are still
  ESM-only and still need `@swc/jest` transformation — but it's now an
  allowlist of ~17 packages instead of an attempt to bridge the whole
  ESM/CJS boundary.

Why keep Jest 30 if the resolver still exists: Jest 30 has a modern dep
tree, better error messages, and removes the `ScriptTransformer` proxy
behaviour that complicated 29's caching. The resolver's scope is now
**proportionate to the actual problem** (Langium ships exports map with
only `import`; we bridge that), not a workaround layered onto a workaround.

Files: `package.json` (dep bumps), `jest.config.base.js`,
`jest.resolver.cjs`.

### 3. Lazy `MetamodelBuilder` getter validated — DONE (kept)

Investigated the cycle carefully. The full chain is

```
SysMLDocumentFactory
  → reads MetamodelBuilder
  → reads IndexManager (DefaultIndexManager in Langium 2.x)
  → reads LangiumDocuments (DefaultLangiumDocuments in Langium 2.x)
  → reads LangiumDocumentFactory  (= SysMLDocumentFactory, the root)
```

Two of those edges (`DefaultIndexManager → LangiumDocuments` and
`DefaultLangiumDocuments → LangiumDocumentFactory`) are imposed by Langium
2.x itself — they were lazy field reads in 1.x and became eager constructor
reads in 2.x. Any downstream user who wires a `MetamodelBuilder`-like
service into their `DocumentFactory` is forced to break the cycle on their
own edge.

The lazy getter pattern is the **idiomatic** Langium 2.x fix here. The
comment in `documents.ts` was rewritten to spell out the full chain and the
reason it's safe (the cycle is closed only during injector construction;
`onParsed` fires after DI is complete, so the lazy read returns the
fully-built `MetamodelBuilder`).

File: `packages/syside-languageserver/src/services/shared/workspace/documents.ts`.

### 4. Completion provider ported — DONE

The first pass's `SysMLCompletionProvider` used Langium 1.x's
`backtrackToAnyToken` semantics and a single-context flow with
`findLeafNodeAtOffset`. 15 tests failed.

Three distinct root causes, fixed separately:

1. **`buildCompletionTextEdit` signature change.** Langium 1.x called
   `this.buildCompletionTextEdit(document, offset, label, newText)` from
   inside `fillCompletionItem`. The method internally did
   `tokenStart = backtrackToTokenStart(content, offset)`, which walks back
   from the cursor through word characters. Langium 2.x's signature is
   `buildCompletionTextEdit(context, label, newText)` — it consumes
   `context.tokenOffset` as the range start. SysIDE's trigger flow
   synthesises a `CompletionContext` with `tokenOffset = node.offset` (start
   of the trigger CST node, e.g. `:>`), so the 2.x default would
   fuzzy-match an empty completion label against `:>` and reject every
   candidate.

   Fix: override `buildCompletionTextEdit` to recompute the word-boundary at
   the cursor — restoring the 1.x effective semantics independently of how
   the surrounding code sets `tokenOffset`:

   ```ts
   protected override buildCompletionTextEdit(context, label, newText) {
       const content = context.textDocument.getText();
       const tokenStart = this.backtrackToWordBoundary(content, context.offset);
       const identifier = content.substring(tokenStart, context.offset);
       if (!this.fuzzyMatcher.match(identifier, label)) return undefined;
       return {
           newText,
           range: {
               start: context.textDocument.positionAt(tokenStart),
               end: context.position,
           },
       };
   }
   ```

2. **`nameRegexp` regression in `grammar-config.ts`.** Langium 2.x's
   `RegexToken.regex` returns the **delimited** form `/pattern/` where 1.x
   returned the bare `pattern`. Our code does
   `name = `^${rule.definition.regex}$`` and ends up with
   `^/[_a-zA-Z][\w_\d]*/$|^/'(\\['"bftnr\\]|[^'\\])*'/$` — anchored against
   `/foo/` instead of `foo`, so no actual identifier matches and the
   completion-provider's `isRestrictedName` path wraps every label in quotes.

   Fix: strip leading/trailing `/` before anchoring:
   ```ts
   let pattern = rule.definition.regex;
   if (pattern.startsWith("/") && pattern.endsWith("/")) {
       pattern = pattern.slice(1, -1);
   }
   const regex = `^${pattern}$`;
   ```

3. **`skip` parameter regression in the `RELATIONSHIP_KEYWORDS` branch.** A
   prior refactor changed
   `skip: node.element.$meta` to
   `skip: isElementReference(node.astNode) ? node.astNode.$meta : undefined`.
   At this branch `node.astNode` is the LHS feature, **not** an
   `ElementReference`, so `skip` was always `undefined` and the owning
   feature appeared in its own
   `specialize/subset/redefine/conform` completion list. Restored to the
   1.x semantics — always skip the LHS feature.

Files:
`packages/syside-languageserver/src/services/lsp/completion-provider.ts`,
`packages/syside-languageserver/src/services/parser/grammar-config.ts`.

The flow continues to walk the SysIDE-specific
single-context path with `findLeafNodeAtOffset` rather than mirroring the
2.x generator-of-contexts shape; the tests all pass, so no further
restructuring was needed for the floor. This is on the list for the
Langium 2.x → 3.x hop.

### 5. Feature-chain scope provider — DONE

Two clearly-bounded bugs in `SysMLScopeProvider.initialScope` produced the
7 reference-resolution failures.

**5a. `FeatureChaining` unwrap.** The 1.x branch

```ts
if (owner?.is(FeatureChaining)) {
    owner = owner.owner()?.owner();
}
```
escapes the chaining wrapper to the enclosing scope. Under the actual
AST shape (verified with an in-test probe — `feature c chains a.b;`
parses to Feature `c` with `typeRelationships: [FeatureChaining{a},
FeatureChaining{b}]`, both chainings' `owner()` returns Feature `c`),
this is correct for the **first** chaining ("a" resolves in the enclosing
namespace) but wrong for subsequent chainings. "b" in `a.b` should resolve
in the local scope of the *previously-resolved* "a" — but the unwrap
sends it up to the namespace, where `b` isn't defined.

Replaced with explicit per-index logic:

```ts
const chaining = owner;
const parentFeature = chaining.parent();
const chainings = (parentFeature as FeatureMeta | undefined)?.chainings;
const index = chainings ? chainings.indexOf(chaining as …) : -1;
if (index > 0 && chainings) {
    const previous = chainings[index - 1].element();
    if (previous) {
        return this.localScope(previous, document, options.aliasResolver);
    }
    return;
}
// index === 0 (or unknown): fall through to historic outer-scope unwrap.
owner = chaining.owner()?.owner();
```

**5b. `FeatureChainExpression` handling.** The expression-context analog
`a.b` (e.g. `feature c = a.b;`) goes through a different AST shape:
`FeatureChainExpression { operands: [<a>], children: [Membership{targetRef:
b}] }`. The reference for "b" has `owner = FeatureChainExpression`
directly (Membership is `NonOwnerType`, so unwrapped from the owner
chain).

In the historic code the `while (owner.is(InlineExpression)) owner =
owner.owner()` loop unwraps right past the `FeatureChainExpression`,
landing on the enclosing Feature; `makeLinkingScope` on that Feature
finds "b" through its outward walk, but in arbitrary places (i.e. the
test's `feature c = a.b` resolves "b" against `c`'s scope), which is
silently wrong when `c` has a `b` of its own.

Added an early branch (before the `InlineExpression` unwrap loop) that
detects `owner.is(FeatureChainExpression)` and returns the localScope of
the previous-side's resolved feature (via the FCE meta's `targetFeature()`
or its first operand's `expression.element()`).

File: `packages/syside-languageserver/src/services/references/scope-provider.ts`.

### 6. TODO sweep — DONE

| Location | TODO | Disposition |
| --- | --- | --- |
| `grammar/SysML.langium:1225` | `https://github.com/langium/chevrotain-allstar/issues/1` — `AssignmentTargetMember` inlined as `FeatureChainMember` because of a parser conflict. | Independent of the Langium upgrade; chevrotain-allstar issue, presumed still open. **Kept**, no annotation change needed. |
| `services/parser/parser.ts:336` | `langium/langium#898` — CST repointing in `assignWithoutOverride`. | Verified still needed: `langium@2.1.3` `LangiumParser.prototype.assignWithoutOverride` does not perform CST repointing. **Kept**, comment expanded to document the current state and what would let us retire it. |
| `utils/common.ts:29` | `langium/langium#816` — `Range` may be `null` after rebuild. | The PR addressed the most common cause, but the validation pipeline still calls `sanitizeRange` defensively and removing it would require an empirical pass on 2.x. **Kept**, comment expanded with the retire criterion. |
| `services/references/linker.ts:519,539` | `// TODO: fix in Langium` (vague, no PR link) | Not PR-tagged; describe known limitations of `getLinkedNode` semantics. **Kept**, unchanged. |
| `services/parser/parser.ts:316` (TODO inside `assignWithoutOverride`) | (see PR 898 entry above) | Retired the `_astNode`-via-`defineProperty` mechanic in favour of the public `astNode` setter; the core patch (CST repointing) survives. |

The previous writeup's first-pass `createParser` comment ("retire as soon as
Langium re-exports …") has been **retired** by deleting `create-parser.ts`
entirely. The whole class of "vendored Langium internals" is gone.

### 7. Remaining test failures — RESOLVED

Items 4 and 5 cleared their 22 failures. No additional regressions
surfaced after the parser-bootstrap refactor, the scope-provider fix, the
completion-provider port, or the Jest 30 upgrade.

## Test results

| Stage                                  | Suites pass | Tests pass |
| -------------------------------------- | ----------- | ---------- |
| First-pass end                         |   68 / 72   | 2111 / 2141 (22 failures, 8 skipped) |
| After parser-builder retirement        |   68 / 72   | 2111 / 2141 |
| After scope-provider feature-chain fix |   72 / 72?  | 2118 / 2141 (15 failures) |
| After completion-provider port         |   72 / 72   | 2133 / 2141 |
| After Jest 30 upgrade                  |   72 / 72   | 2133 / 2141 |
| **Final (target)**                     | **72 / 72** | **2133 / 2141 (8 skipped)** |
| Snapshots                              | **67 / 67** | (separate axis)             |

Net regression vs. Phase-0a baseline: **0**. All 22 first-pass failures
cleared.

## Rough time

About 4.5 hours of focused work on the redo (on top of the 6 hours the
first-pass writeup recorded).

Rough breakdown:

- Parser-builder refactor: ~30 min (the realisation that `fillNode` was
  dead code shortened this considerably).
- Scope provider feature-chain fix: ~60 min (mostly probing the actual
  AST shape under 2.x).
- Completion-provider port: ~80 min (three independent root causes:
  `tokenOffset` semantics, the `nameRegexp` `/.../` delimiter regression,
  and the `skip` parameter regression in `RELATIONSHIP_KEYWORDS`).
- Jest 30 upgrade: ~60 min (most of which went into investigating the
  `synckit`/`@pkgr/core` `customExportConditions` interaction before
  concluding the resolver should stay — but narrowed in scope).
- DI cycle investigation + TODO sweep + writeup: ~30 min.


## Calibration notes (uncertain semantic preservation)

Honest list of places where I adopted a Langium-2.x-shaped fix but am not
100% confident it preserves the historic semantics:

1. **`SysMLCompletionProvider.buildCompletionTextEdit`** override.
   Reproduces 1.x's `backtrackToTokenStart`-from-cursor semantics, but
   1.x's `backtrackToTokenStart` also handled some edge cases around quote
   tokens and special characters that my `backtrackToWordBoundary` (word
   characters only) doesn't. The 24 completion tests cover the obvious
   paths; uncommon trigger patterns may behave subtly differently. Likely
   the right way to verify is to run the test suite against a SysIDE
   editor session and watch for regressions in the wild.

2. **`SysMLScopeProvider.initialScope` `FeatureChainExpression` branch.**
   Detects `owner.is(FeatureChainExpression)` early (before the
   `InlineExpression` unwrap loop) and returns the local scope of the
   previously-resolved side via either `targetFeature()` or the first
   operand's element. Nested chains (`a.b.c`) recurse correctly because
   each outer FCE's first operand is itself an FCE whose own resolution
   produced its `targetFeature()`. The case I'm least sure about: when
   the previous side **hasn't been resolved yet** (linker not done), my
   branch returns `undefined` (no scope), which causes a diagnostic on
   "b" rather than a silent fall-through to the enclosing-feature scope.
   That looks like the right behaviour — silent fall-through would hide
   real errors — but it's a behaviour change worth flagging.

3. **`LangiumParser.prototype.assignWithoutOverride` patch using the
   public `astNode` setter.** The first pass used `Object.defineProperty`
   on the private `_astNode` field with a live getter that resolved
   through `target.$cstNode._astNode ?? target`. The redo just sets
   `cstNode.astNode = target` directly. Functionally equivalent **as long
   as `target` is the final merged AST node and isn't further replaced
   downstream**. From reading `LangiumParser.performSubruleAssignment`,
   the pushed-onto-stack object IS the merged target, so a later
   `assignWithoutOverride` would mutate (not replace) it. I believe this
   is sound under 2.x's parser flow but didn't audit every call site.

4. **`grammar-config.ts` `/`-stripping.** Assumes Langium 2.x always
   emits `RegexToken.regex` in `/pattern/` form. For the two
   `NAME_TERMINALS` rules in our grammar (`ID`, `UNRESTRICTED_NAME`) this
   holds; an empty regex or one without delimiters would be silently
   accepted. Not a hazard today.

## Confidence assessment for Phase 0c (Langium 2.x → 3.x)

**Higher-confidence** that should carry forward unchanged or with minor
adjustments:
- Workspace ESM migration (Phase 0a) plumbing.
- The Jest 30 + focused-resolver setup. Langium 3.x's ESM-only shape is
  the same problem class with the same fix — the resolver's
  `ESM_ONLY_PACKAGES` list may grow but the mechanism is stable.
- The compositional parser bootstrap (`prepareLangiumParser` + per-instance
  override). This pattern doesn't depend on a `LangiumParser` subclass at
  all, so it weathers internal refactors of `LangiumParser` better than
  the vendored-builder approach.
- The DI lazy-getter for breaking the `DocumentFactory → MetamodelBuilder
  → IndexManager → LangiumDocuments` cycle. The cycle is part of Langium's
  shape; the lazy getter doesn't break.
- The scope-provider feature-chain fix is the right shape for SysML
  semantics, not a "look like 1.x" patch, so it should be stable.

**Lower-confidence** pieces that I expect each upgrade to require attention:
- The `LangiumParser.prototype.assignWithoutOverride` patch. Langium 3.x
  reportedly continues reworking CST internals; this patch will need to be
  re-validated (and may become obsolete if PR #898 lands).
- The completion provider single-context path. Langium 3.x is expected to
  evolve the `CompletionContext`/`buildContexts` shape further; the
  current `buildCompletionTextEdit` override and the trigger-character
  dispatch will likely need re-aligning. Consider folding the SysIDE
  trigger flow onto the 2.x `buildContexts` generator at the start of
  Phase 0c.
- `grammar-config.ts`'s `/`-stripping. If Langium changes its `RegexToken`
  emission again, this needs a re-check.

Overall the Phase 0c surface should be **smaller** than Phase 0b's was: the
mechanical breaking-change inventory has stabilised, the workarounds are
narrower and better-scoped, and the SysML-specific reach into Langium
internals (subclass requirement, scope-provider unwrap, CST repointing) is
all in one file each rather than threaded through many.
