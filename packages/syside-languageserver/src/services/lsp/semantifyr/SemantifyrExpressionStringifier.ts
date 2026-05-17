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

/**
 * Renders selected AST nodes into the dotted-path / literal forms that the
 * OXSTS surface expects. Throws on inputs it cannot translate; emitting a
 * `"UNDEFINED_*"` placeholder string would produce OXSTS that resolves to
 * the wrong target downstream.
 */
export class SemantifyrExpressionStringifier {
    private readonly elementNameProvider: StableElementNameProvider;

    constructor(services: SemantifyrMapperServices) {
        this.elementNameProvider = services.elementNameProvider;
    }

    protected stableName(element: ast.Element | undefined): string {
        if (element === undefined) {
            throw new Error("Cannot stringify a missing element");
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
        throw new Error(`Cannot stringify element of type '${element.$type}'`);
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
        throw new Error(`Cannot stringify expression of type '${expression.$type}'`);
    }

    private stringifyLiteralExpression(expression: LiteralExpression): string {
        if (isLiteralNumber(expression)) {
            return this.stringifyLiteralNumberExpression(expression);
        }
        if (isLiteralBoolean(expression)) {
            return this.stringifyLiteralBooleanExpression(expression);
        }
        throw new Error(`Cannot stringify literal expression of type '${expression.$type}'`);
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
        const parts = expression.expression.targetRef?.parts;
        if (parts === undefined || parts.length === 0) {
            throw new Error("FeatureReferenceExpression has no reference parts");
        }
        // Join every segment of the qualified name; single-segment refs render
        // as the bare name, multi-segment as `pkg.foo`.
        return parts.map((p) => this.stableName(p.ref)).join(".");
    }

    public stringifyMembershipReference(membership: ast.Membership | undefined): string {
        if (membership === undefined) {
            throw new Error("Cannot stringify a missing membership");
        }
        if (isOwningMembership(membership)) {
            return this.stringifyOwningMembershipReference(membership);
        }
        const parts = membership.targetRef?.parts;
        if (parts === undefined || parts.length === 0) {
            throw new Error("Membership reference has no parts");
        }
        return parts.map((p) => this.stableName(p.ref)).join(".");
    }

    private stringifyOwningMembershipReference(membership: ast.OwningMembership): string {
        const connector = membership.target as Connector | undefined;
        if (!connector) {
            throw new Error("Owning membership has no target");
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
            throw new Error("Owning membership target has no resolvable reference");
        }
        return parts.map((p) => this.stableName(p.ref)).join(".");
    }

    private stringifyFeatureExpression(feature: Feature): string {
        const segments = feature.typeRelationships
            .flatMap((r) => r.targetRef?.parts ?? [])
            .map((p) => this.stableName(p.ref));
        if (segments.length === 0) {
            throw new Error("Feature expression has no type-relationship parts");
        }
        return segments.join(".");
    }
}
