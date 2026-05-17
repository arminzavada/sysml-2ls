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
import { BindingConnectorAsUsage } from "#generated/ast.js";
import { BindingConnectorMeta, BindingConnectorOptions } from "../KerML/binding-connector.js";
import { metamodelOf } from "../metamodel.js";
import { ConnectorAsUsageMeta, ConnectorAsUsageOptions } from "./connector-as-usage.js";
import type { FeatureMeta } from "../KerML/_internal.js";

export interface BindingConnectorAsUsageOptions
    extends BindingConnectorOptions, ConnectorAsUsageOptions {}

@metamodelOf(BindingConnectorAsUsage.$type, {
    base: "Links::selfLinks",
    binary: "Links::selfLinks",
})
export class BindingConnectorAsUsageMeta extends Mixin(BindingConnectorMeta, ConnectorAsUsageMeta) {
    override ast(): BindingConnectorAsUsage | undefined {
        return this._ast as BindingConnectorAsUsage;
    }

    /**
     * The resolved feature on the left side of `bind a = b`. For a binding
     * that rebinds a local port (`bind myPort = parent.somePort`), this is
     * the local `myPort`. Returns `undefined` if the end has no reference
     * subsetting.
     */
    sourceFeature(): FeatureMeta | undefined {
        return this.relatedFeatures().at(0) ?? undefined;
    }

    /**
     * The resolved feature on the right side of `bind a = b`. For a chained
     * target (`bind p = q.r`), this is the resolved chained feature `q.r`.
     */
    targetFeature(): FeatureMeta | undefined {
        return this.relatedFeatures().at(1) ?? undefined;
    }
}

declare module "#generated/ast.js" {
    interface BindingConnectorAsUsage {
        $meta: BindingConnectorAsUsageMeta;
    }
}
