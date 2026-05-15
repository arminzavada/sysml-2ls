# Prototype P1a — Reclassify fork patches against the *current* LSP

> **Subagent brief.** Inserted after [P1](01-default-value-type-prop.md) discovered that some catalogued fork patches are already moot in the current LSP state. Resolves the upper-bound uncertainty in [`02-library-builtins-fork-patches.md`](../02-library-builtins-fork-patches.md) before P3 builds infrastructure around assumptions that may be wrong.

## Goal

For each of the 26 fork-modified library files, determine whether the patch is still **load-bearing** (LSP produces diagnostics if un-patched) or is **already moot** (the LSP handles the un-patched content correctly, suggesting the underlying LSP gap has been closed since the catalogue's 2024-12 baseline).

## What this prototype answers

**Question:** How many of the ~16 "fork-only LSP workarounds" in the catalogue are actually still needed? If half are moot, Phase 1's patch-conversion work is half the assumed size and the LSP-bug-list is shorter.

## In scope

- For each of the 26 fork-modified library files (listed in the catalogue's "Per-file disposition" table):
  1. Generate the upstream `2026-03` version of the file.
  2. Substitute it into the bundled stdlib temporarily.
  3. Run the language server validation on a representative model that exercises the patched feature.
  4. Record: did diagnostics fire? if yes, which?
  5. Restore the patched (bundled-fork) version.
- Categorize each file as:
  - **moot** — un-patched parses with zero diagnostics, can be retired immediately.
  - **load-bearing** — un-patched produces diagnostics; matches the catalogue's original assessment.
  - **partial** — some part of the patch is still needed; the file's patch could be reduced.
  - **contradicts upstream** — the two Cat. F/G patches; drop regardless.

## Out of scope

- Implementing any fixes for the load-bearing cases. That work happens in implementation phase.
- Converting any patches to `.patch` files. That's P3's job, after this prototype gives P3 a smaller scope.
- Cross-referencing each finding against specific LSP code paths (i.e. "this is now handled by X"). The reclassification is purely behavioral; explaining *why* a patch became moot is followup work.

## Success criteria

- Updated table in [`02-library-builtins-fork-patches.md`](../02-library-builtins-fork-patches.md) with per-file disposition: `moot` / `load-bearing` / `partial` / `contradicts`.
- A consolidated count of how many are still needed.
- A recommendation for P3's scope: e.g. "convert N patches to `.patch` files; drop M as moot in the same Phase 1 step."

## Required reading

1. [`02-library-builtins-fork-patches.md`](../02-library-builtins-fork-patches.md) — the catalogue you are revising.
2. [`feedback_conformance_over_compat.md`](../../../) memory.
3. [P1 results](results/01-default-value-type-prop-result.md) — explains the discovery that triggered this prototype.

## Method

1. Pick the simplest file first (smallest diff, e.g. one of the 2-line diffs) and confirm your harness works.
2. The "harness" can be either:
   - A script that programmatically substitutes file content, runs the language server, captures diagnostics. Reusable.
   - Manual: for each file, temporarily swap content, run `pnpm test` or a single jest probe, observe.
   The script option is more efficient and the right approach for 26 files. Build it.
3. For each file, decide a representative model that exercises the patched feature. For most patches, *the file itself* (or a stdlib import of it) is the exercise — when un-patched, does anything that depends on this file fail to validate?
4. Tabulate results.
5. Update the catalogue.

## Output

**1. Harness code**, uncommitted, branch `proto/p1a-reclassify-patches`. Likely a `scripts/reclassify-patches.mjs` or a Jest test that iterates the file list.

**2. Updated catalogue**: edit [`02-library-builtins-fork-patches.md`](../02-library-builtins-fork-patches.md) to amend the "Per-file disposition" table with the new classifications.

**3. Results writeup** at `docs/maintenance/upgrades/2026-03/prototypes/results/01a-reclassify-patches-result.md`:
- Harness description.
- For each file: classification and brief evidence (e.g. "moot: no diagnostics when un-patched"; "load-bearing: errors `X cannot be found in scope of Y`").
- Summary counts: `moot / load-bearing / partial / contradicts`.
- Recommendation for P3 scope reduction.

## Report back

~300 words: harness design, summary counts, the most surprising single finding (the file you expected to be load-bearing that wasn't, or vice versa), recommendation for P3.

## If scope expands

If the harness itself is harder than expected — e.g. the language server doesn't expose a clean diagnostics-capture API for batch use — **stop**. Document the blocker and recommend either a different approach or a per-file manual pass for a sample.
