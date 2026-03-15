import { expandToNode, Generated } from "langium";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrExpressionStringifier } from "./SemantifyrExpressionStringifier";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { ast } from "../../..";
import {
    isOperatorExpression,
    isLiteralExpression,
    isFeatureReferenceExpression,
    FeatureReferenceExpression,
    isFeatureMembership,
    Expression,
    OperatorExpression,
    isLiteralBoolean,
    isLiteralNumber,
    isInvocationExpression,
    ParameterMembership,
    Feature,
    FeatureValue,
    isFeatureChainExpression,
    OwningMembership,
} from "../../../generated/ast";

export type OperatorExpression_Operator =
    | "*"
    | "/"
    | "+"
    | "-"
    | "not"
    | "<"
    | ">"
    | "<="
    | ">="
    | "=="
    | "!="
    | "or"
    | "and";

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

        return "UNKNOWN_TYPE_OF_EXPRESSION";
    }

    private mapFeatureReferenceExpression(
        featureName: string,
        expression: FeatureReferenceExpression
    ): Generated {
        const expr = expression.expression;
        if (isFeatureMembership(expr)) {
            // weird case: this is actually an embedded feature
            const realExpr = expr.target as Expression;
            return this.mapExpression(featureName, realExpr);
        }

        return expandToNode`
            redefine contains ${featureName}: AttributeReferenceExpression {
                redefine refers attribute: Attribute = ${this.expressionStringifier.stringifyMembershipReference(expression.expression)}
            }
        `;
    }

    private mapOperatorExpression_OperatorToTypeName(
        operator: OperatorExpression_Operator
    ): Generated {
        if (operator == "+") {
            return "PlusOperatorExpression";
        } else if (operator == "-") {
            return "MinusOperatorExpression";
        } else if (operator == "*") {
            return "MultiplicationOperatorExpression";
        } else if (operator == "/") {
            return "DivisionOperatorExpression";
        } else if (operator == "not") {
            return "UnaryNotExpression";
        } else if (operator == "==") {
            return "EqualityOperatorExpression";
        } else if (operator == "!=") {
            return "InequalityOperatorExpression";
        } else if (operator == "<") {
            return "LessThanOperatorExpression";
        } else if (operator == "<=") {
            return "LessThanOrEqualsOperatorExpression";
        } else if (operator == ">") {
            return "GreaterThanOperatorExpression";
        } else if (operator == ">=") {
            return "GreaterThanOrEqualsOperatorExpression";
        } else if (operator == "or") {
            return "OrOperatorExpression";
        } else if (operator == "and") {
            return "AndOperatorExpression";
        }

        return "UNKNOWN_KIND_OF_OPERATOR";
    }

    private mapOperatorExpression(featureName: string, expression: OperatorExpression): Generated {
        const operator = expression.operator as OperatorExpression_Operator;

        if (isFeatureChainExpression(expression)) {
            const parameter = expression.children[0] as OwningMembership;
            const parameterFeature = parameter.target as Feature;
            // const parameterValue = parameterFeature.value as FeatureValue;
            // const parameterExpression = parameterValue.target as Expression;
            const parameterExpressionString =
                this.expressionStringifier.stringifyElement(parameterFeature);

            const left = expression.operands[0] as FeatureReferenceExpression;
            const leftExpr = left.expression;

            return expandToNode`
                redefine contains ${featureName}: AttributeReferenceExpression {
                    redefine refers attribute: Attribute = ${this.expressionStringifier.stringifyMembershipReference(leftExpr)}.${parameterExpressionString}
                }
            `;
        }

        const operatorType = this.mapOperatorExpression_OperatorToTypeName(operator);
        if (operatorType == "UnaryNotExpression") {
            return expandToNode`
                redefine contains ${featureName}: ${operatorType} {
                    ${this.mapExpression("operand", expression.operands[0])}
                }
            `;
        }

        return expandToNode`
            redefine contains ${featureName}: ${operatorType} {
                ${this.mapExpression("left", expression.operands[0])}
                ${this.mapExpression("right", expression.operands[1])}
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

        return "UNEXPECTED_LITERAL_EXPRESSION";
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
        const invocationType = this.featureClassifier(expression);
        if (invocationType?.declaredName === "isStateActive") {
            return this.mapIsStateActiveInvocationExpression(featureName, expression);
        }
        if (invocationType?.declaredName === "mustAlways") {
            return this.mapMustAlwaysInvocationExpression(featureName, expression);
        }
        if (invocationType?.declaredName === "eventually") {
            return this.mapEventuallyInvocationExpression(featureName, expression);
        }

        return "UNKNOWN_TYPE_OF_INVOCATION";
    }

    private mapIsStateActiveInvocationExpression(
        featureName: string,
        expression: ast.InvocationExpression
    ): Generated {
        const parameter = expression.children[0] as ParameterMembership;
        const parameterFeature = parameter.target as Feature;
        const parameterValue = parameterFeature.value as FeatureValue;
        const parameterExpression = parameterValue.target as Expression;
        const parameterExpressionString =
            this.expressionStringifier.stringifyElement(parameterExpression);

        return expandToNode`
            redefine contains ${featureName}: IsStateActiveExpression {
                redefine refers state: State = ${parameterExpressionString}
            }
        `;
    }

    private mapMustAlwaysInvocationExpression(
        featureName: string,
        expression: ast.InvocationExpression
    ): Generated {
        const parameter = expression.children[0] as ParameterMembership;
        const parameterFeature = parameter.target as Feature;
        const parameterValue = parameterFeature.value as FeatureValue;
        const parameterExpression = parameterValue.target as Expression;

        return expandToNode`
            redefine contains ${featureName}: MustAlways {
                ${this.mapExpression("body", parameterExpression)}
            }
        `;
    }

    private mapEventuallyInvocationExpression(
        featureName: string,
        expression: ast.InvocationExpression
    ): Generated {
        const parameter = expression.children[0] as ParameterMembership;
        const parameterFeature = parameter.target as Feature;
        const parameterValue = parameterFeature.value as FeatureValue;
        const parameterExpression = parameterValue.target as Expression;

        return expandToNode`
            redefine contains ${featureName}: Eventually {
                ${this.mapExpression("body", parameterExpression)}
            }
        `;
    }
}
