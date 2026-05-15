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
import { FlowDefinition } from "../../generated/ast.js";
import { InteractionMeta, InteractionOptions } from "../KerML/interaction.js";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../metamodel.js";
import { ActionDefinitionMeta, ActionDefinitionOptions } from "./action-definition.js";
import { AstNode, LangiumDocument } from "langium";

export interface FlowDefinitionOptions extends InteractionOptions, ActionDefinitionOptions {}

@metamodelOf(FlowDefinition.$type, {
    base: "Flows::Message",
    binary: "Flows::Message",
})
// @ts-expect-error ignoring static inheritance error
export class FlowDefinitionMeta extends Mixin(InteractionMeta, ActionDefinitionMeta) {
    override ast(): FlowDefinition | undefined {
        return this._ast as FlowDefinition;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: FlowDefinitionOptions
    ): T["$meta"] {
        const model = ActionDefinitionMeta.create.call(
            this,
            provider,
            document,
            options
        ) as FlowDefinitionMeta;
        return model;
    }
}

declare module "../../generated/ast.js" {
    interface FlowDefinition {
        $meta: FlowDefinitionMeta;
    }
}
