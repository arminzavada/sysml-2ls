<!-- markdownlint-disable-file MD024 -->

# Changelog

<!-- Include links to comparison to the previous version -->

## main

### Language / stdlib

- Standard library advanced from upstream `2024-12` to `2026-03`, released
  release-by-release through `2025-02`, `2025-04`, `2025-06`, `2025-07`,
  `2025-09`, `2025-10`, `2025-11`, `2025-12`, `2026-01`, `2026-02`, `2026-03`.
- Switched the stdlib source from the `arminzavada/SysML-v2-Release` fork to
  upstream `Systems-Modeling/SysML-v2-Release` via the clone script, with a
  `scripts/patches/` directory for any fork-on-upstream patches needed. The
  one fork-only patch (`Occurrences.kerml` `end`-keyword shape) retired
  itself at `2026-01` when upstream emitted the same form; the patches
  directory is currently empty.
- 2025-02 grammar adopted: `var`/`const` (KerML) and `constant` (SysML)
  replacing `readonly`; `new` constructor expressions; `$::` global-scope
  qualifier; expanded `send`/`accept` body forms; `derived` keyword position
  constraint; `const` permitted on end features (2025-11 grammar fix).
- 2025-02 library renames adopted: `FlowConnectionDefinition` → `FlowDefinition`,
  `FlowConnectionUsage` → `FlowUsage`, `SuccessionFlowConnectionUsage` →
  `SuccessionFlowUsage`; `Transfer::item` → `Transfer::payload`. Three
  dedicated model classes renamed to match.
- 2025-04 grammar: control nodes (`fork`/`join`/`decide`/`merge`) accept
  full action bodies with parameters; `isComposite` bound directly to
  `fork`/`join` keywords.
- Qualified-name redefinition-target resolution now routes the first
  segment through the owning type's inherited members, matching the
  pilot's 2025-11 fix (`KerMLScope.xtend`'s `isRedefinition` short-circuit).
  See the probe test at
  `packages/syside-languageserver/src/__tests__/kerml/core/probe-redef-target-resolution.test.ts`.
- Implemented the 13 validators from the pilot's 2026-01 batch as real
  validator functions (replacing "implicitly ensured by the model"
  comments). Most fire only on programmatically-corrupted AST; see
  [docs/known_limitations.md](docs/known_limitations.md).
