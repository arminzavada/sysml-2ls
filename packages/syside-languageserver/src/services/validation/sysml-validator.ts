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

import { stream } from "langium";
import * as ast from "#generated/ast.js";
import {
    AcceptActionUsageMeta,
    ActionUsageMeta,
    ActorMembershipMeta,
    AllocationUsageMeta,
    AnalysisCaseUsageMeta,
    AssertConstraintUsageMeta,
    AssignmentActionUsageMeta,
    AssociationStructMeta,
    AttributeUsageMeta,
    BasicMetamodel,
    CalculationUsageMeta,
    CaseDefinitionMeta,
    CaseUsageMeta,
    ClassMeta,
    ConjugatedPortDefinitionMeta,
    ConnectionUsageMeta,
    ConstraintUsageMeta,
    ControlNodeMeta,
    DataTypeMeta,
    DefinitionMeta,
    ElementMeta,
    EnumerationUsageMeta,
    EventOccurrenceUsageMeta,
    ExhibitStateUsageMeta,
    ExposeMeta,
    ExpressionMeta,
    FeatureMeta,
    FlowDefinitionMeta,
    FlowUsageMeta,
    IncludeUseCaseUsageMeta,
    InteractionMeta,
    InterfaceDefinitionMeta,
    InterfaceUsageMeta,
    ItemUsageMeta,
    MetadataUsageMeta,
    OPERATORS,
    ObjectiveMembershipMeta,
    OccurrenceDefinitionMeta,
    OccurrenceUsageMeta,
    OperatorExpressionMeta,
    ParameterMembershipMeta,
    PartUsageMeta,
    PerformActionUsageMeta,
    PortDefinitionMeta,
    PortUsageMeta,
    ReferenceSubsettingMeta,
    RenderingUsageMeta,
    RequirementConstraintMembershipMeta,
    RequirementDefinitionMeta,
    RequirementUsageMeta,
    RequirementVerificationMembershipMeta,
    SatisfyRequirementUsageMeta,
    SendActionUsageMeta,
    StakeholderMembershipMeta,
    StateDefinitionMeta,
    StateSubactionMembershipMeta,
    StateUsageMeta,
    SubjectMembershipMeta,
    SuccessionAsUsageMeta,
    TransitionFeatureMembershipMeta,
    TransitionUsageMeta,
    TriggerInvocationExpressionMeta,
    TypeMeta,
    UsageMeta,
    UseCaseUsageMeta,
    VariantMembershipMeta,
    VerificationCaseUsageMeta,
    ViewDefinitionMeta,
    ViewRenderingMembershipMeta,
    ViewUsageMeta,
    ViewpointUsageMeta,
} from "../../model/index.js";
import { KeysMatching } from "../../utils/index.js";
import { SubtypeKeys, SysMLType } from "../sysml-ast-reflection.js";
import { KerMLValidator } from "./kerml-validator.js";
import {
    ModelDiagnosticInfo,
    ModelValidationAcceptor,
    validateSysML,
} from "./validation-registry.js";

/**
 * Implementation of custom validations.
 */
export class SysMLValidator extends KerMLValidator {
    // validateDefinitionNonVariationMembership - duplicate with validateVariantMembershipOwningNamespace

    protected isVariation(node: ElementMeta): boolean {
        return node.isAny(ast.Usage.$type, ast.Definition.$type) ? node.isVariation : false;
    }

