# Known Limitations

- Currently, there is a [Heisenbug](https://en.wikipedia.org/wiki/Heisenbug)
  that appears for some users by triggering a lot of false-positive
  `A Feature must be typed by at least one type` errors.
  - We are not able to consistently reproduce this bug.
  - As far as we know, this might happen due to a seemingly random order of how
    the documents are being parsed, which leads to some SysML standard library
    documents to be parsed earlier or later than they should be, which breaks
    semantic resolution.
  - If any users or developers from the community are experiencing this bug on
    their machines, it would be easiest for them to try to fix it.
  - GitLab issues reporting this bug:
    - [#19](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues/19)
    - [#15](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues/15)
- While the parser is LL(*), it may fail to parse some more complex language
  constructs that require lookahead outside the context of a parser rule:
  - Some expressions may fail to parse, i.e. feature reference expressions
  - Namespace (`::` and `*`) and recursive (`::` and `**`) import tokens cannot
    be parsed separated by whitespace
  - `assign` cannot have feature chains or expressions on the left side in SysML
  - SysML grammar is slightly relaxed for succession and transition usage elements
    so that they can appear anywhere in the body and are not constrained by the
    preceding and following elements
- The 2026-01 validation batch — `validateEndFeatureMembership`,
  `validateParameterMembership`, `validateCollectExpressionOperator`,
  `validateIndexExpressionOperator`, `validateSelectExpressionOperator`,
  `validateFeatureChainExpressionOperator`, `validateFlowEndIsEnd`,
  `validateUsageIsReferential`, `validateReferenceUsageIsReferential`,
  `validateAttributeUsageIsReferential`,
  `validateEnumerationDefinitionIsVariation`,
  `validateEventOccurrenceUsageIsReference`, and `validatePortUsageIsReference`
  — is implemented for spec traceability, but most rules are also enforced
  structurally by the metamodel's getter overrides (e.g. `EnumerationDefinition.isVariation`
  always returns `true`). They therefore fire only on AST states the grammar
  cannot produce — i.e. when nodes are constructed programmatically through
  the API in a way that violates a subclass invariant. The pilot's 2026-01
  release fires the same rules from EMF state; semantically the editor is
  consistent with the pilot, with the only practical difference being that
  our validators would not catch an *incorrectly-implemented metamodel*,
  whereas the pilot's would.
