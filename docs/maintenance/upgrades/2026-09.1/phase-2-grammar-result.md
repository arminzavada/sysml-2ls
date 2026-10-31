# Phase 2 — Grammar result

Grammar items G1–G7, X1, V3 and the V4 retirement from [`plan.md`](plan.md). Uncommitted on `main`.

## Verification

- `pnpm typecheck` (plus `tsc -b --force` in `syside-languageserver`), `pnpm lint`: clean.
- `pnpm test`: 86 files, 2225 passed, 7 expected fail, 7 skipped (baseline 79 / 2163). One test removed (V4), 63 added.
- No snapshot changes.
- `pnpm grammar` regenerates `gen/` (gitignored). The committed TextMate grammars are unchanged, as expected from chunk 1 §K.
- All 313 pilot example models under `sysml/src` and `kerml/src` parse without parser errors. Before this phase, 7 failed: `ActionTest`, `DecisionTest`, `InterfaceTest`, `RequirementTest`, `ViewTest`, `FeatureChains.kerml` and `MetadataTest.kerml`.

## Items

### G1 — visibility on annotating members in `enum def` bodies

- `SysML.langium`: `EnumerationItems` uses `VisibleAnnotatingMember`. The SysML `AnnotatingMember` rule became dead and was removed.
- Tests: `__tests__/sysml/enumerations.test.ts`. One test covers the new forms. One lookahead test checks that `#M a;`, `private #M b;`, `#M metadata m : M;`, `private #M metadata n : M;`, `c;` and `doc` still map to the same membership and element kinds.

### G2 — keyword `frame concern` body is `RequirementBody`

- `SysML.langium` `FramedConcernUsage`: the keyword alternative now ends in `RequirementBody`.
- Tests: `__tests__/sysml/requirements.test.ts`.
  - Accepts `subject`, `assume`/`require`, `frame`, `verify`, `actor` and `stakeholder` members.
  - Rejects a result expression, a `return` parameter, an initial node, a control node, a send node and a guarded succession.
  - Definition-body members still parse.

### G3 — feature conjugation to a feature chain (KerML)

- `KerML.langium` `FeatureConjugation`: `targetRef=FeatureReference | targetChain=OwnedFeatureChain`.
- Tests: `__tests__/kerml/core/conjugations.test.ts`. Covers `conjugates` and `~`, and checks that the chain resolves to `[a, b]` after build.
- Not verified: conjugated-feature semantics (direction flipping) through a chain.

### G4 — anonymous typed KerML metadata feature

- `KerML.langium` `MetadataFeatureDeclaration`: `Identification?`.
- Tests: new `__tests__/kerml/kernel/metadata.test.ts`, covering `@ :`, `metadata :` and `metadata typed by`, next to the existing `@m :` and `@` forms.
- The printer is unchanged: `@ : M` still prints as `@M`, which is the same model.

### G5 — feature value on interface usages

- `SysML.langium` `InterfaceUsageDeclaration`: `UsageDeclaration? ValuePart? ( 'connect' InterfacePart )?`.
- `model/printer/connectors.ts` `printInterfaceUsage`:
  - prints the value, which was previously dropped;
  - forces `connect` when a value is present, because the grammar requires it and `as_needed` would otherwise drop it.
- Tests:
  - `__tests__/sysml/interfaces.test.ts`, including the pilot `InterfaceTest` line;
  - printer tests in `model/printer/__tests__/connectors.test.ts`.
- Deferred to Phase 5: `validateConnectorRelatedFeatures` for a non-abstract `interface i = i1;` (chunk 6 G5).

### G6 — visibility on guarded successions

- `SysML.langium` `GuardedSuccessionMember`: `Visibility? target=GuardedSuccession`.
- Tests: `__tests__/sysml/actions.test.ts`.
  - The pilot `DecisionTest` parses verbatim.
  - One lookahead test checks that the visibility-prefixed initial node, succession, named and anonymous guarded successions, and the unprefixed guarded succession each keep their membership and element kinds.

### G7 — multiplicity on `assume` / `require` / `frame` / `render` shorthands

- `SysML.langium`: `RequirementConstraintUsage`, `FramedConcernUsage` and `ViewRenderingUsage` use `FeatureSpecializationPart?`. `verify` (`RequirementVerificationUsage`) and `VariantReference` keep `FeatureSpecialization*`, as in the pilot.
- Printer:
  - `canPrintShorthandUsage` takes `allowMultiplicity`;
  - `printSpecialRequirementMember` passes `shorthandMultiplicity`, which is true for frame, assume, require and render, and false for verify;
  - `printShorthandUsage` prints the multiplicity part;
  - the now-unused `ignoreMultiplicity` option of `printSpecializationPart` was removed.
- Tests:
  - `__tests__/sysml/requirements.test.ts`, `__tests__/sysml/views.test.ts`: the pilot `RequirementTest` forms, multiplicity properties, and `verify r [1];` still rejected;
  - printer tests in `model/printer/__tests__/edges.test.ts`, including `verify` keeping the keyword form.

### X1 — bodied `send { … }`

- `SysML.langium` `SendNode` now has the pilot shape: `'send' ( ActionBody | ( payload=NodeParameterMember SenderReceiverPart? | SenderReceiverPart ) ActionBody )`. The pilot's `EmptyParameterMember` stays implicit, as before. This also adds `send;`, `send via r;` and `send via r to s;`.
- `model/printer/actions.ts` `printSendAction` now prints payload-less sends. It previously threw "Interrupted payload chain", already for `send to r;`.
- Tests:
  - `__tests__/sysml/actions.test.ts`: the pilot `ActionTest` sends, body-first parsing, and the payload-less forms;
  - printer tests in `model/printer/__tests__/actions.test.ts`.
- **Deviation, stopped:** see below.

### V3 — payload required in state actions and transition effects

- `SysML.langium` `SendNodeDeclaration`: `ActionNodeUsageDeclaration? 'send' payload=NodeParameterMember SenderReceiverPart?`. It is now used only by `StateActionUsage_4` and `EffectBehaviorUsage_4`.
- Tests: `__tests__/sysml/states.test.ts`. Payload-less `entry`, `do` and `exit` sends and transition effects are rejected; payload forms still parse.
- `model/SysML/__tests__/action-derived.test.ts`: the empty-payload test moved from `entry send to p;` to an action body.

### V4 — send/accept parameter checks

- Removed `validateSendActionParameters` and its test.
- `validateAcceptActionUsageParameters` now checks only `payload`, the spec's `notEmpty`, per chunk 6 V4. It still never fires on parsed models.

## Open: X1 residual (accepts more than the pilot)

The pilot always takes the body when `{` or `;` follows `send`. The generated ANTLR decision for `SendNode` confirms this: `;` and `{` predict `ActionBody` unconditionally. So a `SendNode` payload can never start with `{` or `;`.

Our parser uses chevrotain-allstar. Its prediction stops at the end of the rule and keeps the alternative that matches the most tokens. A payload such as `{ … }` or `;` therefore still wins whenever it can complete the rule. Inputs we accept and the pilot rejects:

- `send { } ;`
- `send { 1 } via r;`
- `send { } to r;`
- `send { } { }`

These were accepted before this phase too. The body-first cases the pilot accepts are fixed.

Matching the pilot means the payload expression must not start with a body expression. That needs one of these:

- a guard parameter threaded through about 18 SysML expression rules (Langium requires explicit arguments at every call site);
- a duplicated expression chain;
- a check outside the grammar layer.

All three go beyond a reasonable rule restructuring, so this part stopped per the phase brief. It needs Armin's decision.
