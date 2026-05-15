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

import { Inheritance, ItemFeature, Redefinition } from "../../generated/ast.js";
import { SubtypeKeys } from "../../services/sysml-ast-reflection.js";
import { metamodelOf } from "../metamodel.js";
import { FeatureMeta, FeatureOptions } from "./_internal.js";

export const ItemFeatureImplicits = {
    payload: "Transfers::Transfer::payload",
};

export type ItemFeatureOptions = FeatureOptions;

@metamodelOf(ItemFeature.$type, ItemFeatureImplicits)
export class ItemFeatureMeta extends FeatureMeta {
    override ast(): ItemFeature | undefined {
        return this._ast as ItemFeature;
    }
    override defaultSupertype(): string {
        return "payload";
    }

    override specializationKind(): SubtypeKeys<Inheritance> {
        return Redefinition.$type;
    }
}

declare module "../../generated/ast.js" {
    interface ItemFeature {
        $meta: ItemFeatureMeta;
    }
}
