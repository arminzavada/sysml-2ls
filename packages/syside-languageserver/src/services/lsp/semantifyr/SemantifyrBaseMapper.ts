import { expandToNode, Generated, JoinOptions, joinToNode } from "langium";
import { StableElementNameProvider } from "./StableNameStore";
import { ast } from "../../..";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { isClassifier, isFeatureTyping } from "../../../generated/ast";

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

    protected featureClassifier(feature: ast.Feature): ast.Classifier | undefined {
        const featureTyping = feature.heritage.find((h) => isFeatureTyping(h));

        const target = featureTyping?.targetRef?.parts[0].ref;

        if (isClassifier(target)) {
            return target;
        }

        return undefined;
    }
}
