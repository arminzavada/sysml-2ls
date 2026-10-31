# Chunk 1 — Grammar / keywords (2026-09.1 upgrade)

> **Per-upgrade artifact.** Every surface-syntax change in the pilot `.xtext` grammars between `2026-03` (commit `3a1be5b87`) and `2026-09.1` (commit `d81b2ad50`), cross-referenced against `packages/syside-languageserver/src/grammar/`.
>
> **Method:** `git diff 2026-03..2026-09.1 -- '*.xtext'` on the pilot, plus `git log` over the same range to attribute each hunk to an issue and tag. Pilot rules are quoted from the pilot at tag `2026-09.1`; repo rules from the current `main`. Probes ran on the built CLI:
>
> - KerML: `node packages/syside-cli/dist/cli.cjs dump -v -l none <file>`. No stdlib is loaded, so "must be typed by at least one type" and "Could not find implicit …" noise is filtered out of the results below.
> - SysML: `node packages/syside-cli/dist/cli.cjs compile <file> SysML-v2-Release/sysml.library`. This loads the repo's pinned (2026-03) stdlib and prints diagnostics before mapping. `exit=0` means no errors.
>
> **Tags:** `understood` / `structurally-clear` / `needs-deeper-trace` / `consult-Armin`. **Gap** is the direction of our current deviation from the pilot at `2026-09.1`.

## Summary

| # | Tag | Rule (pilot) | Our rule | Gap | Confidence |
|---|-----|--------------|----------|-----|------------|
| G1 | 2026-05 | SysML `AnnotatingMember` + `MemberPrefix` (SYSML21-319) | `SysML.langium` `EnumerationItems` → `AnnotatingMember` | we reject what the pilot accepts | `understood` |
| G2 | 2026-05 | SysML `FramedConcernUsage` keyword form: `CalculationBody` → `RequirementBody` (SYSML21-366) | `SysML.langium` `FramedConcernUsage` | **both directions** | `understood` |
| G3 | 2026-07 | KerML `FeatureConjugation` + `OwnedFeatureChain` (ST6RI-935) | `KerML.langium` `FeatureConjugation` | we reject what the pilot accepts | `structurally-clear` |
| G4 | 2026-07 | KerML `MetadataFeatureDeclaration`: `Identification?` (ST6RI-935) | `KerML.langium` `MetadataFeatureDeclaration` | we reject what the pilot accepts | `understood` |
| G5 | 2026-07 | SysML `InterfaceUsageDeclaration` + `ValuePart?` (ST6RI-935) | `SysML.langium` `InterfaceUsageDeclaration` | we reject what the pilot accepts | `understood` |
| G6 | 2026-07 | SysML `GuardedSuccessionMember` + `MemberPrefix` (ST6RI-935) | `SysML.langium` `GuardedSuccessionMember` | we reject what the pilot accepts | `structurally-clear` |
| G7 | 2026-07 | SysML `RequirementConstraintUsage`, `FramedConcernUsage`, `ViewRenderingUsage` ref-subsetting forms: `FeatureSpecialization*` → `FeatureSpecializationPart?` (ST6RI-935) | same three rules in `SysML.langium` | we reject what the pilot accepts | `understood` |
| K | — | Keyword set, terminals, hidden tokens | — | aligned (unchanged) | `understood` |
| X1 | out of range | Bodied `send { … }` (2025-02) | `SysML.langium` `SendNodeDeclaration` | **both directions** (pre-existing) | `needs-deeper-trace` |

**Headline:** all grammar changes in range are listed above; the digest's list was complete. There are 9 rule edits in 8 productions, 2 in 2026-05 and 7 in 2026-07; 2026-04, -08, -09 and -09.1 touch the `.xtext` files only in license headers. All are grammar-layer in the pilot, so we must enforce them in the grammar too. All but G2 are pure widenings. G2 also narrows, because the keyword `frame concern` body loses the calculation-only items. No AST interface changes: every property the new alternatives assign already exists in `KerML.interfaces.langium` / `SysML.interfaces.langium`. The target stdlib uses none of the new forms, so the grammar port does not gate the stdlib swap.

**Port size:** about 9 one-line `.langium` edits, a regenerate, two small printer changes (G5, G7), and parser/printer tests. Estimate under a day. Risk sits in Langium lookahead for G1 and G6.

---

## G1. Visibility on annotating members in `enum def` bodies (2026-05, SYSML21-319)

**Pilot `2026-09.1`:**

