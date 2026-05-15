# Chunk 1 — Grammar / new keywords (2026-03 upgrade)

> **Per-upgrade artifact.** Cross-reference of grammar-and-keyword items from [`release-notes-digest.md`](release-notes-digest.md) against this repo's Langium grammar.
>
> **Scope:** Only the surface-syntax / keyword changes. Semantic effects (scoping, type system, validation) are deferred to later chunks.
>
> **Method:** Pilot rules are quoted verbatim from `~/work/systems-modeling/SysML-v2-Pilot-Implementation/` checked out at tag `2026-03` (commit `3a1be5b87`). Repo rules are quoted verbatim from `packages/syside-languageserver/src/grammar/`. Spec PDFs not consulted for this chunk — `.xtext` is authoritative for surface syntax.
>
> **Status legend:** `missing` — not present in repo · `partial` — present but doesn't match pilot · `present` — matches · `unclear` — needs more investigation · `consult-Armin` — domain question I shouldn't answer alone.

## Summary

| # | Item | Status |
|---|------|--------|
| 1 | KerML `var` / `const` keywords (replacing `readonly`) | **missing** |
| 2 | SysML `constant` keyword (replacing `readonly`) | **missing** |
| 3 | `new` constructor expression keyword | **missing** |
| 4 | Global-scope `$::` qualifier | **missing** |
| 5 | `derived` keyword position constraint | **partial** |
| 6 | `const` permitted on end features | **missing** |
| 7 | Expanded `send` action notation | **partial** (3 sub-gaps) |
| 8 | `accept` action body redefining `receiver` | **unclear** / consult-Armin |
| 9 | Control nodes (`fork`/`join`/`decide`/`merge`) with full action bodies | **missing** |
| 10 | `nonunique` keyword (2026-02 internal change) | **present** (surface unchanged; behavior tbd in later chunk) |

**Headline:** the 2025-02 grammar additions are fundamentally absent from this repo. The repo's grammar is still on the pre-2025-02 syntax shape (uses `readonly`, no `var`/`const`/`constant`/`new`/`$::`). This is consistent with the digest's claim that 2025-02 is the heaviest single release.

---

## 1. `var` / `const` (KerML), `constant` (SysML), removal of `readonly`

**Pilot 2026-03** — `org.omg.kerml.xtext/src/org/omg/kerml/xtext/KerML.xtext` lines 511–523:

```
fragment EndFeaturePrefix returns SysML::Feature :
    ( isConstant ?= 'const')? isEnd ?= 'end'
;

fragment BasicFeaturePrefix returns SysML::Feature :
    ( direction = FeatureDirection )?
    ( isDerived ?= 'derived' )?
    ( isAbstract ?= 'abstract' )?
    ( isComposite ?= 'composite' | isPortion ?= 'portion' )?
    ( isVariable ?= 'var' | isConstant ?= 'const' )?
;
```

**Pilot 2026-03 (SysML)** — `org.omg.sysml.xtext/src/org/omg/sysml/xtext/SysML.xtext` lines 558–564:

```
fragment RefPrefix returns SysML::Usage :
    ( direction = FeatureDirection )?
    ( isDerived ?= 'derived' )?
    ( isAbstract ?= 'abstract' | isVariation ?= 'variation')?
    ( isConstant ?= 'constant' )?
;
```

**Repo** — `packages/syside-languageserver/src/grammar/KerML.langium` lines 419–423:

```
fragment BasicFeaturePrefix:
    ( direction=FeatureDirectionKind )?
    Abstract? ( isComposite='composite' | isPortion='portion' )?
    Readonly? Derived?
;
```

And `packages/syside-languageserver/src/grammar/KerML.expressions.langium:106`: `isReadOnly='readonly'`.

**Status: missing.** The repo grammar exposes `'readonly'` and an `isReadOnly` AST attribute. There is no `'var'`, `'const'`, `'constant'`, no `isVariable`/`isConstant` attributes. The repo lacks an `EndFeaturePrefix` analogue — it uses an `End` token directly in the prefix rule.

**Implementation impact:** keyword changes on parser; AST interface changes (`KerML.interfaces.langium` and `SysML.interfaces.langium` — currently declare `isReadOnly?: 'readonly'`); downstream attribute references; tests; standard library (the stdlib at the new tag will use `var`/`const`/`constant`).

---

## 2. `new` constructor expression keyword

**Pilot 2026-03** — `org.omg.kerml.expressions.xtext/src/org/omg/kerml/expressions/xtext/KerMLExpressions.xtext:426`:

```
'new' ownedRelationship += InstantiatedTypeMember
```

This is part of an expression alternative; constructor expressions are `new T(args...)`-shaped.

**Repo:** zero matches for `'new'` token in any `.langium` file. No `InstantiatedTypeMember` rule.

**Status: missing.** Affects expression grammar, AST, evaluator. Per the digest, 2025-02 also makes the previous behavior — calling a non-behavior/non-step/non-expression as if it were a constructor — an explicit error. So we both lack the new syntax AND silently allow a now-rejected legacy form. Implementation work: parser, AST node, evaluator, validator (reject old form, accept new).

