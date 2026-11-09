import { Generated, expandToNode } from "langium/generate";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { isImport } from "#generated/ast";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";

const globalItemPrefix = "global_";

export class SemantifyrItemMapper extends SemantifyrBaseMapper {
    constructor(services: SemantifyrMapperServices) {
        super(services);
    }

    public globalItemName(item: ast.ItemDefinition): string {
        return `${globalItemPrefix}${this.stableName(item)}`;
    }

    public mapItemDefinition(scope: ast.Namespace, item: ast.ItemDefinition): Generated {
        return expandToNode`
            ${this.expandToBlock(
                `class ${this.declare(scope, item)} : Item`,
                item.children,
                (e) => this.mapMembership(e),
                { appendNewLineIfNotEmpty: true }
            )}
            global containment ${this.declare(scope, item, this.globalItemName(item))}: ${this.stableName(item)}[1]
        `;
    }

    private mapMembership(membership: ast.Membership | ast.Import): Generated {
        if (isImport(membership) || this.isAnnotation(membership.target)) {
            return undefined;
        }
        return this.unsupported(
            membership,
            "Semantifyr does not support members of an item definition"
        );
    }
}
