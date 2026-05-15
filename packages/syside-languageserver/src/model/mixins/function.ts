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

import { Expression, ReturnParameterMembership, SysMLFunction } from "../../generated/ast.js";
import {
    ExpressionMeta,
    FunctionMeta,
    ResultExpressionMembershipMeta,
    ReturnParameterMembershipMeta,
    TypeMeta,
} from "../KerML/_internal.js";
import { BasicMetamodel } from "../metamodel.js";

export class FunctionMixin {
    protected _result: ResultExpressionMembershipMeta | undefined;

    /**
     * @returns owned or inherited result parameter if one exists, otherwise undefined
     */
    resultParameter(this: TypeMeta & FunctionMixin): ResultExpressionMembershipMeta | undefined {
        if (!this._result) {
            return this.allTypes()
                .filter(BasicMetamodel.isAny(SysMLFunction.$type, Expression.$type))
                .map((e) => (e as FunctionMixin)._result)
                .nonNullable()
                .head();
        }

        return this._result;
    }

    returnParameter(this: TypeMeta): ReturnParameterMembershipMeta | undefined {
        return this._children.get(ReturnParameterMembership.$type).at(0);
    }

    /**
     * Get the expected return type of a function or expression
     * @param self AST node that owns this metamodel
     * @returns the return type or its qualified name if one was inferred, undefined otherwise
     */
    protected getReturnType(
        self: FunctionMeta | ExpressionMeta | undefined
    ): TypeMeta | string | undefined {
        if (!self) return;

        const result = self.resultParameter();
        if (result) {
            return result.element()?.returnType();
        }

        return self.returnParameter()?.element();
    }
}
