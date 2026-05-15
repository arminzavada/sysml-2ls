# 2026-03 upgrade arc — resume notes

Final state at end of Phase 0f. Use this when picking the work back up.

## Final state

* **Langium**: 4.2.4 (CLI 4.2.1, chevrotain 12.0.0)
* **TypeScript**: 5.8.3 (pinned via `pnpm.overrides`)
* **Test runner**: Vitest 3.2.4
* **ESLint**: 9.39.1 (flat config, `typescript-eslint` v8)
* **Node**: `>=20.11.0`
* **Module system**: ESM throughout (no CJS sources)
* **Test baseline**: 2133 passed / 8 skipped / 2141 total

All Phase 0a-0f changes are commit-clean before phase 0f's branch. Phase 0f's
uncommitted changes (16 files) await user review on
`worktree-agent-ad2f1b81935a8454e`.

## Phase-by-phase result docs

* `phase-0a` (ESM migration): no doc; commit `6d86542`.
* `phase-0b` (Langium 1.2 → 2.1): `phase-0b-langium-1-to-2-result.md`.
* `vitest-migration` (Jest → Vitest 2.x): `vitest-migration-result.md`,
  commit `17e95ef`.
* `phase-0c` (Langium 2.1 → 3.5): `phase-0c-langium-2-to-3-result.md`.
* `phase-0d` (Langium 3.5 → 4.2): `phase-0d-langium-3-to-4-result.md`.
* `phase-0e` (deps modernization, ESLint v9 flat, Vitest 3, etc.):
  `phase-0e-deps-modernization-result.md`.
* `phase-0f` (final cleanup): `phase-0f-final-cleanup-result.md` (this set).

## What's ready for the user

The toolchain arc is done. SysML-side work (e.g. the `proto/p1a-reclassify-patches`
branch this worktree was cut from) can resume on top of the Phase 0f result.

## Deferred items (with reason, from Phase 0e and 0f)

* **TypeScript 6.x**: held by `pnpm.overrides` pin and Langium 4.2.x peer.
  Revisit when Langium 5.x lands.
* **Vitest 4.x**: 3.x is the safer first step. Vitest 4 changed
  `vi.useFakeTimers` / `workspace` API shape.
* **ESLint 10.x**: only RC-stream; v9 is the current flat-config LTS.
* **Type-checked lint** (`@typescript-eslint/no-deprecated`,
  `tseslint.configs.strictTypeChecked`): would surface real but
  large-volume findings. Needs its own triage phase with CI-cost measurement.
* **`performance-now` → `performance.now()`** and **`node-fetch` → built-in
  `fetch`**: small functional simplifications, deferred to a "remove polyfills"
  pass.
* **`@typescript-eslint/no-deprecated`**: same gating as type-checked lint.

## Workarounds still in place (documented at their site)

* `SysMLDocumentFactory` lazy `MetamodelBuilder` getter: closes a Langium DI
  cycle (`Factory → MetamodelBuilder → IndexManager → LangiumDocuments →
  Factory`). Comment is in `services/shared/workspace/documents.ts`.
* `sanitizeRange` (`utils/common.ts`): defensive against partial-reparse CST
  ranges with `null` ends.
* Linker `// TODO: fix in Langium` markers (×3): Langium-side AST/CST
  inconsistency during eager / partial linking.
* `_ref`/`_nodeDescription` shape in `SysMLLinker.buildReference`: required by
  `DefaultLinker.doLink`'s `in`-property check.
* `SysMLDocuments.deleteDocuments` mirroring single-doc invalidation: Langium
  4.x `DocumentBuilder.update` uses bulk `deleteDocuments`; the base
  `DefaultLangiumDocuments.deleteDocuments` doesn't run our per-doc cleanup.

## Known limitations (carryover, see `docs/known_limitations.md`)

* False-positive "Feature must be typed by at least one type" errors
  (issues #19, #15). Heisenbug.
* LL(*) parser lookahead gaps for some expression / import patterns.

## How to verify before continuing

```
pnpm install
pnpm run grammar:generate
pnpm test            # expect 2133/8/2141
pnpm run build       # expect tsc -b + esbuild clean
pnpm run lint        # expect 0 errors, 0 warnings
```

If any of these regress, that's a real regression. The baseline is the
truth.
