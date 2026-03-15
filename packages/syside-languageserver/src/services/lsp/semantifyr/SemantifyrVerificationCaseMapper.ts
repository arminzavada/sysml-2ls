import { Generated, expandToNode, joinToNode } from "langium";
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
} from "../../../generated/ast";
import { SemantifyrExpressionMapper } from "./SemantifyrExpressionMapper";

export class SemantifyrVerificationCaseMapper extends SemantifyrBaseMapper {
    private readonly expressionMapper: SemantifyrExpressionMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);

        this.expressionMapper = services.expressionMapper;
    }

    public mapVerificationCaseDefinition(
        verificationCase: ast.VerificationCaseDefinition
    ): Generated {
        return expandToNode`
            @VerificationCase
            class ${this.stableName(verificationCase)} : VerificationCaseDefinition {
                ${joinToNode(verificationCase.children, (e) => this.mapMembership(e), { appendNewLineIfNotEmpty: true })}
            }
        `;
    }

    private mapMembership(membership: ast.Membership | ast.Import): Generated {
        if (isImport(membership)) {
            return undefined;
        }

        if (isFeatureMembership(membership)) {
            return this.mapFeatureMembership(membership);
        }

        if (isOwningMembership(membership)) {
            return this.mapOwningMembership(membership);
        }

        return undefined;
    }

    private mapFeatureMembership(membership: ast.FeatureMembership): Generated {
        if (isSubjectMembership(membership)) {
            return this.mapSubjectMembership(membership);
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

        return undefined;
    }

    private mapOwningMembership(membership: ast.OwningMembership): Generated {
        return undefined; // skip members for now
    }

    private mapSubjectMembership(membership: ast.SubjectMembership): Generated {
        const element = membership.target;
        if (element === undefined) {
            return undefined;
        }

        if (!isUsage(element)) {
            return undefined;
        }

        const subjectName = this.stableName(element);
        const subjectType = this.featureClassifier(element);
        const subjectTypeName = this.stableName(subjectType);

        return expandToNode`
            contains ${subjectName}: ${subjectTypeName}[1] redefines subject
        `;
    }

    private mapObjectiveMembership(membership: ast.ObjectiveMembership): Generated {
        const element = membership.target as RequirementUsage;
        if (element === undefined) {
            return undefined;
        }

        return expandToNode`
            redefine contains objective: Requirement[1] {
                ${joinToNode(element.children, (e) => this.mapMembership(e), { appendNewLineIfNotEmpty: true })}
            }
        `;
    }

    private mapRequirementVerificationMembership(
        membership: ast.RequirementVerificationMembership
    ): Generated {
        const element = membership.target as RequirementUsage;
        if (element === undefined) {
            return undefined;
        }

        return expandToNode`
            redefine contains verifyRequirement : Constraint[1] {
                ${joinToNode(element.children, (e) => this.mapMembership(e), { appendNewLineIfNotEmpty: true })}
            }
        `;
    }

    private mapRequirementConstraintMembership(
        membership: ast.RequirementConstraintMembership
    ): Generated {
        const element = membership.target as ConstraintUsage;
        if (element === undefined) {
            return undefined;
        }

        const resultExpression = element.result?.target as Expression;

        return this.expressionMapper.mapExpression("requiredConstraint", resultExpression);
    }
}
