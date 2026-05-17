import { expandToNode, Generated, JoinOptions, joinToNode } from "langium/generate";
import { StableElementNameProvider } from "./StableNameStore";
import { ast } from "../../..";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { isClassifier } from "#generated/ast";

export class SemantifyrBaseMapper {
    private readonly stableNameStore: StableElementNameProvider;

    constructor(services: SemantifyrMapperServices) {
        this.stableNameStore = services.elementNameProvider;
    }

    protected expandToBlock<T>(
        mainLine: Generated,
        children: T[],
        toGenerated: (element: T, index: number, isLast: boolean) => Generated = String,
        joinOptions: JoinOptions<T> = {}
    ): Generated {
        if (children.length <= 0) {
            return mainLine;
        }

        return expandToNode`
            ${mainLine} {
                ${joinToNode(children, toGenerated, joinOptions)}
            }
        `;
    }

    protected stableName(element: ast.Element | undefined): string {
        if (element === undefined) {
            return "UNDEFINED_ELEMENT";
        }

        return this.stableNameStore.stableName(element);
    }

    /**
     * The classifier (`PartDefinition`, `PortDefinition`, ...) of a usage's
     * first typing. Walks the qualified-name chain via the metamodel's
     * `allTypings()` so multi-segment references like `pkg::Foo` resolve to
     * `Foo` rather than the package.
     */
    protected featureClassifier(feature: ast.Feature): ast.Classifier | undefined {
        for (const typing of feature.$meta.allTypings()) {
            const target = typing.ast();
            if (target && isClassifier(target)) return target;
        }
        return undefined;
    }
}
