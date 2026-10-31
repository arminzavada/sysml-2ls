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

import { FeatureValue, InterfaceUsage } from "#generated/ast.js";
import { parsedNode } from "../../testing/index.js";

test.each([
    ["abstract interface i = i1;", 0],
    ["interface i : I := i1 connect x.p1 to y.p2;", 2],
    ["interface = i1 connect (a, b, c);", 3],
])("interface usage '%s' accepts a feature value", async (text: string, ends: number) => {
    await expect(
        parsedNode(text, { lang: "sysml", node: InterfaceUsage.$type })
    ).resolves.toMatchObject({
        value: { $type: FeatureValue.$type },
        ends: Array(ends).fill({}),
    });
});
