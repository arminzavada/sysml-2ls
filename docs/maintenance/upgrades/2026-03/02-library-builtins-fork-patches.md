# Chunk 2 sub-deliverable — fork-patch catalogue

> **2026-05-04 revision — patch-moot reclassification needed.** [Prototype P1](prototypes/01-default-value-type-prop.md) discovered that two of the catalogued Cat. B patches (`TradeStudies.sysml` and `Performances.kerml`) are **already moot** — they produce zero diagnostics with or without the patch, despite this catalogue marking them as "fork-only LSP workarounds." The LSP has evolved enough since 2024-12 (the catalogue's baseline) that some patches are no longer load-bearing.
>
> **Implication:** the "16 fork-only LSP workarounds" headline below is **likely an overestimate**. A separate re-classification prototype ([P1a](prototypes/01a-reclassify-patches.md)) un-patches each of the 26 files and runs a diagnostics harness to determine which are actually still needed. Until that pass completes, treat the "fork-only" classifications in this catalogue as **upper bound estimates**, not facts.


> **Per-upgrade artifact.** Catalogues the differences between this repo's bundled stdlib (sourced from `arminzavada/SysML-v2-Release` ≈ tag `2024-12`) and upstream `Systems-Modeling/SysML-v2-Release` at the same `2024-12` tag. Purpose: support the strategic decision among (a) fix the LSP to obviate patches, (b) maintain re-applied `.patch` files, or (c) handle each upgrade by hand.
>
> **Scope:** 26 fork-modified files. No additions or deletions; modifications only.

## Top-line numbers

- 26 files differ between bundled and upstream `2024-12` (out of ~115 library files).
- Total diff volume: ~260 lines (added + removed).
- Largest: `ShapeItems.sysml` (71 lines), `Actions.sysml` (28), `VectorFunctions.kerml` (20).

## Methodology

1. Diff each file `bundled` vs `upstream@2024-12`.
2. Group patches into categories by what the patch is doing.
3. For each category, spot-check upstream `2026-03` to determine whether the underlying issue has been resolved upstream (in which case the fork patch is *moot* at upgrade time and simply gets discarded) or is still a fork-only divergence (in which case it represents real LSP work or per-upgrade burden).

---

## Categories of patches

### A. Manual diamond-redefinition expansion *(most common)*

**Pattern:** explicitly listing inherited paths in `:>>` redefinitions where the upstream omits them.

**Example (`Items.sysml`):**
```
+ ref item :>> items::localClock, subobjects::localClock;
```

**Example (`ShapeItems.sysml`):**
```
- attribute :>> length = rectangleLength;
+ attribute :>> revolvedCurve::length, Rectangle::length = rectangleLength;
```

**Example (`Actions.sysml`):**
```
- ref occurrence :>> this = (that as Action).this { ... }
+ ref occurrence :>> actions::this, subperformances::this = (that as Action).this { ... }
```

**What it's working around:** the LSP's name resolver can't reach the inherited features through implicit paths under multi-specialization (the diamond-collision class of bug). Manual enumeration spells it out for the resolver.

**Affected files:** `Items.sysml`, `Parts.sysml`, `Actions.sysml`, `Objects.kerml`, `Time.sysml`, `ShapeItems.sysml`, `SpatialItems.sysml`, parts of `States.sysml`.

**2026-03 disposition:** **mixed**.
- `Actions.sysml`: upstream `2026-03` now also explicitly enumerates (`:>> Action::this, actions::this, subperformances::this`). Fork patch becomes a near-superset; **moot** after the upgrade replaces with upstream.
- `Items.sysml`, `Parts.sysml`, `Time.sysml`, `Objects.kerml`, `ShapeItems.sysml`: upstream `2026-03` still does **not** include these explicit redefinitions. The fork patches remain **fork-only** and will resurface as LSP errors when bundled is replaced with upstream.

This is the same family of issue that the digest's 2025-09 / 2025-11 "name resolution under multi-specialization" pilot fixes addressed at the resolver level. Pilot-side fix; the spec/library does not require the explicit names.

**Best fixed at:** the LSP scoping layer (Chunk 3 territory). Once scope resolution under multi-specialization works correctly, all of these patches are unnecessary regardless of upstream library text.

---

### B. Type ascription / cast addition

**Pattern:** adding `: Type` annotations or `as Type` casts at points where the upstream relies on type inference.

**Examples:**
```
# TradeStudies.sysml
- in ref :>> alternatives;
+ in ref :>> alternatives: ScalarValue;

# Performances.kerml
- feature redefines dispatchScope default thisPerformance;
+ feature redefines dispatchScope : Performance default thisPerformance;

# StatePerformances.kerml
- allSubtransitionPerformances(runToCompletionScope)->forAll{...}
+ allSubtransitionPerformances(runToCompletionScope as Performance)->forAll{...}

# VectorFunctions.kerml
- :>> dimension = size(components);
+ :>> dimension = size(components) as Positive;

# ShapeItems.sysml
- attribute wallNumber : Positive = size(wall);
+ attribute wallNumber : Positive = size(wall) as Positive;
```

**What it's working around:** the LSP's type inference cannot conclude what the pilot can. Explicit `as` / `:` annotations bypass inference.

**Affected files:** `TradeStudies.sysml`, `Performances.kerml`, `StatePerformances.kerml`, `VectorFunctions.kerml`, `NumericalFunctions.kerml`, `RationalFunctions.kerml`, `SequenceFunctions.kerml`, `ShapeItems.sysml`, `ISQSpaceTime.sysml`, parts of `Quantities.sysml`.

**2026-03 disposition:** upstream `2026-03` does **not** add these ascriptions (spot-checked `Performances.kerml`, `VectorFunctions.kerml`, `ISQSpaceTime.sysml`). Patches remain **fork-only** and will resurface.

**Best fixed at:** the LSP type-inference layer (Chunk 4 territory).

---

### C. Specialization order swap

**Pattern:** swapping the order of types in `:>` specialization lists.

**Example (`Connections.sysml`):**
```
- abstract connection def BinaryConnection :> Connection, BinaryLinkObject {
+ abstract connection def BinaryConnection :> BinaryLinkObject, Connection {
```

**What it's working around:** unclear — possibly the LSP picked a different "first" type for some downstream computation, or the order affected name shadowing.

**Affected files:** `Connections.sysml` (single instance found).

**2026-03 disposition:** **moot.** Upstream `2026-03` now has `:> BinaryLinkObject, Connection`, matching the fork. Patch becomes a no-op.

---

### D. Direction kind and small grammatical fixes

**Pattern:** small substantive corrections that look like the fork was *ahead* of upstream, anticipating a bug fix.

**Example (`States.sysml`):**
```
- out payload[0..*];
+ inout payload[0..*];
```

**Example (`SpatialItems.sysml`):**
```
- item :>> SpatialItem::localClock, subitems::localClock default (that as SpatialItem).localClock;
+ ref item :>> SpatialItem::localClock, subitems::localClock default (that as SpatialItem).localClock;
```

**What it's:** library content corrections that the fork applied early.

**Affected files:** `States.sysml`, parts of `SpatialItems.sysml`.

**2026-03 disposition:** **moot.** Upstream `2026-03` `States.sysml` has `inout payload[0..*]`, matching the fork. Patch becomes a no-op. (`SpatialItems.sysml` has additional changes — see category I.)

---

### E. Indexing-syntax rewrite

**Pattern:** rewriting infix `#` to `->'#'` function-call form, and adding the matching `private import`.

**Example (`VectorFunctions.kerml`):**
```
+ private import CollectionFunctions::'#';

- (1..w.dimension)->collect{in i : Positive; v#(i) + w#(i)}
+ (1..w.dimension)->collect{in i : Positive; v->'#'(i) + w->'#'(i)}
```

**What it's working around:** the LSP's parser or scope resolver cannot find the `#` operator the way the pilot does — the fork rewrites uses to be syntactically explicit, plus brings the operator into local scope via an explicit private import.

**Affected files:** `VectorFunctions.kerml`. (Other files retain `#` use without rewrite — apparently the LSP only fails for some contexts.)

**2026-03 disposition:** upstream `2026-03` still uses bare `v#(i)` (e.g. `cartesianZeroVector#(3);` line 199, `v#(i) + w#(i)` line 218). Patch remains **fork-only**.

**Best fixed at:** the LSP scope-resolution layer or operator-resolution code (Chunk 3 / Chunk 5 territory).

---

### F. Substantive correctness disagreement (return type)

**Pattern:** changing a return type to be mathematically more accurate.

**Example (`RationalFunctions.kerml`):**
```
- function '^' specializes RealFunctions::'^' { in x: Rational[1]; in y: Rational[1]; return : Rational[1]; }
+ function '^' specializes RealFunctions::'^' { in x: Rational[1]; in y: Rational[1]; return : Real[1]; }
```

**Why the fork did this:** non-integer powers of rationals are not always rational (e.g. `2^0.5 = √2 ∉ ℚ`). The fork is mathematically correct.

**2026-03 disposition:** upstream `2026-03` still returns `Rational[1]`. Patch is **fork-only** and **disagrees with the spec**.

**Per the conformance rule:** the fork patch must be **dropped**. We follow upstream/spec even if upstream is mathematically suspect; if it's a real bug, file it against the upstream pilot/spec.

---

### G. Quantity type substitution

**Pattern:** substituting `AngularMeasureUnit` → `AngularMeasureValue` (and similar) on attributes used as values.

**Example (`ISQSpaceTime.sysml`):**
```
- attribute <'φ'> azimuth : AngularMeasureUnit = num#(2) [mRef.mRefs#(2)];
+ attribute <'φ'> azimuth : AngularMeasureValue = num#(2) [mRef.mRefs#(2)];
```

**Why the fork did this:** semantically the attribute holds a measured value, not a unit. The fork looks like a bug fix.

**2026-03 disposition:** upstream `2026-03` still uses `AngularMeasureUnit` (lines 333, 341, 342, 348, 349 of the upstream file). Patch is **fork-only** and **disagrees with the spec**.

**Per the conformance rule:** drop. If correct, file with upstream.

---

### H. Inserted comments + library-text adjustments

**Pattern:** added comments documenting an LSP/spec mismatch, sometimes accompanied by an additional type in a redefines list.

**Example (`Actions.sysml` line ~193):**
```
- ref sentMessage :>> sentTransfer: MessageTransfer, MessageConnection;
+ // Because messageConnections implicitly subsets flowConnections
+ // according to the spec, all messages are implicitly flow connections
+ // as well, making MessageConnection assignment to what should be
+ // message invalid
+ ref sentMessage :>> sentTransfer: MessageTransfer, MessageConnection, FlowConnections::FlowConnection;
```

**What it's working around:** the LSP doesn't realise `MessageConnection` already implicitly subsets `FlowConnection` per the spec, so an explicit listing is needed.

**Affected files:** `Actions.sysml`.

**2026-03 disposition:** upstream `2026-03` `Actions.sysml` has the simpler form (no explicit `FlowConnections::FlowConnection`). Patch remains **fork-only**.

**Best fixed at:** the LSP scoping / specialization-graph layer (Chunk 3).

---

### I. Formatting / refactor

**Pattern:** rewriting a multi-line expression for clarity, or reformatting whitespace.

**Example (`VectorFunctions.kerml`):**
```
- CartesianVectorOf(
-     if w == null? CartesianVectorOf(v.elements->collect{in x : Real; -x})
-     else CartesianVectorOf(
-         (1..v.dimension)->collect{in i : Positive; v#(i) - w#(i)}
-     )
- );
+ if w == null
+     ?    CartesianVectorOf(v.elements->collect { in x : Real; -x })
+     else CartesianVectorOf((1..v.dimension)->collect { in i : Positive; v->'#'(i) - w->'#'(i) });
```

**What it's:** intertwined with category E rewrites; the formatting change carries semantic differences.

**Affected files:** `VectorFunctions.kerml`.

**2026-03 disposition:** upstream `2026-03` retains the original verbose form. Patch is **fork-only**.

---

### J. Receiver hiding inside accept actions

**Pattern:** adding a `private in _ :>> receiver;` block inside an `:>> 'accept'` redefinition body to hide an inherited `receiver`.

**Example (`Actions.sysml` line ~337):**
```
- action accepter : AcceptMessageAction :>> 'accept';
+ :>> 'accept' {
+     //**
+         hide the other inherited receiver:
+         * either it is ambiguous with AcceptMessageAction::receiver
+         * or inheriting receivers redefine its bound value
+       */
+     private in _ :>> receiver;
+ }
+ action accepter : AcceptMessageAction :> 'accept';
```

**What it's working around:** the LSP can't pick the right `receiver` among multiple inherited ones.

**Affected files:** `Actions.sysml`.

**2026-03 disposition:** upstream `2026-03` has the simpler `action accepter : AcceptMessageAction :>> 'accept';` and binds `receiver` separately. Patch remains **fork-only**.

**Best fixed at:** LSP scoping / disambiguation (Chunk 3).

---

## Per-file disposition

> **Updated 2026-05-14 by [P1a](prototypes/01a-reclassify-patches.md).** The
> "LSP-impact" column is the empirical reclassification: each fork patch was
> swapped out for the upstream 2024-12 version and the LSP was re-run over
> the bundled stdlib. **moot** = un-patched upstream produces zero
> diagnostics at HEAD; **load-bearing** = at least one diagnostic fires;
> **contradicts** = Cat. F/G, dropped on principle without behavioral
> testing. The "Upstream-absorbed at `2026-03`" column is the original
> column (does upstream itself ship the fork's edit) and is retained for
> upgrade-burden context.
>
> See [P1a results](prototypes/results/01a-reclassify-patches-result.md)
> for harness details and the single load-bearing case.

| File | Categories | Upstream-absorbed at `2026-03` | **LSP-impact at HEAD** |
|------|-----------|---------------------------------|------------------------|
| `Domain Libraries/Analysis/SampledFunctions.sysml` | B | no | **moot** |
| `Domain Libraries/Analysis/TradeStudies.sysml` | B | no | **moot** |
| `Domain Libraries/Cause and Effect/CauseAndEffect.sysml` | (TBD) | n/a | **moot** |
| `Domain Libraries/Geometry/ShapeItems.sysml` | A, B | no | **moot** |
| `Domain Libraries/Geometry/SpatialItems.sysml` | A, D | partially | **moot** |
| `Domain Libraries/Metadata/RiskMetadata.sysml` | (TBD) | n/a | **moot** |
| `Domain Libraries/Quantities and Units/ISQSpaceTime.sysml` | G | no (and disagrees) | **contradicts** (drop on principle) |
| `Domain Libraries/Quantities and Units/Quantities.sysml` | (TBD) | n/a | **moot** |
| `Domain Libraries/Quantities and Units/Time.sysml` | A | no | **moot** |
| `Kernel Function Library/CollectionFunctions.kerml` | (TBD) | n/a | **moot** |
| `Kernel Function Library/ControlFunctions.kerml` | (TBD) | n/a | **moot** |
| `Kernel Function Library/NumericalFunctions.kerml` | B | no | **moot** |
| `Kernel Function Library/RationalFunctions.kerml` | F | no (and disagrees) | **contradicts** (drop on principle) |
| `Kernel Function Library/SequenceFunctions.kerml` | B | no | **moot** |
| `Kernel Function Library/VectorFunctions.kerml` | B, E, I | no | **moot** |
| `Kernel Semantic Library/Objects.kerml` | A | no | **moot** |
| `Kernel Semantic Library/Occurrences.kerml` | K (new) | partially | **load-bearing** (`checkFeatureCrossingSpecialization` fires at line 572) |
| `Kernel Semantic Library/Performances.kerml` | B | no | **moot** |
| `Kernel Semantic Library/StatePerformances.kerml` | B | no | **moot** |
| `Systems Library/Actions.sysml` | A, H, J | partially | **moot** |
| `Systems Library/Connections.sysml` | C | yes | **moot** |
| `Systems Library/FlowConnections.sysml` | (TBD) | partially (renamed to `Flows.sysml` upstream) | **moot** |
| `Systems Library/Interfaces.sysml` | (TBD) | n/a | **moot** |
| `Systems Library/Items.sysml` | A | no | **moot** |
| `Systems Library/Parts.sysml` | A | no | **moot** |
| `Systems Library/States.sysml` | D | yes | **moot** |

Notes:
- `Occurrences.kerml` introduces a new category not covered by A–J: the
  fork prefixes a participant of a cross-feature declaration with the
  `end` keyword. Call this **Category K — end-keyword on cross-feature
  participants.** Underlying LSP gap:
  `checkFeatureCrossingSpecialization` requires all participants of an
  end-cross declaration to be `end`-prefixed, but the spec/upstream
  expects the inference to flow through `crosses` semantics. This is
  the one resurfacing LSP defect at HEAD; everything else is moot.
- The original "categories" column groups patches by edit shape. The
  empirical LSP-impact column shows that *edit shape* is now a poor
  predictor of load-bearingness: Cat. A (7 files), Cat. B (7 files), and
  Cat. E/H/I/J (4 files) are *all* moot at HEAD.

## Aggregate count

> **Updated 2026-05-14 by P1a.** The original count below was the
> upstream-absorbed/fork-only classification ("will the fork edit silently
> disappear when we re-fetch?"). The new LSP-impact count is "does the LSP
> still need the patch to produce a clean validation?"

**LSP-impact at HEAD** (the new question):

- **Moot** (LSP accepts the un-patched form): **23 files**.
- **Load-bearing** (LSP produces diagnostics without the patch): **1 file** (`Occurrences.kerml`, end-keyword on a cross-feature participant).
- **Contradicts upstream/spec** (dropped on principle): **2 files** (`RationalFunctions.kerml`, `ISQSpaceTime.sysml`).

**Upstream-absorbed at `2026-03`** (the original question, retained for
upgrade-burden context):

- **Yes / fully absorbed**: `Connections.sysml`, `States.sysml` (2 files).
- **Partially absorbed**: `Actions.sysml`, `SpatialItems.sysml`,
  `FlowConnections.sysml`, `Occurrences.kerml` (4 files).
- **Not absorbed**: ~15 files.
- **Disagrees with upstream**: 2 (`RationalFunctions.kerml`,
  `ISQSpaceTime.sysml`).

So the actual upgrade calculus is: **almost every fork patch is
gratuitous at HEAD**, regardless of whether upstream-2026-03 absorbed
the edit. The "fork patches will resurface as LSP errors" prediction
from the original catalogue was wrong — only one does. The LSP fixes
between the catalogue's 2024-12 baseline and HEAD already closed the
gaps that Cat. A/B/E/H/I/J were working around.

---

## Three-option analysis

### (a) Fix the LSP

For the resurfacing patches (~16 files), the underlying LSP gaps cluster into three areas:

| LSP gap | Categories driven by it | Likely chunk |
|---------|------------------------|--------------|
| Name resolution under multi-specialization (diamond) | A, H | Chunk 3 (Scoping) |
| Type inference (sizing, casts, redefinition typing) | B | Chunk 4 (Type system) |
| Operator/symbol resolution (`#`, etc.) | E, J | Chunk 3 / Chunk 5 |

**Effort:** real LSP work, but scoped to known gaps. Some of these (A, H) overlap with the pilot's own 2025-09 / 2025-11 name-resolution fixes — i.e., we have a reference implementation to mirror.

**Pros:**
- Fully aligns with the conformance principle: LSP gaps *are* defects.
- Future upgrades become lower-friction: no patches to re-rebase.
- Other user models (not just stdlib) benefit from the same fixes.

**Cons:**
- Substantial effort, not blocking the upgrade itself but blocking a clean library-rebuild after.
- The upgrade can't be considered "done" until LSP fixes land — or we ship the upgrade with a regression in stdlib parseability.

### (b) Maintain `.patch` files re-applied by the clone script

Modify [`clone-sysml-release.mjs`](../../../packages/syside-languageserver/scripts/clone-sysml-release.mjs) to apply a folder of `.patch` files after fetching upstream. Each upgrade: `git diff` against the previously-patched copy to update patches that don't apply cleanly.

**Pros:**
- Keeps the upgrade unblocked.
- Patches are versioned, reviewable, attributable to a reason in each header.
- Lower upfront work than fixing the LSP.

**Cons:**
- Per-upgrade burden: rebasing patches against new upstream is cognitively expensive (when upstream and patches edit the same lines).
- Hides the underlying LSP defects — they accumulate without visibility.
- New LSP-gap-induced patches accrete over time.
- Categories F and G (which contradict upstream) should *not* be `.patch` material; they should be dropped per the conformance rule.

### (c) Handle by hand each upgrade

Re-apply known fixes manually after each upgrade.

**Pros:**
- Zero infrastructure.

**Cons:**
- Highest per-upgrade effort.
- Knowledge atrophies between upgrades — easy to miss a patch.
- No record of *why* each patch existed.

---

## Recommendation

**Combination of (a) and (b), staged:**

1. **Drop the contradiction patches** (categories F, G) immediately, per the conformance rule. They are bugs in the fork, not workarounds.
2. **Convert the remaining fork-only LSP workarounds to a `patches/` directory under the bundled stdlib**, with one `.patch` file per category and a header explaining the LSP gap each is working around. Have `clone-sysml-release.mjs` apply them after `git checkout`. This unblocks the `2026-03` upgrade.
3. **Treat each patch's existence as a bug ticket against the LSP.** As Chunks 3 / 4 / 5 produce concrete fixes, retire the corresponding patch files.

This is option (b) on the path to option (a) — neither a permanent patches-only solution (which would be drift) nor a wait-for-LSP-fix (which blocks the upgrade), but explicit remediation. Aligned with the conformance principle: the patches' existence is itself a documented defect list.

The "patches `.patch` directory" is materially better than category-(c) hand-handling because:
- The patches *are* the spec of what's wrong with the LSP.
- They serve as regression markers — if a patch starts failing to apply because upstream changed the line, that's a signal to look closer.
- They're discoverable by the next maintainer.

If the catalogue numbers change substantially with the unclassified files, this recommendation may shift. Open the unclassified files only if helpful.

---

## What I have *not* done

- Inspected the 5 unclassified small-diff files (`CauseAndEffect.sysml`, `RiskMetadata.sysml`, `Quantities.sysml`, `CollectionFunctions.kerml`, `ControlFunctions.kerml`, `Occurrences.kerml`, `Interfaces.sysml`). Each is ≤13 lines of diff. Happy to open them on request.
- Verified that the patches actually apply cleanly today against upstream `2024-12` — implicit since they were applied against that commit, but a `git apply --check` pass would be a sanity net.
- Hooked up an actual `patches/` directory or modified the clone script. That's an implementation step, not a catalogue step.
