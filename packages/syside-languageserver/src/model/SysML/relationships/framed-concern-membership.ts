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
import { FramedConcernMembership } from "../../../generated/ast.js";
import { RelationshipOptionsBody } from "../../KerML/index.js";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel.js";
import { ConcernUsageMeta } from "../concern-usage.js";
import { RequirementDefinitionMeta } from "../requirement-definition.js";
import { RequirementConstraintMembershipMeta } from "./requirement-constraint-membership.js";
import { RequirementUsageMeta } from "../requirement-usage.js";
import { RequirementConstraintKind } from "../../enums.js";

@metamodelOf(FramedConcernMembership.$type)
export class FramedConcernMembershipMeta<
    T extends ConcernUsageMeta = ConcernUsageMeta,
> extends RequirementConstraintMembershipMeta<T> {
    override get kind(): RequirementConstraintKind {
        return "requirement";
    }
    override set kind(value: RequirementConstraintKind) {
        // empty;
    }

    override ast(): FramedConcernMembership | undefined {
        return this._ast as FramedConcernMembership;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        options?: RelationshipOptionsBody<
            ConcernUsageMeta,
            RequirementDefinitionMeta | RequirementUsageMeta
        >
    ): T["$meta"] {
        return super.create(provider, document, options);
    }
}

declare module "../../../generated/ast.js" {
    interface FramedConcernMembership {
        $meta: FramedConcernMembershipMeta;
    }
}
