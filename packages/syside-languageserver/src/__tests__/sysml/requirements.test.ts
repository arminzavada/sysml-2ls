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
    ActorMembership,
    ConcernUsage,
    ConstraintUsage,
    FramedConcernMembership,
    MultiplicityRange,
    ReferenceSubsetting,
    RequirementConstraintMembership,
    RequirementVerificationMembership,
    StakeholderMembership,
    SubjectMembership,
    Subsetting,
} from "#generated/ast.js";
import { parseSysML, parsedNode } from "../../testing/index.js";

describe("framed concern usages", () => {
    test("keyword form accepts requirement body members", async () => {
        await expect(
            parsedNode(
                `requirement def R {
                    frame concern c {
                        subject s;
                        require constraint { true }
                        assume constraint a;
                        frame concern f;
                        verify requirement r;
                        actor act;
                        stakeholder st;
                    }
                }`,
                { lang: "sysml", node: ConcernUsage.$type }
            )
        ).resolves.toMatchObject({
            children: [
                { $type: SubjectMembership.$type },
                { $type: RequirementConstraintMembership.$type },
                { $type: RequirementConstraintMembership.$type },
                { $type: FramedConcernMembership.$type },
                { $type: RequirementVerificationMembership.$type },
                { $type: ActorMembership.$type },
                { $type: StakeholderMembership.$type },
            ],
        });
    });

    test.each([
        ["result expression", "true"],
        ["return parameter", "return r : B;"],
        ["initial node", "action a; first a;"],
        ["control node", "fork f;"],
        ["send node", "send x;"],
        ["guarded succession", "action a; action b; first a if true then b;"],
    ])("keyword form rejects a %s", async (_, member) => {
        const result = await parseSysML(`requirement def R { frame concern c { ${member} } }`, {
            build: false,
        });
        expect(result.parserErrors).not.toHaveLength(0);
    });

    test("keyword form still accepts definition body members", async () => {
        await expect(
            parsedNode(
                `requirement def R {
                    frame concern c {
                        attribute x;
                        succession first x then x;
                        bind x = x;
                    }
                }`,
                { lang: "sysml", node: ConcernUsage.$type }
            )
        ).resolves.toMatchObject({ children: [{}, {}, {}] });
    });
});

describe("requirement member shorthands", () => {
    test.each([
        ["assume", ConstraintUsage.$type],
        ["require", ConstraintUsage.$type],
        ["frame", ConcernUsage.$type],
    ] as const)("'%s' shorthand accepts multiplicity", async (kw, type) => {
        await expect(
            parsedNode(`requirement def R { ${kw} c [0..*]; }`, { lang: "sysml", node: type })
        ).resolves.toMatchObject({
            heritage: [{ $type: ReferenceSubsetting.$type }],
            multiplicity: { target: { $type: MultiplicityRange.$type } },
        });
    });

    test("shorthand accepts multiplicity properties between specializations", async () => {
        await expect(
            parsedNode("requirement def R { frame c :> c [1] nonunique { } }", {
                lang: "sysml",
                node: ConcernUsage.$type,
            })
        ).resolves.toMatchObject({
            heritage: [{ $type: ReferenceSubsetting.$type }, { $type: Subsetting.$type }],
            multiplicity: { target: { $type: MultiplicityRange.$type } },
            isNonunique: true,
        });
    });

    test("shorthand accepts multiplicity properties without range", async () => {
        await expect(
            parsedNode("requirement def R { require c ordered; }", {
                lang: "sysml",
                node: ConstraintUsage.$type,
            })
        ).resolves.toMatchObject({ isOrdered: true });
    });

    test("'verify' shorthand rejects multiplicity", async () => {
        const result = await parseSysML("requirement def R { verify r [1]; }", { build: false });
        expect(result.parserErrors).not.toHaveLength(0);
    });
});
