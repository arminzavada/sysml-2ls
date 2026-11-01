import { Generated } from "langium/generate";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import {
    isImport,
    isFeatureMembership,
    isOwningMembership,
    isStateUsage,
    isTransitionUsage,
    isStateSubactionMembership,
    ActionUsage,
} from "#generated/ast";
import { SemantifyrActionMapper } from "./SemantifyrActionMapper";
import { SemantifyrTransitionMapper } from "./SemantifyrTransitionMapper";

export class SemantifyrStateMapper extends SemantifyrBaseMapper {
    private readonly transitionMapper: SemantifyrTransitionMapper;
    private readonly actionMapper: SemantifyrActionMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);

        this.transitionMapper = services.transitionMapper;
        this.actionMapper = services.actionMapper;
    }

    public mapExhibitStateUsage(
        part: ast.PartDefinition,
        exhibitStateUsage: ast.ExhibitStateUsage
    ): Generated {
        const exhibitStateName = this.declare(part, exhibitStateUsage);
        const stateType = exhibitStateUsage.isParallel ? "ParallelState" : "State";

        return this.expandToBlock(
            `contains ${exhibitStateName}: ${stateType} redefines exhibitState`,
            exhibitStateUsage.children,
            (e) => this.mapMembership(exhibitStateUsage, e),
            { appendNewLineIfNotEmpty: true }
        );
    }

    private mapMembership(
        state: ast.StateUsage,
        membership: ast.Membership | ast.Import
    ): Generated {
        if (isImport(membership)) {
            return undefined;
        }

        if (isFeatureMembership(membership)) {
            return this.mapFeatureMembership(state, membership);
        }

        if (isOwningMembership(membership)) {
            return this.mapOwningMembership(membership);
        }

        return undefined;
    }

    private mapFeatureMembership(
        state: ast.StateUsage,
        membership: ast.FeatureMembership
    ): Generated {
        const element = membership.target;

        if (element === undefined) {
            return undefined;
        }

        if (isStateUsage(element)) {
            return this.mapStateUsage(state, element);
        }

        if (isTransitionUsage(element)) {
            return this.transitionMapper.mapTransitionUsage(state, element);
        }

        if (isStateSubactionMembership(membership)) {
            return this.mapStateSubactionMembership(membership);
        }

        return undefined;
    }

    private mapOwningMembership(_membership: ast.OwningMembership): Generated {
        return undefined; // skip members for now
    }

    private mapStateUsage(state: ast.StateUsage, stateUsage: ast.StateUsage): Generated {
        const exhibitStateName = this.declare(state, stateUsage);
        const stateType = stateUsage.isParallel ? "ParallelState" : "State";

        return this.expandToBlock(
            `contains ${exhibitStateName}: ${stateType} subsets states`,
            stateUsage.children,
            (e) => this.mapMembership(stateUsage, e),
            { appendNewLineIfNotEmpty: true }
        );
    }

    private mapStateSubactionMembership(stateSubaction: ast.StateSubactionMembership): Generated {
        if (stateSubaction.kind == "entry") {
            return this.mapEntryStateSubactionMembership(stateSubaction);
        }
        if (stateSubaction.kind == "do") {
            return this.mapDoStateSubactionMembership(stateSubaction);
        }
        if (stateSubaction.kind == "exit") {
            return this.mapExitStateSubactionMembership(stateSubaction);
        }

        throw new Error(`Unexpected subaction kind: ${stateSubaction.kind}`);
    }

    private mapEntryStateSubactionMembership(
        stateSubactionMembership: ast.StateSubactionMembership
    ): Generated {
        const action = stateSubactionMembership.target as ActionUsage;
        return this.actionMapper.mapActionUsage("entryAction", action);
    }

    private mapDoStateSubactionMembership(
        _stateSubactionMembership: ast.StateSubactionMembership
    ): Generated {
        throw new Error("Do subaction are not yet supported!");
    }

    private mapExitStateSubactionMembership(
        stateSubactionMembership: ast.StateSubactionMembership
    ): Generated {
        const action = stateSubactionMembership.target as ActionUsage;
        return this.actionMapper.mapActionUsage("exitAction", action);
    }
}
