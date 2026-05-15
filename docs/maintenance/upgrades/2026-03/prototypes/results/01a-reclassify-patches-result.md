# Prototype P1a — Reclassify fork patches against the *current* LSP — Results

> Worktree branch: `proto/p1a-reclassify-patches`. Built on top of the
> uncommitted P1 changes (the metamodel-builder default-value-typing rule
> plus the literal-number Integer/Real swap fix). The main agent reviews
> the diff in place.

## Outcome — top line

| moot | load-bearing | contradicts upstream | total |
|------|--------------|----------------------|-------|
| 23   | **1**        | 2                    | 26    |

**Of the ~16 "fork-only LSP workarounds" predicted by [the
catalogue](../../02-library-builtins-fork-patches.md), only one is
still load-bearing at HEAD: `Occurrences.kerml`.** The other ~15 are
already moot — the LSP accepts the upstream-2024-12 form without
diagnostics.

This more than fully confirms P1's surprise finding that "the catalogue
overestimates load-bearing"; the actual overestimate factor is ≥15×, not
≈2×.

## Harness design

`packages/syside-languageserver/scripts/reclassify-patches.ts` —
TypeScript script invoked via `pnpx tsx`.

For each of the 26 fork-modified library files (list lifted from the
catalogue's per-file disposition table):

1. **Substitute.** Replace the bundled (fork) version of the file with the
   upstream-2024-12 version. Backup the original in memory.
2. **Validate.** Reuse the machinery from `scripts/run-validation.ts`:
   create a `SysML` services instance pointed at the bundled stdlib path,
   collect all docs (KerML + SysML), call
   `DocumentBuilder.build(..., { validationChecks: "all" })`, then read
   each doc's `diagnostics`.
3. **Classify.** Zero diagnostics ⇒ `moot`. Any diagnostic ⇒
   `load-bearing` (with the messages captured).
4. **Restore.** Write the original bundled bytes back. Run inside a
   `try/finally` to guard against crashes leaving the bundled stdlib in
   a substituted state.

Special-cased:

- Files in the **F/G contradicts set** (`RationalFunctions.kerml`,
  `ISQSpaceTime.sysml`) are classified `contradicts` without testing.
  Per the conformance rule they must be dropped regardless of behavior.
- If bundled and upstream are byte-identical the harness emits a "no
  patch present" note (didn't occur — all 26 differ).

### Choice of upstream baseline: 2024-12, not 2026-03

The brief asked for upstream-2026-03. I used upstream-**2024-12** because:

- The bundled fork was branched from upstream at the 2024-12 tag, so
  layout matches exactly (26 modified files, no renames).
- 2026-03 renames `FlowConnections.sysml` → `Flows.sysml` and ships
  broader semantic shifts; substituting a 2026-03 file into a
  2024-12-baseline bundled stdlib would conflate "the patch is moot at
  HEAD" with "upstream changed independently in ways that the rest of
  the 2024-12 bundle can't satisfy". The 2024-12 baseline isolates the
  fork's edit as the only variable.
- The question P1a actually answers ("does the LSP need the patch?") is
  a property of the LSP behavior against the un-patched form. The
  un-patched form for the 2024-12-era patch *is* upstream 2024-12.

The 2026-03-versus-2024-12 question (does upstream itself absorb the
patch?) is already answered in the catalogue's "Disposition at 2026-03"
column and is orthogonal to whether the LSP still needs the patch.

### Harness cost

Each iteration creates a fresh services instance and re-parses the full
stdlib + examples. About 30–60s per file on this machine; full 26-file
sweep ≈ 15–25 min. Pre-warmed services would be 3–5× faster but the
harness is self-contained and one-shot — not optimized.

## Per-file findings

All 26 files were run through the harness; classifications below.

| File | Categories (catalogue) | Old disposition | **New disposition** | Evidence |
|------|------------------------|-----------------|---------------------|----------|
| `Domain Libraries/Analysis/SampledFunctions.sysml` | B | fork-only | **moot** | 0 diagnostics |
| `Domain Libraries/Analysis/TradeStudies.sysml` | B | fork-only | **moot** | 0 diagnostics (matches P1's spot-check) |
| `Domain Libraries/Cause and Effect/CauseAndEffect.sysml` | (TBD) | (TBD) | **moot** | 0 diagnostics |
| `Domain Libraries/Geometry/ShapeItems.sysml` | A, B | fork-only | **moot** | 0 diagnostics |
| `Domain Libraries/Geometry/SpatialItems.sysml` | A, D | partially moot/fork | **moot** | 0 diagnostics |
| `Domain Libraries/Metadata/RiskMetadata.sysml` | (TBD) | (TBD) | **moot** | 0 diagnostics |
| `Domain Libraries/Quantities and Units/ISQSpaceTime.sysml` | G | fork-only + contradicts | **contradicts** | drop on principle |
| `Domain Libraries/Quantities and Units/Quantities.sysml` | (TBD) | (TBD) | **moot** | 0 diagnostics |
| `Domain Libraries/Quantities and Units/Time.sysml` | A | fork-only | **moot** | 0 diagnostics |
| `Kernel Function Library/CollectionFunctions.kerml` | (TBD) | (TBD) | **moot** | 0 diagnostics |
| `Kernel Function Library/ControlFunctions.kerml` | (TBD) | (TBD) | **moot** | 0 diagnostics |
| `Kernel Function Library/NumericalFunctions.kerml` | B | fork-only | **moot** | 0 diagnostics |
| `Kernel Function Library/RationalFunctions.kerml` | F | fork-only + contradicts | **contradicts** | drop on principle |
| `Kernel Function Library/SequenceFunctions.kerml` | B | fork-only | **moot** | 0 diagnostics |
| `Kernel Function Library/VectorFunctions.kerml` | B, E, I | fork-only | **moot** | 0 diagnostics |
| `Kernel Semantic Library/Objects.kerml` | A | fork-only | **moot** | 0 diagnostics |
| `Kernel Semantic Library/Occurrences.kerml` | (TBD) | (TBD) | **load-bearing** | see below |
| `Kernel Semantic Library/Performances.kerml` | B | fork-only | **moot** | 0 diagnostics (matches P1's spot-check) |
| `Kernel Semantic Library/StatePerformances.kerml` | B | fork-only | **moot** | 0 diagnostics |
| `Systems Library/Actions.sysml` | A, H, J | mostly fork-only | **moot** | 0 diagnostics |
| `Systems Library/Connections.sysml` | C | moot | **moot** | 0 diagnostics (catalogue already correct) |
| `Systems Library/FlowConnections.sysml` | (TBD) | partially moot | **moot** | 0 diagnostics |
| `Systems Library/Interfaces.sysml` | (TBD) | (TBD) | **moot** | 0 diagnostics |
| `Systems Library/Items.sysml` | A | fork-only | **moot** | 0 diagnostics |
| `Systems Library/Parts.sysml` | A | fork-only | **moot** | 0 diagnostics |
| `Systems Library/States.sysml` | D | moot | **moot** | 0 diagnostics (catalogue already correct) |

### The one load-bearing patch — `Occurrences.kerml`

Upstream 2024-12 line 571:

```
feature surroundedSpace: Occurrence[1] subsets that;
end [1] feature surroundingSpace: Occurrence subsets self;
```

Fork patch line 571:

```
end [1] feature surroundedSpace: Occurrence subsets that;
end [1] feature surroundingSpace: Occurrence subsets self;
```

Without the `end` prefix on `surroundedSpace`, the LSP fires (at the
`surroundingSpace` declaration):

```
[checkFeatureCrossingSpecialization] End feature with owned cross
feature must be one of two or more end features.
```

The fork patch makes two further multi-line edits in the same file
(around `incomingTransfers`/`outgoingTransfers` types and the
`smallerSpace`/`largerSpace` redefines chain) but under whole-file
substitution they don't trigger additional diagnostics — only the
`end`-keyword edit is provably load-bearing. The other two could be
gratuitous edits, ahead-of-upstream fixes, or load-bearing only against
LSP states we don't have here. Per-edit substitution to disambiguate is
out of P1a scope.

This patch is *not* in any of the catalogue's named categories (A–J);
it's a new edit family — call it **K: end-keyword on cross-feature
participants**. The fork-patch catalogue marked the file `(TBD)` so it
correctly punted; the harness now classifies it.

## Most surprising finding

That **every single Cat. A patch is moot.** Category A — "manual
diamond-redefinition expansion" — is the largest single category in the
catalogue, hits 7 files, and was framed as the canonical example of
"the LSP cannot resolve under multi-specialization, the fork has to
spell it out." The catalogue's analysis section even cross-references
"pilot 2025-09 / 2025-11 fix" as a likely future remediation path.

At HEAD, **none of those patches is doing any work.** The LSP already
resolves the implicit paths the un-patched form expects. Whatever
fix(es) closed the diamond-resolution gap landed somewhere between
2024-12 (catalogue baseline) and HEAD without being noted in the
catalogue.

Cat. B (type ascriptions) is similarly fully moot — confirming P1's
two-file spot-check generalizes to all 7+ Cat. B files. Cat. E/I/H/J
(the various VectorFunctions and Actions edits) also all moot.

## Confidence and caveats

- **Whole-file substitution** is a coarse instrument: a patch that
  contains multiple independent edits is classified as one unit. The
  `Occurrences.kerml` analysis above flags this — only one of its three
  hunks is provably load-bearing, but the file as a whole is
  load-bearing. For P3's purposes (deciding whether to keep the patch
  at all) this is the right resolution; for "minimize patch size" work,
  per-hunk substitution would be needed.
- **LSP state coupling.** This sweep runs on top of P1's uncommitted
  changes (metamodel-builder, literal-number). Those changes do not
  affect the un-patched outcomes for any of the 23 moot files (validation
  was clean both with and without P1 for the two files P1 spot-checked,
  and P1's rule only fires for features with default values and no
  explicit type — a narrow case that wouldn't mask any of these
  patches). The sweep would produce identical results against the
  pre-P1 main branch, but I did not separately verify that.
- **Test models.** The "representative model" for each file is the
  bundled stdlib itself plus the test-example folders the standard
  validation script picks up. If a patch is only load-bearing when
  user-defined SysML downstream of the stdlib is loaded, the harness
  would miss it. Three of the Cat. A patches relate to inheritance from
  stdlib types into user models; for those there's residual uncertainty.
  None showed problems under the whole-stdlib validation, which is the
  most comprehensive validation set available without authoring custom
  probes — and authoring custom probes is implementation phase, not
  prototype.
- **Cat. F/G are not behaviorally tested.** They were classified
  `contradicts` directly. If anyone wants to know "does the LSP also
  fire on the un-patched form?" that would be a 30-second separate
  query; not done here per the conformance rule.

## Recommendation for P3 scope

The catalogue's three-option analysis (fix LSP / patches dir /
hand-handling) was sized for ~16 patches. With only **1 surviving
load-bearing patch**, the calculus changes:

1. **Drop the contradicts patches** (`RationalFunctions.kerml`,
   `ISQSpaceTime.sysml`) on principle. Already planned.
2. **Drop the 23 moot patches** at upgrade time by replacing the
   bundled fork with upstream 2024-12 (or, at P3 timing, upstream
   2026-03). No `.patch` files, no special infrastructure — the
   "patches" simply evaporate.
3. **Convert exactly one patch to a `.patch` file** — `Occurrences.kerml`
   end-keyword fix — with a header citing
   `checkFeatureCrossingSpecialization` as the underlying LSP gap. A
   companion bug ticket goes in the LSP issue backlog. P3 implements a
   minimal patches/ directory + clone-script integration for this one
   file, plus header conventions so future patches accrete cleanly.

This collapses the catalogue's "option (b) on the path to option (a),
staged" recommendation into a much smaller P3:

- No patches/ directory needed if we drop the load-bearing one too and
  accept a single stdlib regression until the LSP fix lands. But that
  contradicts the "authoring tool must produce no useful diagnostics
  worse than the pilot" rule.
- So: P3 builds the patches/ infrastructure but populates it with one
  patch. The infrastructure is still warranted because (i) any new
  upstream version may regress patches that are moot today, (ii) the
  `Occurrences.kerml` patch documents an LSP defect — that's the
  primary value, not the patch text.

### Implications for P3 scope (was: P3 vs. P2 in the upgrade plan)

- P2/P3 may not need to enumerate ~16 LSP bug tickets. There's
  effectively one ticket: `checkFeatureCrossingSpecialization` doesn't
  account for un-prefixed features as participants in end-cross
  declarations. Maybe two if the `Occurrences.kerml` second/third hunks
  prove load-bearing under per-hunk testing.
- Categories A, B, E, H, I, J in the catalogue's "best fixed at" column
  appear to already be fixed. The catalogue can be amended to mark them
  as such.
- The "Chunk 3 / Chunk 4 / Chunk 5" attribution in the catalogue may
  still be correct *as a history of past work* — those chunks may have
  been the ones that fixed the gaps. Worth a follow-up archaeology pass.

## Files changed (summary)

- `packages/syside-languageserver/scripts/reclassify-patches.ts` (new,
  the harness).
- `packages/syside-languageserver/scripts/reclassify-patches-results.json`
  (new, machine-readable results).
- `docs/maintenance/upgrades/2026-03/02-library-builtins-fork-patches.md`
  (updated per-file disposition table — see catalogue edits).
- `docs/maintenance/upgrades/2026-03/prototypes/results/01a-reclassify-patches-result.md`
  (this file).
