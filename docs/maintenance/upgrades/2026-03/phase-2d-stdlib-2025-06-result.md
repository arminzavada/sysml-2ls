# Phase 2d — Stdlib advance to upstream 2025-06

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`:

- Old: `cf42294fe178afca2401e485e0e83268b38269d7` (2025-04)
- New: `53736d8b23b36f72a8c356fef52ff476a092abf7` (2025-06)

## Occurrences patch status

Required adaptation. The original patch (Phase 1b) edited a single line in
`Occurrences::Occurrence::SurroundedSpacePerformances`:

```
-			feature surroundedSpace: Occurrence[1] subsets that;
+			end [1] feature surroundedSpace: Occurrence subsets that;
```

leaving the adjacent `surroundingSpace` line untouched because upstream
2025-04 already declared it as `end [1] feature surroundingSpace ...`.

In 2025-06 the upstream library was rewritten so that both features
appear without the `end` keyword and with the multiplicity moved to the
canonical post-type position:

```
			feature surroundedSpace: Occurrence [1] subsets that;
			feature surroundingSpace: Occurrence [1] subsets self;
```

This is a library wording change in the bug-fix release; the semantic
intent is unchanged (the `crosses` declarations further down still
reference these two features as cross-feature participants). The
context line offsets also shifted from `@@ -568` to `@@ -601` due to
unrelated edits earlier in the file.

The patch was regenerated to:

- Update the hunk header to `@@ -601,8 +601,8 @@`.
- Modify *both* lines (add the `end` keyword) instead of one.
- Keep the multiplicity in its new canonical post-type position.

The patch comment was updated to reflect that both lines are now
touched. The retirement criterion is unchanged (it still hinges on the
LSP's `checkFeatureCrossingSpecialization` validator learning to infer
end-ness through `crosses` semantics).

After regeneration the patch applies cleanly via the clone script.

## Grammar / AST drift

The pilot was not consulted in detail for 2025-06; the release notes
classify this as a metamodel `.uml`/`.ecore` realignment to Beta 4 with
no surface-syntax change. Empirically:

- The clone + patch + full test run completed with no AST regeneration
  required.
- No code under `packages/` was modified beyond the clone script and
  patch.
- The test baseline matched exactly.

So for the LSP's purposes 2025-06 was effectively a pin bump.

## Final test result

```
Test Files  75 passed (75)
Tests       2152 passed | 7 skipped (2159)
```

Identical to the pre-change baseline (2152 / 7 / 2159). Build is clean
(`pnpm run build` succeeds with 0 warnings, 0 errors). Lint reports
pre-existing errors unrelated to this phase (no new diffs in any
source file).

## Summary

Not a pin-only no-op: the upstream rewording of the two
`SurroundedSpacePerformances` end-features forced a patch regeneration.
The change is mechanical and preserves the original intent of the fork.
No grammar drift, no AST regen, no code adaptation, tests at baseline.
