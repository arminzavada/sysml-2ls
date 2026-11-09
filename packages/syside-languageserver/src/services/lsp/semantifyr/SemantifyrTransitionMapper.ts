import { CompositeGeneratorNode, expandToNode, Generated } from "langium/generate";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { isStateUsage } from "#generated/ast";
import { AstUtils } from "langium";
import { SemantifyrExpressionStringifier } from "./SemantifyrExpressionStringifier";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";

import { SemantifyrExpressionMapper } from "./SemantifyrExpressionMapper";
import { SemantifyrActionMapper } from "./SemantifyrActionMapper";

export class SemantifyrTransitionMapper extends SemantifyrBaseMapper {
    private readonly expressionStringifier: SemantifyrExpressionStringifier;
    private readonly expressionMapper: SemantifyrExpressionMapper;
    private readonly actionMapper: SemantifyrActionMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);

        this.expressionStringifier = services.expressionStringifier;
        this.expressionMapper = services.expressionMapper;
        this.actionMapper = services.actionMapper;
    }

    public mapTransitionUsage(
        state: ast.StateUsage,
        transitionUsage: ast.TransitionUsage
    ): Generated {
        const meta = transitionUsage.$meta;
        const transitionName = this.declare(state, transitionUsage);
        this.checkTransitionTarget(transitionUsage);

        const node = new CompositeGeneratorNode();
        node.append(this.mapTransitionAccepter(meta.acceptAction()?.ast()));
        node.appendNewLineIfNotEmpty();
        node.append(this.mapTransitionGuard(meta.guardExpression()?.ast()));
        node.appendNewLineIfNotEmpty();
        node.append(this.mapTransitionEffect(meta.effectAction()?.ast()));
        node.appendNewLineIfNotEmpty();

        return expandToNode`
            contains ${transitionName}: Transition subsets transitions {
                redefine refers from: StateNode = ${this.expressionStringifier.stringifyMembershipReference(transitionUsage, transitionUsage.source)}
                redefine refers to: StateNode = ${this.expressionStringifier.stringifyMembershipReference(transitionUsage, transitionUsage.then)}
                ${node}
            }
        `;
    }

    private checkTransitionTarget(transitionUsage: ast.TransitionUsage): void {
        const succession = transitionUsage.then?.target as ast.Connector | undefined;
        const targetEnd = succession?.ends?.[1]?.target as ast.ReferenceUsage | undefined;
        const reference = targetEnd
            ? targetEnd.heritage[0]?.targetRef
            : (succession as ast.Feature | undefined)?.typeRelationships.at(-1)?.targetRef;
        const target = reference?.parts.at(-1)?.ref;
        // `done` is a state, but one the library declares and OXSTS has no counterpart for.
        const declaredHere =
            target && AstUtils.getDocument(target) === AstUtils.getDocument(transitionUsage);
        if (target && !(isStateUsage(target) && declaredHere)) {
            this.unsupported(
                transitionUsage.then!,
                "Semantifyr requires a transition target to be a state of this model"
            );
        }
    }

    private mapTransitionAccepter(accept: ast.AcceptActionUsage | undefined): Generated {
        if (!accept) return undefined;
        return this.actionMapper.mapAcceptActionUsage("acceptAction", accept, "redefines");
    }

    private mapTransitionGuard(guard: ast.Expression | undefined): Generated {
        if (!guard) return undefined;
        return expandToNode`
            redefine contains guard: Guard {
                ${this.expressionMapper.mapExpression("expression", guard)}
            }
        `;
    }

    private mapTransitionEffect(effect: ast.ActionUsage | undefined): Generated {
        if (!effect) return undefined;
        return this.actionMapper.mapActionUsage("action", effect);
    }
}
