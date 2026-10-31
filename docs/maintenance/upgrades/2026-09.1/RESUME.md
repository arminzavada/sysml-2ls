# 2026-09.1 upgrade — resume notes

## Current phase

Complete (2026-10-31), uncommitted on `main`'s working tree until Armin commits. Decisions D1–D7 resolved in [`plan.md`](plan.md); prototypes folded into implementation at Armin's direction.

## Done

- Exploration: release-notes digest, chunks 01–06, synthesis.
- Phase 1: stdlib pinned to `2026-09`; `clone-sysml-release.mjs` regenerates `packages/syside-base/src/stdlib.ts` from the pin; `scripts/update-stdlib.mjs` removed. Suite green (79 files, 2163 passed, 7 expected fail, 7 skipped).

- Phase 2: grammar G1–G7, X1/V3 send rules, G5/G7 printers, V4 retired ([result](phase-2-grammar-result.md)). Suite green (86 files, 2225 passed).

- X1 residual (Armin, 2026-10-30): payloads starting with `{` rejected by `validateSendActionPayloadNotBody` instead of the grammar; documented in `docs/known_limitations.md`.

- Phase 3: T2, T2b, T4, T5, T7, T8, T9, T10 ([result](phase-3-typing-result.md)). Suite green (87 files, 2290 passed). Leftovers folded into Phases 4 and 5 of the plan.

- Phase 4: V1, V5, V6, V8, V10, V11, V12, A1–A5, ST6RI-856 ([result](phase-4-validation-result.md)). Suite green (88 files, 2335 passed). Leftovers folded into Phase 5b.

- Phase 5a: T3, occurrence supertypes, owned-end binary rule, variant ownership ([result](phase-5a-typing-backlog-result.md)). Suite green when run alone; full runs on the loaded machine hit hook timeouts (load 17–27 on 8 cores from other sessions).

- Phase 5a2: portion owner typing dropped, default supertype from owned typings ([result](phase-5a2-typing-followups-result.md)). Suite green (88 files, 2405 passed) at normal load; the earlier timeouts were load.

- Phase 5a3: flow ends without default supertype, KerML `portion` not composite; constructor results stopped (AST change, see plan out-of-scope) ([result](phase-5a3-typing-tail-result.md)). Suite green (88 files, 2410 passed).

- Phase 5b: A6–A9, G5, inventory B aligned, explicit-relationships-only validation, cross-feature fix, flow-end renames, `known_limitations.md` ([result](phase-5b-validation-backlog-result.md)). A10/A11 stopped on scoping bugs. Suite green (88 files, 2453 passed, 6 expected fail).

- Phase 5c: transition and expression scoping with A10/A11, implied parameter redefinitions for all behaviors and steps, inherited end multiplicity, featuring checks as errors, `assign` crash ([result](phase-5c-remaining-pilot-rejects-result.md)). Suite green (90 files, 2479 passed, 6 expected fail, 7 skipped).

## Open for Armin

- Constructor-expression result feature (plan out-of-scope): an AST change reaching scoping, the evaluator, the printer and the Semantifyr mapper. It also decides whether constructor arguments resolve past the constructor (spec, ours) or stop at its result feature (pilot code, not run).
- `assign (expr).x := …` parity needs the commented-out `AssignmentTargetMember` in `SysML.langium`.
- Possible pilot quirk, matched here: composite variant ports of variation ports report `validatePortUsageIsReference`.
- Not checked against a running pilot: chained access through portions (`p.s.q`) no longer resolves (5a2).

## Retrospective

- The in-range port was small, as the synthesis estimated. The pre-existing backlog was not: it took five sub-phases (5a–5c), each surfacing the next. Two of the gaps were name-resolution bugs, not missing validators.
- Oracles that worked:
  - the pilot's xpect models, run through our validator;
  - its stdlib XMI, for compositeness and typing (0 mismatches over 8312 elements);
  - a before/after dump of every diagnostic and reference target on the 310 release models.
  Every reference-target change was traced to an item.
- Folding prototypes into implementation worked for this size. Subagents ran in the main tree without worktree isolation, since each phase built on the previous uncommitted one. One subagent used `git stash`; later briefs forbade it.
- Full-suite hook timeouts under heavy machine load looked like regressions; the files passed alone.
