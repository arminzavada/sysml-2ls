# Prototype P3 — Stdlib repoint + patches infrastructure

> **Subagent brief.** Validates the strategy from [`02-library-builtins-fork-patches.md`](../02-library-builtins-fork-patches.md): repoint the clone script to upstream, drop contradiction patches, convert one LSP-workaround patch to a `.patch` file applied by the script.

## Goal

Set up the **infrastructure** to apply versioned `.patch` files to the fetched stdlib, and validate it by converting **one** representative fork patch end-to-end.

## What this prototype answers

**Question:** Does the `.patch`-files-applied-by-clone-script strategy work cleanly? Are there blockers (encoding, line endings, file paths with spaces, patch-tool availability)? Is one patch easy to convert and re-apply, or does it take longer than the catalogue assumed?

## In scope

- Modify [`packages/syside-languageserver/scripts/clone-sysml-release.mjs`](../../../packages/syside-languageserver/scripts/clone-sysml-release.mjs):
  - Change the remote from `arminzavada/SysML-v2-Release` to `Systems-Modeling/SysML-v2-Release`.
  - Change the pinned commit to `cd99f7ca70b96abb38f09dfd25725e3cf259baa3` (tag `2026-03`).
  - Add an apply-patches step **after** `git checkout`.
- Create a `patches/` directory next to the clone script.
- Drop the two **contradiction patches** ([Cat. F, G in the catalogue](../02-library-builtins-fork-patches.md#f-substantive-correctness-disagreement-return-type)):
  - `Domain Libraries/Quantities and Units/ISQSpaceTime.sysml`
  - `Kernel Libraries/Kernel Function Library/RationalFunctions.kerml`
  - Confirm dropping these does NOT regress tests (the patches were against upstream's intent; dropping aligns us with upstream).
- Convert **one** LSP-workaround patch. Recommended: `Systems Library/Items.sysml` ([Cat. A](../02-library-builtins-fork-patches.md#a-manual-diamond-redefinition-expansion-most-common)), which adds `ref item :>> items::localClock, subobjects::localClock;`. Smallest non-trivial Cat. A example.
  - Generate the `.patch` file using `diff -u` between upstream `2024-12` and the bundled fork version.
  - Save it under `patches/` with a descriptive header explaining: what LSP gap it works around, which prototype/issue tracks the gap's resolution, when the patch should be retired.
  - Make the clone script `git apply` this patch after checkout.
  - Run the full test suite to confirm: (a) the library now matches the fork's behavior for `Items.sysml`, (b) other parts of the library are at upstream `2026-03`, (c) tests are green.

## Out of scope

- Converting any other patches (the rest follow the established pattern).
- Touching the LSP itself to actually fix the underlying gaps (separate prototype, P5).
- Updating the [`upgrade-checklist.md`](../../upgrade-checklist.md) — that happens in implementation phase.
- Committing. Branch `proto/p3-stdlib-patches-infra`.

## Success criteria

- `pnpm run prepare-validation` or equivalent (the clone script's invocation) succeeds.
- The fetched stdlib contains:
  - Upstream `2026-03` for all files **except** `Items.sysml`.
  - The fork-patched version for `Items.sysml`.
- `pnpm test` results: **same baseline** (2118 passed, 8 skipped, 0 failed). Note: tests that were passing thanks to the contradiction patches' wrong return type may now fail; that is *desired* per conformance — if so, document and skip them with a comment pointing at the issue ticket.
- The `.patch` file is readable by `git apply --check` cleanly.

## Required reading

1. [`upstream-sources.md`](../../upstream-sources.md).
2. [`02-library-builtins.md`](../02-library-builtins.md) and [`02-library-builtins-fork-patches.md`](../02-library-builtins-fork-patches.md).
3. [`plan.md` Phase 1](../plan.md#phase-1--stdlib-pin-migration--fork-patch-infrastructure).

## Method

1. Read the catalogue thoroughly. Pick `Items.sysml` as the test case.
2. Edit the clone script: new remote URL, new commit, new apply-patches step.
3. Generate the Items.sysml patch:
   ```bash
   git -C ~/work/systems-modeling/SysML-v2-Release show 2024-12:"sysml.library/Systems Library/Items.sysml" > /tmp/upstream.sysml
   diff -u /tmp/upstream.sysml "/home/armin/work/sensmetry/sysml-2ls/SysML-v2-Release/sysml.library/Systems Library/Items.sysml" > items.patch
   ```
   Then re-target the patch to upstream `2026-03` content — Items.sysml may have changed between 2024-12 and 2026-03, so the patch may need to be rebased manually. (Worth checking with `git -C ~/work/systems-modeling/SysML-v2-Release diff 2024-12 2026-03 -- "sysml.library/Systems Library/Items.sysml"` first.)
4. Add a header comment to the `.patch` file explaining its origin and retirement criteria.
5. Test the apply-patches step.
6. Run the test suite.
7. Write the results doc.

## Output

**1. Code/script changes**, uncommitted, branch `proto/p3-stdlib-patches-infra`:
- Modified `clone-sysml-release.mjs`.
- New `patches/items-sysml-localclock-diamond.patch` (or similar).
- Any necessary `README` snippet documenting the `patches/` mechanism.

**2. Results writeup** at `docs/maintenance/upgrades/2026-03/prototypes/results/03-stdlib-patches-infra-result.md`:
- Final clone-script changes (summary).
- Whether the Items.sysml patch applied cleanly against upstream `2026-03` (likely yes — diamond patches are localized).
- Test results — did dropping the contradiction patches change test outcomes? If so, what did we learn?
- Whether the workflow is repeatable for the remaining ~15 patches. Yes/no with rationale.
- Estimated effort for the full patch conversion based on this one.

## Report back

~300 words: script changes, patch outcome, test deltas, repeatability assessment.

## If scope expands

If the patch can't be cleanly generated (the file has diverged too much between 2024-12 and 2026-03), **stop** and report. Pick a different patch (e.g. `Parts.sysml` for a smaller Cat. A example) and retry, OR document the blocker for `Items.sysml` specifically.
