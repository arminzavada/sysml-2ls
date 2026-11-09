import { expandToNode, Generated, JoinOptions, joinToNode } from "langium/generate";
import { StableElementNameProvider } from "./StableNameStore";
import { ast } from "../../..";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { isAnnotatingElement, isClassifier, isMetadataUsage } from "#generated/ast";
import type { AstNode } from "langium";
import { SemantifyrUnsupportedConstructs } from "./SemantifyrUnsupportedConstructs";

export class SemantifyrBaseMapper {
    private readonly stableNameStore: StableElementNameProvider;
    private readonly unsupportedConstructs: SemantifyrUnsupportedConstructs;

    constructor(services: SemantifyrMapperServices) {
        this.stableNameStore = services.elementNameProvider;
        this.unsupportedConstructs = services.unsupportedConstructs;
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

    protected unsupported(node: AstNode, message: string): string {
        return this.unsupportedConstructs.report(node, message);
    }

    protected isAnnotation(element: ast.Element | undefined): boolean {
        return isAnnotatingElement(element) || isMetadataUsage(element);
    }

    protected unsupportedHeritage(type: ast.Type): void {
        for (const relationship of type.heritage) {
            this.unsupported(relationship, "Semantifyr does not support specialization here");
        }
    }

    protected stableName(element: ast.Element): string {
        return this.stableNameStore.stableName(element);
    }

    protected declare(scope: ast.Element | undefined, element: ast.Element, name?: string): string {
        return this.stableNameStore.declare(scope, element, name);
    }

    protected declareTyped(
        scope: ast.Element,
        element: ast.Element,
        type: ast.Element | undefined
    ): string {
        return this.stableNameStore.declareTyped(scope, element, type);
    }

    protected member(scope: ast.Element | undefined, name: string): ast.Element | undefined {
        return this.stableNameStore.member(scope, name);
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
