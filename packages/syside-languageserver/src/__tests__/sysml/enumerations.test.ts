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
    Comment,
    Documentation,
    EnumerationDefinition,
    EnumerationUsage,
    MetadataUsage,
    OwningMembership,
    VariantMembership,
} from "#generated/ast.js";
import { parsedNode } from "../../testing/index.js";

test("annotating members in enumeration bodies can have visibility", async () => {
    await expect(
        parsedNode(
            `enum def E {
                private doc /* hidden */
                public comment /* c */
                protected @M;
                private metadata m : M;
                enum a;
            }`,
            { lang: "sysml", node: EnumerationDefinition.$type }
        )
    ).resolves.toMatchObject({
        children: [
            {
                $type: OwningMembership.$type,
                visibility: "private",
                target: { $type: Documentation.$type },
            },
            {
                $type: OwningMembership.$type,
                visibility: "public",
                target: { $type: Comment.$type },
            },
            {
                $type: OwningMembership.$type,
                visibility: "protected",
                target: { $type: MetadataUsage.$type },
            },
            {
                $type: OwningMembership.$type,
                visibility: "private",
                target: { $type: MetadataUsage.$type },
            },
            { $type: VariantMembership.$type, target: { $type: EnumerationUsage.$type } },
        ],
    });
});

test("prefixed enumerated values and metadata usages are distinguished after visibility", async () => {
    await expect(
        parsedNode(
            `enum def E {
                #M a;
                private #M b;
                #M metadata m : M;
                private #M metadata n : M;
                c;
                doc /* d */
            }`,
            { lang: "sysml", node: EnumerationDefinition.$type }
        )
    ).resolves.toMatchObject({
        children: [
            { $type: VariantMembership.$type, target: { $type: EnumerationUsage.$type } },
            {
                $type: VariantMembership.$type,
                visibility: "private",
                target: { $type: EnumerationUsage.$type },
            },
            { $type: OwningMembership.$type, target: { $type: MetadataUsage.$type } },
            {
                $type: OwningMembership.$type,
                visibility: "private",
                target: { $type: MetadataUsage.$type },
            },
            { $type: VariantMembership.$type, target: { $type: EnumerationUsage.$type } },
            { $type: OwningMembership.$type, target: { $type: Documentation.$type } },
        ],
    });
});
