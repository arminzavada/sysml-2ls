# Phase 1b — Switch stdlib source to upstream, extract the one load-bearing patch

## Summary

`packages/syside-languageserver/scripts/clone-sysml-release.mjs` now
fetches from `Systems-Modeling/SysML-v2-Release` (upstream) at commit
`f49ea19a807a2aa45ad1afed0ed62afe41aabdf9` (tag `2024-12`) instead of
the `arminzavada/SysML-v2-Release` fork at `8743e9fe…`. After
`git checkout FETCH_HEAD`, the script iterates the
`packages/syside-languageserver/scripts/patches/` directory in sorted
order and applies each `.patch` file with `git apply --whitespace=nowarn`.
Patch failures are fatal.

The 23 moot fork modifications (catalogue categories A–J) silently
disappear because they were never re-added to upstream content and we
no longer fetch the fork. P1a's empirical reclassification confirmed
none of them affect LSP validation at HEAD.

## The one load-bearing patch

`packages/syside-languageserver/scripts/patches/0001-occurrences-end-keyword.patch`:

```diff
--- a/sysml.library/Kernel Libraries/Kernel Semantic Library/Occurrences.kerml
+++ b/sysml.library/Kernel Libraries/Kernel Semantic Library/Occurrences.kerml
@@ -568,7 +568,7 @@
 			 * Occurrences that have inner spaces that completely include this occurrence.
 			 */

-			feature surroundedSpace: Occurrence[1] subsets that;
+			end [1] feature surroundedSpace: Occurrence subsets that;
 			end [1] feature surroundingSpace: Occurrence subsets self;

 			connector :InsideOf
```

The file's leading `#`-comment header records the rationale (LSP gap:
`checkFeatureCrossingSpecialization` does not infer end-ness from
`crosses` semantics) and retirement criterion (when that validator
correctly accepts the un-patched upstream form).

The other three hunks present in the *bundled fork's* `Occurrences.kerml`
(`incomingTransfers`, `outgoingTransfers`, `Within` assoc end
redefinitions) are dropped — P1a classified them as moot (no LSP impact).

## Verification

- `rm -rf SysML-v2-Release && node packages/syside-languageserver/scripts/clone-sysml-release.mjs` succeeded.
- Resulting `SysML-v2-Release/sysml.library/Kernel Libraries/Kernel Semantic Library/Occurrences.kerml` line 571 is `end [1] feature surroundedSpace: Occurrence subsets that;` — patch applied.
- `diff -q` between bundled `Items.sysml`/`Parts.sysml` and the
  upstream `2024-12` versions: identical (moot fork edits gone).
- `pnpm test`: **2142 passed | 7 skipped (2149)** — matches the
  worktree's pre-change baseline.
- `pnpm run build` / `pnpm run lint`: clean.

## Future maintenance

At the next stdlib pin advance:
- Bump `commit` in `clone-sysml-release.mjs` to the new upstream SHA.
- If the new upstream content shifts the hunk's surrounding lines,
  regenerate `0001-occurrences-end-keyword.patch` against the new base
  (still a one-hunk diff, still the same `end` keyword insertion) until
  the LSP gap is closed; then delete the patch and the directory.
