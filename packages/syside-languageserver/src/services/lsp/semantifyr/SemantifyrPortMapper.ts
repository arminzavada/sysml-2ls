import { expandToNode, Generated } from "langium";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import {
    isImport,
    isFeatureMembership,
    isOwningMembership,
    isItemUsage,
    ItemUsage,
    isItemDefinition,
} from "../../../generated/ast";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { SemantifyrItemMapper } from "./SemantifyrItemMapper";

export class SemantifyrPortMapper extends SemantifyrBaseMapper {
    private readonly itemMapper: SemantifyrItemMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);

        this.itemMapper = services.itemMapper;
    }

    public mapPortDefinition(port: ast.PortDefinition): Generated {
        return expandToNode`
            ${this.mapNormalPortDefinition(port)}
            ${this.mapConjugatedPortDefinition(port)}
        `;
    }

    private mapNormalPortDefinition(port: ast.PortDefinition): Generated {
        return this.expandToBlock(
            `class ${this.stableName(port)} : NormalPort`,
            port.children,
            (e) => this.mapMembership(e),
            { appendNewLineIfNotEmpty: true }
        );
    }

    private mapConjugatedPortDefinition(port: ast.PortDefinition): Generated {
        return this.expandToBlock(
            `class Conjugated${this.stableName(port)} : ConjugatedPort`,
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

        return undefined;
    }

    private mapFeatureMembership(membership: ast.FeatureMembership): Generated {
        const element = membership.target;

        if (element === undefined) {
            return undefined;
        }

        if (isItemUsage(element)) {
            return this.mapItemUsage(element);
        }

        return undefined;
    }

    private itemUsageSubsets(itemUsage: ItemUsage): string {
        if (itemUsage.direction === "in") {
            return `incomingItems`;
        }
        if (itemUsage.direction === "out") {
            return `outgoingItems`;
        }

        return "UNEXPECTED_ITEM_DIRECTION";
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
        return undefined; // skip port members for now
    }
}
