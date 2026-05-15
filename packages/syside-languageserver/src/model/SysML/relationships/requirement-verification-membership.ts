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
    ObjectiveMembership,
    RequirementUsage,
    RequirementVerificationMembership,
    VerificationCaseDefinition,
    VerificationCaseUsage,
} from "../../../generated/ast.js";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel.js";
import { RequirementConstraintMembershipMeta } from "./requirement-constraint-membership.js";
import { RequirementUsageMeta } from "../requirement-usage.js";
import { AstNode, LangiumDocument } from "langium";
import { RelationshipOptionsBody } from "../../KerML/index.js";
import { RequirementDefinitionMeta } from "../requirement-definition.js";
import { RequirementConstraintKind } from "../../enums.js";

@metamodelOf(RequirementVerificationMembership.$type)
export class RequirementVerificationMembershipMeta<
    T extends RequirementUsageMeta = RequirementUsageMeta,
> extends RequirementConstraintMembershipMeta<T> {
    override get kind(): RequirementConstraintKind {
        return "requirement";
    }
    override set kind(value: RequirementConstraintKind) {
        // empty;
    }

    override ast(): RequirementVerificationMembership | undefined {
        return this._ast as RequirementVerificationMembership;
    }

    isLegalVerification(): boolean {
        let owner = this.owner();
        if (!owner?.is(RequirementUsage.$type) || !owner.parent()?.is(ObjectiveMembership.$type))
            return false;
        owner = owner.owner();
        return Boolean(owner?.isAny(VerificationCaseDefinition.$type, VerificationCaseUsage.$type));
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: RelationshipOptionsBody<
            RequirementUsageMeta,
            RequirementDefinitionMeta | RequirementUsageMeta
        >
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../../generated/ast.js" {
    interface RequirementVerificationMembership {
        $meta: RequirementVerificationMembershipMeta;
    }
}
