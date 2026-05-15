/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Mixin } from "ts-mixer";
import { FlowUsage } from "../../generated/ast.js";
import { ItemFlowMeta, ItemFlowOptions } from "../KerML/item-flow.js";
import { ElementIDProvider, GeneralType, MetatypeProto, metamodelOf } from "../metamodel.js";
import { ActionUsageMeta, ActionUsageOptions } from "./action-usage.js";
import { ConnectorAsUsageMeta, ConnectorAsUsageOptions } from "./connector-as-usage.js";
import { AstNode, LangiumDocument } from "langium";
import {
    Edge,
    ElementParts,
    EndFeatureMembershipMeta,
    FeatureMeta,
    ItemFlowEndMeta,
    ParameterMembershipMeta,
} from "../KerML/index.js";
import { EventOccurrenceUsageMeta } from "./event-occurrence-usage.js";
import { enumerable } from "../../utils/index.js";

export interface FlowUsageOptions
    extends ConnectorAsUsageOptions, ActionUsageOptions, ItemFlowOptions {
    // can't override ends alone to allow only either ends or messages
    ends?: readonly Edge<EndFeatureMembershipMeta, ItemFlowEndMeta>[];
    /**
     * Message events for Messages. Will be used instead of `ends` if non-empty.
     */
    messages?: readonly Edge<ParameterMembershipMeta, EventOccurrenceUsageMeta>[];
}

@metamodelOf(FlowUsage.$type, {
    base: "Flows::flows",
    message: "Flows::messages",
    enclosedPerformance: "Performances::Performance::enclosedPerformances",
    subperformance: "Performances::Performance::subperformances",
    ownedPerformance: "Objects::Object::ownedPerformances",
    subaction: "Actions::Action::subactions",
    ownedAction: "Parts::Part::ownedActions",
    entry: "States::StateAction::entryAction",
    do: "States::StateAction::doAction",
    exit: "States::StateAction::exitAction",
    trigger: "Actions::TransitionAction::accepter",
    guard: "Actions::TransitionAction::guard",
    effect: "Actions::TransitionAction::effect",
    timeslice: "Occurrences::Occurrence::timeSlices",
    snapshot: "Occurrences::Occurrence::snapshots",
})
export class FlowUsageMeta extends Mixin(ActionUsageMeta, ItemFlowMeta, ConnectorAsUsageMeta) {
    // this ideally would be mutually exclusive with `ends`
    private _messages: ParameterMembershipMeta<EventOccurrenceUsageMeta>[] = [];

    @enumerable
    public get messages(): readonly ParameterMembershipMeta<EventOccurrenceUsageMeta>[] {
        return this._messages;
    }

    get isMessageConnection(): boolean {
        return this._messages.length > 0;
    }

    /**
     * Adds owned message members and returns the new number of message members.
     * Any messages will be used in place of `ends`.
     */
    addMessage(...value: Edge<ParameterMembershipMeta, EventOccurrenceUsageMeta>[]): number {
        return this.addOwnedEdges(this._messages, value);
    }

    /**
     * Removes message sby value and returns the new number of message members.
     */
    removeMessage(...value: readonly ParameterMembershipMeta[]): number {
        return this.removeOwnedElements(this._messages, value);
    }

    /**
     * Removes messages by predicate and returns the new number of message members.
     */
    removeMessageIf(predicate: (value: ParameterMembershipMeta) => boolean): number {
        return this.removeOwnedElementsIf(this._messages, predicate);
    }

    override defaultGeneralTypes(): GeneralType[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isPartOwnedComposite()) supertypes.push("ownedAction");
        else if (this.isStructureOwnedComposite()) supertypes.push("ownedPerformance");

        if (this.isActionOwnedComposite()) supertypes.push("subaction");
        else if (this.isBehaviorOwnedComposite()) supertypes.push("subperformance");
        else if (this.isBehaviorOwned()) supertypes.push("enclosedPerformance");

        return supertypes;
    }

    override defaultSupertype(): string {
        return this.isMessageConnection ? "message" : "base";
    }

    override ast(): FlowUsage | undefined {
        return this._ast as FlowUsage;
    }

    protected override collectDeclaration(parts: ElementParts): void {
        FeatureMeta.prototype["collectDeclaration"].call(this, parts);

        if (this.isMessageConnection) parts.push(["messages", this.messages]);
        else if (this.ends.length > 0) parts.push(["ends", this.ends]);
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: FlowUsageOptions
    ): T["$meta"] {
        const model = ActionUsageMeta.create.call(
            this,
            provider,
            document,
            options
        ) as FlowUsageMeta;
        if (options) {
            ConnectorAsUsageMeta.applyConnectorOptions(model, options);
            ItemFlowMeta.applyItemFlowOptions(model, options);
            if (options.messages) model.addMessage(...options.messages);
        }
        return model;
    }
}

declare module "../../generated/ast.js" {
    interface FlowUsage {
        $meta: FlowUsageMeta;
    }
}
