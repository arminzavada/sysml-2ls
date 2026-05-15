# Project issues — now / during / later

> **Snapshot: 2026-05-04.** Inventory of known issues, test debt, dependency lag, and code-quality concerns in `sysml-2ls`. Each item is dispositioned for **now** (before the 2026-03 migration begins), **during** (handled inside one of the migration phases), or **later** (deferred until after the migration).
>
> **Method:** Read of [`docs/known_limitations.md`](known_limitations.md), grep of TODO/FIXME comments (~58 hits), inspection of skipped tests (8 actually-skipped of 2126 total — suite is green at 80% coverage), spot-checks of dependency major versions in [`packages/*/package.json`](../../packages/).
>
> **Reads against:** the [exploration synthesis](upgrades/2026-03/00-exploration-synthesis.md) and [`plan.md`](upgrades/2026-03/plan.md), so the dispositioning is informed by what the migration is going to touch.

## Health summary

- **Test suite:** green. 70 suites, 2118 passing, 8 skipped, 0 failing. Runtime ~92s.
- **Coverage:** 80.86% statements, 72.82% branches. Reasonable; no acute coverage emergency.
- **Lint / build:** no failing build per the test run; not separately verified for warnings.
- **Documented limitations:** 2 entries in [`known_limitations.md`](known_limitations.md) — the Heisenbug and four LL(*) parser limitations.
- **Dependency lag:** Langium `~1.2.0` (latest is several majors ahead), `vscode-languageserver ~8.0.2` (latest ~9.x), `chevrotain ^9.1.0` (latest ~11.x).
- **TODO/FIXME comments:** ~58 in source; clusters around stub library references, visibility filtering, evaluator gaps, completion-provider polish, annotation processing.

The project is **not in a bad state**. It is a well-tested, ~80%-covered codebase that has been on pause; what's needed is catching up upstream and resolving accumulated TODOs, not rescuing a broken project.

## Now — before migration begins

These are short audit/decision items that, if skipped, would create avoidable rework or incorrect plans.

| Item | Rationale | Effort |
|------|-----------|--------|
| **Confirm Langium upgrade target.** Read changelogs from `1.2.x` through current latest; note breaking changes in scope-provider and grammar APIs. | Plan Phase 0 depends on knowing what we're moving to. Affects how Phase 3a (multi-spec scoping fix) integrates — Langium may have made API changes that affect the implementation. | 1–2 hours, read-only. |
| **Audit the 8 skipped tests.** Are they recording bugs to fix, deferred functionality, or stale tests to delete? Each tells a different story. | If any are recording bugs adjacent to the migration's surface, they should be addressed during. | <1 hour. |
| **Decide on the Heisenbug.** Is it parse-order-dependent stdlib loading? If so, the `2026-03` stdlib re-fetch + Phase 1 patch infrastructure may *change* its symptom even if it doesn't fix it — better to characterize it before, so we can tell whether migration helped or just shifted the manifestation. | Knowing pre-migration baseline matters for retrospective. | 1–2 hours of investigation. |
| **Quick dep-vulnerability scan.** `pnpm audit` to surface security-flagged transitive deps that need updating regardless. | Bundling security upgrades into Phase 0 (Langium upgrade) is cleaner than fixing them later. | <30 minutes. |
| **`pnpm` complexity quick-look.** Spend 30 minutes to characterize what's actually complex: too many workspaces? Pre-build hooks? Custom scripts? Decide whether it's a real concern or vague unease. | If it's a real concern, surface it now so it doesn't ambush Phase 0. | <1 hour. |

**Disposition:** these are **all read-only investigation** items. No code changes "now". Total effort: ~5 hours.

## During — inside the migration phases

These are issues that the [migration plan](upgrades/2026-03/plan.md) will naturally address. They become work items inside specific phases.

