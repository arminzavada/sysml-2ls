import { expandToNode, Generated } from "langium/generate";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrExpressionStringifier } from "./SemantifyrExpressionStringifier";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { ast } from "../../..";
import {
    Expression,
    FeatureReferenceExpression,
    isFeatureChainExpression,
    isFeatureMembership,
    isFeatureReferenceExpression,
    isInvocationExpression,
    isLiteralBoolean,
    isLiteralExpression,
    isLiteralNumber,
    isMembership,
    isOperatorExpression,
    isOwningMembership,
    OperatorExpression,
} from "#generated/ast";

const BINARY_OPERATOR_LIBRARY_CLASS: ReadonlyMap<string, string> = new Map([
    ["+", "PlusOperatorExpression"],
    ["-", "MinusOperatorExpression"],
    ["*", "MultiplicationOperatorExpression"],
    ["/", "DivisionOperatorExpression"],
    ["==", "EqualityOperatorExpression"],
    ["!=", "InequalityOperatorExpression"],
    ["<", "LessThanOperatorExpression"],
    ["<=", "LessThanOrEqualsOperatorExpression"],
    [">", "GreaterThanOperatorExpression"],
    [">=", "GreaterThanOrEqualsOperatorExpression"],
    ["or", "OrOperatorExpression"],
    ["and", "AndOperatorExpression"],
]);

const UNARY_OPERATOR_LIBRARY_CLASS: ReadonlyMap<string, string> = new Map([
    ["not", "UnaryNotExpression"],
]);

export class SemantifyrExpressionMapper extends SemantifyrBaseMapper {
    private readonly expressionStringifier: SemantifyrExpressionStringifier;

    constructor(services: SemantifyrMapperServices) {
        super(services);
        this.expressionStringifier = services.expressionStringifier;
    }

    mapExpression(featureName: string, expression: ast.Expression): Generated {
        if (isFeatureReferenceExpression(expression)) {
            return this.mapFeatureReferenceExpression(featureName, expression);
        }
        if (isOperatorExpression(expression)) {
            return this.mapOperatorExpression(featureName, expression);
        }
        if (isLiteralExpression(expression)) {
            return this.mapLiteralExpression(featureName, expression);
        }
        if (isInvocationExpression(expression)) {
            return this.mapInvocationExpression(featureName, expression);
        }
        throw new Error(`Unsupported expression type '${expression.$type}'`);
    }

    private mapFeatureReferenceExpression(
        featureName: string,
        expression: FeatureReferenceExpression
    ): Generated {
        // An OwningMembership wrapping an Expression (`f = some_expression`)
        // produces a FeatureReferenceExpression whose .expression points to
        // a FeatureMembership; unwrap and re-dispatch on the embedded expr.
        const embedded = expression.expression;
        if (isFeatureMembership(embedded)) {
            const inner = embedded.target as Expression | undefined;
            if (!inner) {
                throw new Error("Embedded FeatureMembership has no expression target");
            }
            return this.mapExpression(featureName, inner);
        }
        return expandToNode`
            redefine contains ${featureName}: AttributeReferenceExpression {
                redefine refers attribute: Attribute = ${this.expressionStringifier.stringifyMembershipReference(expression.expression)}
            }
        `;
    }

    private mapOperatorExpression(featureName: string, expression: OperatorExpression): Generated {
        if (isFeatureChainExpression(expression)) {
            return this.mapFeatureChainExpression(featureName, expression);
        }

        const operator = expression.operator;
        if (!operator) {
            throw new Error("OperatorExpression has no operator token");
        }
        const unaryClass = UNARY_OPERATOR_LIBRARY_CLASS.get(operator);
        if (unaryClass) {
            return expandToNode`
                redefine contains ${featureName}: ${unaryClass} {
                    ${this.mapExpression("operand", expression.operands[0])}
                }
            `;
        }

        const binaryClass = BINARY_OPERATOR_LIBRARY_CLASS.get(operator);
        if (!binaryClass) {
            throw new Error(`Unsupported operator '${operator}'`);
        }
        return expandToNode`
            redefine contains ${featureName}: ${binaryClass} {
                ${this.mapExpression("left", expression.operands[0])}
                ${this.mapExpression("right", expression.operands[1])}
            }
        `;
    }

