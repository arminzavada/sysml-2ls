# Phase 2c — Stdlib 2025-04 + Control-Node Grammar

Branch: `phase-2c-stdlib-2025-04`, based on `556bb74` (main tip after Phase 2b).

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`:
- Before: `b17ab0ed8c85e3713c8c27ab89f995d764f8974c` (2025-02)
- After: `cf42294fe178afca2401e485e0e83268b38269d7` (2025-04, "Updated for 2025-04.")

Stdlib refreshed via `rm -rf SysML-v2-Release && node …/clone-sysml-release.mjs`.

## Occurrences patch

`scripts/patches/0001-occurrences-end-keyword.patch` re-applied by the clone
script on the new tree with no errors.

## Grammar changes

`packages/syside-languageserver/src/grammar/SysML.langium`:

Before:
```
MergeNode    : ControlNodePrefix 'merge'  UsageDeclaration? ActionNodeBody ;
DecisionNode : ControlNodePrefix 'decide' UsageDeclaration? ActionNodeBody ;
JoinNode     : ControlNodePrefix 'join'   UsageDeclaration? ActionNodeBody ;
ForkNode     : ControlNodePrefix 'fork'   UsageDeclaration? ActionNodeBody ;

fragment ActionNodeBody : ';' | '{' ActionNodeItems '}' ;
fragment ActionNodeItems : ( children+=AnnotatingMember )* ;
```

After (matches pilot 2025-04 `SysML.xtext` lines 1659–1681):
```
MergeNode    : ControlNodePrefix isComposite?='merge'  UsageDeclaration? ActionBody ;
DecisionNode : ControlNodePrefix isComposite?='decide' UsageDeclaration? ActionBody ;
JoinNode     : ControlNodePrefix isComposite?='join'   UsageDeclaration? ActionBody ;
ForkNode     : ControlNodePrefix isComposite?='fork'   UsageDeclaration? ActionBody ;
```

Two changes folded in here:

1. Body is now the full `ActionBody` fragment (defined at line 1065 of
   `SysML.langium` — admits all `ActionBodyItem`s, i.e. parameters,
   nested actions, transitions, annotations, etc.). The restricted
   annotations-only `ActionNodeBody`/`ActionNodeItems` fragments were
   deleted; no other rule referenced them.
2. `isComposite` is now bound to the keyword as a boolean assignment
   (`?=`), matching the pilot. A `fork f { … }` therefore parses as a
   composite usage by default (was previously left unset).

## AST / interface impact

`isComposite` was previously typed as `'composite'` (string literal) in
`KerML.interfaces.langium` to fit the `isComposite='composite'`
assignment in `BasicFeaturePrefix`. The new boolean assignment from the
control-node rules collides with that type.

Minimal fix to keep this phase scoped to the control-node migration
axis: widen the interface to `'composite' | boolean`. The runtime model
(`packages/syside-languageserver/src/model/KerML/feature.ts`) already
coerces with `Boolean(options.isComposite)`, so it accepts both
populations without further code changes. No other TS adaptations
needed.

Regenerated artefacts: `src/generated/ast.ts`, `src/generated/grammar.ts`,
TextMate grammars under `syntaxes/`.

## Constructor expressions (digest item 2)

The release note covers *evaluation* of constructor expressions. The
AST shape (`new` keyword, constructor-form invocation) was added in
Phase 2a and is unchanged in 2025-04. Per the authoring-not-execution
principle this phase makes no evaluator change. No-op as planned.

## Verification

- `pnpm run grammar:generate` — succeeds (two pre-existing warnings
  about lines 1563/1579 in `SysML.langium`; unrelated to this phase).
- `pnpm run build` — clean.
- `pnpm test` — **2152 passed / 7 skipped / 2159 total**. Same as
  baseline (Semantifyr integration tests, stdlib loading, all 9
  Semantifyr models still parse + validate cleanly).
- `pnpm run lint` — 13 errors / 6 warnings, **all pre-existing** on
  this branch (verified by stashing the diff and re-running). No new
  lint problems introduced.

## Files changed

```
packages/syside-languageserver/scripts/clone-sysml-release.mjs       |  2 +-
packages/syside-languageserver/src/generated/ast.ts                  |  (regen)
packages/syside-languageserver/src/generated/grammar.ts              |  (regen)
packages/syside-languageserver/src/grammar/KerML.interfaces.langium  |  2 +-
packages/syside-languageserver/src/grammar/SysML.langium             | 16 ++++------
```

No commits made; main agent commits after review.

## Anything unexpected

The `isComposite` interface widening to `'composite' | boolean` is the
only non-trivial side-effect. It would be cleaner to also flip
`BasicFeaturePrefix` to `isComposite ?= 'composite'` so the property is
uniformly boolean everywhere — but that touches an unrelated migration
axis (Feature prefix), so deferred. Flagging here for a future cleanup
sweep.
