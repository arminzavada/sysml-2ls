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
import { SuccessionFlowUsage } from "#generated/ast.js";
import {
    SuccessionItemFlowMeta,
    SuccessionItemFlowOptions,
} from "../KerML/succession-item-flow.js";
import { metamodelOf } from "../metamodel.js";
import { FlowUsageMeta, FlowUsageOptions } from "./flow-usage.js";
import { Edge, EndFeatureMembershipMeta, ItemFlowEndMeta } from "../KerML/index.js";

export interface SuccessionFlowUsageOptions extends SuccessionItemFlowOptions, FlowUsageOptions {
    ends?: readonly Edge<EndFeatureMembershipMeta, ItemFlowEndMeta>[];
}

@metamodelOf(SuccessionFlowUsage.$type, {
    base: "Flows::successionFlows",
    message: "Flows::successionFlows",
})
export class SuccessionFlowUsageMeta extends Mixin(SuccessionItemFlowMeta, FlowUsageMeta) {
    override ast(): SuccessionFlowUsage | undefined {
        return this._ast as SuccessionFlowUsage;
    }
}

declare module "#generated/ast.js" {
    interface SuccessionFlowUsage {
        $meta: SuccessionFlowUsageMeta;
    }
}
