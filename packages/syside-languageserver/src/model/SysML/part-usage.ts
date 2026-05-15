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

import {
    ActorMembership,
    CaseDefinition,
    CaseUsage,
    PartUsage,
    RequirementDefinition,
    RequirementUsage,
    StakeholderMembership,
} from "../../generated/ast.js";
import { metamodelOf } from "../metamodel.js";
import { ItemUsageMeta, ItemUsageOptions } from "./item-usage.js";

export type PartUsageOptions = ItemUsageOptions;

@metamodelOf(PartUsage.$type, {
    base: "Parts::parts",
    subitem: "Items::Item::subparts",
    requirementActor: "Requirements::RequirementCheck::actors",
    requirementStakeholder: "Requirements::RequirementCheck::stakeholders",
    caseActor: "Cases::Case::actors",
})
export class PartUsageMeta extends ItemUsageMeta {
    override defaultSupertype(): string {
        if (this.isRequirementActor()) return "requirementActor";
        if (this.isRequirementStakeholder()) return "requirementStakeholder";
        if (this.isCaseActor()) return "caseActor";
        return super.defaultSupertype();
    }

    protected isRequirementActor(): boolean {
        return Boolean(
            this.parent()?.is(ActorMembership.$type) &&
                this.owner()?.isAny(RequirementDefinition.$type, RequirementUsage.$type)
        );
    }

    protected isRequirementStakeholder(): boolean {
        return Boolean(
            this.parent()?.is(StakeholderMembership.$type) &&
                this.owner()?.isAny(RequirementDefinition.$type, RequirementUsage.$type)
        );
    }

    protected isCaseActor(): boolean {
        return Boolean(
            this.parent()?.is(ActorMembership.$type) && this.owner()?.isAny(CaseDefinition.$type, CaseUsage.$type)
        );
    }

    override isIgnoredParameter(): boolean {
        return Boolean(
            super.isIgnoredParameter() ||
                this.parent()?.isAny(ActorMembership.$type, StakeholderMembership.$type)
        );
    }

    override ast(): PartUsage | undefined {
        return this._ast as PartUsage;
    }
}

declare module "../../generated/ast.js" {
    interface PartUsage {
        $meta: PartUsageMeta;
    }
}
