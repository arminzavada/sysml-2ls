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

import { Structure } from "../../generated/ast.js";
import { TypeClassifier } from "../enums.js";
import { metamodelOf } from "../metamodel.js";
import { ClassMeta, ClassOptions } from "./_internal.js";

export const ImplicitStructures = {
    base: "Objects::Object",
};

export type StructureOptions = ClassOptions;

@metamodelOf(Structure.$type, ImplicitStructures)
export class StructureMeta extends ClassMeta {
    protected override _classifier = TypeClassifier.Structure;

    override ast(): Structure | undefined {
        return this._ast as Structure;
    }
}

declare module "../../generated/ast.js" {
    interface Structure {
        $meta: StructureMeta;
    }
}
