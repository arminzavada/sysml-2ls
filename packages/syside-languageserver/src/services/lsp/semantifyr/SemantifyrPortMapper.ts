import { expandToNode, Generated } from "langium/generate";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import {
    isImport,
    isFeatureMembership,
    isOwningMembership,
    isItemUsage,
    ItemUsage,
    isItemDefinition,
} from "#generated/ast";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { SemantifyrItemMapper } from "./SemantifyrItemMapper";

export class SemantifyrPortMapper extends SemantifyrBaseMapper {
    private readonly itemMapper: SemantifyrItemMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);

        this.itemMapper = services.itemMapper;
    }

    public mapPortDefinition(scope: ast.Namespace, port: ast.PortDefinition): Generated {
        this.unsupportedHeritage(port);
        return expandToNode`
            ${this.mapNormalPortDefinition(scope, port)}
            ${this.mapConjugatedPortDefinition(scope, port)}
        `;
    }

    private mapNormalPortDefinition(scope: ast.Namespace, port: ast.PortDefinition): Generated {
        return this.expandToBlock(
            `class ${this.declare(scope, port)} : NormalPort`,
            port.children,
            (e) => this.mapMembership(e),
            { appendNewLineIfNotEmpty: true }
        );
    }

    private mapConjugatedPortDefinition(scope: ast.Namespace, port: ast.PortDefinition): Generated {
        return this.expandToBlock(
            `class ${this.declare(scope, port, `Conjugated${this.stableName(port)}`)} : ConjugatedPort`,
            port.children,
            (e) => this.mapMembership(e),
            { appendNewLineIfNotEmpty: true }
        );
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

        return this.unsupported(
            membership,
            "Semantifyr does not support this membership in a port definition"
        );
    }

    private mapFeatureMembership(membership: ast.FeatureMembership): Generated {
        const element = membership.target;

        if (element === undefined) {
            return undefined;
        }

        if (isItemUsage(element)) {
            // return this.mapItemUsage(element);
            return undefined;
        }

        return this.unsupported(
            element,
            `Semantifyr does not support a ${element.$type} in a port definition`
        );
    }

    private itemUsageSubsets(itemUsage: ItemUsage): string {
        if (itemUsage.direction === "in") {
            return `incomingItems`;
        }
        if (itemUsage.direction === "out") {
            return `outgoingItems`;
        }

        return this.unsupported(itemUsage, "Semantifyr requires a port item to be in or out");
    }

    private mapItemUsage(itemUsage: ItemUsage): Generated {
        const itemName = this.stableName(itemUsage);
        const classifier = this.featureClassifier(itemUsage);
        if (!isItemDefinition(classifier)) {
            return undefined;
        }
        const classifierName = this.stableName(classifier);
        const subsets = this.itemUsageSubsets(itemUsage);
        const expression = this.itemMapper.globalItemName(classifier);

        return `refers ${itemName}: ${classifierName} subsets ${subsets} = ${expression}`;
    }

    private mapOwningMembership(membership: ast.OwningMembership): Generated {
        if (this.isAnnotation(membership.target)) {
            return undefined;
        }
        return this.unsupported(
            membership,
            "Semantifyr does not support this member in a port definition"
        );
    }
}
