# SysIDE Editor — VS Code Extension

VS Code extension entry point for the
[sysml-2ls](../../README.md) language server. Ships both a Node-based
extension (full filesystem access, used in classic VS Code) and a
browser bundle (for vscode.dev / web environments).

The extension wires the
[`syside-languageclient`](../syside-languageclient) into VS Code's LSP
host and registers SysML v2 / KerML file associations, syntax-highlighting
grammars, and a few custom commands (e.g. the S-expression dump). The
underlying language services live in
[`syside-languageserver`](../syside-languageserver).

## Building

From the workspace root:

```bash
pnpm install
pnpm run clone-stdlib   # one-time: clone the SysML v2 stdlib
pnpm run build          # builds all packages including this one
```

To produce a packaged `.vsix`:

```bash
pnpm run vscode:package
```

Install the resulting file manually (`code --install-extension <file>.vsix`).
This fork is not published to the VS Code Marketplace or Open VSX. See the
top-level [README](../../README.md#building-from-source) for the full
development workflow.
