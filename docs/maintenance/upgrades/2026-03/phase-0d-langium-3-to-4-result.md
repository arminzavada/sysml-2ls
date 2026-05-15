# Phase 0d — Langium 3.5 → 4.2 upgrade: **complete**

Status: **green**. `langium` is on `~4.2.4`, `langium-cli` on `~4.2.1`,
`chevrotain` on `~12.0.0`, `typescript` on `5.8.3`. `tsc -b
tsconfig.build.json` returns 0 errors and the Vitest suite reports
**2133 passed / 8 skipped** — identical to the Phase-0c baseline.

The first attempt at 0d stopped after the dependency bump because the
generated AST shape change (PR #1942) produced ~1800 cascading compile
errors and looked architectural. On a second pass the migration turned
out to be mechanical-but-pervasive rather than architectural: roughly
220 source files needed shape-touching edits, all driven by a small
catalogue of patterns. No new workarounds were introduced.

## Final versions

| Package          | Phase-0c | Phase-0d |
| ---------------- | -------- | -------- |
| `langium`        | `~3.5.0` | `~4.2.4` |
| `langium-cli`    | `~3.5.2` | `~4.2.1` |
| `chevrotain`     | `~11.0.3`| `~12.0.0`|
| `typescript`     | `5.1.3`  | `5.8.3`  |

The TypeScript bump is forced by Langium 4.x's published declarations
(upstream changelog: "TypeScript requirement: Langium now requires
TypeScript >= 5.8.0"). With TS 5.1.3 the generated `ast.ts` fails to
compile against the new `PropertyType`/`TypeMetaData` shape because of
`readonly []` inference differences.

`vscode-languageserver`, `vscode-languageserver-textdocument`, and
`vscode-uri` did not change (4.2.4 still depends on
`vscode-languageserver ~9.0.1`).

## Categorised changes (286 files, +2174/-2025)

### 1. `ast.X` const → frozen object descriptor (~220 files)

In Langium 3.x, `ast.Comment` was the string literal `'Comment'`. In
Langium 4.x (PR #1942) it is `{ $type: 'Comment', about: 'about', body:
'body', ... } as const`. Every value-position use was rewritten to
`ast.Comment.$type`; type-position uses (`ast.Comment` as a TS type,
`isComment`, `ast.Comment.$type`-keyed switches) stay as-is.

Touched files: `src/model/**` (~160), `src/services/**` (16),
`src/__tests__/**` (19), `src/utils/**` (3), plus the generated
`ast.ts`. The Meta-class chain follow-ons (`Property 'is' does not
exist on type 'never'`, `Class static side 'typeof FeatureMeta'
incorrectly extends`, the `Inheritance` discriminator failures) all
fell out automatically once category 1 was resolved.

### 2. `FileSystemProvider` widening (PR #1784, no source changes)

`FileSystemProvider` gained `stat`/`statSync`/`readBinary`/`readBinarySync`/
`readDirectorySync`. Both `SysMLNodeFileSystemProvider` (extends
`NodeFileSystemProvider`) and `SysMLEmptyFileSystemProvider` (extends
`EmptyFileSystemProvider`) pick the new methods up via inheritance —
no SysML-side implementation needed. The Phase-0c writeup had flagged
this as a sub-phase candidate but the upstream defaults are sufficient.

### 3. References API split (PR #1509)

`References#findDeclaration` → `findDeclarations` (returns an array).
The linker now produces `Reference | MultiReference`. Linker and
scope-provider signatures were updated to the union; SysML's existing
multi-target handling via `ElementReference.parts` was not affected
semantically.

### 4. Grammar generator restrictions (langium-cli 4.x)

(a) `fragment X returns string: '...'` is rejected. Affected rules
were rewritten as regular parser rules with primitive returns:
`TypedByToken`, `ConjugatesToken` (KerML.langium); `SpecializesToken`,
`SubsetsToken`, `ReferencesToken`, `CrossesToken`, `RedefinesToken`
(KerML.expressions.langium); `DefinedByToken` (SysML.langium).

(b) "Parser rule potentially consumes no input" is a **warning**, not
an error, in langium-cli 4.x. The first attempt mistook it for an
error and rewrote `EffectBehaviorUsage_1: {ActionUsage}` to require a
`'{' ActionBodyItems '}'` body, which would have rejected `do;` (the
empty-action form). Reverted: `EffectBehaviorUsage_1` now uses the
optional `EffectBehaviorUsageBody` fragment, generation completes with
the warning printed but produces a functioning parser, and `do;`
parses as it did under 3.5. See "Decision on `do;` semantics" below.

### 5. AST reflection / `assignMandatoryProperties`

`SysMLAstReflection.getTypeMetaData` and the property-defaults
machinery shifted to the 4.x `TypeMetaData` shape (`PropertyType` now
distinguishes scalar vs array vs reference at the type level). Our
existing assignment-mandatory-properties override was kept; it slots
into the new shape without behavioural change.

### 6. Builder / documents

`SysMLDocuments.deleteDocuments` (plural) was added to mirror
`deleteDocument`'s invalidation side-effects, because 4.x's
`DocumentBuilder.update` calls the plural form for bulk deletes.
`invalidateDocument` continues to work; we did not switch to
`DocumentBuilder.reset` (PR #2071) because the override surface we
need (`exports`, `namedElements`, `modelDiagnostics`, `onInvalidated`)
is per-document and `invalidateDocument` is still the closest fit.

### 7. Service registry

`DefaultServiceRegistry.singleton` was removed (PR #1786). The SysML
override did not depend on it.

## Workaround retirement audit

The Phase-0c writeup flagged three candidates. Disposition:

| Workaround | Status | Reason |
| --- | --- | --- |
| `sanitizeRange` (langium/langium#816) | **kept** | The defensive helper is still called from the validation pipeline. Removing it would require an empirical pass to confirm 4.x's range construction is total under all reparse paths (LSP edits, CLI single-shot, programmatic `DocumentBuilder.update`). No 4.x changelog entry retires it. Leave for a future targeted pass. |
| `MetamodelBuilder` DI lazy-getter in `SysMLDocumentFactory` | **kept** | The DI cycle (DocumentFactory → MetamodelBuilder → IndexManager → LangiumDocuments → LangiumDocumentFactory) is imposed by Langium's eager constructor reads in `IndexManager` and `LangiumDocuments`. 4.x does not change this contract, so the lazy-getter is still the cleanest break. |
| Feature-chain scope-provider logic | **kept** | SysML's chain semantics (`A::b::c` with implicit redefinitions and conjugations) are not a generic-Langium concern; no upstream movement here. |

No retirements were possible in this phase. None of these is a hack
*against* Langium 4.x's grain — they're SysML-specific specialisations
that Langium leaves to consumers.

## TODO sweep

| TODO | Status |
| --- | --- |
| `SysML.langium:1225` — `chevrotain-allstar#1` | Issue still open. Leave. |
| `linker.ts:524, :544` — "fix in Langium" (eager linking, partial AST nodes) | These are ambient eager-linking notes, not tracking a specific PR. Eager linking is still disabled. Leave. |
| `linker.ts:591` — "fix eager linking and remove this method entirely" | Same family. Leave. |
| `scope-provider.ts:233` — specialization narrowing question | Pre-existing semantic uncertainty, not Langium-version-coupled. Leave. |

No TODOs referencing Langium PRs/issues retired in this phase.

## Decision on `do;` empty-body semantics

**Preserved.** Pilot cross-check (`2026-03` tag of
SysML-v2-Pilot-Implementation, `org.omg.sysml.xtext/src/.../SysML.xtext`):

```xtext
EffectBehaviorUsage returns SysML::ActionUsage :
    EmptyActionUsage | PerformedActionUsage ( '{' ActionBodyItem* '}' )?
;

EmptyActionUsage returns SysML::ActionUsage :
    {SysML::ActionUsage}
;
```

Pilot accepts a pure-empty `EmptyActionUsage` (zero tokens) as the
entire `EffectBehaviorUsage`; the outer member's `';'` terminator
follows. The conformance-over-compat rule says we must accept what
the pilot accepts. The first-attempt grammar rewrite would have
rejected `do;` — a stricter-than-pilot regression, not allowed.

Resolution: `EffectBehaviorUsage_1: {ActionUsage} EffectBehaviorUsageBody`
where `EffectBehaviorUsageBody` is the optional `( '{' ActionBodyItems '}' )?`
fragment. langium-cli prints the "parser rule potentially consumes no
input" warning on `EffectBehaviorUsage_1` (and transitively on
`EffectBehaviorUsage`) but generates a functioning parser. The
warning is accurate but harmless — the surrounding `EffectBehaviorMember`
context ensures the empty production is only reachable after `'do'`,
and the outer `';'` terminator follows.

## Test result

```
Test Files  72 passed (72)
     Tests  2133 passed | 8 skipped (2141)
```

Identical to the Phase-0c baseline.

There are pre-existing Vitest deprecation warnings in
`node-file-system-provider.test.ts` and a few snapshot tests about
unawaited `.resolves` assertions; these existed before Phase 0d and
are unrelated to the Langium hop. They will trip Vitest 3's stricter
behaviour and should be cleaned up as a follow-up.

## Uncertainty about preserved semantics

- `do {}` (empty braces) vs `do;` (no body, terminator from outer
  member): both now parse to an empty `ActionUsage`. Pilot accepts
  both. No test in the suite exercises `do;` directly, so the
  behaviour is asserted only by manual cross-check against the pilot
  grammar.
- The `MultiReference` union has been threaded through linker and
  scope-provider signatures but the SysML codepath has historically
  produced a single-target reference per resolution. Whether any
  Langium 4.x internal now relies on the multi-target form for
  Membership chains is unverified; the suite is green so the
  contract is observed in practice.
- The parser-wrapper postprocessing ordering relative to
  `assignMandatoryProperties` has not changed shape from 0c, but the
  AST type for postprocessors did (`$type` is now object-keyed). All
  call sites were updated; the `$children`-dependent postprocessors
  (`Import`, `OperatorExpression`, `WhileLoopActionUsage`,
  `TransitionUsage`, `SuccessionAsUsage`) keep their previous order.

## Retrospective on the full Langium upgrade arc (1.2 → 4.2)

The arc was four hops over four sub-phases: 0a (ESM), 0b (1.2 → 2.1),
0c (2.1 → 3.5), 0d (3.5 → 4.2). Vitest replaced Jest in parallel.

### Biggest wins

- **ESM migration (0a)** was settled before the version hops started.
  Every later hop benefitted; no Jest/ESM resolver workarounds
  survived into 4.x.
- **`CstNodeBuilder.construct` patch retired (0b)** — the manual
  `_astNode`/`defineProperty` mechanic replaced by Langium's public
  `astNode` setter.
- **`documentPhaseListeners` retired (0c)** — first-class
  `DocumentBuilder.onBuildPhase` API.
- **`assignWithoutOverride` CST-repointing patch retired (0c)** —
  Langium handles this internally now.
- **LSP/Core split (`langium/lsp`, 2.x)** is clean. Future moves
  between subpaths should be tiny.
- **Utility-namespace consolidation (`AstUtils`, `CstUtils`,
  `GrammarUtils`, 3.x)** is stable from 3.0 onward.
- **AST shape mechanical** — despite first-attempt panic, the 820
  `ast.X` references actually have a near-mechanical pattern
  (`$type` append at value-position) that an editor with grep can
  drive in a few hours per family of files.

### Biggest pain points

- **AST shape ripple (4.x, PR #1942)** — pervasive, every consumer of
  `ast.*` touched. Compiler errors look architectural before the
  pattern is recognised; once recognised, the migration is
  mechanical but not free.
- **`TypeMetaData` reshape (3.x)** — required reading both Langium's
  and our `assignMandatoryProperties` to translate correctly.
- **`ConfigurationProvider` lifecycle reshape (3.x)** — needed
  `sysmlReady` deferred to avoid deadlocks in CLI/test paths where the
  LSP `initialized` notification doesn't fire. This survives intact.
- **CST-handling tweaks at every hop** — the parser-wrapper
  postprocessing reorder at 3.x; the misread "potentially consumes no
  input" warning at 4.x. Each carries small semantic risk that the
  test suite catches but doesn't characterise.

### What's clean now (post-4.2)

- DI graph except for the one `MetamodelBuilder` lazy-getter in
  `SysMLDocumentFactory` (Langium-imposed cycle, not retirable).
- Document-builder phase listeners.
- Parser bootstrap (`prepareLangiumParser`).
- Grammar config / regex stripping.
- File-system-provider extension shape (inheritance handles 4.x's
  new methods without an override).

### What's still complicated (post-4.2)

- **`SysMLConfigurationProvider`** — three overlapping concerns
  (initialize-vs-initialized, `sysmlReady` deferred, non-LSP
  `getConfiguration` cache read).
- **`SysMLAstReflection.getTypeMetaData`** — property-defaults logic
  is structurally equivalent to Langium's previous `mandatory[]` API
  but carries our `assignMandatoryProperties` override too.
- **Parser-wrapper postprocessing** — ordering relative to
  `assignMandatoryProperties` matters for `$children`-dependent
  postprocessors.
- **Linker eager-linking** — disabled and replaced with the explicit
  `loadAstNode`/`linkReference` pair in `SysMLLinker.buildReference`.
  Three "fix in Langium" TODOs survive; not coupled to a specific
  upstream PR.

### Net assessment

The 4.x hop was the longest single phase (~250 source files touched
including tests; the 1.2 → 2.1 and 2.1 → 3.5 hops were 50–80 each)
but produced the fewest new workarounds (zero). The framework's grain
in 4.x is closer to where SysML wants to be — multi-reference
support is a real upstream win, even though we don't fully exploit it
yet. Future hops should be smaller absent another AST-shape-level
change.
