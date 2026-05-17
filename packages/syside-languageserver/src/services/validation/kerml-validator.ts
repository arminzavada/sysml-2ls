/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { MultiMap, Properties, Stream, stream } from "langium";
import * as ast from "#generated/ast.js";
import {
    AnyOperator,
    AssociationMeta,
    AssociationStructMeta,
    BasicMetamodel,
    BehaviorMeta,
    BindingConnectorMeta,
    ClassMeta,
    ConnectorMeta,
    CrossSubsettingMeta,
    DataTypeMeta,
    ElementFilterMembershipMeta,
    ElementMeta,
    ExpressionMeta,
    FeatureChainExpressionMeta,
    FeatureChainingMeta,
    FeatureMeta,
    FeatureReferenceExpressionMeta,
    FeatureValueMeta,
    FunctionMeta,
    IMPLICIT_OPERATORS,
    ImportMeta,
    InteractionMeta,
    InvocationExpressionMeta,
    ItemFlowEndMeta,
    ItemFlowMeta,
    LibraryPackageMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MultiplicityMeta,
    MultiplicityRangeMeta,
    NamespaceMeta,
    OperatorExpressionMeta,
    OPERATORS,
    ParameterMembershipMeta,
    RedefinitionMeta,
    RelationshipMeta,
    ResultExpressionMembershipMeta,
    ReturnParameterMembershipMeta,
    SpecializationMeta,
    StructureMeta,
    SubsettingMeta,
    typeArgument,
    TypeMeta,
} from "../../model/index.js";
import { SysMLSharedServices } from "../services.js";
import { SysMLIndexManager } from "../shared/workspace/index-manager.js";
import { SubtypeKeys, SysMLInterface, SysMLType } from "../sysml-ast-reflection.js";
import {
    ModelDiagnosticInfo,
    ModelValidationAcceptor,
    Severity,
    validateKerML,
} from "./validation-registry.js";
import { NonNullable, Visibility } from "../../utils/index.js";
import { SysMLFileSystemProvider } from "../shared/index.js";

/**
 * Implementation of custom validations.
 */
export class KerMLValidator {
    protected readonly index: SysMLIndexManager;
    protected readonly fs: SysMLFileSystemProvider;

    constructor(services: SysMLSharedServices) {
        this.index = services.workspace.IndexManager;
        this.fs = services.workspace.FileSystemProvider;
    }

    @validateKerML(ast.Element.$type)
    validateElementIsImpliedIncluded(node: ElementMeta, accept: ModelValidationAcceptor): void {
        if (
            !node.isImpliedIncluded &&
            node
                .ownedElements()
                .filter(BasicMetamodel.is(ast.Relationship.$type))
                .some((r) => r.isImplied)
        ) {
            accept("error", "Element cannot have implied relationships included.", {
                element: node,
                code: "validateElementIsImpliedIncluded",
            });
        }
    }

    @validateKerML(ast.Import.$type)
    validateImportTopLevelVisibility(node: ImportMeta, accept: ModelValidationAcceptor): void {
        if (node.parent()?.is(ast.Namespace.$type) && !node.parent()?.parent()) {
            if (node.visibility === Visibility.private) return;
            else {
                accept("error", "Top Level Import must be private", {
                    element: node,
                    property: "visibility",
                    code: "validateImportTopLevelVisibility",
                });
            }
        }
    }

    @validateKerML(ast.Import.$type)
    validateImportExplicitVisibility(node: ImportMeta, accept: ModelValidationAcceptor): void {
        if (!node.is(ast.Expose.$type) && !node.hasExplicitVisibility) {
            accept("error", "An Import must have explicit visibility.", {
                element: node,
                code: "validateImportExplicitVisibility",
            });
        }
    }

    @validateKerML(ast.Namespace.$type, { bounds: [ast.InlineExpression.$type] })
    validateNamespaceDistinguishability(
        element: NamespaceMeta,
        accept: ModelValidationAcceptor
    ): void {
        const duplicates = new MultiMap<
            string,
            [ElementMeta, Properties<ast.Element> | undefined]
        >();

        // for performance reasons, only check direct members
        for (const child of element.ownedElements()) {
            let member: MembershipMeta;
            let target: ElementMeta;

            if (child.is(ast.Membership.$type)) {
                // skip non-owning non-alias members
                if (child.nodeType() === ast.Membership.$type && !child.isAlias) return;
                const element = child.isAlias ? child : child.element();
                /* istanbul ignore next */
                if (!element) continue;
                member = child;
                target = element;
            } else if (child.is(ast.MembershipImport.$type) && !child.isRecursive) {
                const element = child.element();
                /* istanbul ignore next */
                if (!element) continue;
                member = element;
                target = child;
            } else {
                // not checking recursive/namespace imports
                continue;
            }

            if (member.name) {
                duplicates.add(member.name, [target, "declaredName"]);
            }
            if (member.shortName && member.shortName !== member.name) {
                duplicates.add(member.shortName, [target, "declaredShortName"]);
            }
        }

        for (const [name, members] of duplicates.entriesGroupedByKey()) {
            if (members.length < 2) continue;
            for (const [target, property] of members) {
                accept("warning", `Duplicate of another member named ${name}.`, {
                    element: target,
                    code: "validateNamespaceDistinguishability",
                    property,
                });
            }
        }

        // TODO: inherited members
    }

