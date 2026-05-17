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
import { ExhibitStateUsage, ReferenceSubsetting } from "#generated/ast.js";
import { FeatureMeta } from "../KerML/index.js";
import { GeneralType, metamodelOf } from "../metamodel.js";
import { PerformActionUsageMeta, PerformActionUsageOptions } from "./perform-action-usage.js";
import { StateUsageMeta, StateUsageOptions } from "./state-usage.js";
import { enumerable } from "../../utils/index.js";

export interface ExhibitStateUsageOptions extends PerformActionUsageOptions, StateUsageOptions {}

@metamodelOf(ExhibitStateUsage.$type, {
    performedAction: "Parts::Part::exhibitedStates",
})
export class ExhibitStateUsageMeta extends Mixin(PerformActionUsageMeta, StateUsageMeta) {
    @enumerable
    // @ts-expect-error issue with mixins
    override get isComposite(): boolean {
        return false;
    }
    override set isComposite(value) {
        // empty
    }

    override defaultGeneralTypes(): GeneralType[] {
        const supertypes = super.defaultGeneralTypes();
        if (this.isPerformedAction()) supertypes.push("performedAction");
        return supertypes;
    }

    override ast(): ExhibitStateUsage | undefined {
        return this._ast as ExhibitStateUsage;
    }
    override namingFeature(): FeatureMeta | undefined {
        return this.types(ReferenceSubsetting.$type).head() as FeatureMeta | undefined;
    }
}

declare module "#generated/ast.js" {
    interface ExhibitStateUsage {
        $meta: ExhibitStateUsageMeta;
    }
}
