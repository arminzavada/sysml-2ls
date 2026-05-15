# Semantifyr test-models integration

## Where models were copied

`packages/syside-languageserver/src/__tests__/resources/semantifyr-models/`

10 SysML files: the 9 listed models plus `Verification.sysml`, which defines
the Semantifyr-specific calc defs (`eventually`, `mustAlways`,
`isStateActive`) that all 9 models reference. Without it the references are
unresolved. `spacecraft.oxsts` is intentionally not copied.

## Test

`packages/syside-languageserver/src/__tests__/integration/semantifyr-models.test.ts`

Mirrors `stdlib-loading.test.ts`: same `setupServicesWithStdlib` setup
(`createSysMLServices` with `standardLibrary: true`, full `sysml.library`
preloaded with validation off), then for each test model build with
`validation: { categories: ["built-in", "fast"] }` and assert zero
`parserErrors` and zero severity-1 diagnostics. `Verification.sysml` is
pre-built in `beforeAll` so cross-document references resolve. Uses
`it.each` / `it.skip.each` over arrays of file names.

## Per-model status

Passing (4):

- `aircraft_engine.sysml`
- `autonomous_driving.sysml`
- `door_access.sysml`
- `power_subsystems.sysml`

Skipped (5) — same root cause, `validateUsageOwningType` (in
`packages/syside-languageserver/src/services/validation/sysml-validator.ts`)
fires on `flow from X to Y` endpoint Usages, treating them as having a
non-Definition/non-Usage `owningType`. Listed under `KNOWN_FAILING_MODELS`
with a `// TODO:` comment. Skipped, not made laxer, per the
conformance-over-compat rule:

- `compressedspacecraft.sysml`
- `crossroads.sysml`
- `orion_protocol.sysml`
- `semanticstest.sysml`
- `spacecraft.sysml`

## Final test count

Before: 2143 passed / 7 skipped / 2150 total.
After:  2147 passed / 12 skipped / 2159 total (+4 passed, +5 skipped, +9 new).

Lint: clean on the new file. Build: clean.

## Uncertainty

The `flow from ... to ...` validation behavior looks like a real
sysml-2ls validation bug (or a stale rule from an earlier metamodel) —
flow-connection endpoints are Usages whose `owningType` is the enclosing
flow Usage, which *is* a Usage, so the rule should be satisfied. Did not
investigate or change production code (per "isolate migration axes"); the
5 affected models are skipped with a TODO pointing at the validator.
