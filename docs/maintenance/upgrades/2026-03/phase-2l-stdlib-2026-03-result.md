# Phase 2l - Stdlib advance to 2026-03 (final target)

## Pin update

`packages/syside-languageserver/scripts/clone-sysml-release.mjs`: bumped from
`0bd362302f23a3b7b5f169d49b0d49b938e00c0c` (2026-02) to
`cd99f7ca70b96abb38f09dfd25725e3cf259baa3` (2026-03 release tag).

No patches needed; `scripts/patches/` remains empty.

## `checkConnectorTypeFeaturing` comparison with pilot 2026-03

The 2026-03 behavior change is driven by pilot commit `90172570b`
(ST6RI-921) on `FeatureReferenceExpressionAdapter.addReferenceConnector()`: it
removed the `!isInFilterExpression()` guard. The pilot now creates an implicit
binding connector for FRE referents even inside filter expressions, so the
existing `checkConnectorTypeFeaturing` rule (KerMLValidator.xtend line 1013)
flags qualified-name feature references in filter expressions because the
referent's owning type isn't featured by the FRE's context. Users must rewrite
`[Foo::bar]` as `[(as Foo).bar]` (feature chain), which the rule already
exempts via its `FeatureChainExpression` special case.

The validator rule itself is unchanged between 2026-02 and 2026-03; only the
adapter transformation is.

Our `validateConnectorEnds` in `kerml-validator.ts` (lines 898-931) implements
the same core check but does not include the pilot's special-case branches for
`FeatureReferenceExpression` / `FeatureChainExpression` location nor the
`Flow`/owning-namespace exemption. More fundamentally, our LSP does not run
the pilot's transformation pass, so the implicit binding connectors created
inside FRE/FCE never enter our AST. The rule therefore fires only on
explicitly authored connectors.

**Net effect:** our toolchain is more lenient than pilot 2026-03 for filter
expressions using qualified-name feature refs - we silently accept what the
pilot now rejects. This is a pre-existing divergence (modeling of implicit
binding connectors), not introduced by 2026-03; documenting as a known gap.
Closing it requires synthesizing the implicit binding during scope/typing,
which is out of scope for a stdlib-axis phase per the isolation rule. Filed
as future work.

Test baseline holds (the upstream stdlib was rewritten by Ed Seidewitz to use
`(as T).f`, so we don't inherit any newly invalid library content).

## Test result

`pnpm test`: **2152 passed | 7 skipped (2159)** - matches Phase 2k baseline
exactly.

(First test run had two flaky `beforeAll` hook timeouts in
`packages/syside-languageserver/src/model/printer/__tests__/{edges,expressions}.test.ts`
caused by 10s hook limit being exceeded during cold initialization. Subsequent
runs are clean. Unrelated to stdlib content.)

`pnpm run build`: clean.
`pnpm run lint`: 13 pre-existing errors / 6 pre-existing warnings; our diff
touches only the stdlib pin so none are attributable to this phase.

## Retrospective: 2026-03 cycle stdlib advance (2024-12 -> 2026-03)

Eight phases (2e..2l) walked the stdlib forward one upstream release at a
time. Headline observations:

- **Patches retired to zero.** We entered the cycle carrying the Occurrences
  patch and exited with `scripts/patches/` empty (retired in Phase 2j /
  2026-01). No patches are required for 2026-03.
- **Most phases were uneventful.** The majority were "bump pin, clone,
  baseline green, lint, done" with no source changes - vindicating the
  isolate-migration-axes principle.
- **Real complexity hits were validator-driven.** A few phases needed
  validator audits when upstream tightened a constraint
  (feature-chaining/scoping; `checkConnectorTypeFeaturing` here). When the
  pilot's tightening relied on its transformation pass we deferred rather
  than reimplement the transformation - logged as known divergences.
- **Pre-existing divergence pattern.** Several constraints in the pilot are
  "satisfied by transformation" (adapters add implicit elements, then the
  rule passes/fails). Our authoring-time LSP doesn't run those adapters, so
  we systematically under-report on rules whose violations only appear after
  transformation. This is the largest remaining qualitative gap; it cuts
  across releases and warrants its own track.
- **Tests held at exact counts most phases.** The 2152 / 7 baseline has been
  stable since the printer infrastructure stabilized earlier in the cycle;
  flaky hook timeouts in printer tests recurred but were never a real
  regression.

sysml-2ls now ships on stdlib **2026-03**.
