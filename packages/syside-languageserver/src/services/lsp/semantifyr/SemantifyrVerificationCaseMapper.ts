import { Generated, expandToNode, joinToNode } from "langium/generate";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import {
    ConstraintUsage,
    Expression,
    isFeatureMembership,
    isImport,
    isObjectiveMembership,
    isOwningMembership,
    isRequirementConstraintMembership,
    isRequirementVerificationMembership,
    isSubjectMembership,
    isUsage,
    RequirementUsage,
} from "#generated/ast";
import { SemantifyrExpressionMapper } from "./SemantifyrExpressionMapper";

export class SemantifyrVerificationCaseMapper extends SemantifyrBaseMapper {
    private readonly expressionMapper: SemantifyrExpressionMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);

        this.expressionMapper = services.expressionMapper;
    }

    public mapVerificationCaseDefinition(
        scope: ast.Namespace,
        verificationCase: ast.VerificationCaseDefinition
    ): Generated {
        const verifyMembers = verificationCase.children.flatMap((membership) => {
            return isObjectiveMembership(membership)
                ? ((membership.target as RequirementUsage | undefined)?.children.filter(
                      isRequirementVerificationMembership
                  ) ?? [])
                : [];
        });
        for (const extraVerify of verifyMembers.slice(1)) {
            this.unsupported(extraVerify, "Semantifyr supports one verify member per case");
        }
        return expandToNode`
            @VerificationCase
            class ${this.declare(scope, verificationCase)} : VerificationCaseDefinition {
                ${joinToNode(verificationCase.children, (e) => this.mapMembership(verificationCase, e), { appendNewLineIfNotEmpty: true })}
            }
        `;
    }

    private mapMembership(scope: ast.Element, membership: ast.Membership | ast.Import): Generated {
        if (isImport(membership)) {
            return undefined;
        }

        if (isFeatureMembership(membership)) {
            return this.mapFeatureMembership(scope, membership);
        }

        if (isOwningMembership(membership)) {
            return this.mapOwningMembership(membership);
        }

        return this.unsupported(
            membership,
            "Semantifyr does not support this membership in a verification case"
        );
    }

    private mapFeatureMembership(scope: ast.Element, membership: ast.FeatureMembership): Generated {
        if (isSubjectMembership(membership)) {
            return this.mapSubjectMembership(scope, membership);
        }
        if (isObjectiveMembership(membership)) {
            return this.mapObjectiveMembership(membership);
        }
        if (isRequirementVerificationMembership(membership)) {
            return this.mapRequirementVerificationMembership(membership);
        }
        if (isRequirementConstraintMembership(membership)) {
            return this.mapRequirementConstraintMembership(membership);
        }

        return this.unsupported(
            membership,
            `Semantifyr does not support a ${membership.$type} in a verification case`
        );
    }

    private mapOwningMembership(membership: ast.OwningMembership): Generated {
        if (this.isAnnotation(membership.target)) {
            return undefined;
        }
        return this.unsupported(
            membership,
            "Semantifyr does not support this member in a verification case"
        );
    }

    private mapSubjectMembership(scope: ast.Element, membership: ast.SubjectMembership): Generated {
        const element = membership.target;
        if (!element || !isUsage(element)) {
            return this.unsupported(membership, "A verification case subject must be a usage");
        }
        const subjectType = element.$meta.allTypings().at(0)?.ast();
        if (!subjectType) {
            return this.unsupported(
                element,
                `Verification case subject '${element.declaredName ?? "<anonymous>"}' has no resolved type`
            );
        }
        return expandToNode`
            contains ${this.declareTyped(scope, element, subjectType)}: ${this.stableName(subjectType)}[1] redefines subject
        `;
    }

    private mapObjectiveMembership(membership: ast.ObjectiveMembership): Generated {
        const element = membership.target as RequirementUsage | undefined;
        if (!element) {
            return this.unsupported(membership, "A verification case objective must not be empty");
        }
        return expandToNode`
            redefine contains objective: Requirement[1] {
                ${joinToNode(element.children, (e) => this.mapMembership(element, e), { appendNewLineIfNotEmpty: true })}
            }
        `;
    }

    private mapRequirementVerificationMembership(
        membership: ast.RequirementVerificationMembership
    ): Generated {
        const element = membership.target as RequirementUsage | undefined;
        if (!element) {
            return this.unsupported(membership, "A verification requirement must not be empty");
        }
        return expandToNode`
            redefine contains verifyRequirement : Constraint[1] {
                ${joinToNode(element.children, (e) => this.mapMembership(element, e), { appendNewLineIfNotEmpty: true })}
            }
        `;
    }

    private mapRequirementConstraintMembership(
        membership: ast.RequirementConstraintMembership
    ): Generated {
        if (membership.kind === "assume") {
            return this.unsupported(membership, "Semantifyr does not support assume constraints");
        }
        const element = membership.target as ConstraintUsage | undefined;
        if (!element) {
            return this.unsupported(membership, "A constraint membership must have a target");
        }
        const resultExpression = element.$meta.result?.element()?.ast() as Expression | undefined;
        if (!resultExpression) {
            return this.unsupported(
                element,
                `Constraint '${element.declaredName ?? "<anonymous>"}' has no result expression`
            );
        }
        return this.expressionMapper.mapExpression("requiredConstraint", resultExpression);
    }
}
