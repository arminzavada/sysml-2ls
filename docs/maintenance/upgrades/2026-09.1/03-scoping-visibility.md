# Chunk 3 — Scoping & visibility (2026-09.1 upgrade)

> **Per-upgrade artifact.** Name-resolution, visibility and import changes in the pilot between `2026-03` and `2026-09.1`, checked against `packages/syside-languageserver/src/services/references/` and `src/utils/scope*.ts`.
>
> **Method:**
>
> - Pilot: the logic moved in 2026-05 (`org.omg.sysml/src/org/omg/sysml/{adapter,delegate,util}` → `org.omg.sysml.logic/src/main/java/org/omg/sysml/...`), so both trees were extracted at their tags, license headers stripped, and diffed file by file. Same for `org.omg.kerml.xtext/src` and `org.omg.sysml.xtext/src` (scoping, linking, post-processing, runtime modules). Each hunk was attributed to a commit with `git log`.
> - Probes: a scratch Node script loads the built `lib/` of the language server with the pinned (`2026-03`) stdlib, builds each snippet with all validation checks, and prints every diagnostic plus each type's specializations. The snippets are quoted below.
>
> **Tags:** `understood` / `structurally-clear` / `needs-deeper-trace` / `consult-Armin`.

## Summary

| # | Tag | Item | Our state | Gap | Confidence |
| --- | --- | --- | --- | --- | --- |
| S1 | 2026-09.1 | Proxy-linking fix (ST6RI-984) | No proxies; both new pilot regression models pass | none | `understood` |
| S2 | pre-existing | Semantic-metadata base type on a classifier (surfaced by S1's second test model) | Classifier subclassifies the base-type *feature* | shape only, no diagnostic | `structurally-clear` → chunk 4 |
| S3 | 2026-05 | `Namespace::resolve` / `resolveLocal` / `resolveGlobal` per spec OCL (ST6RI-926) | No such API; `$::` parsed but ignored (2026-03 carry-over) | API-only | `understood` |
| S4 | 2026-05/08 | Linker, scope, import and membership post-processing moved to `postprocessing` packages | Equivalent logic in `ast-to-model.ts` | none | `understood` |
| S5 | 2026-07 (OCL) | `featureMembership` excludes imported memberships (KERML11-191) | `TypeMeta.allFeatures` never includes imports | none found | `structurally-clear` |
| S6 | 2026-09 | Self-annotating metaclass/metadata def stack overflow (ST6RI-976) | No recursion | none | `understood` |
| S7 | 2026-07 | Standalone EMF setup / library name lookup (ST6RI-954) | not applicable | none | `understood` |

**Headline:** "Scoping unchanged" is **confirmed**. Across the range the Xtext linker, `KerMLScope`, `KerMLGlobalScope(Provider)` and `KerMLScopeProvider` change only in license headers, one interface drop and the post-processing hook. Import and membership post-processing moved verbatim. The only behavioral fix (ST6RI-984) is about EMF proxies, which have no Langium analogue, and both regression models it ships already resolve cleanly here. Nothing in this chunk gates the stdlib swap. The one deviation the probes surfaced (S2) is a typing issue and goes to chunk 4.

**Size:** zero for porting. Optional: add the S1/S6 models as regression tests (under an hour).

---

## S1. Proxy-linking fix (2026-09.1, ST6RI-984)

**Pilot `2026-09.1`:** three commits (besides version and CI), all about EMF proxies that fail to resolve during the resolution of another name and resolve later.

- `org.omg.sysml.logic/.../adapter/FeatureAdapter.java` `getAllRedefinedFeatures()`: the result is no longer cached while any redefined feature is still a proxy.
- `.../util/TypeUtil.java` `insertImplicitSpecializations`, `.../util/FeatureUtil.java` `insertImplicitTypeFeaturings`, `.../util/ConnectorUtil.java` `addConnectorEndTo`: an implied relationship to a general/featuring/related element with no owning relationship used to adopt that element as an owned related element (meant for on-the-fly feature chains). An unresolved proxy also has no owner, so it got adopted into the containment tree. All three now add `&& !x.eIsProxy()`; the commit title is "not add/cache proxies".
- `org.omg.kerml.xtext/.../validation/KerMLValidator.xtend` `doCheckBindingConnector`: resolves both related features (`EcoreUtil.resolve`) before `validateBindingConnectorTypeConformance`, removing spurious warnings.
- New `org.omg.sysml.interactive.tests/.../NestedResolutionTest.java` with two models (below). Commit history shows they failed before the fix.

**Ours:** no proxies. A reference either links or gets a `LinkingError`.

- `services/references/linker.ts` `linkReference` (line 238) returns early on `to.cached`.
- `doLink` (line 490) stores the result with `to.set(resolved)`.
- `utils/containers.ts` `Target.set` records a failed link as `null`, so a failed link is cached for the rest of the build.

So the failure *class* exists here in a different form: a nested resolution that fails early stays failed. It is not the pilot's bug, and it is not new in range. This is the pre-existing ordering fragility tracked as the Heisenbug in `docs/known_limitations.md`. `validateBindingConnectorTypeConformance` (`kerml-validator.ts` line 882) drops unresolved related features and skips when fewer than two remain, so the spurious-warning half has no equivalent.

**Probes** (the two pilot test models, verbatim):

```sysml
package P {
    private import VerificationCases::*;
    private import VerificationMethodKind::*;
    verification def MassTest;
    verification massTests : MassTest {
        @VerificationMethod { kind = test; }
    }
}
```

No diagnostics. `kind` redefines `VerificationCases::VerificationMethod::kind` and `test` links; with `tst` instead, we report "Could not resolve reference to Feature named 'tst'", so the clean result is real.

```sysml
package P {
    private import Metaobjects::SemanticMetadata;
    private import ScalarValues::*;
    port def Interface {
        attribute url : String;
        attribute protocol : String;
    }
    port interfaces : Interface;
    metadata def <service> ServiceMetadata :> SemanticMetadata {
        :>> baseType default interfaces meta SysML::PortUsage;
    }
    #service def Service {
        attribute :>> url = "pull";
        attribute :>> protocol = "JSON";
    }
    port def Endpoint :> Service, Interface;
}
```

No diagnostics. `Service::url`/`protocol` redefine `Interface::url`/`protocol`. The implied supertype is wrong, though (S2).

**Gap:** none to port. **Status:** `understood`.

## S2. Semantic-metadata base type on a classifier (pre-existing, surfaced by S1)

**Pilot:** `TypeAdapter.getBaseTypes()` evaluates each `baseType` value. `ClassifierAdapter.getBaseTypes()` then maps every base type that is a *feature* to that feature's types and keeps only classifiers. So `#service def Service` gets `Service :> Interface`, which is what the test's comment says.

**Ours:** `services/shared/workspace/metamodel-builder.ts` `addSemanticMetadata` (line 599) adds `node.specializationKind()` to the annotated element of the evaluated metaclass reference as-is. The probe dump:

```text
P::Service : Definition
  implied Subclassification -> P::interfaces
  implied Subclassification -> Base::Anything
```

A `Subclassification` whose general is a `PortUsage`. Scoping works anyway: `interfaces`' typing brings in `Interface`'s members, so the redefinitions link. The shape is still wrong for a classifier. The same happens for a self-annotated semantic metadata def (S6 probe: `SM` subclassifies the usage `parts`).

**Gap:** we produce a non-conformant implicit relationship; no diagnostic difference observed. **Size:** small (map feature → types when `node` is a classifier). **Status:** `structurally-clear`. The porting belongs to chunk 4.

## S3. `Namespace::resolve*` re-implemented (2026-05, ST6RI-926)

**Pilot:** `delegate/invocation/Namespace_resolve_InvocationDelegate.java`, `…resolveLocal…` and `…resolveGlobal…` now follow the spec OCL.

- `resolve` splits off the qualification. No qualification goes to `resolveLocal`, `$` goes to `resolveGlobal`, anything else goes to `resolveVisible` on the resolved qualifier.
- `resolveLocal` looks in the namespace's own `membership` and then recurses to the owning namespace; at the root it goes global.
- `resolveGlobal` stays library-only (`SysMLLibraryUtil.getLibraryElement`) and is now null-safe.
- `NamespaceUtil.getNamedMembershipFor` became a plain name/short-name match over `membership` instead of a call into the Xtext scope.

The only in-module callers are `Type_specializesFromLibrary` and `Feature_redefinesFromLibrary`, which use `resolveGlobal`. The Xtext linker never calls these operations.

**Ours:** no `resolve*` operations on `NamespaceMeta`. `grammar/KerML.expressions.langium` parses `$::` into `isGlobal` with a TODO; nothing reads the flag. That is the 2026-03 cycle's chunk 3 item 1, still open and not changed by this range.

**Gap:** API/evaluation-side only. **Status:** `understood`.

## S4. Linker, scope and post-processing relocation (2026-05/08)

**Pilot:**

- `KerMLLinker.java`: `ElementUtil.postProcess` → `doGetPostProcessor(element).postProcess()`. The new `SysMLLinker` overrides it with the SysML factory.
- `KerMLScope.xtend` stops implementing `ISysMLScope`; `getElement` stays.
- `KerMLGlobalScope`, `KerMLGlobalScopeProvider` and `KerMLScopeProvider`: license only.
- Import/membership post-processing moved from the adapters to `org.omg.kerml.xtext/.../postprocessing/` without change:
  - `ImportParserPostProcessor`: imports inside a filter package are public.
  - `NamespaceImportParserPostProcessor`: a filter package's implicit `importedNamespace`.
  - `MembershipParserPostProcessor`: alias names are unescaped.

**Ours:** `utils/ast-to-model.ts` `[ast.Import.$type]` sets `Visibility.public` for an import whose parent is a package owned by an import, matching the first rule. Names, alias names included, go through `sanitizeName` in the `[ast.Element.$type]` handler. The filter-package `importedNamespace` default was not re-traced. Since the pilot moved that code unchanged, there is nothing new to compare.

**Status:** `understood` (no change in range).

## S5. `featureMembership` excludes imported memberships (KERML11-191)

**Pilot:** `TypeAdapter.getFeatureMembership()` = owned feature memberships plus inherited `FeatureMembership`s whose `membershipOwningNamespace` is one of `allSupertypes()`. Feature memberships that a supertype only *imports* are dropped. The code predates `2026-03`; in range only the OCL caught up (2026-07). ST6RI-944 (2026-05) makes the setting delegate clear caches on every call, which affects performance only.

**Ours:** `model/KerML/type.ts` `allFeatures()` (line 556) concatenates `featureMembers()` (owned children only) over `allTypes(undefined, true)` and drops redefined ones. Imported memberships never enter, so the filter holds by construction. `basePositionalFeatures` (line 500) is built the same way.

**Status:** `structurally-clear` (not probed with a public import inside a supertype).

## S6. Self-annotating metadata (2026-09, ST6RI-976)

**Pilot:** `metaclass M1 { metadata M1; }` and `metadata def M { metadata M; }` overflowed the stack in `TypeAdapter.getBaseTypes()` through `getMetaclass()` → `removeRedundantTypes`. Fixed by calling `FeatureUtil.getTypesOf` with a shared visited set.

**Ours:** probes

```sysml
package SelfMeta {
    metadata def M { metadata M; }
    #M part def X;
    metadata def <sm> SM :> Metaobjects::SemanticMetadata {
        :>> baseType = parts meta SysML::PartUsage;
        metadata SM;
    }
    part parts;
    #sm part def Y;
}
```

and the KerML `metaclass M1 { metadata M1; } #M1 class C;` build with no diagnostics and no recursion. (`SM`/`Y` show the S2 shape issue.)

**Status:** `understood`.

## S7. Standalone setup / library lookup (2026-07, ST6RI-954)

`ResourceSetModelLibraryProvider` skips `OwningMembership` names during lookup, and `SysMLLogicStandaloneSetup` became idempotent. This is the non-Xtext path only. **Status:** `understood`, not relevant.

---

## Open questions

1. Add the S1 and S6 models to the scoping/linking test suite as regression guards? They pass today and cost nothing.
2. S2 is a pre-existing typing deviation in semantic metadata. Take it with the chunk 4 work or leave it for a later cycle? (`structurally-clear`, small.)
