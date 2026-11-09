import { expandToNode, joinToNode, toString, Generated } from "langium/generate";
import { ast } from "../../..";
import {
    isImport,
    isFeatureMembership,
    isOwningMembership,
    isCalculationDefinition,
    isPartDefinition,
    isPortDefinition,
    isItemDefinition,
    isVerificationCaseDefinition,
} from "#generated/ast";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { SemantifyrPartMapper } from "./SemantifyrPartMapper";
import { SemantifyrPortMapper } from "./SemantifyrPortMapper";
import { SemantifyrItemMapper } from "./SemantifyrItemMapper";
import { SemantifyrVerificationCaseMapper } from "./SemantifyrVerificationCaseMapper";

export const modelPackage = "semantifyr::sysml::model";

export class SemantifyrRootNamespaceMapper extends SemantifyrBaseMapper {
    private readonly partMapper: SemantifyrPartMapper;
    private readonly portMapper: SemantifyrPortMapper;
    private readonly itemMapper: SemantifyrItemMapper;
    private readonly verificationCaseMapper: SemantifyrVerificationCaseMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);
        this.partMapper = services.partMapper;
        this.portMapper = services.portMapper;
        this.itemMapper = services.itemMapper;
        this.verificationCaseMapper = services.verificationCaseMapper;
    }

    public mapRootNamespace(model: ast.Namespace): string {
        const node = expandToNode`
            package ${this.declare(undefined, model, modelPackage)}
            ${""}
            ${this.imports()}
            ${""}
            ${joinToNode(model.children, (e) => this.mapGuardedGlobalMembership(model, e), { appendNewLineIfNotEmpty: true })}
        `;

        return toString(node);
    }

    private imports(): Generated {
        return expandToNode`
            import semantifyr::sysml::expressions
            import semantifyr::sysml::attributes
            import semantifyr::sysml::states
            import semantifyr::sysml::parts
            import semantifyr::sysml::ports
            import semantifyr::sysml::items
            import semantifyr::sysml::actions
            import semantifyr::sysml::triggers
            import semantifyr::sysml::verification
        `;
    }

    private mapGuardedGlobalMembership(
        model: ast.Namespace,
        membership: ast.Membership | ast.Import
    ): Generated {
        try {
            return this.mapGlobalMembership(model, membership);
        } catch (error) {
            // A construct of an unforeseen shape breaks the mapper's casts.
            if (error instanceof TypeError) {
                return this.unsupported(
                    membership,
                    `Semantifyr cannot translate this element: ${error.message}`
                );
            }
            throw error;
        }
    }

    private mapGlobalMembership(
        model: ast.Namespace,
        membership: ast.Membership | ast.Import
    ): Generated {
        if (isImport(membership)) {
            return undefined;
        }

        if (isFeatureMembership(membership)) {
            return this.mapGlobalFeatureMembership(membership);
        }

        if (isOwningMembership(membership)) {
            return this.mapGlobalOwningMembership(model, membership);
        }

        return this.unsupported(
            membership,
            "Semantifyr does not support this membership at the top level"
        );
    }

    private mapGlobalFeatureMembership(membership: ast.FeatureMembership): Generated {
        return this.unsupported(membership, "Semantifyr does not support top-level features");
    }

    private mapGlobalOwningMembership(
        model: ast.Namespace,
        membership: ast.OwningMembership
    ): Generated {
        const element = membership.target;

        if (element === undefined) {
            return undefined;
        }

        if (isPartDefinition(element)) {
            return this.partMapper.mapPartDefinition(model, element);
        }

        if (isPortDefinition(element)) {
            return this.portMapper.mapPortDefinition(model, element);
        }

        if (isItemDefinition(element)) {
            return this.itemMapper.mapItemDefinition(model, element);
        }

        if (isVerificationCaseDefinition(element)) {
            return this.verificationCaseMapper.mapVerificationCaseDefinition(model, element);
        }

        if (this.isAnnotation(element) || isCalculationDefinition(element)) {
            return undefined;
        }

        return this.unsupported(
            element,
            `Semantifyr does not support a top-level ${element.$type}`
        );
    }
}
