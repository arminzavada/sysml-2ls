# _SysIDE_ Language Server

The main implementation package: Langium-based parser, scoping, validation,
formatting, completion, and LSP services for SysML v2 and KerML.

- Grammar: [`src/grammar/*.langium`](src/grammar/).
- Generated parser + AST: [`src/generated/`](src/generated/) — regenerate with
  `pnpm run grammar:generate`. Committed to git so a freshly cloned repo
  builds without `langium-cli`.
- Standard library: cloned on demand into the repo-root `SysML-v2-Release/`
  directory via [`scripts/clone-sysml-release.mjs`](scripts/clone-sysml-release.mjs).
  Pinned to upstream `Systems-Modeling/SysML-v2-Release` at the tag chosen
  by that script.
- Patches applied to the cloned stdlib (if any) live next to it under
  [`scripts/patches/`](scripts/clone-sysml-release.mjs). Currently empty.

See the top-level [README](../../README.md) for the build/test workflow.