    @validateKerML(ast.Specialization.$type)
    validateSpecializationSpecificNotConjugated(
        node: SpecializationMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.isImplied) return;
        const specific = node.source();
        if (
            specific?.is(ast.Type.$type) &&
            specific.specializations(ast.Conjugation.$type).length > 0
        ) {
            const parsed = node.ast();
            accept("error", "Conjugated type cannot be a specialized type.", {
                element: node,
                code: "validateSpecializationSpecificNotConjugated",
                property: parsed?.sourceRef
                    ? "sourceRef"
                    : parsed?.sourceChain
                      ? "sourceChain"
                      : "source",
            });
        }
    }

    @validateKerML(ast.Type.$type)
    validateTypeAtMostOneConjugator(node: TypeMeta, accept: ModelValidationAcceptor): void {
        const conjugations = node.specializations(ast.Conjugation.$type);
        if (conjugations.length > 1) {
            this.apply("warning", conjugations, "Type can have at most one conjugator.", accept, {
                code: "validateTypeAtMostOneConjugator",
            });
        }
    }

    private readonly typeRelationshipNotSelf: Record<string, { code: string; message: string }> = {
        [ast.Differencing.$type]: {
            code: "validateTypeDifferencingTypesNotSelf",
            message: "A Type cannot be one of its own differencingTypes.",
        },
        [ast.Intersecting.$type]: {
            code: "validateTypeIntersectingTypesNotSelf",
            message: "A Type cannot be one of its own intersectingTypes.",
        },
        [ast.Unioning.$type]: {
            code: "validateTypeUnioningTypesNotSelf",
            message: "A Type cannot be one of its own unioningTypes.",
        },
        [ast.FeatureChaining.$type]: {
            code: "validateFeatureChainingFeaturesNotSelf",
            message: "A Feature cannot be one of its own chainingFeatures.",
        },
    };

    @validateKerML(ast.Type.$type, { sysml: false })
    validateTypeRelatesTypesNotSelf(node: TypeMeta, accept: ModelValidationAcceptor): void {
        node.typeRelationships.forEach((r) => {
            if (r.element() !== node) return;
            const info = this.typeRelationshipNotSelf[r.nodeType()];

            /* istanbul ignore next */
            if (!info) return;

            accept("error", info.message, {
                element: r,
                code: info.code,
            });
        });
    }

    private readonly typeRelationshipNotOne: Record<string, { code: string; message: string }> = {
        [ast.Differencing.$type]: {
            code: "validateTypeOwnedDifferencingNotOne",
            message: "A Type cannot have exactly one ownedDifferencing.",
        },
        [ast.Intersecting.$type]: {
            code: "validateTypeOwnedIntersectingNotOne",
            message: "A Type cannot have exactly one ownedIntersecting.",
        },
        [ast.Unioning.$type]: {
            code: "validateTypeOwnedUnioningNotOne",
            message: "A Type cannot have exactly one ownedUnioning.",
        },
        [ast.FeatureChaining.$type]: {
            code: "validateFeatureChainingFeatureNotOne",
            message: "A Feature cannot have exactly one chainingFeatures.",
        },
    };

    @validateKerML(ast.Type.$type)
    validateTypeRelationshipNotOne(node: TypeMeta, accept: ModelValidationAcceptor): void {
        const relationships: Record<string, RelationshipMeta[]> = {};
        node.typeRelationships.forEach((r) => {
            (relationships[r.nodeType()] ??= []).push(r);
        });

        Object.entries(relationships).forEach(([type, relationships]) => {
            const info = this.typeRelationshipNotOne[type];
            if (!info || relationships.length !== 1) return;
            this.apply("error", relationships, info.message, accept, {
                code: info.code,
            });
        });
    }

    // sysml has no multiplicity types/members outside of declaration so this
    // would always pass
    @validateKerML(ast.Type.$type, { sysml: false })
    validateTypeOwnedMultiplicity(node: TypeMeta, accept: ModelValidationAcceptor): void {
        // even though multiplicity is a subtype of feature, it is parsed as a
        // non-feature element...
        const multiplicities = stream(node.children)
            .filter(BasicMetamodel.is(ast.OwningMembership.$type))
            .map((m) => m.element())
            .nonNullable()
            .filter(BasicMetamodel.is(ast.Multiplicity.$type))
            .tail(node.multiplicity ? 0 : 1);

        this.apply(
            "warning",
            multiplicities,
            "A Type may have at most one ownedMember that is a Multiplicity.",
            accept,
            { code: "validateTypeOwnedMultiplicity" }
        );
    }

    @validateKerML(ast.EndFeatureMembership.$type)
    validateEndFeatureMembership(node: MembershipMeta, accept: ModelValidationAcceptor): void {
        const feature = node.element();
        /* istanbul ignore next */
        if (!feature?.is(ast.Feature.$type)) return;
        if (!feature.isEnd) {
            accept(
                "error",
                "The ownedMemberFeature of an EndFeatureMembership must have isEnd = true.",
                {
                    element: node,
                    code: "validateEndFeatureMembership",
                }
            );
        }
    }

    @validateKerML(ast.Multiplicity.$type, { sysml: false })
    validateMultiplicityDomain(node: MultiplicityMeta, accept: ModelValidationAcceptor): void {
        const owningType = node.owner();
        /* istanbul ignore next */
        if (!owningType?.is(ast.Type.$type)) return;

        const multi = node.featuredBy;
        if (owningType.is(ast.Feature.$type)) {
            const owner = owningType.featuredBy;
            if (
                multi !== owner &&
                multi.length !== owner.length &&
                multi.some((tf) => !owner.includes(tf))
            ) {
                this.apply(
                    "warning",
                    multi,
                    "Feature multiplicity featuringTypes must be the same as those of the Feature itself.",
                    accept,
                    { code: "validateFeatureMultiplicityDomain" }
                );
            }
        } else if (multi.length !== 0) {
            this.apply(
                "warning",
                multi,
                "Classifier multiplicity featuringTypes must be empty.",
                accept,
                {
                    code: "validateClassifierMultiplicityDomain",
                }
            );
        }
    }

    @validateKerML(ast.Feature.$type)
    validateFeatureTyping(node: FeatureMeta, accept: ModelValidationAcceptor): void {
        if (
            node.allTypings().length === 0 &&
            // in case failed to link
            !node.typeRelationships.find((r) => r.is(ast.FeatureTyping.$type))
        ) {
            accept("error", "A Feature must be typed by at least one type.", {
                element: node,
                property: "heritage",
                // not in the spec
                code: "validateFeatureTyping",
            });
        }
    }

    @validateKerML(ast.CrossSubsetting.$type)
    validateCrossSubsettingCrossedFeature(
        node: CrossSubsettingMeta,
        accept: ModelValidationAcceptor
    ): void {
        const crossingFeature = node.source();
        if (
            !crossingFeature?.is(ast.Feature.$type) ||
            !crossingFeature.isEnd ||
            !crossingFeature.owningType
        )
            return;

        const target = node.element();

        if (!target?.is(ast.Feature.$type) || target.chainings.length !== 2) {
            accept("error", "Cross subsetting must chain exactly 2 features.", {
                element: node,
                code: "validateCrossSubsettingCrossedFeature",
            });
        } else {
            let count = 0;
            let opposite = undefined;

            for (const member of crossingFeature.owningType.featureMembers()) {
                const f = member.element();
                if (!member.is(ast.EndFeatureMembership.$type) && !f?.isEnd) continue;
                if (++count > 2) break;
                if (!opposite && crossingFeature !== f) opposite = f;
            }

            if (count == 2 && target.chainings.at(0)?.element() !== opposite) {
                accept("error", "Cross subsetting must chain through an opposite end feature.", {
                    element: target,
                    code: "validateCrossSubsettingCrossedFeature",
                });
            }
        }
    }

    // Only doing validateCrossSubsettingCrossingFeature for explicit CrossSubsettings as otherwise
    // Occurrences::Occurrence::surroundedByOccurrences::surroundingSpace in the standard library
    // fails validation
    @validateKerML(ast.CrossSubsetting.$type)
    validateCrossSubsettingCrossingFeature(
        node: CrossSubsettingMeta,
        accept: ModelValidationAcceptor
    ): void {
        const crossingFeature = node.source();
        if (node.isImplied || !crossingFeature?.is(ast.Feature.$type)) return;

        const numEndFeatures = crossingFeature.owningType
            ?.basePositionalFeatures(
                (f) => f.is(ast.EndFeatureMembership.$type) || !!f.element()?.isEnd,
                undefined,
                true
            )
            .toArray().length;
        if (!crossingFeature.isEnd || !numEndFeatures || numEndFeatures < 2) {
            accept("error", "Cross subsetting must be owned by one of two or more end features.", {
                element: node,
                code: "validateCrossSubsettingCrossingFeature",
            });
        }
    }

    @validateKerML(ast.Feature.$type)
    validateFeatureCrossFeatureSpecialization(
        node: FeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const cross = node.crossFeature;
        if (!cross || cross === node.findOwnedCrossFeature()) return;

        const redefinitions = stream(node.specializations(ast.Redefinition.$type))
            .map((redefinition) => (redefinition as RedefinitionMeta).element()?.crossFeature)
            .nonNullable()
            .filter((redefinitionCross) => !cross.conforms(redefinitionCross))
            .toArray();

        if (redefinitions.length > 0) {
            accept("error", "Cross feature must specialize redefined end cross features.", {
                element: node.findOwnedCrossFeature() ?? node.ownedCrossSubsetting ?? node,
                code: "validateFeatureCrossFeatureSpecialization",
            });
        }
    }

    @validateKerML(ast.Feature.$type)
    validateFeatureCrossFeatureType(node: FeatureMeta, accept: ModelValidationAcceptor): void {
        const cross = node.crossFeature;
        if (!cross) return;
        if (
            cross === node.findOwnedCrossFeature() &&
            node.specializations().every((s) => s.isImplied)
        )
            return;
        const nodeTypings = node.allTypings();
        const crossTypings = cross.allTypings();
        if (
            nodeTypings.length === crossTypings.length &&
            nodeTypings.every((t) => crossTypings.includes(t))
        )
            return;
        accept("error", "Cross feature must have same types as its feature.", {
            element: node.findOwnedCrossFeature() ?? node.ownedCrossSubsetting ?? node,
            code: "validateFeatureCrossFeatureType",
        });
    }

    @validateKerML(ast.Feature.$type)
    checkFeatureCrossingSpecialization(node: FeatureMeta, accept: ModelValidationAcceptor): void {
        if (!node.isEnd) return;
        const cross = node.findOwnedCrossFeature();
        if (cross && node.crossFeature && cross !== node.crossFeature) {
            accept("error", "Must cross the owned cross feature.", {
                element: node.ownedCrossSubsetting as CrossSubsettingMeta,
                code: "checkFeatureCrossingSpecialization",
            });
        }
    }

    @validateKerML(ast.Feature.$type)
    validateFeatureEndMultiplicity(node: FeatureMeta, accept: ModelValidationAcceptor): void {
        if (node.isEnd && node.multiplicity) {
            const bounds = node.multiplicity.element()?.bounds;
            if (bounds && (bounds.lower !== 1 || bounds.upper !== 1)) {
                accept("warning", "End feature must have a multiplicity 1..1.", {
                    element: node.multiplicity,
                    code: "validateFeatureEndMultiplicity",
                });
            }
        }
    }

    @validateKerML(ast.Feature.$type)
    validateFeatureOwnedCrossSubsetting(node: FeatureMeta, accept: ModelValidationAcceptor): void {
        const cross = node.specializations(ast.CrossSubsetting.$type);
        if (cross.length > 1) {
            this.apply(
                "error",
                cross,
                "A Feature must have at most one ownedSubsetting that is a CrossSubsetting.",
                accept,
                { code: "validateFeatureOwnedCrossSubsetting" }
            );
        }
    }

    @validateKerML(ast.Feature.$type)
    validateFeatureOwnedReferenceSubsetting(
        node: FeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const refs = node.specializations(ast.ReferenceSubsetting.$type);
        if (refs.length > 1) {
            this.apply(
                "warning",
                refs,
                "A Feature must have at most one ownedSubsetting that is a ReferenceSubsetting.",
                accept,
                { code: "validateFeatureOwnedReferenceSubsetting" }
            );
        }
    }

    // this is broken until linking can be done to our custom model structures w/o langium AstNode
    // @validateKerML(ast.Redefinition)
    // validateRedefinitionDirectionConformance(
    //     node: RedefinitionMeta,
    //     accept: ModelValidationAcceptor
    // ): void {
    //     const redefining = node.source() as FeatureMeta | undefined;
    //     const redefined = node.element();

    //     if (!redefining || !redefined || redefined.parent() === node) return;

    //     const dstFeaturings = redefined.featuredBy;
    //     const direction = redefining.direction;
    //     for (const featuring of dstFeaturings) {
    //         const redefinedDir = featuring.directionOf(redefined);
    //         if (
    //             ((redefinedDir == "in" || redefinedDir == "out") && direction != redefinedDir) ||
    //             (redefinedDir == "inout" && direction == "none")
    //         ) {
    //             accept("error", "Redefining feature must have a compatible direction", {
    //                 element: node,
    //                 code: "validateRedefinitionDirectionConformance",
    //             });
    //         }
    //     }
    // }

    @validateKerML(ast.FeatureChaining.$type)
    validateFeatureChainingFeatureConformance(
        node: FeatureChainingMeta,
        accept: ModelValidationAcceptor
    ): void {
        const feature = node.element();
        if (!feature) return;
        const chainings = (node.source() as FeatureMeta).chainings;
        const i = chainings.indexOf(node);
        if (i > 0) {
            const previous = chainings[i - 1].element();
            /* istanbul ignore next */
            if (!previous) return;
            if (!feature.featuredBy.every((t) => previous.conforms(t))) {
                accept(
                    "error",
                    "A chainingFeature must be featured by the previous chainingFeature",
                    { element: node, code: "validateFeatureChainingFeatureConformance" }
                );
            }
        }
    }

    @validateKerML(ast.Redefinition.$type)
    validateRedefinitionFeaturingTypes(
        node: RedefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const redefining = node.source() as FeatureMeta | undefined;
        const redefined = node.element();

        if (!redefining || !redefined || redefined.parent() === node) return;

        const srcFeaturings = redefining.featuredBy;
        const dstFeaturings = redefined.featuredBy;
        if (srcFeaturings.every((t) => dstFeaturings.includes(t))) {
            accept(
                "error",
                srcFeaturings.length === 0
                    ? "A package level Feature cannot redefine other Features."
                    : "Owner of redefining feature cannot be the same as owner of the redefined feature.",
                {
                    element: node,
                    code: "validateRedefinitionFeaturingTypes",
                }
            );
        }
    }

    validateSubsettingMultiplicityConformance(
        node: SubsettingMeta,
        subsetting: FeatureMeta,
        subsetted: FeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const bounds = subsetting.multiplicity?.element()?.bounds;
        const end = subsetting.isEnd;

        if (!bounds) return;
        // only need to check bounds if either both are ends or neither are ends
        if (end !== subsetted.isEnd) return;

        const subBounds = subsetted.multiplicity?.element()?.bounds;
        /* istanbul ignore next */
        if (!subBounds) return;

        const [src, dst] =
            node.nodeType() === ast.Redefinition.$type
                ? ["Redefining", "redefined"]
                : ["Subsetting", "subsetted"];
        if (node.nodeType() === ast.Redefinition.$type && !end) {
            if (
                bounds.lower !== undefined &&
                subBounds.lower !== undefined &&
                bounds.lower < subBounds.lower
            ) {
                accept(
                    "warning",
                    `${src} feature should not have smaller multiplicity lower bound (${bounds.lower}) than ${dst} feature (${subBounds.lower})`,
                    {
                        element: subsetting,
                        property: "multiplicity",
                        code: "validateRedefinitionMultiplicityConformance",
                    }
                );
            }
        }

        if (
            bounds.upper !== undefined &&
            subBounds.upper !== undefined &&
            bounds.upper > subBounds.upper
        ) {
            accept(
                "warning",
                `${src} feature should not have larger multiplicity upper bound (${bounds.upper}) than ${dst} feature (${subBounds.upper})`,
                {
                    element: subsetting,
                    property: "multiplicity",
                    code: "validateSubsettingMultiplicityConformance",
                }
            );
        }
    }

    validateSubsettingUniquenessConformance(
        node: SubsettingMeta,
        subsetting: FeatureMeta,
        subsetted: FeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!subsetted.isNonUnique && subsetting.isNonUnique) {
            accept(
                "error",
                node.nodeType() === ast.Redefinition.$type
                    ? "Redefining feature cannot be nonunique if redefined feature is unique"
                    : "Subsetting feature cannot be nonunique if subsetted feature is unique",
                {
                    element: node,
                    property: "sourceRef",
                    code: "validateSubsettingUniquenessConformance",
                }
            );
        }
    }

    validateSubsettingFeaturingTypes(
        node: SubsettingMeta,
        subsetting: FeatureMeta,
        subsetted: FeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const subsettedTypes = subsetted.featuredBy;
        if (
            subsettedTypes.length > 0 &&
            !subsettedTypes.every((t) => this.isAccessibleFrom(subsetting, t))
        ) {
            accept(
                subsetting.owner()?.is(ast.ItemFlowEnd.$type) ? "error" : "warning",
                "Invalid subsetting, must be an accessible feature (use dot notation for nesting).",
                { element: node, code: "validateSubsettingFeaturingTypes" }
            );
        }
    }

    protected isAccessibleFrom(feature: FeatureMeta, type: TypeMeta): boolean {
        const featurings = feature.featuredBy;
        return (
            (featurings.length == 0 && type.qualifiedName == "Base::Anything") ||
            featurings.some((featuring) => {
                return (
                    featuring.conforms(type) ||
                    (featuring.is(ast.Feature.$type) && this.isAccessibleFrom(featuring, type))
                );
            })
        );
    }

    @validateKerML(ast.Subsetting.$type)
    validateSubsetting(node: SubsettingMeta, accept: ModelValidationAcceptor): void {
        if (node.isImplied) return;

        const subsetting = node.source() as FeatureMeta | undefined;
        const subsetted = node.element();
        if (!subsetting || !subsetted) return;

        // connectors have separate validation
        if (
            subsetting.owner()?.is(ast.Connector.$type) ||
            subsetted.owner()?.is(ast.Connector.$type)
        )
            return;

        this.validateSubsettingMultiplicityConformance(node, subsetting, subsetted, accept);
        this.validateSubsettingUniquenessConformance(node, subsetting, subsetted, accept);
        this.validateSubsettingFeaturingTypes(node, subsetting, subsetted, accept);
    }

    @validateKerML(ast.DataType.$type, { sysml: false })
    validateDatatypeSpecialization(node: DataTypeMeta, accept: ModelValidationAcceptor): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization.$type)
                .filter((s) => s.element()?.isAny(ast.Class.$type, ast.Association.$type)),
            "A DataType must not specialize a Class or an Association.",
            accept,
            { code: "validateDatatypeSpecialization", property: "targetRef" }
        );
    }

    @validateKerML(ast.Class.$type, {
        sysml: false,
        bounds: [ast.AssociationStructure.$type, ast.Interaction.$type],
    })
    validateClassSpecialization(node: ClassMeta, accept: ModelValidationAcceptor): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization.$type)
                .filter((s) => s.element()?.isAny(ast.DataType.$type, ast.Association.$type)),
            "A Class must not specialize a DataType or an Association.",
            accept,
            { code: "validateClassSpecialization", property: "targetRef" }
        );
    }

    @validateKerML(ast.Structure.$type, { sysml: false })
    validateStructSpecialization(node: StructureMeta, accept: ModelValidationAcceptor): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization.$type)
                .filter((s) => s.element()?.is(ast.Behavior.$type)),
            "A Structure must not specialize a Behavior.",
            accept,
            { code: "validateStructSpecialization", property: "targetRef" }
        );
    }

    @validateKerML(ast.AssociationStructure.$type, { sysml: false })
    @validateKerML(ast.Interaction.$type, { sysml: false })
    validateAssocStructSpecialization(
        node: AssociationStructMeta | InteractionMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization.$type)
                .filter((s) => s.element()?.isAny(ast.DataType.$type)),
            `An ${
                node.is(ast.Interaction.$type)
                    ? ast.Interaction.$type
                    : ast.AssociationStructure.$type
            } must not specialize a DataType.`,
            accept,
            { code: "validateClassSpecialization", property: "targetRef" }
        );
    }

    @validateKerML(ast.Connector.$type)
    @validateKerML(ast.Association.$type)
    validateBinarySpecialization(
        node: AssociationMeta | ConnectorMeta,
        accept: ModelValidationAcceptor
    ): void {
        // only checking owned ends so that the error doesn't propagate to all
        // subtypes
        const ends = node.ownedEnds();
        if (ends.length > 2 && node.conforms("Links::BinaryLink")) {
            const isConn = node.is(ast.Connector.$type);
            accept(
                "error",
                `Invalid binary ${
                    isConn ? ast.Connector.$type : ast.Association.$type
                } - cannot have more than two ends.`,
                {
                    element: node,
                    code: isConn
                        ? "validateConnectorBinarySpecialization"
                        : "validateAssociationBinarySpecialization",
                }
            );
        }
    }

    @validateKerML(ast.Connector.$type)
    @validateKerML(ast.Association.$type)
    validateRelatedTypes(
        node: AssociationMeta | ConnectorMeta,
        accept: ModelValidationAcceptor
    ): void {
        // abstract connectors can have less than 2 ends
        if (node.isAbstract) return;

        if (node.allEnds().length < 2) {
            const isConn = node.is(ast.Connector.$type);
            accept(
                "error",
                `Invalid concrete  ${
                    isConn ? ast.Connector.$type : ast.Association.$type
                }, must have at least 2 related elements`,
                {
                    element: node,
                    code: isConn
                        ? "validateConnectorRelatedFeatures"
                        : "validateAssociationRelatedTypes",
                }
            );
        }
    }

    // validateAssociationStructureIntersection - is implicitly ensured by the
    // type hierarchy

    @validateKerML(ast.BindingConnector.$type)
    validateBindingConnectorIsBinary(
        node: BindingConnectorMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.relatedFeatures().length !== 2) {
            accept("error", "A BindingConnector must be binary.", {
                element: node,
                property: "ends",
                code: "validateBindingConnectorIsBinary",
            });
        }
    }

    @validateKerML(ast.BindingConnector.$type)
    validateBindingConnectorTypeConformance(
        node: BindingConnectorMeta,
        accept: ModelValidationAcceptor
    ): void {
        const related = node.relatedFeatures().filter(NonNullable);
        // skip invalid binding connectors
        if (related.length !== 2) return;

        const notConformsBoolean = (i: number): boolean | undefined => {
            const owningType = related[i].owningType;
            return (
                owningType &&
                this.isBooleanExpression(owningType) &&
                !related[i]
                    .allTypings()
                    .some((t) => this.index.conforms(t, "Performances::BooleanEvaluation"))
            );
        };

        if (
            !this.conformsSymmetrical(related[0].allTypings(), related[1].allTypings()) ||
            notConformsBoolean(0) ||
            notConformsBoolean(1)
        ) {
            accept("warning", "Bound features should have conforming types", {
                element: node,
                code: "validateBindingConnectorTypeConformance",
            });
        }
    }

    @validateKerML(ast.Connector.$type)
    validateConnectorEnds(node: ConnectorMeta, accept: ModelValidationAcceptor): void {
        const featuringTypes = node.featuredBy;

        const ends = node.connectorEnds();
        const skip =
            !node.owningType && node.is(ast.ItemFlow.$type) && node.owner()?.is(ast.Feature.$type);
        if (skip) return;
        ends.forEach((end, index) => {
            // no guarantee that the user has correctly used only a single
            // reference subsetting so only check the head
            const related = end.specializations(ast.ReferenceSubsetting.$type).at(0)?.element() as
                | FeatureMeta
                | undefined;

            if (
                !related ||
                (featuringTypes.length == 0
                    ? related.isFeaturedWithin(undefined)
                    : featuringTypes.every((t) => related?.isFeaturedWithin(t)))
            ) {
                return;
            }

            accept(
                "warning",
                `Invalid connector end #${index}, should be an accessible feature (use dot notation for nesting)`,
                {
                    element: end,
                    code: "checkConnectorTypeFeaturing",
                }
            );
        });
    }

    @validateKerML(ast.Behavior.$type)
    validateBehaviorSpecialization(node: BehaviorMeta, accept: ModelValidationAcceptor): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization.$type)
                .filter((s) => s.element()?.is(ast.Structure.$type)),
            "A Behavior must not specialize a Structure.",
            accept,
            { code: "validateBehaviorSpecialization", property: "targetRef" }
        );
    }

    // this is implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ParameterMembership.$type)
    validateParameterMembershipOwningType(
        node: ParameterMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.owner();
        if (owner && !owner.isAny(ast.Behavior.$type, ast.Step.$type)) {
            accept("error", "A ParameterMembership must be owned by a Behavior or a Step.", {
                element: node,
                code: "validateParameterMembershipOwningType",
            });
        }
    }

    @validateKerML(ast.ParameterMembership.$type)
    validateParameterMembership(
        node: ParameterMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const feature = node.element();
        /* istanbul ignore next */
        if (!feature?.is(ast.Feature.$type)) return;
        if (!feature.direction || feature.direction === "none") {
            accept(
                "error",
                "The ownedMemberParameter of a ParameterMembership must have a direction (in, out, or inout).",
                { element: node, code: "validateParameterMembership" }
            );
        }
    }

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.SysMLFunction.$type)
    @validateKerML(ast.Expression.$type)
    validateReturnParameterMembershipCount(
        node: ExpressionMeta | FunctionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const isFn = node.is(ast.SysMLFunction.$type);
        const results = node.children.filter(
            BasicMetamodel.is(ast.ReturnParameterMembership.$type)
        );
        if (results.length > 1)
            this.apply(
                "error",
                results,
                `${
                    isFn ? "A Function" : "An Expression"
                } must own at most one ReturnParameterMembership.`,
                accept,
                {
                    code: isFn
                        ? "validateFunctionReturnParameterMembership"
                        : "validateExpressionReturnParameterMembership",
                }
            );
    }

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ReturnParameterMembership.$type)
    @validateKerML(ast.ResultExpressionMembership.$type)
    validateResultExpressionMembershipOwningType(
        node: ResultExpressionMembershipMeta | ReturnParameterMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.owner();
        if (owner && !owner.isAny(ast.SysMLFunction.$type, ast.Expression.$type)) {
            accept(
                "error",
                `The owningType of a ${node.nodeType()} must be a Function or Expression.`,
                {
                    element: node,
                    code:
                        node.nodeType() === ast.ReturnParameterMembership.$type
                            ? "validateReturnParameterMembershipOwningType"
                            : "validateResultExpressionMembershipOwningType",
                }
            );
        }
    }

    // validateReturnParameterMembershipParameterHasDirectionOut - implicitly
    // ensured by the model

    /* istanbul ignore next (operator is hard-coded by CollectExpressionMeta;
    fires only if the AST is constructed via a non-grammar path) */
    @validateKerML(ast.CollectExpression.$type)
    validateCollectExpressionOperator(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.operator !== IMPLICIT_OPERATORS.COLLECT) {
            accept("error", "The operator of a CollectExpression must be 'collect'.", {
                element: node,
                code: "validateCollectExpressionOperator",
            });
        }
    }

    /* istanbul ignore next (operator is hard-coded by IndexExpressionMeta) */
    @validateKerML(ast.IndexExpression.$type)
    validateIndexExpressionOperator(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.operator !== IMPLICIT_OPERATORS.INDEX) {
            accept("error", "The operator of an IndexExpression must be '#'.", {
                element: node,
                code: "validateIndexExpressionOperator",
            });
        }
    }

    @validateKerML(ast.SelectExpression.$type)
    validateSelectExpressionOperator(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.getFunction() !== "ControlFunctions::select") {
            accept("error", "The operator of a SelectExpression must be 'select'.", {
                element: node,
                code: "validateSelectExpressionOperator",
            });
        }
    }

    @validateKerML(ast.FeatureChainExpression.$type)
    validateFeatureChainExpressionOperator(
        node: FeatureChainExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.getFunction() !== "ControlFunctions::'.'") {
            accept("error", "The operator of a FeatureChainExpression must be '.'.", {
                element: node,
                code: "validateFeatureChainExpressionOperator",
            });
        }
    }

    @validateKerML(ast.FeatureChainExpression.$type)
    validateFeatureChainExpressionFeatureConformance(
        node: FeatureChainExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const target = node.targetFeature();
        const left = node.args.at(0);

        /* istanbul ignore next */
        if (!target || !left) return;
        const ns = left.is(ast.Expression.$type) ? this.index.findType(left.returnType()) : left;
        /* istanbul ignore next */
        if (!ns) return;

        if (target.featuredBy.length > 0 && !target.featuredBy.some((t) => ns.conforms(t)))
            accept("error", "FeatureChainExpression target must be accessible.", {
                element: node,
                property: "children",
                index: 0, // left is in `operands`
                code: "validateFeatureChainExpressionFeatureConformance",
            });
    }

    @validateKerML(ast.FeatureReferenceExpression.$type)
    /* istanbul ignore next (grammar and type system doesn't allow anything
    other than feature to be used) */
    validateFeatureReferenceExpressionReferentIsFeature(
        node: FeatureReferenceExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const target = node.expression?.element();
        if (target && !target.is(ast.Feature.$type))
            accept("error", "Invalid feature reference expression, must refer to a feature", {
                element: node,
                property: "expression",
                code: "validateFeatureReferenceExpressionReferentIsFeature",
            });
    }

    @validateKerML(ast.InvocationExpression.$type)
    validateInvocationExpressionArgs(
        node: InvocationExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const type = node.invokes() ?? this.index.findType(node.getFunction());
        if (!type) return;

        const expected = new Set(
            type
                .allTypes(undefined, true)
                .flatMap((t) => t.ownedFeatures())
                .nonNullable()
                .filter((f) => f.direction !== "out")
        );

        // nothing to check
        if (expected.size === 0) return;

        const visited = new Set<TypeMeta>();
        node.ownedInputParameters().forEach((param) => {
            const redefinitions = param.types(ast.Redefinition.$type).toArray() as FeatureMeta[];
            if (redefinitions.length === 0) return;
            const redefinedParams = redefinitions.filter((t) => expected.has(t));
            if (redefinedParams.length === 0) {
                accept(
                    "error",
                    "Input parameter must redefine a parameter of the expression type.",
                    { element: param, code: "validateInvocationExpressionParameterRedefinition" }
                );
            } else if (redefinedParams.some((f) => visited.has(f))) {
                accept("error", "Two parameters cannot redefine the same type parameter.", {
                    element: param,
                    code: "validateInvocationExpressionNoDuplicateParameterRedefinition",
                });
            }

            redefinedParams.forEach((p) => visited.add(p));
        });
    }

    @validateKerML(ast.OperatorExpression.$type)
    validateOperatorExpressionCastConformance(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.operator !== OPERATORS.AS) return;

        const left = node.args.at(0);
        const type = typeArgument(node);
        /* istanbul ignore next */
        if (!type || !left?.isAny(ast.Expression.$type, ast.SysMLFunction.$type)) return;

        const arg = this.index.findType(left.returnType());
        /* istanbul ignore next */
        if (!arg) return;
        const argTypes = arg.is(ast.Feature.$type) ? arg.allTypings() : [arg];
        const types = type.is(ast.Feature.$type) ? type.allTypings() : [type];
        if (!this.conformsSymmetrical(argTypes, types)) {
            accept("error", `Cast argument should have conforming types.`, {
                element: node,
                code: "validateOperatorExpressionCastConformance",
            });
        }
    }

    @validateKerML(ast.OperatorExpression.$type, {
        sysml: false,
        bounds: [
            ast.CollectExpression.$type,
            ast.SelectExpression.$type,
            ast.FeatureChainExpression.$type,
        ],
    })
    validateOperatorExpressionBracketOperator(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.operator === OPERATORS.QUANTITY) {
            accept("warning", "Use #(...) operator instead.", {
                element: node,
                property: "operator",
                code: "validateOperatorExpressionBracketOperator",
            });
        }
    }

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ItemFlow.$type)
    validateItemFlowItemFeature(node: ItemFlowMeta, accept: ModelValidationAcceptor): void {
        this.atMostOne(
            "error",
            node.ownedFeatures().filter(BasicMetamodel.is(ast.ItemFeature.$type)),
            accept,
            "An ItemFlow must have at most one ownedFeature that is an ItemFeature.",
            { code: "validateItemFlowItemFeature" }
        );
    }

    @validateKerML(ast.ItemFlow.$type)
    validateFlowEndIsEnd(node: ItemFlowMeta, accept: ModelValidationAcceptor): void {
        node.connectorEnds().forEach((end, index) => {
            if (!end.isEnd) {
                accept("error", `End feature #${index} of an ItemFlow must have isEnd = true.`, {
                    element: end,
                    code: "validateFlowEndIsEnd",
                });
            }
        });
    }

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ItemFlowEnd.$type)
    validateItemFlowEndNestedFeature(node: ItemFlowEndMeta, accept: ModelValidationAcceptor): void {
        const features = node.ownedFeatureMemberships().count();
        if (features !== 1) {
            accept("error", "An ItemFlowEnd must have exactly one ownedFeature.", {
                element: node,
                code: "validateItemFlowEndNestedFeature",
            });
        }
    }

    // implicitly ensured by the grammar but not the type system
    @validateKerML(ast.ItemFlowEnd.$type)
    validateItemFlowEndOwningType(node: ItemFlowEndMeta, accept: ModelValidationAcceptor): void {
        if (!node.owningType?.is(ast.ItemFlow.$type)) {
            accept("error", "The owningType of an ItemFlowEnd must be an ItemFlow.", {
                element: node,
                code: "validateItemFlowEndOwningType",
            });
        }
    }

    @validateKerML(ast.ItemFlowEnd.$type)
    validateItemFlowEndSubsetting(node: ItemFlowEndMeta, accept: ModelValidationAcceptor): void {
        if (
            !node
                .specializations(ast.Subsetting.$type)
                .some((sub) => sub.nodeType() !== ast.Redefinition.$type)
        ) {
            accept("error", "Cannot identify ItemFlowEnd (use dot notation).", {
                element: node,
                code: "validateItemFlowEndSubsetting",
            });
        } else if (!node.specializations(ast.Subsetting.$type).some((sub) => !sub.isImplied)) {
            const child = node.ownedFeatures().head();
            if (child && child.specializations(ast.Redefinition.$type).some((r) => !r.isImplied))
                accept("warning", "ItemFlowEnd should use dot notation.", {
                    element: node,
                    code: "validateItemFlowEndImplicitSubsetting",
                });
        }
    }

    @validateKerML(ast.FeatureValue.$type)
    validateFeatureValueOverriding(node: FeatureValueMeta, accept: ModelValidationAcceptor): void {
        const feature = node.owner();
        if (!feature?.is(ast.Feature.$type)) {
            return;
        }

        if (
            feature
                .allRedefinedFeatures()
                .map((f) => f.value)
                .some((fv) => fv && fv != node && !fv.isDefault)
        ) {
            accept("error", "Cannot override a non-default feature value.", {
                element: node,
                code: "validateFeatureValueOverriding",
            });
        }
    }

    @validateKerML(ast.MultiplicityRange.$type)
    validateMultiplicityRangeBoundResultTypes(
        node: MultiplicityRangeMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (
            node.range &&
            !this.isInteger(node.range.element(), KerMLValidator.IntegerRangeOperators)
        ) {
            accept(
                "error",
                "The results of the bound Expression(s) of a MultiplicityRange must be Naturals.",
                { element: node.range, code: "validateMultiplicityRangeBoundResultTypes" }
            );
        }
    }

    @validateKerML(ast.MetadataFeature.$type, { bounds: [ast.MetadataUsage.$type] })
    validateMetadataFeatureMetaclass(
        node: MetadataFeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.Metaclass.$type,
            accept,
            "MetadataFeature must be typed by exactly one Metaclass.",
            { code: "validateMetadataFeatureMetaclass" }
        );
    }

    @validateKerML(ast.MetadataFeature.$type)
    validateMetadataFeatureMetaclassNotAbstract(
        node: MetadataFeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            "error",
            node.specializations(ast.FeatureTyping.$type).filter((s) => s.element()?.isAbstract),
            "MetadataFeature must be typed by concrete types.",
            accept,
            { code: "validateMetadataFeatureMetaclassNotAbstract" }
        );
    }

    @validateKerML(ast.MetadataFeature.$type)
    validateMetadataFeatureAnnotatedElement(
        node: MetadataFeatureMeta,
        accept: ModelValidationAcceptor
    ): void {
        const annotatedElementFeatures = node
            .allFeatures()
            .map((m) => m.element())
            .nonNullable()
            .filter((f) => !f.isAbstract && f.conforms("Metaobjects::Metaobject::annotatedElement"))
            .toArray();

        if (annotatedElementFeatures.length === 0) return;

        node.annotatedElements().forEach((element) => {
            const meta = element.metaclass?.types().head();
            /* istanbul ignore next */
            if (!meta) return;
            if (
                !annotatedElementFeatures.find((f) =>
                    f.types(ast.FeatureTyping.$type).every((t) => meta.conforms(t))
                )
            )
                accept("error", `Cannot annotate ${meta.name}.`, {
                    element: node,
                    code: "validateMetadataFeatureAnnotatedElement",
                });
        });
    }

    @validateKerML(ast.MetadataFeature.$type)
    validateMetadataFeatureBody(node: TypeMeta, accept: ModelValidationAcceptor): void {
        node.ownedFeatures().forEach((feature) => {
            if (
                !feature
                    .types(ast.Redefinition.$type)
                    .map((t) => t.owner())
                    .find((t) => node.conforms(t as TypeMeta))
            ) {
                accept(
                    "error",
                    "MetadataFeature owned features must redefine owning-type feature.",
                    {
                        element: feature,
                        code: "validateMetadataFeatureBody",
                    }
                );
            }

            const fvalue = feature.value?.element();
            if (fvalue && !fvalue.isModelLevelEvaluable()) {
                accept(
                    "error",
                    "MetadataFeature owned feature values must be model-level evaluable.",
                    { element: fvalue, code: "validateMetadataFeatureBody" }
                );
            }

            this.validateMetadataFeatureBody(feature, accept);
        });
    }

    @validateKerML(ast.ElementFilterMembership.$type)
    validateElementFilterMembership(
        node: ElementFilterMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const expr = node.element();
        const func = expr.getFunction();

        if (func && !expr?.isModelLevelEvaluable())
            accept("error", "The condition Expression must be model-level evaluable", {
                element: expr,
                code: "validatePackageElementFilterIsModelLevelEvaluable",
            });
        else if (!this.isBoolean(expr)) {
            accept(
                "error",
                "The result parameter of the condition Expression must directly or indirectly specialize ScalarValues::Boolean.",
                {
                    element: node,
                    property: "target",
                    code: "validatePackageElementFilterIsBoolean",
                }
            );
        }
    }

    @validateKerML(ast.LibraryPackage.$type)
    checkStandardLibraryPackage(node: LibraryPackageMeta, accept: ModelValidationAcceptor): void {
        if (!node.isStandard) return;
        const emit = (): void => {
            accept("error", "User library packages should not be marked as standard.", {
                element: node,
                property: "isStandard",
                code: "validateLibraryPackageNotStandard",
            });
        };

        if (!node.document.isStandard) {
            emit();
        }
    }

    protected atMostOneMember<T extends SubtypeKeys<ast.Membership>>(
        node: NamespaceMeta,
        type: T,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<SysMLInterface<T>["$meta"]>, "element">
    ): void {
        this.atMostOne(
            "error",
            node.featureMembers().filter(BasicMetamodel.is(type)),
            accept,
            message,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            info as any
        );
    }

    protected atMostOne<T extends ElementMeta>(
        severity: Severity,
        items: Iterable<T>,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): void {
        const matches = Array.from(items);

        if (matches.length < 2) return;
        this.apply(severity, matches, message, accept, info);
    }

    protected apply<T extends ElementMeta>(
        severity: Severity,
        elements: Pick<Stream<T>, "forEach">,
        message: string,
        accept: ModelValidationAcceptor,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): void {
        elements.forEach((element) => accept(severity, message, { ...info, element }));
    }

    protected conformsSymmetrical(left: TypeMeta[], right: TypeMeta[]): boolean {
        // return true if there's at least one type in either array that
        // conforms with every type in the other array
        return (
            left.every((l) => right.some((r) => r.conforms(l))) ||
            right.every((r) => left.some((l) => l.conforms(r)))
        );
    }

    protected expressionResult(expr: ExpressionMeta): string | TypeMeta | undefined {
        let result = expr.returnType();
        const func = expr.getFunction();
        if (!result && func) {
            if (typeof func === "string") {
                const element = this.index.findGlobalElement(func);
                if (element?.isAny(ast.SysMLFunction.$type, ast.Expression.$type))
                    result = element.returnType();
            } else {
                result = func.returnType();
            }
        }

        return result;
    }

    protected readonly BooleanOperators: AnyOperator[] = [
        OPERATORS.NOT,
        OPERATORS.XOR,
        OPERATORS.AND,
        OPERATORS.BITWISE_AND,
        OPERATORS.OR,
        OPERATORS.BITWISE_OR,
    ];

    protected isBoolean(expr: ExpressionMeta): boolean {
        if (expr.is(ast.LiteralBoolean.$type)) {
            return true;
        }

        const result = this.expressionResult(expr);

        if (result && this.index.conforms(result, "ScalarValues::Boolean")) return true;
        return (
            expr.is(ast.OperatorExpression.$type) &&
            this.BooleanOperators.includes(expr.operator) &&
            expr.args.every((arg) => !arg || (arg.is(ast.Expression.$type) && this.isBoolean(arg)))
        );
    }

    protected readonly ComparisonOperators: AnyOperator[] = [
        OPERATORS.EQUALS,
        OPERATORS.SAME,
        OPERATORS.NOT_EQUALS,
        OPERATORS.NOT_SAME,
        OPERATORS.IS_TYPE,
        OPERATORS.HAS_TYPE,
        OPERATORS.LESS,
        OPERATORS.LESS_EQUAL,
        OPERATORS.GREATER,
        OPERATORS.GREATER_EQUAL,
    ];

    protected isBooleanExpression(expr: TypeMeta): boolean {
        if (!expr.is(ast.Expression.$type)) {
            return false;
        }
        if (expr.isAny(ast.LiteralBoolean.$type, ast.Predicate.$type)) {
            // short-circuit for known always-true cases
            return true;
        }

        if (
            expr.is(ast.OperatorExpression.$type) &&
            this.ComparisonOperators.includes(expr.operator)
        ) {
            return true;
        }

        const result = this.expressionResult(expr);

        if (result && this.index.conforms(result, "Performances::BooleanEvaluation")) return true;
        if (expr.is(ast.FeatureReferenceExpression.$type)) {
            const referent = expr.expression?.element();
            if (!referent?.is(ast.Expression.$type)) return false;
            if (this.isBoolean(referent)) return true;

            const refResult = this.index.findType(this.expressionResult(referent));
            return Boolean(refResult?.is(ast.Expression.$type) && this.isBoolean(refResult));
        }

        return false;
    }

    protected static readonly IntegerOperators: AnyOperator[] = [
        OPERATORS.MINUS,
        OPERATORS.PLUS,
        OPERATORS.MULTIPLY,
        OPERATORS.MODULO,
        OPERATORS.EXPONENT_1,
        OPERATORS.EXPONENT_2,
    ];

    protected static readonly IntegerRangeOperators: AnyOperator[] = [
        ...this.IntegerOperators,
        OPERATORS.RANGE,
    ];

    protected isInteger(
        expr: ExpressionMeta,
        operators = KerMLValidator.IntegerOperators
    ): boolean {
        if (expr.is(ast.LiteralInfinity.$type)) {
            return true;
        }
        if (expr.is(ast.LiteralNumber.$type)) {
            return expr.isInteger;
        }

        const result = this.expressionResult(expr);

        if (result && this.index.conforms(result, "ScalarValues::Integer")) return true;
        return (
            expr.is(ast.OperatorExpression.$type) &&
            operators.includes(expr.operator) &&
            expr.args.every((arg) => this.isInteger(arg))
        );
    }

    protected validateExactlyOneTyping<T extends FeatureMeta>(
        node: T,
        bound: SysMLType,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): boolean {
        const typings = node.allTypings();
        if (typings.length !== 1 || !typings.find((t) => t.is(bound))) {
            accept("error", message, { ...info, element: node });
            return false;
        }

        return true;
    }
}
