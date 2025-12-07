import { ast } from "../../..";
import {
    isOwningMembership,
    Connector,
    ReferenceUsage,
    LiteralExpression,
    isLiteralNumber,
    isLiteralBoolean,
    LiteralNumber,
    LiteralBoolean,
    isMembership,
    isExpression,
    Expression,
    isLiteralExpression,
    isFeatureChainExpression,
    FeatureChainExpression,
    isFeatureReferenceExpression,
    FeatureReferenceExpression,
    isFeature,
    Feature,
} from "../../../generated/ast";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { StableElementNameProvider } from "./StableNameStore";

export class SemantifyrExpressionStringifier {
    private readonly elementNameProvider: StableElementNameProvider;

    constructor(services: SemantifyrMapperServices) {
        this.elementNameProvider = services.elementNameProvider;
    }

    protected stableName(element: ast.Element | undefined): string {
        if (element === undefined) {
            return "UNDEFINED_ELEMENT";
        }

        return this.elementNameProvider.stableName(element);
    }

    stringifyElement(element: ast.Element): string {
        if (isMembership(element)) {
            return this.stringifyMembershipReference(element);
        }
        if (isExpression(element)) {
            return this.stringifyExpression(element);
        }
        if (isFeature(element)) {
            return this.stringifyFeatureExpression(element);
        }

        return "UNEXPECTED_ELEMENT";
    }

    private stringifyExpression(expression: Expression): string {
        if (isLiteralExpression(expression)) {
            return this.stringifyLiteralExpression(expression);
        }
        if (isFeatureChainExpression(expression)) {
            return this.stringifyFeatureChainExpression(expression);
        }
        if (isFeatureReferenceExpression(expression)) {
            return this.stringifyFeatureReferenceExpression(expression);
        }

        return "UNEXPECTED_EXPRESSION";
    }

    private stringifyLiteralExpression(expression: LiteralExpression): string {
        if (isLiteralNumber(expression)) {
            return this.stringifyLiteralNumberExpression(expression);
        }
        if (isLiteralBoolean(expression)) {
            return this.stringifyLiteralBooleanExpression(expression);
        }

        return "UNEXPECTED_LITERAL_EXPRESSION";
    }

    private stringifyLiteralNumberExpression(expression: LiteralNumber): string {
        return expression.literal.toString();
    }

    private stringifyLiteralBooleanExpression(expression: LiteralBoolean): string {
        return expression.literal ? "true" : "false";
    }

    private stringifyFeatureChainExpression(expression: FeatureChainExpression): string {
        const operand = this.stringifyElement(expression.operands[0]);
        const current = this.stringifyElement(expression.children[0]);

        return `${operand}.${current}`;
    }

    private stringifyFeatureReferenceExpression(expression: FeatureReferenceExpression): string {
        const member = expression.expression;
        const parts = member.targetRef?.parts;
        if (parts === undefined) {
            return "EMPTY_PARTS";
        }
        if (parts.length !== 1) {
            return "UNEXPECTED_AMOUNT_OF_PARTS";
        }
        const relevantPart = parts[0];

        return this.stableName(relevantPart.ref);
    }

    public stringifyMembershipReference(membership: ast.Membership | undefined): string {
        if (membership === undefined) {
            return "UNDEFINED_MEMBERSHIP";
        }
        if (isOwningMembership(membership)) {
            return this.stringifyOwningMembershipReference(membership);
        }
        const parts = membership.targetRef?.parts;
        if (parts === undefined) {
            return "EMPTY_PARTS";
        }
        return parts.map((e) => this.stableName(e.ref)).join(".");
    }

    private stringifyOwningMembershipReference(membership: ast.OwningMembership): string {
        const connector = membership.target as Connector;
        if (connector?.ends === undefined) {
            return this.stringifyFeatureExpression(connector);
        }
        const thenEnd = connector?.ends[1]?.target as ReferenceUsage;
        const parts = thenEnd?.heritage[0]?.targetRef?.parts;
        if (parts === undefined) {
            return "EMPTY_PARTS";
        }
        return parts.map((e) => this.stableName(e.ref)).join(".");
    }

    private stringifyFeatureExpression(feature: Feature): string {
        const typeRelationships = feature.typeRelationships.map((r) => r.targetRef);
        const parts = typeRelationships.flatMap((r) => r?.parts);
        return parts.map((e) => this.stableName(e?.ref)).join(".");
    }
}