| Item | Migration phase that touches it | Notes |
|------|----------------------------------|-------|
| **Stub library references (`// TODO` placeholders)** in [`metadata-feature.ts`](../../packages/syside-languageserver/src/model/KerML/metadata-feature.ts), [`step.ts`](../../packages/syside-languageserver/src/model/KerML/step.ts), [`feature-chain-expression.ts`](../../packages/syside-languageserver/src/model/KerML/expressions/feature-chain-expression.ts), [`for-loop-action-usage.ts`](../../packages/syside-languageserver/src/model/SysML/for-loop-action-usage.ts) | Phase 2 (grammar/AST + library renames) | These are placeholders for canonical library element references that should be filled in when library renames land. Address during Phase 2. |
| **Visibility-filter TODOs** in [`type.ts:519, 551, 556`](../../packages/syside-languageserver/src/model/KerML/type.ts) (`// TODO: filter by visibility?`) | Phase 3a (multi-spec scoping) | These three sites are exactly the inheritance walks that Phase 3a's `gen()` algorithm fixes. Visibility filtering integration is part of that work per [`03b-visibility-filter-trace.md`](upgrades/2026-03/03b-visibility-filter-trace.md). |
| **"Implement filtering" for imports** ([`imports.test.ts:101`](../../packages/syside-languageserver/src/__tests__/kerml/root/imports.test.ts)) | Phase 3a (scoping) | Pilot's `imp()` honors filter conditions on imports; we'd add this when porting the scoping algorithm. |
| **Implicit redefinition / "spec is a little confusing"** ([`features.redefinition.test.ts:103`](../../packages/syside-languageserver/src/__tests__/kerml/core/features.redefinition.test.ts)) | Phase 3a (scoping) | Multi-spec resolution work clarifies redefinition semantics; this TODO retires when the algorithm lands. |
| **LL(*) parser limitations** documented in [`known_limitations.md`](known_limitations.md): feature-reference expressions, whitespace-separated `::`/`*` import tokens, `assign` LHS chains, succession/transition relaxation | Phase 0 (Langium upgrade) and Phase 2 (grammar) | Newer Langium versions have improved Chevrotain integration and may relax some lookahead constraints. Some items will require staying as documented limitations even after upgrade — flag in [`known_limitations.md`](known_limitations.md) updates per the [stricter-than-pilot rule](../../).../memory/feedback_stricter_than_pilot_ok_if_documented.md). |
| **Langium grammar generator workaround** (`addSuperPropertiesInternal` HTML-comment in [`README.md`](../../README.md#L184)) | Phase 0 | Verify it's still relevant in the upgrade target; remove the workaround note if not. |
| **Reflection TODO in evaluator** ([`evaluator.ts:322`](../../packages/syside-languageserver/src/model/expressions/evaluator.ts)) | Phase 5 (evaluator catch-up) | Fits with constructor-expression and trig-function additions. |
| **Heisenbug** (parse-order-dependent type errors) | Phase 1 (stdlib pin migration) | The fork-patch wipe + new stdlib + patch-script changes the document-loading sequence in non-trivial ways. Whether the bug clears or shifts will be observable; document the outcome. |
| **8 skipped tests** | Phase that touches each (categorized after the "now" audit) | Each test's home phase depends on what it skips. |

**Disposition:** these are tracked items that get fixed inside their migration phases — not separate work, just ensuring they're remembered. Add a checklist to each phase's success criteria: "skipped tests in this area un-skipped or removed; TODOs in this area resolved or escalated."

## Later — post-migration

Deferred until after the migration is complete.

| Item | Why later |
|------|-----------|
| **`pnpm` setup overhaul** | Already deferred per the plan. "Seems too complex" is vague; revisit only if a concrete pain point arises during migration. |
| **Coverage push to 90%+** | 80% is fine. Better to add coverage to *new* code (migration-introduced) than retroactively chase old gaps. |
| **Completion-provider polish** ([`completion-provider.ts:62, 114, 449, 510`](../../packages/syside-languageserver/src/services/lsp/completion-provider.ts)) — show docs in label details, extend default lexer and cache keywords, custom-lexer migration | UX improvements, not migration-blocking. Better to do them after the language semantics are correct. |
| **Annotation formatting improvements** ([`annotations.test.ts`](../../packages/syside-languageserver/src/__tests__/kerml/root/annotations.test.ts) TODOs) — strip surrounding `/* */`, multi-line leading-whitespace strip, KerML body validation in `TextualRepresentation` | Polish; orthogonal to migration. |
| **Hover documentation polish** | Same. |
| **Print escape handling** ([`print.ts:207`](../../packages/syside-languageserver/src/model/printer/print.ts)) | Small, isolated; revisit when formatter work happens. |
| **Test coverage of `syside-cli`, `syside-protocol`, `syside-languageclient`** (small packages, may be undertested) | Surface area is small; verify after migration. |
| **GitLab issue migration / housekeeping** | The project has a [GitLab issue tracker](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues) including the Heisenbug issues #19 and #15. Triage post-migration to close stale ones and reopen against the new state. |
| **Sensmetry mirror sync** ([github.com/sensmetry/sysml-2ls](https://github.com/sensmetry/sysml-2ls)) | Decide post-migration whether GitHub mirror is still primary or canonical moves elsewhere. |
| **DCO / signed commits** | Existing process, not migration-blocking; verify any contributor docs are still correct. |

## Summary by category

- **Now:** ~5 hours of read-only investigation. Goal: avoid surprises and confirm assumptions baked into [`plan.md`](upgrades/2026-03/plan.md).
- **During:** ~15 distinct issues, each tied to a migration phase. Goal: ensure they are not lost; require their resolution as part of phase success criteria.
- **Later:** ~8 categories of polish and overhaul. Goal: defer decisively until the migration's foundation is in place; revisit then with fresh priorities.

## Open question

Should the "now" audit items (Langium changelog read, skipped-test triage, Heisenbug characterization, dep audit, pnpm look) be done **right away** as a single audit pass before [`plan.md`](upgrades/2026-03/plan.md) is finalized, or rolled into Phase 0 of the plan? My weak preference: do them as a quick standalone audit first, since several of them feed back into the plan and could surface revisions we'd want to make before committing.
