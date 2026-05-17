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

import { describe, expect, test } from "vitest";
import { AstNode } from "langium";
import {
    AcceptActionUsage,
    isSendActionUsage,
    isAcceptActionUsage,
    SendActionUsage,
} from "#generated/ast.js";
import { parseSysML } from "../../../testing/index.js";
import { streamAst } from "../../../utils/ast-util.js";

async function parseAndCollect(src: string): Promise<{
    sends: SendActionUsage[];
    accepts: AcceptActionUsage[];
}> {
    const result = await parseSysML(src);
    expect(result.parserErrors).toHaveLength(0);
    const sends: SendActionUsage[] = [];
    const accepts: AcceptActionUsage[] = [];
    streamAst(result.value as AstNode).forEach((node) => {
        if (isSendActionUsage(node)) sends.push(node);
        if (isAcceptActionUsage(node)) accepts.push(node);
    });
    return { sends, accepts };
}

const COMMON_PROLOGUE = `
item def Ping;
port def CommandPort { in item command: Ping; }
`;

describe("SendActionUsageMeta derived methods", () => {
    test("payloadItemDefinition resolves the Item type", async () => {
        const { sends } = await parseAndCollect(`
            ${COMMON_PROLOGUE}
            part def P {
                port p: CommandPort;
                exhibit state S { state s1 { entry send Ping() via p; } }
            }
        `);
        expect(sends).toHaveLength(1);
        const item = sends[0].$meta.payloadItemDefinition()?.ast();
        expect(item?.declaredName).toBe("Ping");
    });

    test("isConstructor() is true only for `send new X()`", async () => {
        const { sends } = await parseAndCollect(`
            ${COMMON_PROLOGUE}
            part def P {
                port p: CommandPort;
                exhibit state S {
                    state s1 { entry send Ping() via p; }
                    state s2 { entry send new Ping() via p; }
                }
            }
        `);
        expect(sends).toHaveLength(2);
        expect(sends[0].$meta.isConstructor()).toBe(false);
        expect(sends[1].$meta.isConstructor()).toBe(true);
    });

    test("senderFeature resolves the `via` port reference", async () => {
        const { sends } = await parseAndCollect(`
            ${COMMON_PROLOGUE}
            part def P {
                port p: CommandPort;
                exhibit state S { state s1 { entry send Ping() via p; } }
            }
        `);
        const portFeature = sends[0].$meta.senderFeature()?.ast();
        expect(portFeature?.declaredName).toBe("p");
    });

    test("payloadInvocation() is undefined for empty payload", async () => {
        const { sends } = await parseAndCollect(`
            ${COMMON_PROLOGUE}
            part def P {
                port p: CommandPort;
                exhibit state S { state s1 { entry send to p; } }
            }
        `);
        expect(sends).toHaveLength(1);
        expect(sends[0].$meta.payloadInvocation()).toBeUndefined();
        expect(sends[0].$meta.payloadItemDefinition()).toBeUndefined();
    });
});

describe("AcceptActionUsageMeta derived methods", () => {
    test("payloadItemDefinition resolves the accepted Item type", async () => {
        const { accepts } = await parseAndCollect(`
            ${COMMON_PROLOGUE}
            part def P {
                port p: CommandPort;
                exhibit state S {
                    state s1;
                    transition first s1 accept : Ping via p then s1;
                }
            }
        `);
        const transitionAccept = accepts.find((a) => a.$meta.payloadItemDefinition());
        expect(transitionAccept).toBeDefined();
        expect(transitionAccept!.$meta.payloadItemDefinition()?.ast()?.declaredName).toBe("Ping");
    });

    test("payloadTrigger() returns the trigger for `accept after N`", async () => {
        const { accepts } = await parseAndCollect(`
            ${COMMON_PROLOGUE}
            private import SI::s;
            part def P {
                port p: CommandPort;
                exhibit state S {
                    state s1;
                    transition first s1 accept after 30 [s] then s1;
                }
            }
        `);
        const trigger = accepts
            .map((a) => a.$meta.payloadTrigger()?.ast())
            .find((t) => t?.kind === "after");
        expect(trigger?.kind).toBe("after");
    });
});