```
AnnotatingMember returns SysML::OwningMembership :
	MemberPrefix ownedRelatedElement += AnnotatingElement
;

fragment EnumerationBody returns SysML::EnumerationDefinition :
	  ';'
	| '{' ( ownedRelationship += AnnotatingMember
		  | => ownedRelationship += EnumerationUsageMember
		  )*
	  '}'
;
```

SysML `AnnotatingMember` is referenced only by `EnumerationBody`. Elsewhere, annotating elements come in through `DefinitionMember`, which already has `MemberPrefix`.

**Ours:** `SysML.langium` `AnnotatingMember: target=AnnotatingElement` has no visibility. Its only use is `EnumerationItems`. All other body rules use `VisibleAnnotatingMember: Visibility? target=AnnotatingElement`.

**Probes:**

```sysml
package P {
    enum def E {
        private doc /* hidden doc */
        public comment /* c */
        enum a;
        b;
    }
}
```

The current result is a parse error at `doc` and `comment` ("Expecting … but found 'doc'"). The pilot accepts it.

```sysml
package P {
    metadata def M;
    enum def E {
        private @M;
        protected metadata m : M;
        enum a;
    }
}
```

The current result is a parse error at `@` and `metadata`. Without visibility (`doc /* doc */` inside an enum def), `exit=0`.

**Gap:** we reject what the pilot accepts. **Layer:** grammar.

**Port:** make `EnumerationItems` use `VisibleAnnotatingMember`; SysML `AnnotatingMember` then becomes dead and can be deleted. Alternatively, add `Visibility?` to `AnnotatingMember` and dedupe the two rules. **Lookahead risk:** both alternatives would then open with `Visibility?`, and both an `AnnotatingElement` (via `MetadataUsage`) and an `EnumeratedValue` can start with `#M` prefix metadata. The pilot needs a `=>` predicate here. Langium's ALL(*) should cope, but this needs a parse test, not an assumption. **AST:** none, since `Relationship.visibility` already exists. **Printer:** `printWithVisibility` is generic.

## G2. Keyword `frame concern` body: `CalculationBody` → `RequirementBody` (2026-05, SYSML21-366)

**Pilot `2026-09.1`:**

```
FramedConcernUsage returns SysML::ConcernUsage :
      ownedRelationship += OwnedReferenceSubsetting FeatureSpecializationPart?
      RequirementBody
    | ( UsageExtensionKeyword* ConcernUsageKeyword | UsageExtensionKeyword+ )
      ConstraintUsageDeclaration RequirementBody
;
```

The 2026-03 pilot rule had `CalculationBody` on the second alternative (the `FeatureSpecializationPart?` on the first is G7).

**Ours:** `SysML.langium` `FramedConcernUsage` still has `ConstraintUsageDeclaration CalculationBody` on the keyword alternative. Our standalone `ConcernUsage` and the shorthand `frame c { … }` already use `RequirementBody`, so this change only brings the keyword form in line.

**What moves:**

- **Now accepted by the pilot, rejected by us:** `subject`, `assume`/`require`, `frame`, `verify`, `actor` and `stakeholder` members inside `frame concern c { … }`.
- **Now rejected by the pilot, accepted by us:**
  - a trailing result expression;
  - a `return` parameter;
  - action-body-only members: `first x;` initial nodes, action nodes (`send`/`accept`/assign/`if`/`while`/`for`/`terminate`/`fork`/`join`/`merge`/`decide`), and target and guarded successions.

  Plain usages, `succession`s, `bind`s, imports and aliases remain legal through `DefinitionBodyItem`.

**Probes:**

```sysml
package P {
    part def S;
    requirement def R {
        subject s : S;
        frame concern c {
            subject s2 : S;
            require constraint { true }
        }
    }
}
```

Current: parse error "Expecting token of type '}' but found `subject`". The pilot accepts.

```sysml
package P {
    requirement def R {
        frame concern c {
            true
        }
    }
}
```

Current: `exit=0`. The pilot rejects it at the grammar layer. The same holds for `frame concern c { return r : ScalarValues::Boolean; }`, which gives `exit=0` today.

```sysml
package P {
    requirement def R {
        frame concern c {
            action a;
            first a;
            fork f;
        }
    }
}
```

Current: parses. The only error is the validator's "The owningType of a ControlNode must be an ActionDefinition or ActionUsage" on `fork f;`. The pilot rejects `first a;` and `fork f;` at the grammar layer.

**Gap:** both directions. **Layer:** grammar. We must reject at parse time, not in a validator. **Port:** one token. **AST:** `ConcernUsage` keeps its inherited `result?` slot, which simply stops being populated for framed concerns. No interface change. **Repo fixtures:** no test model, Semantifyr model or stdlib file uses a keyword `frame concern` with a calculation-only body, so nothing in-repo breaks.