- Added `validateUsageOwningType` (and fixed it to walk through
  KerML-Feature transparent owners like `ItemFlowEnd`, so flow endpoints
  don't false-positive).
- Added an integration test that loads the
  [Semantifyr](https://github.com/ftsrg/semantifyr) `TestModels`
  (9 SysML files at
  `packages/syside-languageserver/src/__tests__/resources/semantifyr-models/`)
  against the full stdlib, asserting zero parse / linking / validation errors.

### Toolchain

- **Langium**: `1.2.0` → `4.2.4` (via four major hops, each in its own commit).
- **TypeScript**: `5.1.3` → `5.8.3`.
- **Test runner**: Jest 29 → **Vitest 3** (drops the per-package
  `jest.config.cjs` files and the `lodash-es` resolver workaround).
- **ESLint**: 8 → 9 with the flat-config migration (`eslint.config.mjs`);
  legacy `.eslintrc.json` and `tsconfig.eslint.json` retired.
  `typescript-eslint` v8 meta-package.
- **`@types/node`**: 14 (legacy pin) → 22 LTS.
- **Module system**: workspace-wide ESM. Every package declares
  `"type": "module"`; all relative imports include `.js` extensions;
  no remaining `.cjs` shims (the patches script remains pure ESM).
- **Other deps refreshed**: Prettier `3.3` → `3.8`, esbuild `0.17` → `0.25`,
  chevrotain `9.1` → `12.0`, `vscode-languageserver` line aligned to `9.x`,
  plus 20+ other deps brought current.
- `@types/node` engines requirement raised to `>=20.11.0`.
- Each Langium upgrade hop retired one or more workarounds: vendored
  `parser-builder-base.ts` (1→2), `assignWithoutOverride` CST patch (2→3),
  `documentPhaseListeners` shim (2→3). No new workarounds were introduced.

### Fork

- Forked from the archived upstream
  [Sensmetry SysIDE Editor](https://gitlab.com/sensmetry/public/sysml-2ls) at
  `0.9.1`. Continuing development under community maintenance.
- Removed the upstream deprecation notice and the GitLab CI/mirroring
  infrastructure; the repository is now GitHub-hosted.
- Removed the upstream release/publishing pipeline (`gh-release.mjs`,
  `prepare-release.mjs`, `publish.mjs`, marketplace publish scripts and
  related devDeps). The fork is not currently published; local packaging
  via `pnpm vscode:package` still works.
- Cleaned up developer lifecycle scripts: dropped `prepare` (no more
  full build on `pnpm install`), `prepack`/`postpack` (no `npm pack`
  workflow), the `tstrace` debug helper, `build:clean` / `test:watch`
  aliases, and the broken root `grammar` delegate. Consolidated the
  `esbuild-base` / `esbuild` / `esbuild:watch` proliferation in
  `syside-cli`, `syside-languageserver`, and `syside-vscode`.
- Fixed a latent build bug where the `prebuild` step's
  `cp -R syntaxes ../syside-vscode/syntaxes` would nest `syntaxes/syntaxes/`
  when the destination already existed.
- Replaced the bespoke `run-validation.ts` script and its
  `expected-diagnostics.json` baseline with a vitest integration test
  ([packages/syside-languageserver/src/__tests__/integration/stdlib-diagnostics.test.ts](packages/syside-languageserver/src/__tests__/integration/stdlib-diagnostics.test.ts))
  that snapshots the diagnostics produced when validating the full stdlib.
  Refresh the baseline with `pnpm vitest -u`. The legacy
  `prepare-validation` npm script is now `clone-stdlib` (it only clones
  the upstream `SysML-v2-Release` at the pinned tag; the validation runs
  as part of `pnpm test`).
- See [docs/maintenance/](docs/maintenance/) for the upgrade notes from the
  2026-03 cycle, including the per-phase result docs.

## 0.9.1 (upstream final)

- Renamed from "SysIDE Editor" to "SysIDE Editor Legacy" upstream.
- Upstream README updated with deprecation status.
- Added notification on launch announcing upstream deprecation.

  > This entry is preserved for history. The deprecation notice and launch
  > banner have been removed in the fork.

## 0.9.0

### Changes

- Updated to [2024-12 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-12).
  - Support for _Cross subsetting_ (`crosses` and `=>` keywords).
- Switch to [Sensmetry fork](https://github.com/daumantas-kavolis-sensmetry/SysML-v2-Release/tree/fixes)
  of the SysML v2 standard library that fixes some issues
  - Users can still opt to using the official library by downloading it manually
    and using the `syside.editor.standardLibraryPath` setting, but then validation
    issues might arise.
- Added `syside.editor.sexp.console` command to print out the [S-expressions](https://en.wikipedia.org/wiki/S-expression)
  of the selected model node.
  - Can be triggered either by right clicking on the node and choosing
    _SysIDE Editor_: Get S-expression of the current node_ from the _SysML_
    category or from the Command Palette
  - The output is printed to the _Output_ pane of VSCode, under _SysIDE_ category

### Fixed

- Fix [#22](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues/22) -
  Context Menu Commands Fail in Eclipse Theia

## 0.8.0

### Fixed

- Fixed erroneous `validateLibraryPackageNotStandard` validation errors when
  using the bundled standard library

### Changes

- Updated to [2024-11 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-11)
  - New keyword `terminate`
  - New type `TerminateActionUsage`

### Chores

- Renamed command titles from 'SysIDE' to 'SysIDE Editor'

## 0.7.0

### Changes

- Added license to the published `syside-languageserver.js` which is now zipped
  together with license
- Added License Bundler on esbuild
- Updated to [2024-09 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-09)
  - Updated default visibilities of `Imports`
  - Imports need to have explicit visibility now

### Improvements

- Users no longer need to manually download the standard library or click the
  "Download standard library" button in the notification on first run of SysIDE
  Editor. The extension now bundles the latest standard library.

### Chores

- Rebranded from "SysIDE CE" to "SysIDE Editor".
  - Settings and command prefixes changed from `syside` to `syside.editor`.
  - Existing settings will be automatically migrated.

## 0.6.2

### Changes

- Updated icon

## 0.6.1

### Fixed

- Fixed `locale` semantic highlighting and TextMate grammar now correctly
  highlights `REGULAR_COMMENT`s, strings and numbers.

## 0.6.0

### Changes

- Updated to [2024-02 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-02)
  - Nearly all changes are to validation
- VS Code configuration settings now use `syside` section name instead of
  `sysml`, existing settings will be automatically migrated

### Improvements

- VSCode extension now works on the web with a few differences:
  - `syside.standardLibraryPath` is ignored, standard library is fetched directly
    from GitHub
  - `syside.plugins` is ignored

  Performance on the web may be degraded as the server has to share resources
  with other extensions. In addition, selecting SysML language will now provide
  language server support irrespective of the file extension, KerML files have
  to have `.kerml` extension to get support
- Only relevant standard library files will be downloaded instead of the full
  repository, greatly improving download
- Formatter now uses pretty-printer to format documents which can take line
  width into account through

  ```json
    "[sysml|kerml]": {
      "syside.formatting.lineWidth": 100
    },
    "syside.formatting.lineWidth": 100
  ```

  in VS Code settings. Additional options are available through
  `syside.formatting.` section which can also control optional keyword formatting.
  Formatting can be disabled by leading notes with `syside-format ignore` inside
  them which will print the element subtree the note is attached to as-is. Let
  us know about any issues with the new formatter like notes disappearing or
  feedback how the formatting style can be improved.
- Added pretty-printer for KerML and SysML models

### Chores

- Added methods to add and remove owned child elements
- Refactored model building and validation to work on internal model elements
  instead
- Refactored AST and internal model to store order dependent child nodes in
  separate fields/properties to allow for easier runtime modifications without
  having to maintain implicit ordering

## 0.5.2

### Fixed

- Fixed resolving custom SysIDE path on Windows when it was absolute

## 0.5.1

### Improvements

- Changed how language server is bundled, resulting in much better performance

## 0.5.0

### Fixed

- False positive standard library validation in some cases on Windows
- Completion showing suggestions from the current element scope for type and
  feature relationships when completion is triggered by a related token

### Improvements

- Global scopes are now cached in a single structure, and reference resolution
  across documents will be done in constant time unless some documents in the
  workspace contain public imports or unnamed features in root namespace. In
  that case, reference resolution will fall back to iterating through those
  documents if name was not resolved. While this does not improve performance
  much on small projects, it should scale better
- Improved reference resolution performance, should be more than twice as fast
  now

## 0.4.3

### Fixed

- `StateActionUsage` and `EffectBehaviorUsage` parsing which resulted in bad
  parse trees [#9](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues/9)

### Chores

- Updated Langium to 1.2.0

## 0.4.2

### Fixed

- Standard library always loaded from an equivalent path on the current drive on
  Windows [#7](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues/7)
- False error when semantic token computation is cancelled [#8](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues/8)

### Chores

- Added configuration options for custom server path and command line arguments
  which may be used in the future
- Organized sources into workspace with dependant packages

## 0.4.1

### Fixed

- Fixed type relationships sometimes indented an additional time in unnamed types
- Alias members not showing up in completion suggestions

## 0.4.0

### Added

- KerML validations
- SysML validations
- Subsetting multiplicities and unique names in direct scope validations

### Fixed

- Whitespace issues in some formatting cases
- Excessive indentation in some formatting cases
- Formatter replacing all comment bodies in a scope with the first one
- Bugs discovered while adding validations
- `allocate` is not indented an additional time if the element starts with
  `allocate`
- Qualified names in suggestions shown from the membership node instead of the
  suggested element
- Standard library pop up showing on every extension activation after updating
  compatible standard library

## 0.3.1

### Changed

- Updated to [2023-02 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2023-02)
  - Indexing now uses `#(<sequence expression>)` syntax, `[...]` is now only
    used for multiplicities and quantities

## 0.3.0

### Changed

- Renamed to Systems Modeling IDE (SysIDE)

## 0.2.1

### Added

- Syntax highlighting in markdown fenced blocks with `kerml` and `sysml` identifiers
- Full auto-formatting. However, there is no configuration for it currently and
  there is no support for maximum line widths

### Fixed

- Completion not inserting quotes around restricted names if the cursor is on `{`
- Automatic indentation
- Completion sometimes returning no suggestions for multi-word unrestricted names

### Changed

- VS Code extension exports `LanguageClient`
- Invalid KerML/SysML documents will not be formatted

## 0.2.0

### Added

- Dynamic loading of JS plugins similar to how VS Code loads plugins at start up
  for non-intrusively extending server functionality. Plugins are loaded during
  workspace initialization through an exported `activate(context:
  SysMLSharedServices)` function. Also see `sysml.plugins` setting
- Users who have downloaded the standard library through this extension will be
  prompted to download a compatible standard library again when the compatible
  version changes

### Changed

- Updated to [2022-12 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2022-12)

## 0.1.1

### Fixed

- Documentation fixes

## 0.1.0

- Initial release
