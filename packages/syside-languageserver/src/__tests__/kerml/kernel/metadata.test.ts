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

import { FeatureTyping, MetadataFeature } from "#generated/ast.js";
import { parsedNode } from "../../../testing/index.js";

test.each(["@ :", "metadata :", "metadata typed by", "@m :", "@"])(
    "metadata feature can be declared with '%s'",
    async (declaration: string) => {
        await expect(
            parsedNode(`metaclass M; feature y { ${declaration} M; }`, {
                node: MetadataFeature.$type,
            })
        ).resolves.toMatchObject({
            heritage: [{ $type: FeatureTyping.$type }],
        });
    }
);