## G3. Feature conjugation to a feature chain (2026-07, ST6RI-935)

**Pilot `2026-09.1`** (`KerML.xtext`):

```
fragment FeatureConjugationPart returns SysML::Feature :
	( '~' | 'conjugates' ) ownedRelationship += FeatureConjugation
;

FeatureConjugation returns SysML::Conjugation :
	  originalType = [SysML::Feature | QualifiedName ]
	| ownedRelatedElement += OwnedFeatureChain
;
```

**Ours:** `KerML.langium` `FeatureConjugation returns Conjugation: targetRef=FeatureReference`.

**Probes:**

```kerml
package P {
    feature a { feature b; }
    feature x conjugates a.b;
}
```

The current result is a parse error at `.`. The `~ a.b` spelling gives the same error. `feature x conjugates a;` parses.

**Gap:** we reject what the pilot accepts. KerML-only, since SysML's `FeatureDeclaration` has no conjugation part. **Layer:** grammar.

**Port:** `targetRef=FeatureReference | targetChain=OwnedFeatureChain`, the same shape as our `OwnedRedefinition` and `OwnedSubsetting`.

**Downstream (why `structurally-clear`, not `understood`):**

- `Relationship.targetChain` already exists in `KerML.interfaces.langium`.
- The generic `Relationship` handler in `utils/ast-to-model.ts` already maps `targetChain` to the edge element.
- `services/references/scope-provider.ts` already includes `Conjugation` among the owners that get chain scoping.
- `TypeMeta` conjugation logic (`model/KerML/type.ts`) reads `conjugator.element()`, so a chain feature should flow through.
- On the pilot side, `ConjugationParserPostProcessor` takes `originalType` from the last owned related element. It predates this range because standalone `conjugation … conjugates a.b` already allowed chains.

Not yet verified by a post-change probe that the conjugated type resolves through the chain.

## G4. Anonymous KerML metadata feature with explicit typing (2026-07, ST6RI-935)

**Pilot `2026-09.1`** (`KerML.xtext`):

```
fragment MetadataFeatureDeclaration returns SysML::MetadataFeature :
	( Identification? ( ':' | 'typed' 'by' ) )? ownedRelationship += MetadataTyping
;
```

**Ours:** `KerML.langium` `MetadataFeatureDeclaration: ( Identification TypedByToken )? heritage+=MetadataTyping`.

**Probes:**

```kerml
package P {
    metaclass M;
    feature y {
        @ : M;
    }
}
```

The current result is a parse error at `:`. `metadata : M;` gives the same error, and `metadata typed by M;` fails at `typed`. `@m : M;` and `metadata M;` parse.

SysML is already aligned: `MetadataUsageDeclaration: ( Identification? DefinedByToken )? …`. A probe with `@ : M; metadata : M; metadata defined by M;` inside a part gives `exit=0`.

**Gap:** we reject what the pilot accepts. **Layer:** grammar. **Port:** add one `?`. **AST:** none. **Printer:** `printMetadataFeature` prints `:` only when there is an identifier, so `@ : M` reformats to `@M`. That is the same model, and SysML already behaves this way.

## G5. Feature value on interface usages (2026-07, ST6RI-935)

**Pilot `2026-09.1`:**

```
fragment InterfaceUsageDeclaration returns SysML::InterfaceUsage :
	  UsageDeclaration? ValuePart? ( ConnectorKeyword InterfacePart )?
	| InterfacePart
;
```

The `InterfaceUsage` rule itself was only re-wrapped across two lines.

**Ours:** `SysML.langium` `InterfaceUsageDeclaration: UsageDeclaration? ( 'connect' InterfacePart )? | InterfacePart`. Our `ConnectionUsage` already has `UsageDeclaration? ValuePart? ( 'connect' ConnectorPart )?`.

**Probes:**

```sysml
package InterfaceTest {
    port def P1;
    port def P2;
    interface def I1 {
        end port p1 : P1;
        end port p2 : P2;
    }
    part def A {
        part x { port p1 : P1; }
        part y { port p2 : P2; }
        interface i1 : I1 connect x.p1 to y.p2;
        abstract interface i = i1;
    }
}
```

The current result is a parse error at `=`. This is the pilot's own `InterfaceTest` (XPECT `noErrors`). `interface i2 : I1 := i1 connect x.p1 to y.p2;` fails at `:=` and `connect`. The connection analogues `connection c2 = c1;` and `abstract connection c2 = c1;` both give `exit=0`.

