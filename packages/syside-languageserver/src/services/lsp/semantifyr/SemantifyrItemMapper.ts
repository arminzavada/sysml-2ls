import { Generated, expandToNode } from "langium/generate";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { isItemDefinition } from "#generated/ast";

const globalItemPrefix = "global_";

export class SemantifyrItemMapper extends SemantifyrBaseMapper {
    constructor(services: SemantifyrMapperServices) {
        super(services);
    }

    public globalItemName(item: ast.ItemDefinition): string {
        return `${globalItemPrefix}${this.stableName(item)}`;
    }

    public globalItemDefinition(globalName: string): ast.ItemDefinition | undefined {
        if (!globalName.startsWith(globalItemPrefix)) {
            return undefined;
        }
        return this.elementsNamed(globalName.slice(globalItemPrefix.length)).find(isItemDefinition);
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

    private mapMembership(_membership: ast.Membership | ast.Import): Generated {
        return undefined;
    }
}
