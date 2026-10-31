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
    ActionDefinition,
    ActionUsage,
    Documentation,
    FeatureMembership,
    Membership,
    ReferenceUsage,
    SendActionUsage,
    SuccessionAsUsage,
    TransitionUsage,
} from "#generated/ast.js";
import { parseSysML, parsedNode } from "../../testing/index.js";

describe("guarded successions", () => {
    test("pilot DecisionTest parses", async () => {
        await expect(
            parsedNode(
                `action def DecisionTest {
                    attribute x = 1;

                    decide 'test x';
                    if x == 1 then A1;
                    if x > 1 then A2;
                    else A3;

                    then decide D;
                    if true then A1;
                    if false then A2;

                    action A1;
                    action A2;
                    action A3;

                    public succession S first A1
                        if x == 0 then A2;

                    private first A3;
                        if x > 0 then 'test x';
                }`,
                { lang: "sysml", node: TransitionUsage.$type, index: 5 }
            )
        ).resolves.toMatchObject({
            $container: { $type: FeatureMembership.$type, visibility: "public" },
            declaredName: "S",
        });
    });

    test("visibility does not change how neighbouring members parse", async () => {
        await expect(
            parsedNode(
                `action def D {
                    action A1;
                    action A2;
                    private first A1;
                    public first A1 then A2;
                    protected succession S first A1 then A2;
                    private first A1 if true then A2;
                    public succession T first A1 if true then A2;
                    first A1 if true then A2;
                }`,
                { lang: "sysml", node: ActionDefinition.$type }
            )
        ).resolves.toMatchObject({
            children: [
                { $type: FeatureMembership.$type, target: { $type: ActionUsage.$type } },
                { $type: FeatureMembership.$type, target: { $type: ActionUsage.$type } },
                { $type: Membership.$type, visibility: "private" },
                {
                    $type: FeatureMembership.$type,
                    visibility: "public",
                    target: { $type: SuccessionAsUsage.$type },
                },
                {
                    $type: FeatureMembership.$type,
                    visibility: "protected",
                    target: { $type: SuccessionAsUsage.$type, declaredName: "S" },
                },
                {
                    $type: FeatureMembership.$type,
                    visibility: "private",
                    target: { $type: TransitionUsage.$type },
                },
                {
                    $type: FeatureMembership.$type,
                    visibility: "public",
                    target: { $type: TransitionUsage.$type, declaredName: "T" },
                },
                { $type: FeatureMembership.$type, target: { $type: TransitionUsage.$type } },
            ],
        });
    });
});

describe("send nodes", () => {
    test("a leading body is parsed as the action body", async () => {
        const node = await parsedNode(
            "action a2 { in s; action snd send { in :>> payload = s; } }",
            { lang: "sysml", node: SendActionUsage.$type }
        );
        expect(node.payload).toBeUndefined();
        expect(node).toMatchObject({
            declaredName: "snd",
            children: [{ target: { $type: ReferenceUsage.$type } }],
        });
    });

    test("a leading body with annotations is parsed as the action body", async () => {
        const node = await parsedNode("action def A { send { doc /* x */ } }", {
            lang: "sysml",
            node: SendActionUsage.$type,
        });
        expect(node.payload).toBeUndefined();
        expect(node).toMatchObject({ children: [{ target: { $type: Documentation.$type } }] });
    });

    test.each([
        ["send;", {}],
        ["send via r;", { sender: {} }],
        ["send via r to s;", { sender: {}, receiver: {} }],
        ["send to r;", { receiver: {} }],
        ["send 1 via r to s;", { payload: {}, sender: {}, receiver: {} }],
    ])("'%s' parses", async (text: string, parameters: object) => {
        await expect(
            parsedNode(`action def A { ${text} }`, { lang: "sysml", node: SendActionUsage.$type })
        ).resolves.toMatchObject(parameters);
    });

    test("pilot ActionTest send forms parse", async () => {
        const result = await parseSysML(
            `action a2 {
                in s : S;
                action aa {
                    out part target;
                }
                flow aa.target to snd.receiver;
                action snd send {
                    in :>> payload = s;
                }
                action snd2 send via this to aa.target;
                bind s = snd2.payload;
            }`,
            { build: false }
        );
        expect(result.parserErrors).toHaveLength(0);
    });
});

describe("assignment nodes", () => {
    test("an expression as the assignment target is a parse error", async () => {
        const result = await parseSysML(
            "part def P { attribute x; } part p : P; action a { assign (p).x := 1; }"
        );
        expect(result.parserErrors).not.toHaveLength(0);
    });
});