**Gap:** we reject what the pilot accepts. **Layer:** grammar. **Port:** add `ValuePart?`. **AST:** none, since `Feature.value` exists. **Printer:** `printInterfaceUsage` (`model/printer/connectors.ts`) passes no `suffix`, unlike `printConnectionUsage`. It needs `suffix: node.value ? featureValueAppender(node, context) : undefined`, or the value is silently dropped on format.

**Validation interplay (chunk 6):** the pilot's `validateConnectorRelatedFeatures` errors on a non-abstract connector with fewer than two related features. Ours (`kerml-validator.ts`, "must have at least 2 related elements") checks `allEnds()`. With the stdlib loaded, our non-abstract `connection c2 = c1;` passes. Whether the pilot flags a non-abstract `interface i = i1;` was not traced; its test uses `abstract`. `needs-deeper-trace`.

## G6. Visibility on guarded successions (2026-07, ST6RI-935)

**Pilot `2026-09.1`:**

```
GuardedSuccessionMember returns SysML::FeatureMembership :
	MemberPrefix ownedRelatedElement += GuardedSuccession
;
```

This is used only in `ActionBodyItem`.

**Ours:** `SysML.langium` `GuardedSuccessionMember: target=GuardedSuccession`. It is used only in `ActionBodyItem`, which is already relaxed versus the pilot (see `docs/known_limitations.md`).

**Probes:**

```sysml
action def DecisionTest {
    attribute x : ScalarValues::Integer;
    action A1;
    action A2;
    action A3;

    public succession S first A1
        if x == 0 then A2;

    private first A3;
        if x > 0 then A1;
}
```

The current result is "Expecting token of type 'then' but found `if`" at line 8. The parser commits to a `SuccessionAsUsage` once it sees `public`. The anonymous form `protected first A1 if x == 0 then A2;` also fails. The same model without the two visibility keywords gives `exit=0`.

`private first A3;` in the pilot's updated `DecisionTest` is an `InitialNodeMember`. We already accept that; only the `public succession …` line exercises the change.

**Gap:** we reject what the pilot accepts. **Layer:** grammar. **Port:** `Visibility? target=GuardedSuccession`. **Lookahead risk:** after the change, four `ActionBodyItem` alternatives start with `Visibility?` and diverge only several tokens later:

- `InitialNodeMember` (`first X;`);
- `TargetSuccessionMember`;
- `GuardedSuccessionMember` (`first X if … then`);
- `SuccessionAsUsage` via `NonOccurrenceUsageMember` (`succession S first X then Y;`).

This works today without the shared prefix. It needs a parse test after the change. **AST/printer:** none; visibility printing is generic.

## G7. Multiplicity on `assume`/`require`/`frame`/`render` shorthand (2026-07, ST6RI-935)

**Pilot `2026-09.1`:** in all three productions, the reference-subsetting alternative went from `FeatureSpecialization*` to `FeatureSpecializationPart?`:

```
RequirementConstraintUsage returns SysML::ConstraintUsage :
      ownedRelationship += OwnedReferenceSubsetting FeatureSpecializationPart?
      CalculationBody
    | …

FramedConcernUsage returns SysML::ConcernUsage :
      ownedRelationship += OwnedReferenceSubsetting FeatureSpecializationPart?
      RequirementBody
    | …

ViewRenderingUsage returns SysML::RenderingUsage :
	  ownedRelationship += OwnedReferenceSubsetting FeatureSpecializationPart? UsageBody
	| …
```

`FeatureSpecializationPart` admits a `MultiplicityPart`, meaning `[m..n]` and/or `ordered`/`nonunique`, before or between the specializations.

**Ours:** `SysML.langium` has `heritage+=OwnedReferenceSubsetting FeatureSpecialization*` in `RequirementConstraintUsage`, `FramedConcernUsage` and `ViewRenderingUsage`. Our `FeatureSpecializationPart` is equivalent to the pilot's, and `PerformActionUsageDeclaration` already uses exactly `OwnedReferenceSubsetting FeatureSpecializationPart?`, so the pattern is proven in our grammar.

**Probes:**

```sysml
package RequirementTest {
    constraint c1;
    constraint c2;
    concern c3;
    requirement def R2 {
        assume c1 [0..*];
        require c2 [0..*];
        frame c3[0..*];
    }
}
```

The current result is a parse error at each `[`. This is the pilot's `RequirementTest` addition.

```sysml
package ViewTest {
    rendering r;
    view def V;
    view v : V {
        render r [0..*];
    }
}
```

The current result is a parse error at `[`. `require c2 ordered;` fails at `ordered`, and `frame c3 :> c3 [1] nonunique { }` fails at `[`. The same members without multiplicity give `exit=0`.

