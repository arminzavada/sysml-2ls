import { CompositeGeneratorNode, expandToNode, Generated } from "langium/generate";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
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

    public mapTransitionUsage(transitionUsage: ast.TransitionUsage): Generated {
        const transitionName = this.stableName(transitionUsage);

        const node = new CompositeGeneratorNode();
        node.append(this.mapTransitionAccepter(transitionUsage.accepter));
        node.appendNewLineIfNotEmpty();
        node.append(this.mapTransitionGuard(transitionUsage.guard));
        node.appendNewLineIfNotEmpty();
        node.append(this.mapTransitionEffect(transitionUsage.effect));
        node.appendNewLineIfNotEmpty();

        return expandToNode`
            contains ${transitionName}: Transition subsets transitions {
                redefine refers from: StateNode = ${this.expressionStringifier.stringifyMembershipReference(transitionUsage.source)}
                redefine refers to: StateNode = ${this.expressionStringifier.stringifyMembershipReference(transitionUsage.then)}
                ${node}
            }
        `;
    }

    private mapTransitionAccepter(
        accepter: ast.TransitionFeatureMembership | undefined
    ): Generated {
        if (accepter === undefined) {
            return undefined;
        }

        return this.actionMapper.mapAcceptActionUsage(
            "acceptAction",
            accepter.target as ast.AcceptActionUsage,
            "redefines"
        );
    }

    private mapTransitionGuard(guard: ast.TransitionFeatureMembership | undefined): Generated {
        if (guard === undefined) {
            return undefined;
        }

        return expandToNode`
            redefine contains guard: Guard {
                ${this.expressionMapper.mapExpression("expression", guard.target as ast.Expression)}
            }
        `;
    }

    private mapTransitionEffect(effect: ast.TransitionFeatureMembership | undefined): Generated {
        if (effect === undefined) {
            return undefined;
        }

        return this.actionMapper.mapActionUsage("action", effect.target as ast.ActionUsage);
    }
}
