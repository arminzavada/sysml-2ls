import { expandToNode, Generated } from "langium/generate";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrExpressionStringifier } from "./SemantifyrExpressionStringifier";
import { SemantifyrItemMapper } from "./SemantifyrItemMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import {
    Feature,
    FeatureMembership,
    FeatureReferenceExpression,
    FeatureValue,
    isAssignmentActionUsage,
    isLiteralNumber,
    isOperatorExpression,
    isPerformActionUsage,
    isSendActionUsage,
    ParameterMembership,
    TriggerInvocationExpression,
} from "#generated/ast";
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
        const meta = acceptAction.$meta;
        if (meta.payloadItemDefinition()) {
            return this.mapAcceptItemActionUsage(featureName, acceptAction, kind);
        }

        const trigger = meta.payloadTrigger()?.ast();
        if (trigger) {
            if (trigger.kind === "after") {
                return this.mapAcceptTimoutActionUsage(featureName, acceptAction, trigger, kind);
            }
            if (trigger.kind === "when") {
                return this.mapAcceptWhenActionUsage(featureName, acceptAction, trigger, kind);
            }
            if (trigger.kind === "at") {
                return "AT_TRIGGERS_ARE_NOT_SUPPORTED";
            }
        }

        return "UNKNOWN_ACCEPT_ACTION";
    }

    private mapAcceptTimoutActionUsage(
        featureName: string,
        acceptAction: ast.AcceptActionUsage,
        trigger: TriggerInvocationExpression,
        kind: FeatureKind
    ): Generated {
        const parameterMembership = trigger.children[0] as ParameterMembership;
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

    private mapAcceptWhenActionUsage(
        featureName: string,
        acceptAction: ast.AcceptActionUsage,
        trigger: TriggerInvocationExpression,
        kind: FeatureKind
    ): Generated {
        const parameterMembership = trigger.children[0] as ParameterMembership;
        const parameter = parameterMembership.target as Feature;
        const parameterValue = parameter.value as FeatureValue;
        const parameterValueExpression = parameterValue.target as FeatureReferenceExpression;
        const feature = parameterValueExpression.expression as FeatureMembership;
        const expression = feature.target;

        return expandToNode`
            ${this.containsFeatureLine(featureName, acceptAction, "AcceptWhenAction", kind)} {
                ${this.expressionMapper.mapExpression("expression", expression as ast.Expression)}
            }
        `;
    }

    mapAcceptItemActionUsage(
        featureName: string,
        acceptAction: ast.AcceptActionUsage,
        kind: FeatureKind
    ): Generated {
        const meta = acceptAction.$meta;
        const payloadItem = meta.payloadItemDefinition()?.ast();
        if (!payloadItem) return undefined;

        const viaPort = meta.receiverFeature()?.ast();
        if (!viaPort) {
            throw new Error("AcceptItemAction must have a 'via' port specification");
        }

        const payloadItemGlobalName = this.itemMapper.globalItemName(payloadItem);
        const viaPortExpression = this.stableName(viaPort);

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
        // TODO(phase-2a+): handle empty-payload `send to` and bodied `send { … }` forms
        const meta = sendAction.$meta;
        const payloadItem = meta.payloadItemDefinition()?.ast();
        if (!payloadItem) return undefined;

        const viaPort = meta.senderFeature()?.ast();
        if (!viaPort) {
            throw new Error("Send actions must have a 'via' port specification");
        }

        const payloadItemGlobalName = this.itemMapper.globalItemName(payloadItem);
        const viaPortExpression = this.stableName(viaPort);

        // `send new X(...)` is the spec-compliant form for a freshly-constructed
        // payload; the bare `send X(...)` form is accepted for back-compat but
        // is mapped to the same SendAction.
        const sendClass = meta.isConstructor() ? "ConstructorInvocationAction" : "SendAction";

        return expandToNode`
            ${this.containsFeatureLine(featureName, sendAction, sendClass, kind)} {
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
