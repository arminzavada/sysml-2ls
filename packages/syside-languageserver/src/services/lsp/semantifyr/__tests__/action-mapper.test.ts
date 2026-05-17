/********************************************************************************
 * Unit tests for the Semantifyr action mapper. Standalone (no stdlib) tests
 * confirming that `send X()` and `send new X()` map to distinct OXSTS classes.
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
    it("maps `send new X()` to ConstructorInvocationAction", async () => {
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
        expect(oxsts).toContain("ConstructorInvocationAction");
        expect(oxsts).toContain("global_Ping");
    });

    it("maps bare `send X()` to SendAction (back-compat)", async () => {
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
        expect(oxsts).toContain("SendAction");
        expect(oxsts).not.toContain("ConstructorInvocationAction");
        expect(oxsts).toContain("global_Ping");
    });

    it("emits both forms when both appear in the same model", async () => {
        const oxsts = await compile(`
            part def P {
                port p: CommandPort;
                exhibit state S {
                    state s1 {
                        entry send Ping() via p;
                    }
                    state s2 {
                        entry send new Ping() via p;
                    }
                }
            }
        `);
        expect(oxsts).toMatch(/entryAction: SendAction\b/);
        expect(oxsts).toMatch(/entryAction: ConstructorInvocationAction\b/);
    });
});
