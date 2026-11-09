import { ast } from "../../..";
import {
    Connector,
    Expression,
    Feature,
    FeatureChainExpression,
    FeatureReferenceExpression,
    isExpression,
    isFeature,
    isFeatureChainExpression,
    isFeatureReferenceExpression,
    isLiteralBoolean,
    isLiteralExpression,
    isLiteralNumber,
    isMembership,
    isOwningMembership,
    LiteralBoolean,
    LiteralExpression,
    LiteralNumber,
    ReferenceUsage,
} from "#generated/ast";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { StableElementNameProvider } from "./StableNameStore";
import type { AstNode } from "langium";
import { SemantifyrUnsupportedConstructs } from "./SemantifyrUnsupportedConstructs";

export class SemantifyrExpressionStringifier {
    private readonly elementNameProvider: StableElementNameProvider;
    private readonly unsupportedConstructs: SemantifyrUnsupportedConstructs;

    constructor(services: SemantifyrMapperServices) {
        this.elementNameProvider = services.elementNameProvider;
        this.unsupportedConstructs = services.unsupportedConstructs;
    }

    private path(owner: AstNode, parts: readonly { ref?: ast.Element }[]): string {
        return parts
            .map((part) => {
                return part.ref
                    ? this.elementNameProvider.stableName(part.ref)
                    : this.unsupportedConstructs.report(owner, "Reference could not be resolved");
            })
            .join(".");
    }

    stringifyElement(element: ast.Element): string {
        if (isMembership(element)) {
            return this.stringifyMembershipReference(element, element);
        }
        if (isExpression(element)) {
            return this.stringifyExpression(element);
        }
        if (isFeature(element)) {
            return this.stringifyFeatureExpression(element);
        }
        return this.unsupportedConstructs.report(
            element,
            `Cannot translate an element of type '${element.$type}'`
        );
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
        return this.unsupportedConstructs.report(
            expression,
            `Unsupported expression type '${expression.$type}'`
        );
    }

    private stringifyLiteralExpression(expression: LiteralExpression): string {
        if (isLiteralNumber(expression)) {
            return this.stringifyLiteralNumberExpression(expression);
        }
        if (isLiteralBoolean(expression)) {
            return this.stringifyLiteralBooleanExpression(expression);
        }
        return this.unsupportedConstructs.report(
            expression,
            `Unsupported literal type '${expression.$type}'`
        );
    }

    private stringifyLiteralNumberExpression(expression: LiteralNumber): string {
        if (!Number.isInteger(expression.literal)) {
            return this.unsupportedConstructs.report(
                expression,
                "Semantifyr does not support real numbers"
            );
        }
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
        const parts = expression.expression.targetRef?.parts;
        if (parts === undefined || parts.length === 0) {
            return this.unsupportedConstructs.report(expression, "Reference has no parts");
        }
        // Join every segment of the qualified name; single-segment refs render
        // as the bare name, multi-segment as `pkg.foo`.
        return this.path(expression, parts);
    }

    public stringifyMembershipReference(
        owner: AstNode,
        membership: ast.Membership | undefined
    ): string {
        if (membership === undefined) {
            return this.unsupportedConstructs.report(owner, "Reference is missing");
        }
        if (isOwningMembership(membership)) {
            return this.stringifyOwningMembershipReference(membership);
        }
        const parts = membership.targetRef?.parts;
        if (parts === undefined || parts.length === 0) {
            return this.unsupportedConstructs.report(membership, "Reference has no parts");
        }
        return this.path(membership, parts);
    }

    private stringifyOwningMembershipReference(membership: ast.OwningMembership): string {
        const connector = membership.target as Connector | undefined;
        if (!connector) {
            return this.unsupportedConstructs.report(membership, "Owning membership has no target");
        }
        if (connector.ends === undefined) {
            return this.stringifyFeatureExpression(connector as unknown as Feature);
        }
        // For a SuccessionAsUsage (the AST of `then X`), ends[1] is the target
        // end's ReferenceUsage; its first ReferenceSubsetting's targetRef path
        // is the qualified name we render.
        const thenEnd = connector.ends[1]?.target as ReferenceUsage | undefined;
        const parts = thenEnd?.heritage[0]?.targetRef?.parts;
        if (parts === undefined || parts.length === 0) {
            return this.unsupportedConstructs.report(membership, "Reference could not be resolved");
        }
        return this.path(membership, parts);
    }

    private stringifyFeatureExpression(feature: Feature): string {
        const parts = feature.typeRelationships.flatMap((r) => r.targetRef?.parts ?? []);
        if (parts.length === 0) {
            return this.unsupportedConstructs.report(feature, "Feature has no reference parts");
        }
        return this.path(feature, parts);
    }
}
