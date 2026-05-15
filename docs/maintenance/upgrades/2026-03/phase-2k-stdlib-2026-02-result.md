# Phase 2k - Stdlib 2026-02

## Summary

Advanced the bundled SysML v2 stdlib from upstream `2026-01` to `2026-02`. Pin-only change; no patches required (the Occurrences patch was retired in Phase 2j and remains retired).

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`:

- Before: `b48c37f3bc5702bc4dfce9ce2b7e454720c7c2fb` (2026-01)
- After:  `0bd362302f23a3b7b5f169d49b0d49b938e00c0c` (2026-02, "Updated for 2026-02.")

Stdlib was refreshed via `rm -rf SysML-v2-Release && node packages/syside-languageserver/scripts/clone-sysml-release.mjs`.

## `nonunique` impact

The 2026-02 digest noted that the pilot reimplemented the `nonunique` keyword as a data-type singleton driving the normative `isUnique` property, with no surface-syntax change. Per the `project_pilot_changes_touch_emf` guidance, "no syntax change" releases can still ripple into the AST, so verification was via the full test suite.

Result: no observable impact on this toolchain. Our grammar parses `nonunique` as before, and no tests regressed. As expected: the pilot change was an EMF/metamodel-internal refactor that does not surface in textual notation.

## Other 2026-02 changes

The digest also mentioned "small bug fixes" inherited from upstream content. These are stdlib-content changes only; the test suite (including the Semantifyr integration tests) continues to pass cleanly.

## Verification

- `pnpm test`: **2152 passed | 7 skipped (2159)** -- exactly baseline.
- `pnpm run build`: clean (0 warnings, 0 errors across node and web bundles).
- `pnpm run lint`: pre-existing errors only (not introduced by this phase; diff is a single-line pin change).

## Diff

```
 packages/syside-languageserver/scripts/clone-sysml-release.mjs | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

No commits were made, per phase instructions.
