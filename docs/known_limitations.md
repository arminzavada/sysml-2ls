# Known Limitations

- Historically a [Heisenbug](https://en.wikipedia.org/wiki/Heisenbug) triggered
  false-positive `A Feature must be typed by at least one type` errors
  (`validateFeatureTyping`), believed to come from document-parse-order-dependent
  resolution against the standard library. The rule itself is not in the spec,
  but the pilot has the same one (`validateFeatureHasType_`). If the false
  positive recurs, open an issue with a reproducer.
- Invocation arguments beyond the invoked type's inputs (`f(1, 2)` for a
  single input) are accepted. The pilot reports
  `validateInvocationExpressionParameterRedefinition`.
- Implied parameter redefinitions use only the general types' owned
  parameters and are skipped when a parameter has an explicit redefinition.
  The pilot also redefines inherited parameters and, outside invocations, adds
  the implied ones regardless, so some of its
  `validateRedefinitionDirectionConformance` errors are missed.
- SysML usages get no default multiplicity. The pilot's provisional 2026-09 rule
  (pending SYSML21-185) gives them `[1..1]`, so we miss its multiplicity
  conformance warnings on subsetting and redefining usages.
- While the parser is LL(*), it may fail to parse some more complex language
  constructs that require lookahead outside the context of a parser rule:
  - Some expressions may fail to parse, i.e. feature reference expressions
  - Namespace (`::` and `*`) and recursive (`::` and `**`) import tokens cannot
    be parsed separated by whitespace
  - `assign` cannot have an expression before the target feature in SysML
    (`assign (p).x := 1;` fails to parse; `assign p.x := 1;` parses)
  - SysML grammar is slightly relaxed for succession and transition usage elements
    so that they can appear anywhere in the body and are not constrained by the
    preceding and following elements
  - A `send` payload starting with `{` (`send {} ;`, `send {1} via r;`) parses,
    whereas the pilot reads `{` after `send` as the action body and fails to
    parse. `validateSendActionPayloadNotBody` rejects it at validation instead.
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
