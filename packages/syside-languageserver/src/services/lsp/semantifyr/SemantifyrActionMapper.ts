import { expandToNode, Generated } from "langium";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrExpressionStringifier } from "./SemantifyrExpressionStringifier";
import { SemantifyrItemMapper } from "./SemantifyrItemMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import {
    Feature,
    FeatureReferenceExpression,
    FeatureValue,
    InvocationExpression,
    isAssignmentActionUsage,
    isItemDefinition,
    isLiteralNumber,
    isOperatorExpression,
    isPerformActionUsage,
    isSendActionUsage,
    ParameterMembership,
    ReferenceUsage,
    TriggerInvocationExpression,
} from "../../../generated/ast";
import { SemantifyrExpressionMapper } from "./SemantifyrExpressionMapper";

export type FeatureKind = "redefines" | "subsets";

export class SemantifyrActionMapper extends SemantifyrBaseMapper {
    private readonly itemMapper: SemantifyrItemMapper;
    private readonly expressionStringifier: SemantifyrExpressionStringifier;
    private readonly expressionMapper: SemantifyrExpressionMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);

        this.itemMapper = services.itemMapper;
        this.expressionStringifier = services.expressionStringifier;
        this.expressionMapper = services.expressionMapper;
    }

    mapActionUsage(featureName: string, actionUsage: ast.ActionUsage): Generated;
    mapActionUsage(featureName: string, actionUsage: ast.ActionUsage, kind: FeatureKind): Generated;
    mapActionUsage(
        featureName: string,
        actionUsage: ast.ActionUsage,
        kind?: FeatureKind
    ): Generated {
        const actualKind = kind ?? "redefines";

        if (isAssignmentActionUsage(actionUsage)) {
            return this.mapAssignmentActionUsage(featureName, actionUsage, actualKind);
        }
        if (isPerformActionUsage(actionUsage)) {
            return this.mapPerformActionUsage(featureName, actionUsage, actualKind);
        }
        if (isSendActionUsage(actionUsage)) {
            return this.mapSendActionUsage(featureName, actionUsage, actualKind);
        }

        return "UNKNOWN_TYPE_OF_ACTION";
    }

    mapAcceptActionUsage(
        featureName: string,
        acceptAction: ast.AcceptActionUsage,
        kind: FeatureKind
    ): Generated {
        const payload = acceptAction.payload.target as ReferenceUsage;
        const payloadClassifier = this.featureClassifier(payload);
        if (!isItemDefinition(payloadClassifier)) {
            return this.mapAcceptTimoutActionUsage(featureName, acceptAction, kind);
        }

        return this.mapAcceptItemActionUsage(featureName, acceptAction, kind);
    }

    private mapAcceptTimoutActionUsage(
        featureName: string,
        acceptAction: ast.AcceptActionUsage,
        kind: FeatureKind
    ): Generated {
        const payload = acceptAction.payload.target as ReferenceUsage;
        const payloadExpression = payload.value?.target as TriggerInvocationExpression | undefined;
        if (!payloadExpression) {
            return "UNKNOWN_KIND_OF_ACCEPT_ACTION";
        }
        const parameterMembership = payloadExpression.children[0] as ParameterMembership;
        const parameter = parameterMembership.target as Feature;
        const parameterValue = parameter.value as FeatureValue;
        const parameterValueExpression = parameterValue.target;

        let timeoutValue;
        if (
            isOperatorExpression(parameterValueExpression) &&
            parameterValueExpression.operator === "["
        ) {
            timeoutValue = parameterValueExpression.operands[0];
        } else if (isLiteralNumber(parameterValueExpression)) {
            timeoutValue = parameterValueExpression;
        } else {
            return "UNKNOWN_TIMEOUT_EXPRESSION";
        }

        const timeoutValueString = this.expressionStringifier.stringifyElement(timeoutValue);
        return expandToNode`
            ${this.containsFeatureLine(featureName, acceptAction, "AcceptTimeoutAction", kind)} {
                redefine refers afterTime: int = ${timeoutValueString}
            }
        `;
    }

    mapAcceptItemActionUsage(
        featureName: string,
        acceptAction: ast.AcceptActionUsage,
        kind: FeatureKind
    ): Generated {
        const payload = acceptAction.payload.target as ReferenceUsage;
        const payloadClassifier = this.featureClassifier(payload);
        if (!isItemDefinition(payloadClassifier)) {
            return undefined;
        }
        const payloadItemGlobalName = this.itemMapper.globalItemName(payloadClassifier);

        if (!acceptAction.receiver) {
            throw new Error("AcceptItemActions must have a 'via' port specification!");
        }
        const viaPort = acceptAction.receiver.target as ReferenceUsage;
        if (!viaPort) {
            throw new Error("The 'via' port can not be resolved!");
        }
        const viaPortValue = viaPort.value?.target as FeatureReferenceExpression;
        if (!viaPortValue) {
            throw new Error("The 'via' port value can not be resolved!");
        }
        const viaPortExpression = this.expressionStringifier.stringifyElement(
            viaPortValue.expression
        );

        return expandToNode`
            ${this.containsFeatureLine(featureName, acceptAction, "AcceptItemAction", kind)} {
                redefine refers viaPort: Port = ${viaPortExpression}
                redefine refers payload: Item = ${payloadItemGlobalName}
            }
        `;
    }

    private mapAssignmentActionUsage(
        featureName: string,
        actionUsage: ast.AssignmentActionUsage,
        kind: FeatureKind
    ): Generated {
        const target = actionUsage.assignedValue.target as ast.ReferenceUsage;
        const targetValue = target.value as ast.FeatureValue;
        const targetExpression = targetValue?.target as ast.Expression;

        return expandToNode`
            ${this.containsFeatureLine(featureName, actionUsage, "AssignmentAction", kind)} {
                redefine refers attribute: Attribute = ${this.expressionStringifier.stringifyMembershipReference(actionUsage.targetMember)}
                ${this.expressionMapper.mapExpression("expression", targetExpression)}
            }
        `;
    }

    private mapPerformActionUsage(
        featureName: string,
        actionUsage: ast.PerformActionUsage,
        kind: FeatureKind
    ): Generated {
        const internalActions = actionUsage.children.map((m) => m.target as ast.ActionUsage);
        return this.expandToBlock(
            this.containsFeatureLine(featureName, actionUsage, "CompositeAction", kind),
            internalActions,
            (e) => this.mapActionUsage("children", e, "subsets"),
            { appendNewLineIfNotEmpty: true }
        );
    }

    private mapSendActionUsage(
        featureName: string,
        sendAction: ast.SendActionUsage,
        kind: FeatureKind
    ): Generated {
        const payloadTarget = sendAction.payload.target as ReferenceUsage;
        const payloadTargetValue = payloadTarget.value as FeatureValue;
        const invocationExpression = payloadTargetValue.target as InvocationExpression;
        const featureTyping = this.featureClassifier(invocationExpression);
        if (!isItemDefinition(featureTyping)) {
            return undefined;
        }
        const payloadItemGlobalName = this.itemMapper.globalItemName(featureTyping);

        if (!sendAction.sender) {
            throw new Error("AcceptItemActions must have a 'via' port specification!");
        }
        const viaPort = sendAction.sender.target as ReferenceUsage;
        if (!viaPort) {
            throw new Error("The 'via' port can not be resolved!");
        }
        const viaPortValue = viaPort.value?.target as FeatureReferenceExpression;
        if (!viaPortValue) {
            throw new Error("The 'via' port value can not be resolved!");
        }
        const viaPortExpression = this.expressionStringifier.stringifyElement(
            viaPortValue.expression
        );

        return expandToNode`
            ${this.containsFeatureLine(featureName, sendAction, "SendAction", kind)} {
                redefine refers viaPort: Port = ${viaPortExpression}
                redefine refers payload: Item = ${payloadItemGlobalName}
            }
        `;
    }

    protected containsFeatureLine(
        containingFeature: string,
        element: ast.Element,
        type: Generated,
        kind: FeatureKind
    ): Generated {
        if (kind == "redefines") {
            return `redefine contains ${containingFeature}: ${type}`;
        }

        const elementName = this.stableName(element);

        return `contains ${elementName}: ${type} subsets ${containingFeature}`;
    }
}
