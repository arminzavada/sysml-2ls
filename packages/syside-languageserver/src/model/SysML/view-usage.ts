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

import { ViewUsage, ViewDefinition } from "../../generated/ast.js";
import { metamodelOf } from "../metamodel.js";
import { PartUsageMeta, PartUsageOptions } from "./part-usage.js";

export type ViewUsageOptions = PartUsageOptions;

@metamodelOf(ViewUsage.$type, {
    base: "Views::views",
    subview: "Views::View::subviews",
})
export class ViewUsageMeta extends PartUsageMeta {
    override defaultSupertype(): string {
        return this.isSubview() ? "subview" : "base";
    }

    isSubview(): boolean {
        const parent = this.owner();
        return Boolean(parent?.isAny(ViewDefinition.$type, ViewUsage.$type));
    }

    override ast(): ViewUsage | undefined {
        return this._ast as ViewUsage;
    }
}

declare module "../../generated/ast.js" {
    interface ViewUsage {
        $meta: ViewUsageMeta;
    }
}