    private mapFeatureChainExpression(
        featureName: string,
        expression: OperatorExpression
    ): Generated {
        const parameter = expression.children[0];
        const left = expression.operands[0];
        if (!isFeatureReferenceExpression(left)) {
            throw new Error(
                "FeatureChainExpression left operand must be a FeatureReferenceExpression"
            );
        }
        const leftPath = this.expressionStringifier.stringifyMembershipReference(left.expression);

        let rightPath: string;
        if (isOwningMembership(parameter)) {
            const parameterFeature = parameter.target;
            if (!parameterFeature) {
                throw new Error("FeatureChainExpression member has no target");
            }
            rightPath = this.expressionStringifier.stringifyElement(parameterFeature);
        } else if (isMembership(parameter)) {
            rightPath = this.expressionStringifier.stringifyMembershipReference(parameter);
        } else {
            throw new Error(
                `FeatureChainExpression child has unexpected type '${parameter?.$type}'`
            );
        }

        return expandToNode`
            redefine contains ${featureName}: AttributeReferenceExpression {
                redefine refers attribute: Attribute = ${leftPath}.${rightPath}
            }
        `;
    }

    private mapLiteralExpression(
        featureName: string,
        expression: ast.LiteralExpression
    ): Generated {
        if (isLiteralNumber(expression)) {
            return this.mapLiteralNumberExpression(featureName, expression);
        }
        if (isLiteralBoolean(expression)) {
            return this.mapLiteralBooleanExpression(featureName, expression);
        }
        throw new Error(`Unsupported literal expression type '${expression.$type}'`);
    }

    private mapLiteralNumberExpression(
        featureName: string,
        expression: ast.LiteralNumber
    ): Generated {
        if (expression.literal === undefined) {
            return `redefine contains ${featureName}: LiteralIntegerExpression`;
        }
        return expandToNode`
            redefine contains ${featureName}: LiteralIntegerExpression {
                redefine refers value: int = ${this.expressionStringifier.stringifyElement(expression)}
            }
        `;
    }

    private mapLiteralBooleanExpression(
        featureName: string,
        expression: ast.LiteralBoolean
    ): Generated {
        if (expression.literal === undefined) {
            return `redefine contains ${featureName}: LiteralBooleanExpression`;
        }
        return expandToNode`
            redefine contains ${featureName}: LiteralBooleanExpression {
                redefine refers value: bool = ${this.expressionStringifier.stringifyElement(expression)}
            }
        `;
    }

    private mapInvocationExpression(
        featureName: string,
        expression: ast.InvocationExpression
    ): Generated {
        const invokedName = expression.$meta.invokes()?.ast()?.declaredName;
        switch (invokedName) {
            case "isStateActive":
                return this.mapIsStateActiveInvocation(featureName, expression);
            case "mustAlways":
                return this.mapTemporalInvocation(featureName, expression, "MustAlways");
            case "eventually":
                return this.mapTemporalInvocation(featureName, expression, "Eventually");
            default:
                throw new Error(
                    `Unsupported invocation '${invokedName ?? "<unknown>"}' (only isStateActive, mustAlways, eventually are recognised)`
                );
        }
    }

    private mapIsStateActiveInvocation(
        featureName: string,
        expression: ast.InvocationExpression
    ): Generated {
        const argument = this.firstInvocationArgument(expression);
        const statePath = this.expressionStringifier.stringifyElement(argument);
        return expandToNode`
            redefine contains ${featureName}: IsStateActiveExpression {
                redefine refers state: AbstractState = ${statePath}
            }
        `;
    }

    private mapTemporalInvocation(
        featureName: string,
        expression: ast.InvocationExpression,
        libraryClass: "MustAlways" | "Eventually"
    ): Generated {
        const argument = this.firstInvocationArgument(expression);
        return expandToNode`
            redefine contains ${featureName}: ${libraryClass} {
                ${this.mapExpression("body", argument)}
            }
        `;
    }

    private firstInvocationArgument(expression: ast.InvocationExpression): Expression {
        const argMeta = expression.$meta.arguments().at(0);
        const arg = argMeta?.ast() as Expression | undefined;
        if (!arg) {
            const invoked = expression.$meta.invokes()?.ast()?.declaredName ?? "<unknown>";
            throw new Error(`Invocation '${invoked}' requires at least one argument`);
        }
        return arg;
    }
}
