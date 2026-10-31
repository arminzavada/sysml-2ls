# Upgrade checklist

How to advance `sysml-2ls` from one pilot release to the next.

This document is **intentionally a skeleton**. It will be filled in concretely the first time we perform a real upgrade — replace each placeholder section with what actually happened, not with what we imagine should happen. See [Anti-decay rules](#anti-decay-rules) below.

## Guiding principle: conformance over compatibility

`sysml-2ls`'s correctness criterion is parity with the OMG specification and the pilot implementation. Until parity is reached, the toolchain is considered incorrect — being "permissive" of models the pilot now rejects is a defect, not a feature.

This means upgrades:

- **Do not** preserve previously-accepted-but-now-invalid syntax via deprecated aliases, dual-syntax fallbacks, or compatibility shims.
- **Do not** treat the regression of existing user models as a blocker. If the pilot/spec rejects a string we used to accept, we follow the pilot.
- **Do** enforce restrictions at the same layer the pilot does (grammar-layer constraints stay at the grammar; validator-layer constraints stay at validation).
- **Do** treat any divergence from pilot behavior — discovered during or after an upgrade — as a bug to file or fix, not a quirk to document.

The constraint is on *what the language accepts and what its semantics are*. Performance, API ergonomics, and internals are this project's own design space and may freely diverge from (and improve on) the pilot.

## When to upgrade

A new pilot tag (`YYYY-MM`) has been published on [SysML-v2-Pilot-Implementation](https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation), and either:

- the maintainer wants the new features / fixes, or
- drift from upstream has grown large enough to be worth reducing pre-emptively.

There is no SLA. Skipping months is fine; catching up on multiple at once is also fine.

## Steps

1. **Pre-flight**
   - [ ] Working tree clean; on a fresh upgrade branch off `main`.
   - [ ] Note current targets from [`upstream-sources.md`](upstream-sources.md) (pilot tag, stdlib commit).
   - [ ] Identify the target pilot tag — by policy, this is the **latest available tag** on `Systems-Modeling/SysML-v2-Pilot-Implementation`.

2. **Refresh the local pilot checkout**
   - [ ] `git fetch --tags` and check out the target tag in `~/work/systems-modeling/SysML-v2-Pilot-Implementation/`.

3. **Diff pilot vs previous target**
   - [ ] Grammar (`org.omg.kerml.xtext`, `org.omg.sysml.xtext`).
   - [ ] Scoping / typing / transformation logic.
   - [ ] Standard-library changes (against `SysML-v2-Release` at the matching tag).
   - [ ] Note the items requiring action.

4. **Port to this repo**
   - [ ] Probe beyond the range: in 2026-09.1 the pre-existing deviations outweighed the in-range port.
   - [ ] Port in the order stdlib pin, grammar, typing, validation, with tests green at each boundary. The pin (step 5) can go first when the library hop is test-neutral.
   - [ ] Check each change against the pilot's xpect models, its stdlib XMI (compositeness and typing, see `stdlib-typing.test.ts`) and the release example models.
   - [ ] Per phase, diff every diagnostic and reference target on the release models before and after; trace each change to an item.
   - [ ] Record each stricter-than-pilot check, and each pilot-reject still accepted, in [`known_limitations.md`](../known_limitations.md).

5. **Update the standard-library pin**
   - [ ] Edit [`scripts/clone-sysml-release.mjs`](../../scripts/clone-sysml-release.mjs):
     - The remote must be upstream `Systems-Modeling/SysML-v2-Release` (see [`upstream-sources.md`](upstream-sources.md)). The legacy `arminzavada/SysML-v2-Release` fork was retired in the 2026-03 cycle and must not be reintroduced.
     - `tag` and `commit` must match the `SysML-v2-Release` tag corresponding to the target pilot tag.
   - [ ] Re-run the clone script (`pnpm clone-stdlib`); it also regenerates `packages/syside-base/src/stdlib.ts`. Rebuild.

6. **Validate**
   - [ ] Lint, type-check, full test suite pass.
   - [ ] Open at least one non-trivial model end-to-end in the editor and confirm parsing, scoping, and diagnostics behave as expected.

7. **Record**
   - [ ] Update [`upstream-sources.md`](upstream-sources.md) with the new pilot tag and stdlib commit.
   - [ ] Append a CHANGELOG entry.
   - [ ] Update this file with anything that was missing or wrong from the procedure as written.

## Anti-decay rules

This file is the place we encode hard-won upgrade knowledge — its value is exactly proportional to its accuracy.

- **Reflect reality, not imagination.** Steps must describe what was actually done. If a step is wrong or skipped during a real upgrade, fix it in the same PR.
- **No hypothetical steps.** Add a step only after its absence caused a real problem.
- **No content duplication.** Refer to the live pilot / release / spec rather than copying their text or version-specific details here.
- **Prune as much as you add.** If a step has become unnecessary (tooling improved, automation added), delete it.
