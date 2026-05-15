# Upstream sources we track

This project follows three upstream sources from the OMG SysML v2 ecosystem. Anything else (Eclipse SysON, Sensmetry's `sysand`, third-party language servers, INCOSE/community pages) is intentionally **out of scope** for ongoing tracking — useful context, but not something we sync against.

## 1. OMG specification

- **SysML 2.0:** <https://www.omg.org/spec/SysML/2.0/About-SysML>
- **KerML 1.0:** <https://www.omg.org/spec/KerML/1.0/About-KerML>
- **Status:** Formally adopted by OMG on 2025-06-30; formal documents (`formal/26-03-0x`) published March 2026. Updates from here on are errata-only.
- **What we care about:** language-level changes affecting grammar, name resolution, type system, or semantics. Errata may or may not require code changes — read and decide case-by-case.

## 2. Pilot implementation

- **Repo:** <https://github.com/Systems-Modeling/SysML-v2-Pilot-Implementation>
- **Cadence:** Monthly tags formatted `YYYY-MM` (occasionally `YYYY-MM.1` patches).
- **Role:** De-facto reference for behavior. When the spec is ambiguous or silent, the pilot wins.
- **Targeting policy:** always the latest available tag at the time of an upgrade. We do not pin to older tags.
- **Currently targeting:** `2026-03` (commit `3a1be5b87`, tagged 2026-04-03). _Pending the next upgrade run; the repo is still on its pre-revival baseline._

## 3. Standard library (SysML-v2-Release)

- **Repo:** <https://github.com/Systems-Modeling/SysML-v2-Release>
- **Cadence:** Monthly tags `YYYY-MM`, in lockstep with the pilot.
- **What we use:** the `sysml.library/` content. The repo also ships spec PDFs, example models, and installers — those are not consumed here.
- **Local pinning:** vendored via [`packages/syside-languageserver/scripts/clone-sysml-release.mjs`](../../packages/syside-languageserver/scripts/clone-sysml-release.mjs).
- **Pinning rule:** the standard-library commit **tracks the pilot tag we are targeting**. They are intended to move together — never pin them independently.
- **Source of truth:** upstream `Systems-Modeling/SysML-v2-Release`. The clone script currently fetches from `arminzavada/SysML-v2-Release`, which carries legacy customizations left by previous maintainers; that fork is deprecated and the script will be repointed to upstream as part of the next upgrade.
- **Current pin:** commit `1888927c6930c0c7f5a483411b0187831a9a5d1c` (≈ tag `2024-12`, on the deprecated fork). Inherited from fork time; **to be advanced** to upstream `Systems-Modeling/SysML-v2-Release` at tag `2026-03` (commit `cd99f7ca70b96abb38f09dfd25725e3cf259baa3`) during the next upgrade.

## Maintenance rule

Add to this file only what comes from the three sources above. If something would only ever appear in an "ecosystem survey," it does not belong here.
