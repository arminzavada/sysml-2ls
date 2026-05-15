# Pre-migration audit (2026-05-04)

> **Outcome of the "now" items from [`project-issues-analysis.md`](project-issues-analysis.md).** Five read-only investigations performed before finalizing the migration plan. Findings feed back into [`plan.md`](upgrades/2026-03/plan.md) where they invalidate or refine its assumptions.

## TL;DR

- **Langium target is `4.2.x`** (3 majors ahead, multiple known breaking changes — non-trivial Phase 0).
- **Skipped tests are all pre-existing punts** (spec/pilot uncertainty or absent validator), not migration-blockers.
- **Heisenbug source is identified** at [`kerml-validator.ts:349-356`](../../packages/syside-languageserver/src/services/validation/kerml-validator.ts) — a stricter-than-spec validator marked `// not in the spec`. Likely timing-of-linking issue rather than truly random.
- **pnpm setup is not structurally complex** — 6 packages clean, scripts mostly normal. The "complexity" is probably script proliferation; doesn't impede migration.
- **Security: 58 vulnerabilities** (11 low, 21 moderate, 20 high, 6 critical), most transitive via `jest`, `node-stdlib-browser`, etc. The Langium upgrade likely clears many; full sweep belongs in Phase 0.

**Net effect on the plan:** no major revisions. Phase 0 (Langium upgrade) is **larger than initially scoped** — 3 majors with API breaks in scope-provider and references. Should still happen first per the original sequencing.

## 1. Langium upgrade target

**Current:** `~1.2.0` ([package.json](../../packages/syside-languageserver/package.json)).
**Target:** `4.2.1` (latest stable as of 2026-05; ~3 months old).

**Path:** 1.2 → 2.x → 3.x → 4.x. Three major-version hops. Some teams do hops sequentially to isolate breakage; others jump directly. Either is viable; sequential is lower-risk for this codebase given the scope-provider and AST-generation impact.

