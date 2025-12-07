import { Generated, expandToNode } from "langium";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";

export class SemantifyrItemMapper extends SemantifyrBaseMapper {
    constructor(services: SemantifyrMapperServices) {
        super(services);
    }

    public globalItemName(item: ast.ItemDefinition): string {
        return `global_${this.stableName(item)}`;
    }

    public mapItemDefinition(item: ast.ItemDefinition): Generated {
        return expandToNode`
            ${this.expandToBlock(
                `class ${this.stableName(item)} : Item`,
                item.children,
                (e) => this.mapMembership(e),
                { appendNewLineIfNotEmpty: true }
            )}
            global containment ${this.globalItemName(item)}: ${this.stableName(item)}[1]
        `;
    }

    private mapMembership(membership: ast.Membership | ast.Import): Generated {
        return undefined;
    }
}