    @validateSysML(ast.Definition.$type)
    @validateSysML(ast.Usage.$type)
    validateVariationMembership(
        node: DefinitionMeta | UsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.isVariation) {
            const [type, code] = node.is(ast.Usage.$type)
                ? [ast.Usage.$type, "validateUsageVariationMembership"]
                : [ast.Definition.$type, "validateDefinitionVariationMembership"];
            this.apply(
                "error",
                node
                    .ownedElements()
                    .filter(BasicMetamodel.is(ast.FeatureMembership.$type))
                    .filter(
                        (m) =>
                            !m.isAny(ast.ParameterMembership.$type, ast.ObjectiveMembership.$type)
                    ),
                `All ownedMemberships of variation ${type} must be VariantMemberships.`,
                accept,
                { code }
            );
        }
    }

    @validateSysML(ast.Definition.$type)
    @validateSysML(ast.Usage.$type)
    validateVariationSpecialization(
        node: DefinitionMeta | UsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.isVariation) {
            const [type, code, sup] = node.is(ast.Usage.$type)
                ? [ast.Usage.$type, "validateUsageVariationSpecialization", "Definition or Usage"]
                : [
                      ast.Definition.$type,
                      "validateDefinitionVariationSpecialization",
                      ast.Definition.$type,
                  ];
            this.apply(
                "error",
                node.specializations().filter((s) => {
                    const target = s.element();
                    return target && this.isVariation(target);
                }),
                `A variation ${type} may not specialize any other variation ${sup}.`,
                accept,
                { code }
            );
        }
    }

    // validateUsageNonVariationMembership - duplicate with validateVariantMembershipOwningNamespace

    @validateSysML(ast.Usage.$type)
    validateUsageIsReferential(node: UsageMeta, accept: ModelValidationAcceptor): void {
        /* istanbul ignore next (isReference and isComposite are derived getters
        that the metamodel keeps mutually exclusive; fires only on programmatic
        AST corruption) */
        if (node.isReference && node.isComposite) {
            accept("error", "A Usage cannot be both isReference and isComposite.", {
                element: node,
                code: "validateUsageIsReferential",
            });
        }
    }

    /* istanbul ignore next (ReferenceUsageMeta forces isComposite=false) */
    @validateSysML(ast.ReferenceUsage.$type)
    validateReferenceUsageIsReferential(node: UsageMeta, accept: ModelValidationAcceptor): void {
        if (!node.isReference) {
            accept("error", "A ReferenceUsage must have isReference = true.", {
                element: node,
                code: "validateReferenceUsageIsReferential",
            });
        }
    }

    @validateSysML(ast.Usage.$type)
    validateUsageOwningType(node: UsageMeta, accept: ModelValidationAcceptor): void {
        const owningType = node.owningType;
        if (!owningType) return;
        // KerML Features can transparently own Usages. Examples: synthetic
        // ItemFlowEnd ends on a FlowUsage; Expression bodies acting as lambdas
        // (`->collect { in x; ... }`) owning `in x` parameters; nested
        // InvocationExpressions in FeatureValues. Walk up via owner() — which
        // skips Memberships and OwningMemberships (including FeatureValue) —
        // until we reach a SysML Definition/Usage (valid) or a non-Feature
        // owner (invalid). Spec: SysML 2026-03 §8.3.6.4.
        let current: ElementMeta | undefined = owningType;
        while (
            current &&
            current.is(ast.Feature.$type) &&
            !current.isAny(ast.Definition.$type, ast.Usage.$type)
        ) {
            current = current.owner();
        }
        if (!current || !current.isAny(ast.Definition.$type, ast.Usage.$type)) {
            accept("error", "The owningType of a Usage must be a Definition or a Usage.", {
                element: node,
                code: "validateUsageOwningType",
            });
        }
    }

    @validateSysML(ast.VariantMembership.$type)
    validateVariantMembershipOwningNamespace(
        node: VariantMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.parent();
        if (!owner || !this.isVariation(owner)) {
            accept(
                "error",
                "The membershipOwningNamespace of a VariantMembership must be a variation-point Definition or Usage.",
                {
                    element: node,
                    keyword: "variant",
                    code: "validateVariantMembershipOwningNamespace",
                }
            );
        }
    }

    // TODO: validateAttributeUsageFeatures - seems to be blocked by KERML-4
    // TODO: validateAttributeDefinitionFeatures - seems to be blocked by KERML-4

    /* istanbul ignore next (AttributeUsageMeta forces isComposite=false) */
    @validateSysML(ast.AttributeUsage.$type)
    validateAttributeUsageIsReferential(
        node: AttributeUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.isReference) {
            accept("error", "An AttributeUsage must have isReference = true.", {
                element: node,
                code: "validateAttributeUsageIsReferential",
            });
        }
    }

    @validateSysML(ast.AttributeUsage.$type)
    validateAttributeUsageTyping(node: AttributeUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.DataType.$type,
            accept,
            "An AttributeUsage must be typed by DataTypes only.",
            { code: "validateAttributeUsageTyping" }
        );
    }

    /* istanbul ignore next (EnumerationDefinitionMeta forces isVariation=true) */
    @validateSysML(ast.EnumerationDefinition.$type)
    validateEnumerationDefinitionIsVariation(
        node: DefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.isVariation) {
            accept("error", "An EnumerationDefinition must have isVariation = true.", {
                element: node,
                code: "validateEnumerationDefinitionIsVariation",
            });
        }
    }

    @validateSysML(ast.EnumerationUsage.$type)
    validateEnumerationUsageTyping(
        node: EnumerationUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        // not in spec but, only in pilot
        this.validateExactlyOneTyping(
            node,
            ast.EnumerationDefinition.$type,
            accept,
            "An EnumerationUsage must be typed by exactly one EnumerationDefinition.",
            { code: "validateEnumerationUsageTyping" }
        );
    }

    /* istanbul ignore next (EventOccurrenceUsageMeta forces isComposite=false) */
    @validateSysML(ast.EventOccurrenceUsage.$type)
    validateEventOccurrenceUsageIsReference(
        node: EventOccurrenceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.isReference) {
            accept("error", "An EventOccurrenceUsage must have isReference = true.", {
                element: node,
                code: "validateEventOccurrenceUsageIsReference",
            });
        }
    }

    @validateSysML(ast.EventOccurrenceUsage.$type)
    validateEventOccurrenceUsageReference(
        node: EventOccurrenceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.EventOccurrenceUsage.$type,
            reference: ast.OccurrenceUsage.$type,
            info: { code: "validateEventOccurrenceUsageReference" },
        });
    }

    // validateLifeClassIsSufficient - implicitly ensured by the model

    @validateSysML(ast.OccurrenceDefinition.$type)
    validateOccurrenceDefinitionLifeClass(
        node: OccurrenceDefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const members = node.children
            .filter(BasicMetamodel.is(ast.OwningMembership.$type))
            .filter((m) => m.element().nodeType() === ast.LifeClass.$type);
        if (node.lifeClass) members.push(node.lifeClass);

        if (node.isIndividual) {
            if (members.length !== 1) {
                this.apply(
                    "error",
                    members,
                    "Individual OccurrenceDefinitions must have exactly one LifeClass ownedMember",
                    accept,
                    { code: "validateOccurrenceDefinitionLifeClass" }
                );
            }
        } else if (members.length > 0) {
            this.apply(
                "error",
                members,
                "Non-individual OccurrenceDefinitions must have node LifeClass ownedMember",
                accept,
                { code: "validateOccurrenceDefinitionLifeClass" }
            );
        }
    }

    @validateSysML(ast.OccurrenceUsage.$type, [
        ast.ItemUsage.$type,
        ast.PortUsage.$type,
        ast.Step.$type,
    ])
    validateOccurrenceUsageTyping(
        node: OccurrenceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateAllTypings(
            node,
            ast.Class.$type,
            accept,
            "OccurrenceDefinition must be typed by Classes only.",
            { code: "validateOccurrenceUsageTyping" }
        );
    }

    @validateSysML(ast.OccurrenceUsage.$type)
    validateOccurrenceUsageIndividual(
        node: OccurrenceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const types = node
            .allTypings()
            .filter(BasicMetamodel.is(ast.OccurrenceDefinition.$type))
            .filter((t) => t.isIndividual);

        if (types.length > 1) {
            accept(
                "error",
                "An OccurrenceUsage must have at most one occurrenceDefinition with isIndividual = true.",
                { element: node, code: "validateOccurrenceUsageIndividualDefinition" }
            );
        } else if (node.isIndividual && types.length !== 1) {
            accept("error", "An individual OccurrenceUsage must an individualDefinition.", {
                element: node,
                code: "validateOccurrenceUsageIndividualUsage",
            });
        }
    }

    @validateSysML(ast.ItemUsage.$type, [
        ast.PartUsage.$type,
        ast.PortUsage.$type,
        ast.MetadataUsage.$type,
    ])
    validateItemUsageTyping(node: ItemUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.Structure.$type,
            accept,
            "ItemUsage must be typed by Structures only.",
            { code: "validateItemUsageTyping" }
        );
    }

    @validateSysML(ast.PartUsage.$type, [ast.ConnectionUsage.$type])
    validatePartUsageTyping(node: PartUsageMeta, accept: ModelValidationAcceptor): void {
        if (
            this.validateAllTypings(
                node,
                ast.Structure.$type,
                accept,
                "PartUsage must be typed by Structures only",
                { code: "validatePartUsageTyping" }
            )
        ) {
            this.validateAtLeastTyping(
                node,
                ast.PartDefinition.$type,
                accept,
                "At least one of the itemDefinitions of a PartUsage must be a PartDefinition.",
                { code: "validatePartUsagePartDefinition" }
            );
        }
    }

    // validateConjugatedPortDefinitionConjugatedPortDefinitionIsEmpty - implicitly ensured by the model

    // this will usually be satisfied implictly by the model
    @validateSysML(ast.ConjugatedPortDefinition.$type)
    validateConjugatedPortDefinitionOriginalPortDefinition(
        node: ConjugatedPortDefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (
            node.originalPortDefinition !==
            node.specializations(ast.PortConjugation.$type).at(0)?.element()
        ) {
            accept(
                "error",
                "The originalPortDefinition of the ownedPortConjugator of a ConjugatedPortDefinition must be the originalPortDefinition of the ConjugatedPortDefinition.",
                { element: node, code: "validateConjugatedPortDefinitionOriginalPortDefinition" }
            );
        }
    }

    // this will be satisfied by the grammar but not when creating through code
    @validateSysML(ast.PortDefinition.$type, [ast.ConjugatedPortDefinition.$type])
    validatePortDefinitionConjugatedPortDefinition(
        node: PortDefinitionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const conjugates = node.children
            .filter(BasicMetamodel.is(ast.OwningMembership.$type))
            .filter((m) => m.element().is(ast.ConjugatedPortDefinition.$type));
        if (node.conjugatedDefinition) conjugates.push(node.conjugatedDefinition);
        if (conjugates.length !== 1) {
            this.apply(
                "error",
                conjugates,
                "A PortDefinition must have exactly one ownedMember that is a ConjugatedPortDefinition.",
                accept,
                { code: "validatePortDefinitionConjugatedPortDefinition" }
            );
        }
    }

    @validateSysML(ast.PortDefinition.$type)
    @validateSysML(ast.PortUsage.$type)
    validatePortOwnedUsagesNotComposite(
        node: PortDefinitionMeta | PortUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const usages = node
            .ownedFeatures()
            .filter(BasicMetamodel.is(ast.Usage.$type))
            .filter((u) => !u.is(ast.PortUsage.$type) && u.isComposite);

        const [type, member, code] = node.is(ast.PortDefinition.$type)
            ? [
                  ast.PortDefinition.$type,
                  "ownedUsages",
                  "validatePortDefinitionOwnedUsagesNotComposite",
              ]
            : [ast.PortUsage.$type, "nestedUsages", "validatePortUsageNestedUsagesNotComposite"];
        this.apply(
            "error",
            usages,
            `The ${member} of a ${type} that are not PortUsages must not be composite.`,
            accept,
            { code }
        );
    }

    @validateSysML(ast.PortUsage.$type)
    validatePortUsageTyping(node: PortUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.PortDefinition.$type,
            accept,
            "PortUsages must be typed by PortDefinitions only.",
            { code: "validatePortUsageTyping" }
        );
    }

    @validateSysML(ast.PortUsage.$type)
    validatePortUsageIsReference(node: PortUsageMeta, accept: ModelValidationAcceptor): void {
        // A PortUsage that is not a subport (i.e. not owned by a PortDefinition
        // or PortUsage) must have isReference = true.
        const owner = node.owningType;
        const isSubport = owner?.isAny(ast.PortDefinition.$type, ast.PortUsage.$type);
        if (!isSubport && !node.isReference) {
            accept("error", "A PortUsage that is not a subport must have isReference = true.", {
                element: node,
                code: "validatePortUsageIsReference",
            });
        }
    }

    @validateSysML(ast.ConnectionUsage.$type, [
        ast.FlowUsage.$type,
        ast.InterfaceUsage.$type,
        ast.AllocationUsage.$type,
    ])
    validateConnectionUsageTyping(
        node: ConnectionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateAllTypings(
            node,
            ast.Association.$type,
            accept,
            "ConnectionUsages must be typed by Associations only.",
            { code: "validateConnectionUsageTyping" }
        );
    }

    @validateSysML(ast.FlowDefinition.$type)
    validateFlowEnd(node: FlowDefinitionMeta, accept: ModelValidationAcceptor): void {
        const ends = node.ownedEnds();
        if (ends.length <= 2) return;
        this.apply("error", ends, "FlowDefinition can have at most 2 ends.", accept, {
            code: "validateFlowEnd",
        });
    }

    @validateSysML(ast.FlowUsage.$type)
    validateFlowUsageTyping(node: FlowUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.Interaction.$type,
            accept,
            "FlowUsages must be typed by Interactions only.",
            { code: "validateFlowUsageTyping" }
        );
    }

    @validateSysML(ast.InterfaceDefinition.$type)
    @validateSysML(ast.InterfaceUsage.$type)
    validateInterfaceEnds(
        node: InterfaceDefinitionMeta | InterfaceUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.InterfaceDefinition.$type)
            ? [ast.InterfaceDefinition.$type, "validateInterfaceDefinitionEnd"]
            : [ast.InterfaceUsage.$type, "validateInterfaceUsageEnd"];
        this.apply(
            "error",
            node.ownedEnds().filter((f) => !f.is(ast.PortUsage.$type)),
            `An ${type} end must be a port.`,
            accept,
            { code }
        );
    }

    @validateSysML(ast.InterfaceUsage.$type)
    validateInterfaceUsageTyping(node: InterfaceUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.InterfaceDefinition.$type,
            accept,
            "InterfaceUsages must be typed by InterfaceDefinitions only.",
            { code: "validateInterfaceUsageTyping" }
        );
    }

    @validateSysML(ast.AllocationUsage.$type)
    validateAllocationUsageTyping(
        node: AllocationUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateAllTypings(
            node,
            ast.AllocationDefinition.$type,
            accept,
            "AllocationUsages must be typed by AllocationDefinitions only.",
            { code: "validateAllocationUsageTyping" }
        );
    }

    @validateSysML(ast.AcceptActionUsage.$type)
    validateAcceptActionUsageParameters(
        node: AcceptActionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkParameters(node, ["payload", "receiver"], accept, {
            type: ast.AcceptActionUsage.$type,
            info: { code: "validateAcceptActionUsageParameters" },
        });
    }

    @validateSysML(ast.ActionUsage.$type, [
        ast.StateUsage.$type,
        ast.CalculationUsage.$type,
        ast.FlowUsage.$type,
    ])
    validateActionUsageTyping(node: ActionUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.Behavior.$type,
            accept,
            "ActionUsages must be typed by Behaviors only.",
            { code: "validateActionUsageTyping" }
        );
    }

    @validateSysML(ast.AssignmentActionUsage.$type)
    validateAssignmentActionUsageReferent(
        node: AssignmentActionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.targetMember) {
            accept("error", `An assignment must have a Feature referent.`, {
                element: node,
                code: "validateAssignmentActionUsageReferent",
            });
        }
    }

    @validateSysML(ast.TriggerInvocationExpression.$type)
    validateTriggerInvocationExpression(
        node: TriggerInvocationExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        const arg = node.args.at(0);

        switch (node.kind) {
            case "at":
                if (!arg || !this.isTime(arg)) {
                    accept("error", "An at expression must be a TimeInstantValue.", {
                        element: node,
                        code: "validateTriggerInvocationActionAtArgument",
                    });
                }
                break;
            case "when":
                if (!arg || !this.isBooleanExpression(arg)) {
                    accept("error", "A when expression must be Boolean.", {
                        element: node,
                        code: "validateTriggerInvocationActionWhenArgument",
                    });
                }
                break;
            case "after":
                if (!arg || !this.isDuration(arg)) {
                    accept("error", "An after expression must be a DurationValue.", {
                        element: node,
                        code: "validateTriggerInvocationActionAfterArgument",
                    });
                }
                break;
        }
    }

    protected isTime(expr: ExpressionMeta): boolean {
        const result = this.expressionResult(expr);

        if (result && this.index.conforms(result, "Time::TimeInstantValue")) return true;
        return (
            expr.is(ast.OperatorExpression.$type) &&
            SysMLValidator.IntegerOperators.includes(expr.operator) &&
            expr.args.every((arg) => this.isTime(arg) || this.isDuration(arg))
        );
    }

    protected isDuration(expr: ExpressionMeta): boolean {
        if (this.isDurationExpression(expr)) {
            return true;
        }

        const result = this.expressionResult(expr);

        if (result && this.index.conforms(result, "ISQBase::DurationValue")) return true;
        return (
            expr.is(ast.OperatorExpression.$type) &&
            SysMLValidator.IntegerOperators.includes(expr.operator) &&
            expr.args.every((arg) => this.isTime(arg) || this.isDuration(arg))
        );
    }

    protected isDurationExpression(expr: ExpressionMeta): boolean {
        if (!expr.is(ast.OperatorExpression.$type) || expr.operator != OPERATORS.QUANTITY) {
            return false;
        }

        const arg = expr.args.at(1);
        if (!arg) {
            return false;
        }

        const result = this.expressionResult(arg);
        return Boolean(result && this.index.conforms(result, "ISQBase::DurationUnit"));
    }

    // TODO: validateControlNodeIncomingSuccessions (not in pilot)
    // TODO: validateControlNodeOutgoingSuccessions (not in pilot)

    @validateSysML(ast.ControlNode.$type)
    validateControlNodeOwningType(node: ControlNodeMeta, accept: ModelValidationAcceptor): void {
        if (!node.owningType?.isAny(ast.ActionDefinition.$type, ast.ActionUsage.$type)) {
            accept(
                "error",
                "The owningType of a ControlNode must be an ActionDefinition or ActionUsage.",
                { element: node, code: "validateControlNodeOwningType" }
            );
        }
    }

    // TODO: validateDecisionNodeIncomingSuccessions (not in pilot)
    // TODO: validateDecisionNodeOutgoingSuccessions (not in pilot)
    // TODO: validateForkNodeIncomingSuccessions (not in pilot)
    // TODO: validateJoinNodeOutgoingSuccessions (not in pilot)
    // TODO: validateMergeNodeIncomingSuccessions (not in pilot)
    // TODO: validateMergeNodeOutgoingSuccessions (not in pilot)

    @validateSysML(ast.PerformActionUsage.$type, [
        ast.ExhibitStateUsage.$type,
        ast.IncludeUseCaseUsage.$type,
    ])
    validatePerformActionUsageReference(
        node: PerformActionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.PerformActionUsage.$type,
            reference: ast.ActionUsage.$type,
            info: { code: "validatePerformActionUsageReference" },
        });
    }

    @validateSysML(ast.SendActionUsage.$type)
    validateSendActionParameters(node: SendActionUsageMeta, accept: ModelValidationAcceptor): void {
        this.checkParameters(node, ["payload", "sender", "receiver"], accept, {
            type: ast.SendActionUsage.$type,
            info: { code: "validateSendActionParameters" },
        });
    }

    @validateSysML(ast.SendActionUsage.$type)
    validateSendActionReceiver(node: SendActionUsageMeta, accept: ModelValidationAcceptor): void {
        const receiver = node.receiver?.element()?.value?.element();
        if (
            (receiver?.is(ast.FeatureReferenceExpression.$type) &&
                receiver.expression?.element()?.is(ast.PortUsage.$type)) ||
            (receiver?.is(ast.FeatureChainExpression.$type) &&
                receiver.featureMembers()[0].element()?.basicFeature().is(ast.PortUsage.$type))
        ) {
            accept("warning", "Sending to a port should be done through 'via' instead of 'to'", {
                element: node.receiver,
                code: "validateSendActionReceiver",
            });
        }
    }

    // we use explicit members for each of the features/parameters so checking
    // would only be needed for incomplete elements, e.g. programmatic creation:

    // validateForLoopActionUsageLoopVariable;
    // validateForLoopActionUsageParameters;
    // validateIfActionUsageParameters;
    // validateWhileLoopActionUsageParameters;

    @validateSysML(ast.ExhibitStateUsage.$type)
    validateExhibitStateUsageReference(
        node: ExhibitStateUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.ExhibitStateUsage.$type,
            reference: ast.StateUsage.$type,
            info: { code: "validateExhibitStateUsageReference" },
        });
    }

    @validateSysML(ast.StateSubactionMembership.$type)
    validateStateSubactionMembershipOwningType(
        node: StateSubactionMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.isAny(ast.StateDefinition.$type, ast.StateUsage.$type)) {
            accept(
                "error",
                "The owningType of a StateSubactionMembership must be a StateDefinition or a StateUsage.",
                { element: node, code: "validateStateSubactionMembershipOwningType" }
            );
        }
    }

    @validateSysML(ast.SuccessionAsUsage.$type)
    @validateSysML(ast.TransitionUsage.$type)
    validateStateParallelSubactions(
        node: SuccessionAsUsageMeta | TransitionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const owner = node.owningType;
        if (owner?.isAny(ast.StateDefinition.$type, ast.StateUsage.$type) && owner.isParallel) {
            const [type, member, code] = owner.is(ast.StateDefinition.$type)
                ? [
                      ast.StateDefinition.$type,
                      "ownedActions",
                      "validateStateDefinitionParallelSubactions",
                  ]
                : [ast.StateUsage.$type, "nestedActions", "validateStateUsageParallelSubactions"];
            accept(
                "error",
                `Parallel ${type} ${member} must not have any incomingTransitions or outgoingTransitions.`,
                { element: node, code }
            );
        }
    }

    @validateSysML(ast.StateDefinition.$type)
    @validateSysML(ast.StateUsage.$type)
    validateStateSubactionKind(
        node: StateDefinitionMeta | StateUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const subactions = node
            .featureMembers()
            .filter(BasicMetamodel.is(ast.StateSubactionMembership.$type));

        const [type, code] = node.is(ast.StateDefinition.$type)
            ? [ast.StateDefinition.$type, "validateStateDefinitionStateSubactionKind"]
            : [ast.StateUsage.$type, "validateStateUsageStateSubactionKind"];
        for (const kind of ["do", "entry", "exit"])
            this.atMostOne(
                "error",
                subactions.filter((m) => m.kind === kind),
                accept,
                `A ${type} must not have more than one owned StateSubactionMembership of kind ${kind}.`,
                { code }
            );
    }

    @validateSysML(ast.StateUsage.$type)
    validateStateUsageTyping(node: StateUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateAllTypings(
            node,
            ast.Behavior.$type,
            accept,
            "StateUsages must be typed by Behaviors only.",
            { code: "validateStateUsageTyping" }
        );
    }

    // implicitly ensured by the type system for the most part
    @validateSysML(ast.TransitionFeatureMembership.$type)
    validateTransitionFeatureMembership(
        node: TransitionFeatureMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        const target = node.element();
        if (!target) return;

        switch (node.kind) {
            case "effect": {
                if (!target.is(ast.ActionUsage.$type))
                    accept("error", "TransitionFeature of kind effect must be an ActionUsage.", {
                        element: target,
                        code: "validateTransitionFeatureMembershipEffectAction",
                    });
                return;
            }

            case "guard": {
                if (!target.is(ast.Expression.$type) || !this.isBoolean(target))
                    accept(
                        "error",
                        "TransitionFeature of kind guard must be a boolean expression.",
                        {
                            element: target,
                            code: "validateTransitionFeatureMembershipGuardExpression",
                        }
                    );
                return;
            }

            case "trigger": {
                if (!target.is(ast.AcceptActionUsage.$type))
                    accept(
                        "error",
                        "TransitionFeature of kind trigger must be an AcceptActionUsage.",
                        {
                            element: target,
                            code: "validateTransitionFeatureMembershipTriggerAction",
                        }
                    );
                return;
            }
        }
    }

    @validateSysML(ast.TransitionFeatureMembership.$type)
    validateTransitionFeatureMembershipOwningType(
        node: TransitionFeatureMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.is(ast.TransitionUsage.$type))
            accept(
                "error",
                "The owningType of a TransitionFeatureMembership must be a TransitionUsage.",
                { element: node, code: "validateTransitionFeatureMembershipOwningType" }
            );
    }

    /* istanbul ignore next */ // here for parity with pilot
    @validateSysML(ast.TransitionUsage.$type)
    validateTransitionUsageParameters(
        node: TransitionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        // should be ensured by the type system but TS makes it easy to steal
        // other references
        if (!node.transitionLinkSource)
            accept("error", "A TransitionUsage must have a transitionLinkSource.", {
                element: node,
                code: "validateTransitionUsageParameters",
            });

        if (node.accepter && !node.payload) {
            accept("error", "A TransitionUsage with a triggerAction must have a payload.", {
                element: node,
                code: "validateTransitionUsageParameters",
            });
        }
    }

    @validateSysML(ast.TransitionUsage.$type)
    validateTransitionUsageSuccession(
        node: TransitionUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const succession = stream([node.then, node.else], node.children)
            .filter(BasicMetamodel.is(ast.OwningMembership.$type))
            .map((m) => m.element())
            .filter(BasicMetamodel.is(ast.SuccessionAsUsage.$type))
            .head();

        if (
            !succession
                ?.relatedFeatures()
                .slice(1)
                .every((f) => f?.basicFeature().is(ast.ActionUsage.$type))
        ) {
            accept(
                "error",
                "A TransitionUsage must have an ownedMember that is a Succession with an ActionUsage as its targetFeature.",
                { element: succession ?? node, code: "validateTransitionUsageSuccession" }
            );
        }
    }

    @validateSysML(ast.CalculationUsage.$type, [ast.CaseUsage.$type])
    validateCalculationUsageTyping(
        node: CalculationUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.SysMLFunction.$type,
            accept,
            "CalculationUsages must be typed by exactly one Function.",
            { code: "validateCalculationUsageTyping" }
        );
    }

    @validateSysML(ast.AssertConstraintUsage.$type)
    validateAssertConstraintUsageReference(
        node: AssertConstraintUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.AssertConstraintUsage.$type,
            reference: ast.ConstraintUsage.$type,
            info: { code: "validateAssertConstraintUsageReference" },
        });
    }

    @validateSysML(ast.ConstraintUsage.$type, [ast.RequirementUsage.$type])
    validateConstraintUsageTyping(
        node: ConstraintUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.Predicate.$type,
            accept,
            "ConstraintUsages must be typed by exactly one Predicate.",
            { code: "validateConstraintUsageTyping" }
        );
    }

    @validateSysML(ast.SubjectMembership.$type)
    validateSubjectMembershipOwningType(
        node: SubjectMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (
            !node
                .owner()
                ?.isAny(
                    ast.RequirementUsage.$type,
                    ast.RequirementDefinition.$type,
                    ast.CaseDefinition.$type,
                    ast.CaseUsage.$type
                )
        )
            accept(
                "error",
                `The owningType of SubjectMembership must be a RequirementDefinition, RequirementUsage, CaseDefinition, or CaseUsage.`,
                { element: node, code: `validateSubjectMembershipOwningType` }
            );
    }

    @validateSysML(ast.ActorMembership.$type)
    validateActorMembershipOwningType(
        node: ActorMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (
            !node
                .owner()
                ?.isAny(
                    ast.RequirementUsage.$type,
                    ast.RequirementDefinition.$type,
                    ast.CaseDefinition.$type,
                    ast.CaseUsage.$type
                )
        )
            accept(
                "error",
                `The owningType of ActorMembership must be a RequirementDefinition, RequirementUsage, CaseDefinition, or CaseUsage.`,
                { element: node, code: `validateActorMembershipOwningType` }
            );
    }

    // validateFramedConcernUsageConstraintKind - implicitly ensured by the model

    @validateSysML(ast.RequirementConstraintMembership.$type)
    validateRequirementConstraintMembershipIsComposite(
        node: RequirementConstraintMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.element()?.isComposite)
            accept(
                "error",
                "The ownedConstraint of a RequirementConstraintMembership must be composite.",
                { element: node, code: "validateRequirementConstraintMembershipIsComposite" }
            );
    }

    @validateSysML(ast.RequirementConstraintMembership.$type)
    @validateSysML(ast.StakeholderMembership.$type)
    validateRequirementMembershipOwningType(
        node: RequirementConstraintMembershipMeta | StakeholderMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.isAny(ast.RequirementUsage.$type, ast.RequirementDefinition.$type))
            accept(
                "error",
                `The owningType of an ${node.nodeType()} must be a RequirementDefinition or RequirementUsage.`,
                { element: node, code: `validate${node.nodeType()}OwningType` }
            );
    }

    @validateSysML(ast.RequirementDefinition.$type)
    @validateSysML(ast.RequirementUsage.$type)
    validateRequirementOnlyOneSubject(
        node: RequirementDefinitionMeta | RequirementUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.RequirementDefinition.$type)
            ? [ast.RequirementDefinition.$type, "validateRequirementDefinitionOnlyOneSubject"]
            : [ast.RequirementUsage.$type, "validateRequirementUsageOnlyOneSubject"];
        this.atMostOneMember(
            node,
            ast.SubjectMembership.$type,
            accept,
            `A ${type} must have at most one featureMembership that is a SubjectMembership.`,
            { code }
        );
    }

    @validateSysML(ast.RequirementDefinition.$type)
    @validateSysML(ast.RequirementUsage.$type)
    validateRequirementSubjectParameterPosition(
        node: RequirementDefinitionMeta | RequirementUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.RequirementDefinition.$type)
            ? [
                  ast.RequirementDefinition.$type,
                  "validateRequirementDefinitionSubjectParameterPosition",
              ]
            : [ast.RequirementUsage.$type, "validateRequirementUsageSubjectParameterPosition"];

        this.checkFirstInput(
            node,
            node.featuresByMembership(ast.SubjectMembership.$type).head(),
            accept,
            `The subjectParameter of a ${type} must be its first input.`,
            { code }
        );
    }

    @validateSysML(ast.RequirementUsage.$type, [ast.ViewpointUsage.$type])
    validateRequirementUsageTyping(
        node: RequirementUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.RequirementDefinition.$type,
            accept,
            "RequirementUsages must be typed by exactly one RequirementDefinition.",
            { code: "validateRequirementUsageTyping" }
        );
    }

    @validateSysML(ast.SatisfyRequirementUsage.$type)
    validateSatisfyRequirementUsageReference(
        node: SatisfyRequirementUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.SatisfyRequirementUsage.$type,
            reference: ast.RequirementUsage.$type,
            info: { code: "validateSatisfyRequirementUsageReference" },
        });
    }

    @validateSysML(ast.CaseDefinition.$type)
    @validateSysML(ast.CaseUsage.$type)
    validateCaseDefinitionOnlyOneSubject(
        node: CaseDefinitionMeta | CaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.CaseDefinition.$type)
            ? [ast.CaseDefinition.$type, "validateCaseDefinitionOnlyOneSubject"]
            : [ast.CaseUsage.$type, "validateCaseUsageOnlyOneSubject"];
        this.atMostOneMember(
            node,
            ast.SubjectMembership.$type,
            accept,
            `A ${type} must have at most one featureMembership that is a SubjectMembership.`,
            { code }
        );
    }

    @validateSysML(ast.CaseDefinition.$type)
    @validateSysML(ast.CaseUsage.$type)
    validateCaseOnlyOneObjective(
        node: CaseDefinitionMeta | CaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.CaseDefinition.$type)
            ? [ast.CaseDefinition.$type, "validateCaseDefinitionOnlyOneObjective"]
            : [ast.CaseUsage.$type, "validateCaseUsageOnlyOneObjective"];
        this.atMostOneMember(
            node,
            ast.ObjectiveMembership.$type,
            accept,
            `A ${type} must have at most one featureMembership that is a ObjectiveMembership.`,
            { code }
        );
    }

    @validateSysML(ast.CaseDefinition.$type)
    @validateSysML(ast.CaseUsage.$type)
    validateCaseSubjectParameterPosition(
        node: CaseDefinitionMeta | CaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.CaseDefinition.$type)
            ? [ast.CaseDefinition.$type, "validateCaseDefinitionSubjectParameterPosition"]
            : [ast.CaseUsage.$type, "validateCaseUsageSubjectParameterPosition"];

        this.checkFirstInput(
            node,
            node.featuresByMembership(ast.SubjectMembership.$type).head(),
            accept,
            `The subjectParameter of a ${type} must be its first input.`,
            { code }
        );
    }

    @validateSysML(ast.CaseUsage.$type, [
        ast.AnalysisCaseUsage.$type,
        ast.VerificationCaseUsage.$type,
        ast.UseCaseUsage.$type,
    ])
    validateCaseUsageTyping(node: CaseUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.CaseDefinition.$type,
            accept,
            "CaseUsages must be typed by exactly one CaseDefinition.",
            { code: "validateCaseUsageTyping" }
        );
    }

    @validateSysML(ast.ObjectiveMembership.$type)
    validateObjectiveMembershipIsComposite(
        node: ObjectiveMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.element()?.isComposite)
            accept("error", "The ownedConstraint of a ObjectiveMembership must be composite.", {
                element: node,
                code: "validateObjectiveMembershipIsComposite",
            });
    }

    @validateSysML(ast.ObjectiveMembership.$type)
    validateObjectiveMembershipOwningType(
        node: ObjectiveMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.isAny(ast.CaseUsage.$type, ast.CaseDefinition.$type))
            accept(
                "error",
                `The owningType of an ObjectiveMembership must be a CaseDefinition or CaseUsage.`,
                { element: node, code: `validateObjectiveMembershipOwningType` }
            );
    }

    @validateSysML(ast.AnalysisCaseUsage.$type)
    validateAnalysisCaseUsageTyping(
        node: AnalysisCaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.AnalysisCaseDefinition.$type,
            accept,
            "AnalysisCaseUsages must be typed by exactly one AnalysisCaseDefinition",
            { code: "validateAnalysisCaseUsageTyping" }
        );
    }

    // validateRequirementVerificationMembershipKind - implicitly ensured by the model

    @validateSysML(ast.RequirementVerificationMembership.$type)
    validateRequirementVerificationMembershipOwningType(
        node: RequirementVerificationMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.isLegalVerification())
            accept(
                "error",
                "The owningType of a RequirementVerificationMembership must be a RequirementUsage that is owned by an ObjectiveMembership.",
                { element: node, code: "validateRequirementVerificationMembershipOwningType" }
            );
    }

    @validateSysML(ast.VerificationCaseUsage.$type)
    validateVerificationCaseUsageTyping(
        node: VerificationCaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.validateExactlyOneTyping(
            node,
            ast.VerificationCaseDefinition.$type,
            accept,
            "VerificationCaseUsages must be typed by exactly one VerificationCaseDefinition.",
            { code: "validateVerificationCaseUsageTyping" }
        );
    }

    @validateSysML(ast.IncludeUseCaseUsage.$type)
    validateIncludeUseCaseUsageReference(
        node: IncludeUseCaseUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.checkReferencing(node, accept, {
            type: ast.IncludeUseCaseUsage.$type,
            reference: ast.UseCaseUsage.$type,
            info: { code: "validateIncludeUseCaseUsageReference" },
        });
    }

    @validateSysML(ast.UseCaseUsage.$type)
    validateUseCaseUsageTyping(node: UseCaseUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.UseCaseDefinition.$type,
            accept,
            "UseCaseUsages must be typed by exactly one UseCaseDefinition.",
            { code: "validateUseCaseUsageTyping" }
        );
    }

    // validateExposeIsImportAll - implicitly ensured by the model

    @validateSysML(ast.Expose.$type)
    validateExposeNoExplicitVisibility(node: ExposeMeta, accept: ModelValidationAcceptor): void {
        if (node.hasExplicitVisibility) {
            accept("error", "An Expose cannot have an explicit visibility.", {
                element: node,
                code: "validateExposeNoExplicitVisibility",
            });
        }
    }

    @validateSysML(ast.Expose.$type)
    validateExposeOwningNamespace(node: ExposeMeta, accept: ModelValidationAcceptor): void {
        if (!node.owner()?.is(ast.ViewUsage.$type)) {
            accept("error", "The importOwningNamespace of an Expose must be a ViewUsage.", {
                element: node,
                code: "validateExposeOwningNamespace",
            });
        }
    }

    @validateSysML(ast.RenderingUsage.$type)
    validateRenderingUsageTyping(node: RenderingUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.RenderingDefinition.$type,
            accept,
            "RenderingUsages must be typed by exactly one RenderingDefinition.",
            { code: "validateRenderingUsageTyping" }
        );
    }

    @validateSysML(ast.ViewDefinition.$type)
    @validateSysML(ast.ViewUsage.$type)
    validateViewDefinitionOnlyOneViewRendering(
        node: ViewDefinitionMeta | ViewUsageMeta,
        accept: ModelValidationAcceptor
    ): void {
        const [type, code] = node.is(ast.ViewDefinition.$type)
            ? [ast.ViewDefinition.$type, "validateViewDefinitionOnlyOneViewRendering"]
            : [ast.ViewUsage.$type, "validateViewUsageOnlyOneViewRendering"];

        this.atMostOneMember(
            node,
            ast.ViewRenderingMembership.$type,
            accept,
            `A ${type} must have at most one ViewRenderingMembership.`,
            { code }
        );
    }

    @validateSysML(ast.ViewpointUsage.$type)
    validateViewpointUsageTyping(node: ViewpointUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.ViewpointDefinition.$type,
            accept,
            "ViewpointUsages must be typed by exactly one ViewpointDefinition.",
            { code: "validateViewpointUsageTyping" }
        );
    }

    @validateSysML(ast.ViewRenderingMembership.$type)
    validateViewRenderingMembershipOwningType(
        node: ViewRenderingMembershipMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (!node.owner()?.isAny(ast.ViewUsage.$type, ast.ViewDefinition.$type))
            accept(
                "error",
                `The owningType of an ViewRenderingMembership must be a CaseDefinition or CaseUsage.`,
                { element: node, code: `validateViewRenderingMembershipOwningType` }
            );
    }

    @validateSysML(ast.ViewUsage.$type)
    validateViewUsageTyping(node: ViewUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.ViewDefinition.$type,
            accept,
            "ViewUsages must be typed by exactly one ViewDefinition.",
            { code: "validateViewUsageTyping" }
        );
    }

    @validateSysML(ast.MetadataUsage.$type)
    validateMetadataUsageTyping(node: MetadataUsageMeta, accept: ModelValidationAcceptor): void {
        this.validateExactlyOneTyping(
            node,
            ast.Metaclass.$type,
            accept,
            "MetadataUsages must be typed by exactly one Metaclass.",
            { code: "validateMetadataUsageTyping" }
        );
    }

    @validateSysML(ast.DataType.$type)
    override validateDatatypeSpecialization(
        node: DataTypeMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization.$type)
                .filter((s) => s.element()?.isAny(ast.Class.$type, ast.Association.$type)),
            "An AttributeDefinition must not specialize a Class or an Association.",
            accept,
            { code: "validateDatatypeSpecialization", property: "targetRef" }
        );
    }

    @validateSysML(ast.Class.$type, [ast.AssociationStructure.$type, ast.Interaction.$type])
    override validateClassSpecialization(node: ClassMeta, accept: ModelValidationAcceptor): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization.$type)
                .filter((s) => s.element()?.isAny(ast.DataType.$type, ast.Association.$type)),
            "An ItemDefinition must not specialize a DataType or an Association.",
            accept,
            { code: "validateClassSpecialization", property: "targetRef" }
        );
    }

    @validateSysML(ast.AssociationStructure.$type)
    @validateSysML(ast.Interaction.$type)
    override validateAssocStructSpecialization(
        node: AssociationStructMeta | InteractionMeta,
        accept: ModelValidationAcceptor
    ): void {
        this.apply(
            "error",
            node
                .specializations(ast.Specialization.$type)
                .filter((s) => s.element()?.isAny(ast.DataType.$type)),
            "A ConnectionDefinition must not specialize a DataType.",
            accept,
            { code: "validateClassSpecialization", property: "targetRef" }
        );
    }

    @validateSysML(ast.OperatorExpression.$type, [
        ast.CollectExpression.$type,
        ast.SelectExpression.$type,
        ast.FeatureChainExpression.$type,
    ])
    validateOperatorExpressionQuantity(
        node: OperatorExpressionMeta,
        accept: ModelValidationAcceptor
    ): void {
        if (node.operator === OPERATORS.QUANTITY) {
            const arg = node.operands.at(1);
            /* istanbul ignore next */
            if (!arg) return;
            if (!this.resultConforms(arg, "MeasurementReferences::TensorMeasurementReference")) {
                accept(
                    "warning",
                    "Invalid quantity expression, expected a measurement reference unit",
                    {
                        element: node,
                        property: "operands",
                        index: 1,
                        code: "validateOperatorExpressionQuantity",
                    }
                );
            }
        }
    }

    protected resultConforms(expr: ExpressionMeta, type: string | TypeMeta): boolean {
        const result = expr.returnType();
        if (result && this.index.conforms(result, type)) return true;
        if (expr.is(ast.OperatorExpression.$type)) {
            if (!result) {
                const t = this.index.findType(result);
                if (t && !t.types().some((t) => this.index.conforms(type, t))) return false;
            }

            return expr.args
                .filter(BasicMetamodel.is(ast.Expression.$type))
                .some((arg) => this.resultConforms(arg, type));
        }

        return false;
    }

    protected validateAllTypings<T extends FeatureMeta>(
        node: T,
        bound: SysMLType,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): boolean {
        if (node.allTypings().some((t) => !t.is(bound))) {
            accept("error", message, { ...info, element: node });
            return false;
        }

        return true;
    }

    protected validateAtLeastTyping<T extends FeatureMeta>(
        node: T,
        bound: SysMLType,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<T>, "element">
    ): boolean {
        if (!node.allTypings().find((t) => t.is(bound))) {
            accept("error", message, { ...info, element: node });
            return false;
        }

        return true;
    }

    protected checkReferencing(
        node: FeatureMeta,
        accept: ModelValidationAcceptor,
        options: {
            type: SubtypeKeys<ast.Usage>;
            reference: SubtypeKeys<ast.Usage>;
            info?: Omit<ModelDiagnosticInfo<ReferenceSubsettingMeta>, "element">;
        }
    ): void {
        const ref = node.specializations(ast.ReferenceSubsetting.$type).at(0);
        const target = ref?.finalElement();
        if (ref && target && !target.is(options.reference)) {
            accept(
                "error",
                `ReferenceSubsettings owned by ${options.type} must reference ${options.reference}`,
                { ...options.info, element: ref }
            );
        }
    }

    protected checkParameters<
        T extends FeatureMeta,
        K extends string & KeysMatching<T, ParameterMembershipMeta | undefined>,
    >(
        node: T,
        keys: K[],
        accept: ModelValidationAcceptor,
        options: { type: SubtypeKeys<ast.Usage>; info?: Omit<ModelDiagnosticInfo<T>, "element"> }
    ): void {
        // not checking children since grammar doesn't allow parameter members
        // there, all parameter members (except return) have special slots that
        // should be used instead
        keys.forEach((key) => {
            if (!node[key])
                accept("error", `${options.type} must have ${key} parameter.`, {
                    ...options.info,
                    element: node,
                });
        });
    }

    protected checkFirstInput(
        node: TypeMeta,
        expected: FeatureMeta | undefined,
        accept: ModelValidationAcceptor,
        message: string,
        info?: Omit<ModelDiagnosticInfo<FeatureMeta>, "element">
    ): void {
        if (!expected) return;
        const first = node.ownedInputParameters()[0];

        if (first !== expected) {
            accept("error", message, { ...info, element: node.ownedInputParameters()[0] });
        }
    }
}