**Known breaking changes** that will affect this repo specifically:
- **`References` API:** types changed to `Reference | MultiReference` union. Affects the [linker](../../packages/syside-languageserver/src/services/references/linker.ts) (625 lines) and possibly other reference-resolving code.
- **`findDeclaration` → `findDeclarations`** (now returns an array).
- **AST type accessor change:** `<typeName>` → `<typeName>.$type` in generated `ast.ts`. Mechanical sweep across all `is(typeName)` / `isA: typeName` call sites.
- **Grammar rule names:** can't shadow grammar names; grammar names must be unique.
- Other smaller items in the Langium changelog ([eclipse-langium/langium releases](https://github.com/eclipse-langium/langium/releases)).

**Likely affects:**
- [`scope-provider.ts`](../../packages/syside-languageserver/src/services/references/scope-provider.ts) — directly touches reference resolution.
- [`scope-computation.ts`](../../packages/syside-languageserver/src/services/references/scope-computation.ts) — extends `DefaultScopeComputation`.
- [`linker.ts`](../../packages/syside-languageserver/src/services/references/linker.ts) — largest single file in references/.
- [`metamodel-builder.ts`](../../packages/syside-languageserver/src/services/shared/workspace/metamodel-builder.ts) — uses linker.
- **Every** file that imports from `langium` (broad sweep).

**Recommendation:** Phase 0 is bigger than my earlier estimate suggested. Realistic effort: a focused week of work, not a couple of days. Could be done in incremental hops (1→2, 2→3, 3→4) each with green tests before proceeding — that's the safer cadence.

The HTML-comment workaround in [`README.md`](../../README.md) about Langium's grammar generator (`addSuperPropertiesInternal` bug) should be re-checked on `4.2.x` — likely fixed by now.

**Plan-impact:** confirms Langium-first ordering but enlarges Phase 0's scope. No reordering needed; just a more honest effort estimate.

Sources:
- [langium - npm](https://www.npmjs.com/package/langium)
- [Langium 4.0 release announcement](https://www.typefox.io/blog/langium-release-4.0/)
- [Langium changelog (main branch)](https://github.com/langium/langium/blob/main/packages/langium/CHANGELOG.md)

## 2. Skipped-test triage

8 skipped tests in total, all in two files:

### `__tests__/kerml/kernel/implicits.test.ts:97` (7 tests via `.skip.each`)

```typescript
// skipping tests as pilot implementation always add implicit specializations
// while spec only adds if there are no explicit specializations, not sure which
// is right
test.skip.each(TABLE)("%s%s with explicit specializations does not implicitly specializes %s::%s", ...)
```

The 7 parameterized rows test the rule: "when a feature has explicit specializations, the implicit `Base`/`Occurrences`/`Objects`/`Links`/etc. specialization should *not* also be added." Author skipped because they were unsure whether pilot or spec was right.

**Disposition:** *during migration*. Per the [conformance rule](../../).../memory/feedback_conformance_over_compat.md): follow the pilot. After Phase 2 grammar + Phase 3a scoping work, re-enable, set the expected behavior to match the pilot at 2026-03, and commit. Per [Stricter-than-pilot](../../).../memory/feedback_stricter_than_pilot_ok_if_documented.md): we don't pick "stricter than pilot" here because the pilot's rule is *more* permissive than the spec — we should match pilot.

### `__tests__/services/validation/sysml-validator.test.ts:138` (1 test)

```typescript
test.skip("Usages owned by KerML types trigger validation", () => { ... }
```

The intended validator is `validateUsageOwningType` — does not exist in the repo. The test was written speculatively before the validator was implemented.

**Disposition:** *during migration*. This is exactly the kind of constraint that should be one of the [Phase 4 13 validations](upgrades/2026-03/06-validation-rules.md). When that work happens, implement `validateUsageOwningType` and un-skip.

**Plan-impact:** none. Both classes of skipped tests are already covered by Phase 2/3/4 work; just need to remember to un-skip when each phase touches its area.

## 3. Heisenbug characterization

**Source:** [`kerml-validator.ts:349-356`](../../packages/syside-languageserver/src/services/validation/kerml-validator.ts):

```typescript
if (
    !node.typeRelationships.find((r) => r.is(ast.FeatureTyping))
) {
    accept("error", "A Feature must be typed by at least one type.", {
        element: node,
        property: "heritage",
        // not in the spec
        code: "validateFeatureTyping",
    });
}
```

The validator is marked `// not in the spec` — it is **already a stricter-than-pilot rule** we keep deliberately. Per [feedback_stricter_than_pilot_ok_if_documented](../../).../memory/feedback_stricter_than_pilot_ok_if_documented.md), this is acceptable provided it's documented (which it is, in [`known_limitations.md`](known_limitations.md)).

**Why it's a "Heisenbug":** the check is `find FeatureTyping in node.typeRelationships`. The typeRelationships list is populated during linking. If validation runs against a document before its **cross-document** type links resolve — e.g. when document load order interleaves the standard library and user files — features that *should* have a transitive FeatureTyping via stdlib look untyped at validation time.

This is not actually random; it's a **race between validation and linking**, which manifests differently depending on disk-listing order or async-scheduling timing.

**Plausible Phase 1 effect:** the stdlib re-fetch and patches-script rewrite (Phase 1) changes the file enumeration of the standard library. The bug may shift symptom (different files trigger it) or appear to clear (if order luck improves). **It is not fixed by Phase 1 in any principled way.**

**Plausible real fix:** make the validator wait until linking is complete, or compute the FeatureTyping membership in a way that doesn't depend on the current document's linker state. This is best done as part of Phase 3a (scoping rework) — the same mechanism that resolves inherited features cleanly will give `find FeatureTyping` a stable answer.

**Disposition:** *during migration* (Phase 3a). Document the pre-migration manifestation now so we can verify post-migration whether the symptom truly cleared or just shifted.

**Plan-impact:** none. Already aligned with the Phase 3a scoping rework. Worth adding "Heisenbug verification" to Phase 3a success criteria — either it clears, or we know we still owe a separate fix.

## 4. pnpm complexity look

**Workspace:** 6 packages in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) — `syside-base`, `syside-languageserver`, `syside-cli`, `syside-languageclient`, `syside-protocol`, `syside-vscode`. Clean structure; no nested workspaces, no monorepo-of-monorepos.

**Top-level scripts** ([package.json](../../package.json)): ~20 scripts. The unusual ones:
- `prepare` runs full build on `pnpm install` — slow but standard for monorepos publishing internal packages
- `prepare-validation` / `run-validation` — custom workflow for running spec-validation against models
- `tstrace` — TypeScript build trace for performance profiling
- `index` — recursively runs `index` in workspaces (custom but innocuous)
- `install-hooks` — esbuild bundles the pre-commit hook from TypeScript

**Verdict:** Setup is not structurally complex. The "complexity" probably reflects script proliferation (~20 scripts spread across multiple concerns) and a few non-standard custom workflows that aren't documented. None of it impedes migration work.

**Recommendation:** keep deferred per [`plan.md`](upgrades/2026-03/plan.md). If, during migration, the `prepare` script's slowness becomes friction, address inline; otherwise leave alone.

**Plan-impact:** none.

## 5. Security audit (`pnpm audit`)

**Summary:** 58 vulnerabilities — 11 low, 21 moderate, 20 high, **6 critical**.

**Pattern:** the vast majority are *transitive* via deep dependency chains:
- `jest > @jest/core > jest-config > ts-node > diff`
- `node-stdlib-browser > crypto-browserify > browserify-sign > elliptic`
- `node-stdlib-browser > url > qs`

Direct dependency vulnerabilities are rare; most clear with a `jest`, `Langium`, and `chevrotain` upgrade because they bring newer transitive trees.

**Recommendation:** bundle the security upgrade into Phase 0:
- Upgrade `jest` along with Langium.
- After Phase 0 + Langium upgrade, re-run `pnpm audit` and address residual criticals directly.
- Don't try to fix vulnerabilities outside Phase 0 — they'll churn as deps update.

**Plan-impact:** Phase 0 absorbs the security audit. The 6 criticals should be remediated as part of phase exit (success criterion: "0 critical vulnerabilities outstanding after Phase 0").

## Net plan revisions

Adjustments to [`plan.md`](upgrades/2026-03/plan.md) based on this audit:

1. **Phase 0 (Langium upgrade) is larger than estimated.** ~1 week of focused work, not "small-to-medium." Includes the security-audit remediation as a success criterion.
2. **Phase 0 should be done in sequential major hops** (1→2→3→4) with green tests between, rather than a single 1→4 leap. Lower risk.
3. **Phase 3a (multi-spec scoping)** should include "verify Heisenbug clears" as a success-criterion item.
4. **Phase 2 / 4** should explicitly un-skip the 8 skipped tests as those phases touch their respective areas.
5. **Drop the "small-to-medium" effort label on Phase 0** — replace with "one focused week."
6. **No new phases needed.** The audit confirms the existing five phases cover what's discovered.

## Open question

After the audit, my recommendation is to **finalize [`plan.md`](upgrades/2026-03/plan.md) with the four small revisions above** and then transition to the prototype phase (default-value type propagation, per decision C). Sound right, or do you want to do another audit pass (e.g. inspect the Langium 2.x and 3.x changelogs in detail before committing) first?
