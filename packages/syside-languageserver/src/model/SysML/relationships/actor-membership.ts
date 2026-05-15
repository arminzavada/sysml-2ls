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

import { AstNode, LangiumDocument } from "langium";
import { ActorMembership } from "../../../generated/ast.js";
import { RelationshipOptionsBody } from "../../KerML/index.js";
import { ParameterMembershipMeta } from "../../KerML/relationships/parameter-membership.js";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel.js";
import { PartUsageMeta } from "../part-usage.js";
import { CaseUsageMeta } from "../case-usage.js";
import { CaseDefinitionMeta } from "../case-definition.js";
import { RequirementDefinitionMeta } from "../requirement-definition.js";
import { RequirementUsageMeta } from "../requirement-usage.js";

@metamodelOf(ActorMembership.$type)
export class ActorMembershipMeta<
    T extends PartUsageMeta = PartUsageMeta,
> extends ParameterMembershipMeta<T> {
    override ast(): ActorMembership | undefined {
        return this._ast as ActorMembership;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: RelationshipOptionsBody<
            PartUsageMeta,
            CaseDefinitionMeta | CaseUsageMeta | RequirementDefinitionMeta | RequirementUsageMeta
        >
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../../generated/ast.js" {
    interface ActorMembership {
        $meta: ActorMembershipMeta;
    }
}
