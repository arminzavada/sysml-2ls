# Phase 2j — Stdlib advance to upstream 2026-01

Branch: `phase-2j-stdlib-2026-01` (based on `2c50415`, Phase 2i tip).

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`:
- old: `6b980cacc63c0f6e62e84b2f2673d378ea9e0f5f` (2025-12)
- new: `b48c37f3bc5702bc4dfce9ce2b7e454720c7c2fb` (2026-01)

Upstream tip after refresh: `b48c37f Updated sequence realization examples to fix validation errors.`

## Occurrences patch — retired

`packages/syside-languageserver/scripts/patches/0001-occurrences-end-keyword.patch` was deleted.

Reason: upstream 2026-01 now writes the `Occurrences::Occurrence::SurroundedSpacePerformances::surroundedByOccurrences` cross-feature participants with the explicit `end` keyword:

```
end feature surroundedSpace: Occurrence [1] subsets that;
end feature surroundingSpace: Occurrence [1] subsets self;
```

at lines 604-605 of `Kernel Libraries/Kernel Semantic Library/Occurrences.kerml`. That is exactly what our patch was producing locally. The retirement criterion in the patch header (the LSP no longer needs the keyword inserted) is met from the *upstream* side: they now emit the spec-conformant form natively, so no LSP-side change to `checkFeatureCrossingSpecialization` is required to retire the patch this release.

After deletion, `clone-sysml-release.mjs` runs with no patch steps and no errors.

## Metamodel cleanup impact

Per the 2026-01 release digest, this release contains a major in-memory/XMI metamodel cleanup with "no textual-syntax change". Per `project_pilot_changes_touch_emf`, this was cross-checked by running the full suite. **No ripples observed** in the Langium-side AST shape or interface declarations: tests are at exact baseline.

## Deferrals (unchanged from plan)

- **`TrigFunctions` evaluable** — deferred to Phase 5 per `feedback_authoring_not_execution`. This LSP does not target execution-side equivalence with the pilot evaluator.
- **13 new validators firing in pilot (Chunk 6)** — deferred to Phase 4. The pilot's enabling these constraints in 2026-01 does not automatically apply to us; each would have to be implemented LSP-side.

## Verification

- `pnpm install` — OK.
- `rm -rf SysML-v2-Release && node packages/syside-languageserver/scripts/clone-sysml-release.mjs` — clean, no patch errors.
- `pnpm test` — **2152 passed | 7 skipped (2159)**. Matches pre-change baseline exactly.
- `pnpm run build` — OK, 0 warnings, 0 errors (esbuild node + browser).
- `pnpm run lint` — 13 errors / 6 warnings, **all pre-existing** (this phase's diff is only the pin bump and patch removal; no `src/` changes).

## Diff

```
 packages/syside-languageserver/scripts/clone-sysml-release.mjs       |  2 +-
 packages/syside-languageserver/scripts/patches/0001-occurrences-end-keyword.patch | 34 ----------------------
 2 files changed, 1 insertion(+), 35 deletions(-)
```

No commits made.
