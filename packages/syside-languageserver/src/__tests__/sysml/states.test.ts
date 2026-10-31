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

import { parseSysML, referenceTargets } from "../../testing/index.js";

describe("send actions in states", () => {
    test.each([
        "entry send to r;",
        "do send via r;",
        "exit send via r to r;",
        "state s1; transition first s1 do send to r then s1;",
        "state s1; transition first s1 accept Sig do send via r then s1;",
    ])("'%s' is rejected without a payload", async (member: string) => {
        const result = await parseSysML(`state def S { ${member} }`, { build: false });
        expect(result.parserErrors).not.toHaveLength(0);
    });

    test.each([
        "entry send 1 via r to r;",
        "do send 1 to r;",
        "exit send 1;",
        "state s1; transition first s1 do send 1 via r then s1;",
    ])("'%s' is accepted with a payload", async (member: string) => {
        const result = await parseSysML(`state def S { ${member} }`, { build: false });
        expect(result.parserErrors).toHaveLength(0);
    });
});

test("transition sources and targets resolve in the owning namespace", async () => {
    const result = await parseSysML(`package P {
        action def T { action s1; action s2; }
        state def S {
            state s1 { action x; }
            state s2;
            transition t : T first s1 then s2;
            transition u : T first s1.x then s2;
        }
    }`);
    expect(result.parserErrors).toHaveLength(0);
    expect(referenceTargets(result.value)).toEqual([
        "T -> P::T",
        "s1 -> P::S::s1",
        "s2 -> P::S::s2",
        "T -> P::T",
        "s1 -> P::S::s1",
        "x -> P::S::s1::x",
        "s2 -> P::S::s2",
    ]);
});
