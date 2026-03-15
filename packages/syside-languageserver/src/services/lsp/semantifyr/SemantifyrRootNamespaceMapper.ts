import { expandToNode, joinToNode, toString, Generated } from "langium";
import { ast } from "../../..";
import {
    isImport,
    isFeatureMembership,
    isOwningMembership,
    isPartDefinition,
    isPortDefinition,
    isItemDefinition,
    isVerificationCaseDefinition,
} from "../../../generated/ast";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { SemantifyrPartMapper } from "./SemantifyrPartMapper";
import { SemantifyrPortMapper } from "./SemantifyrPortMapper";
import { SemantifyrItemMapper } from "./SemantifyrItemMapper";
import { SemantifyrVerificationCaseMapper } from "./SemantifyrVerificationCaseMapper";

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
            package semantifyr::sysml::model
            ${""}
            ${this.imports()}
            ${""}
            ${joinToNode(model.children, (e) => this.mapGlobalMembership(e), { appendNewLineIfNotEmpty: true })}
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

    private mapGlobalMembership(membership: ast.Membership | ast.Import): Generated {
        if (isImport(membership)) {
            return undefined;
        }

        if (isFeatureMembership(membership)) {
            return this.mapGlobalFeatureMembership(membership);
        }

        if (isOwningMembership(membership)) {
            return this.mapGlobalOwningMembership(membership);
        }

        return undefined;
    }

    private mapGlobalFeatureMembership(membership: ast.FeatureMembership): Generated {
        return undefined; // skip global features for now
    }

    private mapGlobalOwningMembership(membership: ast.OwningMembership): Generated {
        const element = membership.target;

        if (element === undefined) {
            return undefined;
        }

        if (isPartDefinition(element)) {
            return this.partMapper.mapPartDefinition(element);
        }

        if (isPortDefinition(element)) {
            return this.portMapper.mapPortDefinition(element);
        }

        if (isItemDefinition(element)) {
            return this.itemMapper.mapItemDefinition(element);
        }

        if (isVerificationCaseDefinition(element)) {
            return this.verificationCaseMapper.mapVerificationCaseDefinition(element);
        }

        return undefined;
    }
}