---

## 3. Global-scope `$::` qualifier

**Pilot 2026-03** — `org.omg.kerml.expressions.xtext/src/org/omg/kerml/expressions/xtext/KerMLExpressions.xtext:545–552`:

```
GlobalQualification :
    '$' '::'
;

Qualification :
    ( Name '::' )+
;

QualifiedName:
    GlobalQualification? Qualification? Name
;
```

**Repo:** no `QualifiedName` rule definition found in any `.langium` file (searched all five). No `GlobalQualification` rule. No `'$'` literal anywhere in the grammars. Qualified-name reference is presumably handled implicitly by Langium's cross-reference machinery — `[Type | QualifiedName]`-style refs use a custom `QualifiedName` *parser rule or hidden token*; I could not locate it from grammar alone.

**Status: missing** for the surface syntax, plus **unclear** for how the repo currently parses qualified names. Need to look into the language services / scoping code (`packages/syside-languageserver/src/services/`) to understand the existing mechanism before proposing how to add `$::`.

**Implementation impact:** parser, AST (probably a flag on the qualified-name reference), and — most critically — scoping / name resolution. The "global scope" semantics specifically bypasses local shadowing, so this isn't just a tokenizer change. Treat as a small grammar change with an outsized scoping component (will recur in Chunk 3).

---

## 5. `derived` keyword position constraint

**Pilot 2026-03** — KerML `BasicFeaturePrefix` (above) and SysML `RefPrefix` (above): `derived` appears immediately after `direction`, before any other modifier.

**Repo** — `KerML.langium:419–423` (above): `derived` is positioned LAST, after `composite|portion` and `readonly`.

**Status: partial.** The keyword exists, but the ordering in the repo's grammar will accept positions that the pilot now rejects (e.g. `composite derived ...` would parse here, fail there). This is a **breaking change** for any existing models that put `derived` in the now-disallowed position.

---

## 6. `const` permitted on end features (2025-11 grammar fix)

**Pilot 2026-03** — `EndFeaturePrefix returns SysML::Feature : ( isConstant ?= 'const')? isEnd ?= 'end'` (KerML.xtext:512–513).

**Repo** — `KerML.langium`: there is no `EndFeaturePrefix` fragment; `End` is used directly without an optional `'const'` prefix. Even ignoring the broader `var`/`const` work in item 1, this specific alternative — `const end ...` — is not parseable here.

**Status: missing.** Trivial syntactically; subsumed by item 1's full implementation.

---

## 7. Expanded `send` action notation

**Pilot 2026-03** — `SysML.xtext:1499–1525`:

```
SendNode returns SysML::SendActionUsage :
    OccurrenceUsagePrefix ActionNodeUsageDeclaration? 'send'
    ( ActionBody
    | ( =>
        ( ownedRelationship += NodeParameterMember SenderReceiverPart?
        | ownedRelationship += EmptyParameterMember SenderReceiverPart
        )
        ActionBody
      )
    )
;

fragment SenderReceiverPart returns SysML::ActionUsage :
    'via' ownedRelationship += NodeParameterMember
      ( 'to' ownedRelationship += NodeParameterMember )?
    | ownedRelationship += EmptyParameterMember
      'to' ownedRelationship += NodeParameterMember
;
```

**Repo** — `SysML.langium:1197–1205`:

```
SendNode returns SendActionUsage:
    OccurrenceUsagePrefix SendNodeDeclaration ActionBody
;

fragment SendNodeDeclaration:
    ActionNodeUsageDeclaration? 'send' payload=NodeParameterMember
    ( 'via' sender=NodeParameterMember  )?
    ( 'to' receiver=NodeParameterMember )?
;
```

**Status: partial.** Three sub-gaps:

- **(7a) Bodied form `send { ... }`** — the pilot's outer `( ActionBody | ... )` allows `'send'` to be followed directly by an action body (no payload/sender/receiver in the leader). The repo requires a `payload=NodeParameterMember`, so `send { ... }` is unparseable.
- **(7b) Empty-payload `send to receiver`** — the pilot's `EmptyParameterMember 'to' …` alternative allows `send to recv` with no payload. The repo's `payload=NodeParameterMember` is mandatory.
- **(7c) Implicit `payload` redefinition (semantic, not grammar)** — the digest says `send via…to…` now also implicitly redefines `payload`. This is a transformation/semantics question, not visible in the grammar, and is therefore **deferred to a later chunk**.

The `via`/`to` ordering in the repo is permissive — `'via' sender? 'to' receiver?` as independent optionals rather than the pilot's structured `SenderReceiverPart`. Worth verifying whether the repo accepts strings the pilot now rejects (e.g., `send p to recv` without `via`, which the pilot's grammar requires `EmptyParameterMember` for and which therefore parses into a different AST shape).

---

## 8. `accept` action body redefining `receiver`

