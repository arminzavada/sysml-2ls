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
import { Differencing } from "../../../generated/ast.js";
import { ElementIDProvider, MetatypeProto, metamodelOf } from "../../metamodel.js";
import { ElementMeta, RelationshipMeta, RelationshipOptions, TypeMeta } from "../_internal.js";

@metamodelOf(Differencing.$type)
// @ts-expect-error TS2417 - intentional narrower static `create` signature
export class DifferencingMeta<T extends TypeMeta = TypeMeta> extends RelationshipMeta<T> {
    override ast(): Differencing | undefined {
        return this._ast as Differencing;
    }

    static override create<T extends AstNode>(
        this: MetatypeProto<T>,
        provider: ElementIDProvider,
        document: LangiumDocument,
        // cannot have source
        options?: RelationshipOptions<TypeMeta, TypeMeta, TypeMeta>
    ): T["$meta"] {
        return super.create(
            provider,
            document,
            options as RelationshipOptions<ElementMeta, ElementMeta | undefined>
        );
    }
}

declare module "../../../generated/ast.js" {
    interface Differencing {
        $meta: DifferencingMeta;
    }
}
