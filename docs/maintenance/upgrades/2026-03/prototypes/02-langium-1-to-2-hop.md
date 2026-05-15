# Prototype P2 — Langium `1.2 → 2.x` first hop

> **Subagent brief.** First of the three major-version hops in [`plan.md` Phase 0](../plan.md#phase-0--langium-upgrade-prerequisite). Each hop is its own prototype; this packet covers `1.2 → 2.x`.

## Goal

Upgrade the [`langium`](https://www.npmjs.com/package/langium) dependency from `~1.2.0` to the latest `2.x` (currently `2.1.3` or whatever the latest 2.x line tag is). Apply all mechanical migration changes. Make the test suite green again.

## What this prototype answers

**Question:** What does one Langium major hop actually break in this codebase, and how long does it take? Each subsequent hop (2→3, 3→4) will follow the same pattern, so this prototype's findings calibrate the cost of the full Phase 0.

## In scope

- Update `langium` dependency in all `package.json` files in the workspace to the latest `2.x`.
- Update `langium-cli` to a matching version.
- Re-run grammar generation (`pnpm run grammar:generate`).
- Sweep all `src/**/*.ts` for code that breaks under the new API surface. Common categories:
  - `Reference` type changes (may be `Reference | MultiReference` already in 2.x, or only later).
  - `findDeclaration` rename or signature change.
  - AST `<typeName>` ↔ `<typeName>.$type` accessor changes.
  - Grammar/rule-name uniqueness rules (may not affect 2.x; check).
  - Other items in the [Langium changelog](https://github.com/langium/langium/blob/main/packages/langium/CHANGELOG.md).
- Make every failing test pass.
- Keep behavior identical otherwise — no SysML semantic changes.

## Out of scope

- **Do not** upgrade to 3.x or 4.x. One major hop only.
- **Do not** change Langium grammar files (`.langium`) beyond what's necessary to compile.
- **Do not** refactor surrounding code to take advantage of new Langium features.
- **Do not** address the HTML-comment workaround in [`README.md`](../../../README.md) about `addSuperPropertiesInternal`; verify it's still relevant or note that it's not, but don't refactor away from any workaround unless it actively prevents compilation.
- Committing. Leave the work on branch `proto/p2-langium-1-to-2-hop`.

## Success criteria

- `langium` and `langium-cli` at latest `2.x` in every workspace `package.json`.
- `pnpm install` succeeds.
- `pnpm run grammar:generate` succeeds.
- `pnpm test` is **green** — same count of passing tests, same skipped tests, no new failures. (`Tests: 8 skipped, 2118 passed, 2126 total` is the baseline.)

## Required reading

1. [`pre-migration-audit.md` §1](../../pre-migration-audit.md#1-langium-upgrade-target).
2. [`plan.md` Phase 0](../plan.md#phase-0--langium-upgrade-prerequisite).
3. [Langium 2.x changelog](https://github.com/langium/langium/blob/main/packages/langium/CHANGELOG.md) — fetch via WebFetch the 1.x → 2.x migration entries specifically.
4. Existing code at [`packages/syside-languageserver/src/services/references/linker.ts`](../../../packages/syside-languageserver/src/services/references/linker.ts), [`scope-provider.ts`](../../../packages/syside-languageserver/src/services/references/scope-provider.ts), and [`scope-computation.ts`](../../../packages/syside-languageserver/src/services/references/scope-computation.ts) — likely epicenters of API change.

## Method

1. Read the changelog for 1.x → 2.x major entries.
2. Update package.json files.
3. `pnpm install` and capture the first wave of TypeScript compilation errors.
4. Fix mechanically — most changes are find-replace or signature-update.
5. Re-run `pnpm run grammar:generate`.
6. Run tests; iterate on failures.
7. Once green, count test results and confirm baseline.
8. Write the results doc.

## Output

**1. Code changes**, uncommitted, branch `proto/p2-langium-1-to-2-hop`:
- `package.json` updates across the workspace.
- Whatever TS edits were necessary.
- Updated generated grammar files.

**2. Results writeup** at `docs/maintenance/upgrades/2026-03/prototypes/results/02-langium-1-to-2-hop-result.md`:
- Final Langium version targeted.
- **Categorized list of breaking changes encountered.** For each category: how many files affected, representative one-line example of the change. This is the calibration data — it tells us what 2→3 and 3→4 will likely look like.
- Test results before/after.
- HTML-comment workaround in README — still relevant or not?
- Time taken (rough estimate; subjective).
- Any surprises.
- Confidence that the same approach scales to 2→3 and 3→4 hops.

## Report back

A ~300-word summary: final version, top three categories of breaking change, test results, time, confidence-for-next-hops. Detail goes in the writeup.

## If scope expands

If you encounter a change that requires architectural decisions (e.g. Langium dropped a feature this repo depends on and there's no obvious replacement), **stop**. Write the results doc explaining what's blocking, what options exist, and request guidance.
