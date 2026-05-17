/********************************************************************************
 * Unit tests for the Semantifyr action mapper. Standalone (no stdlib) tests
 * confirming send/accept mapping for the common shapes used in TestModels.
 ********************************************************************************/

import { describe, expect, it } from "vitest";
import { parseSysML } from "../../../../testing/utils.js";
import { mapSysMLNamespaceToSemantifyr } from "../SemantifyrMapper.js";
import type { Namespace } from "#generated/ast.js";

const PROLOGUE = `
item def Ping;
port def CommandPort { in item command: Ping; }
`;

async function compile(modelBody: string): Promise<string> {
    const result = await parseSysML(`${PROLOGUE}\n${modelBody}`);
    expect(result.parserErrors).toHaveLength(0);
    return mapSysMLNamespaceToSemantifyr(result.value as Namespace);
}

describe("SendActionUsage mapping", () => {
    it("maps `send X()` to SendItemAction", async () => {
        const oxsts = await compile(`
            part def P {
                port p: CommandPort;
                exhibit state S {
                    state s1 {
                        entry send Ping() via p;
                    }
                }
            }
        `);
        expect(oxsts).toContain("SendItemAction");
        expect(oxsts).toContain("global_Ping");
    });

    it("maps `send new X()` to SendItemAction as well (constructor form is sugar)", async () => {
        const oxsts = await compile(`
            part def P {
                port p: CommandPort;
                exhibit state S {
                    state s1 {
                        entry send new Ping() via p;
                    }
                }
            }
        `);
        expect(oxsts).toContain("SendItemAction");
        expect(oxsts).toContain("global_Ping");
        // ConstructorInvocationAction was prototyped then dropped; the
        // constructor form collapses to SendItemAction at the OXSTS level.
        expect(oxsts).not.toContain("ConstructorInvocationAction");
    });
});
