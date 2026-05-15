# sysml-2ls

A community-maintained fork of the
[SysIDE Editor](https://gitlab.com/sensmetry/public/sysml-2ls) language server
and VS Code extension for [SysML v2](https://www.omg.org/spec/SysML/2.0/Beta3),
originally built by [Sensmetry](https://sensmetry.com/) and archived upstream
when development moved to a closed-source successor.

This fork continues the open-source line: it keeps the Langium/TypeScript code
base alive, tracks newer SysML v2 stdlib releases, and is open to community
contributions.

## Status

- The upstream project is archived; this fork is independently maintained.
- The original Sensmetry releases (`0.9.x`) shipped support for the
  [2024-12](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-12)
  spec. This fork has advanced through every monthly release and now ships
  on the
  [2026-03](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2026-03)
  release (see [CHANGELOG.md](CHANGELOG.md) and
  [docs/maintenance/](docs/maintenance/) for the cycle's notes).
- The goal is _authoring_ support — parser, language server, editor tooling —
  not full runtime/semantic equivalence with the
  [Eclipse SysML v2 pilot implementation](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation).

## Features

The extension provides editor features for SysML v2 and KerML source files:

- Semantic and syntax checking
- Semantic highlighting
- Autocompletion
- Hovers / documentation on hover
- Code navigation (go to definition, references)
- Folding
- Auto-formatting (elements and comment bodies)
- Renaming
- Document symbols

Demos of each feature are kept in [docs/images/](docs/images/).

## Standard library

The extension uses the SysML v2 standard library from
[Systems-Modeling/SysML-v2-Release](https://github.com/Systems-Modeling/SysML-v2-Release)
(LGPL v3.0). The library is cloned on demand into `SysML-v2-Release/` (this
directory is gitignored) — see [Building from source](#building-from-source)
below. To use a different version at runtime, point the
`syside.editor.standardLibraryPath` setting at your own copy:

![Settings](./docs/images/library-settings.png)

## Building from source

Requirements: Node.js ≥ 20.11 and [pnpm](https://pnpm.io/installation).

```bash
pnpm install
pnpm run clone-stdlib       # clone Systems-Modeling/SysML-v2-Release at the pinned tag
pnpm run build              # compile all TypeScript and the VS Code bundle
pnpm test                   # run vitest (unit + integration tests)
```

`clone-stdlib` is required for the integration test suite and for packaging
the VS Code extension, since both load the stdlib from `SysML-v2-Release/`.
The directory only needs to be (re)cloned when bumping to a new pinned tag.

The generated parser sources under
`packages/syside-languageserver/src/generated/` are checked in, so a
freshly-cloned repo builds without running `grammar:generate`. Regenerate
them only when you edit the `.langium` grammar:

```bash
pnpm run grammar:generate   # regenerate parser from the Langium grammar
pnpm run grammar:watch      # ...or watch the grammar
```

For day-to-day development:

```bash
pnpm run watch              # rebuild TypeScript + esbuild bundles on change
```

To package the VS Code extension as a `.vsix`:

```bash
pnpm run vscode:package
```

This fork is not published to the VS Code Marketplace or Open VSX. Install
the resulting `.vsix` manually (`code --install-extension <file>.vsix`) or
run the extension from the source tree using the launch configurations in
[.vscode/](.vscode/).

## Repository layout

- [packages/syside-base/](packages/syside-base/) — shared utilities and constants
- [packages/syside-languageserver/](packages/syside-languageserver/) — Langium-based parser, scoping, validation, formatting
- [packages/syside-languageclient/](packages/syside-languageclient/) — LSP client glue
- [packages/syside-vscode/](packages/syside-vscode/) — VS Code extension entry point
- [packages/syside-cli/](packages/syside-cli/) — standalone CLI
- [packages/syside-protocol/](packages/syside-protocol/) — custom LSP protocol extensions
- `SysML-v2-Release/` — cloned by `pnpm run clone-stdlib` (gitignored)
- [docs/maintenance/](docs/maintenance/) — notes from the revival/upgrade work

## Known limitations

See [docs/known_limitations.md](docs/known_limitations.md).

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
Contributions are subject to the
[Developer Certificate of Origin](DCO); please sign off commits with `git
commit -s`.

## License

[Eclipse Public License v2.0](https://www.eclipse.org/legal/epl-2.0/), with
the secondary [GPL v2 + Classpath Exception](https://www.gnu.org/software/classpath/license.html)
option — see [LICENSE](LICENSE). The fork inherits the original license; do
not relicense without consent from the original copyright holders. Copyright
on the original code remains with [Sensmetry](https://sensmetry.com/) and the
other contributors listed in the git history.

The SysML v2 standard library cloned into `SysML-v2-Release/` is distributed
under LGPL v3.0 by its original authors at
[Systems-Modeling/SysML-v2-Release](https://github.com/Systems-Modeling/SysML-v2-Release).
When packaged into a `.vsix`, the relevant portions of that library are
bundled alongside the extension under the same LGPL v3.0 terms.

SysML is a trademark of the Object Management Group (OMG).

## Acknowledgements

This project would not exist without the original
[SysIDE Editor](https://gitlab.com/sensmetry/public/sysml-2ls) authors at
[Sensmetry](https://sensmetry.com/). The upstream repository remains the
canonical reference for the project's history through version `0.9.1`.