The digest claims 2025-02 added: `accept trig { in receiver = …; }`.

**Pilot 2026-03** — `AcceptParameterPart` is unchanged from what the digest describes:
```
fragment AcceptParameterPart returns SysML::ActionUsage :
    ownedRelationship += PayloadParameterMember
    ( 'via' ownedRelationship += NodeParameterMember )?
;
```

The "redefining receiver in body" is presumably about what's allowed *inside* `{ ... }` of an `accept` node — so it's about the `ActionBody` content after the `AcceptParameterPart`, governed by general feature redefinition rules, not by a dedicated grammar production.

**Repo** — `AcceptParameterPart` matches the pilot structurally (same shape: payload + optional `'via' receiver`).

**Status: unclear / consult-Armin.** I cannot tell from the grammar whether anything actually changed at the *grammar* level for this item. It looks more like a semantic/scoping change that lets existing-grammar bodies redefine `receiver`. Worth your read.

---

## 9. Control nodes with full action bodies (2025-04)

**Pilot 2026-03** — `SysML.xtext:1664–1700` (representative for `ForkNode`):

```
ForkNode returns SysML::ForkNode :
    ControlNodePrefix
    isComposite ?= 'fork' UsageDeclaration?
    ActionBody
;
```

`MergeNode`, `JoinNode`, `DecideNode` follow the same pattern. `ActionBody` here is the **full** action body (allowing `in`/`out` parameters and other action-body content).

**Repo** — `SysML.langium:1351–1361`:

```
ForkNode returns ForkNode:
    ControlNodePrefix 'fork' UsageDeclaration? ActionNodeBody
;

fragment ActionNodeBody:
    ';' | '{' ActionNodeItems '}'
;

fragment ActionNodeItems:
    ( children+=AnnotatingMember )*
;
```

**Status: missing.** The repo restricts the body of a control node to **annotations only**. The pilot allows the full action body — including parameters, the very thing 2025-04 enabled. The repo also lacks the `isComposite ?= 'fork'` flagging present in the pilot (note the pilot binds `isComposite` directly to the `fork` keyword); this is a separate, potentially-coupled difference worth your read.

---

## 10. `nonunique` representation change (2026-02)

**Pilot 2026-03** — `KerML.xtext:590` and `SysML.xtext:382` reference the `'nonunique'` keyword. The 2026-02 change was internal (in-memory rep), described as having no surface-syntax effect.

**Repo** — `KerML.expressions.langium:124–125` parses `nonunique` (with `ordered`, in either order).

**Status: present** for the grammar surface. Whether the *parser actions* / AST attribute behavior differs is a deeper question deferred to Chunk 4 (Type System) or Chunk 6 (Validation), where the actual `isUnique` propagation is checked.

---

## Open questions for you

(Original questions preserved above each resolution for context.)

1. **Item 8 (accept body redefining receiver):** grammar or semantic? My reading: semantic.
2. **Item 3 (`$::` global qualifier):** where is `QualifiedName` actually parsed in this repo?
3. **Item 5 (`derived` ordering):** enforce at grammar or validation layer?
4. **Item 7 (send notation):** want a differential test set?
5. **Items 1/2 (`var`/`const` rollout):** keep `isReadOnly` as a deprecated alias?

## Resolved (2026-05-04)

1. **Confirmed semantic, not grammar.** Item 8 will be re-examined in Chunk 3 (Scoping) or Chunk 4 (Type system) where redefinition mechanics live. Grammar layer requires no change.
2. **Unknown — likely in a scope-computation class.** I'll grep `packages/syside-languageserver/src/services/` (and `model/`) when Chunk 3 (Scoping) starts. Recording as a known investigation thread, not a Chunk 1 blocker.
3. **Grammar layer.** Models with old `derived` positioning will fail to parse. Per the project's conformance-over-compatibility rule (see [`upgrade-checklist.md`](../../upgrade-checklist.md)), this breakage is acceptable.
4. **No.** The aim is to match the pilot, not to enumerate divergences. Implementation work will follow the pilot's grammar shape directly.
5. **No alias — hard cutover.** `isReadOnly` is removed from the AST when `var`/`const`/`constant` land. Downstream consumers (including Semantifyr) adapt to the new shape.

### Project-level rule that applies

`sysml-2ls` is correct only insofar as it matches the spec/pilot. Any deviation — even a "permissive" one — is a defect. We do not preserve previously-accepted syntax for backward compatibility. Recorded as a guiding principle in [`upgrade-checklist.md` § Guiding principle](../../upgrade-checklist.md#guiding-principle-conformance-over-compatibility).

## Items not yet checked (should I before moving to Chunk 2?)

- Item 4 — verifying I correctly identified the pilot's `nonunique` line context (line 590 might be part of a larger declaration prefix I haven't read).
- Whether **terminals** changed (the repo and pilot likely share `Name`/`UnrestrictedName`/`STRING_VALUE` shape; I haven't diffed terminals).
- Whether **comments / hidden tokens** changed.

These are minor; flagging for completeness.