**Gap:** we reject what the pilot accepts. **Layer:** grammar. **Port:** 3 edits. **AST:** none, since `multiplicity`, `isOrdered` and `isNonunique` already exist on `Feature`/`Type`.

**Printer:** `canPrintShorthandUsage` (`model/printer/definition-usages.ts`) refuses the shorthand when `multiplicity`, `isOrderedExplicitly` or `isNonUnique` is set. `printSpecialRequirementMember` then falls back to the keyword form, and `printShorthandUsage` passes `ignoreMultiplicity: true`. Both must be relaxed for these three call sites, or `require c2 [0..*];` reformats to a different spelling. `perform` has the same pre-existing limitation; it is out of range.

**Semantics (chunk 4):** multiplicity on these referential usages feeds the subsetting/redefinition multiplicity-conformance checks and interacts with the 2026-09 default-multiplicity rule.

## K. Keywords, terminals, hidden tokens

The keyword set is unchanged. Two diffs confirm it:

- the sorted set of quoted literals in `KerMLExpressions.xtext`, `KerML.xtext` and `SysML.xtext` at both tags;
- the token names in the generated `InternalKerML.tokens` / `InternalSysML.tokens` (ignoring numbering) at both tags.

There are no terminal or hidden-token hunks. `KerMLExpressions.xtext` and `Owl.xtext` differ only in license headers. No TextMate / semantic-token / completion keyword updates are needed.

## Not grammar (layer notes for later chunks)

- **`SendActionUsage::payloadArgument` lower bound 1→0 (2026-05).** This is ecore only. The grammar has admitted payload-less sends (`send to r;`, `send { … }`) since 2025-02. Our AST already has `payload?: ParameterMembership`. `SendActionUsageMeta.payload` falls back to a default empty parameter and is never `undefined`. The repo has no `payloadArgument` derivation. Consumers handle absence: the printer goes through `printNodeParameter`, and `SemantifyrActionMapper` throws deliberately on a missing item payload. **No AST ripple.** `validateSendActionParameters` belongs to chunk 6. `understood`.
- **`validateRedefinitionEndConformance` narrowed (KERML11-68, 2026-07).** This lives in `KerMLValidator.xtend` and is validator-layer. Chunk 6.
- **Parse post-processing moved to `org.omg.{kerml,sysml}.xtext/.../postprocessing` (2026-08).** These are parse-time semantics (composite defaults, default multiplicity, variation→abstract), not productions. Chunk 4.

## X1. Incidental, out of range: bodied `send { … }` does not parse as a body

This is from the 2025-02 send rework (2026-03 cycle, item 7a), not this range. It surfaced while probing payload optionality.

**Pilot:** `'send' ( ActionBody | ( => ( NodeParameterMember SenderReceiverPart? | EmptyParameterMember SenderReceiverPart ) ActionBody ) )`. The pilot's own `ActionTest` example uses `action snd send { in :>> payload = s; }`.

**Ours:** `SendNodeDeclaration: ActionNodeUsageDeclaration? 'send' ( payload=NodeParameterMember SenderReceiverPart? | 'to' receiver=NodeParameterMember )?`, followed by `ActionBody`. A leading `{` is consumed by `payload=NodeParameterMember` as a KerML body expression.

**Probes:**

```sysml
package P {
    action def A {
        send { doc /* x */ }
    }
}
```

The current result is a parse error at the closing `}` of the action def. The pilot-style `action snd send { in payload = …; in receiver = x; }` fails the same way.

```sysml
package P {
    action def A {
        send { };
    }
}
```

This currently parses as a `SendActionUsage` whose payload `FeatureValue` holds an empty body `Expression`.

**Gap:** both directions, pre-existing. The `phase-2a-2025-02-grammar-result.md` claim that `send { … }` is supported does not hold. `needs-deeper-trace`: the pilot's ANTLR decision for `send {` was not run empirically, though the first-alternative ordering and the pilot's example models indicate body-first.

## Open questions

1. **X1 scope** (`consult-Armin`): fix the bodied-`send` parse in this cycle's grammar phase, or track it separately? It is pre-existing and outside 2026-03→2026-09.1, but it is a conformance defect in the same rule family.
2. **G1/G6 lookahead** (`structurally-clear`): both add a shared `Visibility?` prefix in front of alternatives that diverge late. The plan should put a parse test for each (the probes above, plus their no-visibility counterparts) before or alongside the edit, rather than assume ALL(*) resolves them.
3. **G5 validator interplay** (`needs-deeper-trace`, chunk 6): does the pilot error on a non-abstract `interface i = i1;` (connector related features)? Our check differs in shape (`allEnds()` vs `relatedFeature`).
