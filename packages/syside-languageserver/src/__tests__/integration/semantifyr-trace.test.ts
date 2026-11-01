import { describe, expect, it, beforeAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import { AstNode, isAstNode, isReference, LangiumDocument } from "langium";
import type { Diagnostic } from "vscode-languageserver";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";
import {
    mapSemantifyrTraceToSysML,
    SemantifyrTrace,
} from "../../services/lsp/semantifyr/SemantifyrMapper.js";
import type { SemantifyrTraceEntry } from "../../services/lsp/semantifyr/SemantifyrTraceGenerator.js";
import { Namespace } from "#generated/ast.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const modelsRoot = path.resolve(currentDir, "..", "resources", "semantifyr-models");
const caseName = "TrafficLightABehaviorNormalGreenUnreachableViolated";

function canonical(node: AstNode): Record<string, unknown> {
    const result: Record<string, unknown> = { $type: node.$type };
    for (const [key, value] of Object.entries(node)) {
        if (!key.startsWith("$")) {
            result[key] = canonicalValue(value);
        }
    }
    return result;
}

function canonicalValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(canonicalValue);
    }
    if (isReference(value)) {
        return value.$refText;
    }
    if (isAstNode(value)) {
        return canonical(value);
    }
    return value;
}

// Nests every traced call under its preceding sibling, as Semantifyr's tracer lookup still does.
function nestUnderPrecedingSibling(entries: SemantifyrTraceEntry[]): SemantifyrTraceEntry[] {
    const [first, ...rest] = entries.map((entry) => ({
        ...entry,
        innerTraces: entry.innerTraces && nestUnderPrecedingSibling(entry.innerTraces),
    }));
    if (first === undefined) {
        return [];
    }
    const nestedRest = nestUnderPrecedingSibling(rest);
    if (nestedRest.length === 0) {
        return [first];
    }
    return [{ ...first, innerTraces: [...(first.innerTraces ?? []), ...nestedRest] }];
}

// Two exhibit states in one part, and features named like the trace's own declarations.
const machineModel = `
private import ScalarValues::Boolean;

item def Ping;
port def PingPort {
    out item ping : Ping;
}

part def Device {
    port pings : PingPort;
    attribute startup : Boolean;

    exhibit state Power {
        transition first start then Off;
        state Off;
        transition powerUp first Off then On;
        state On;
    }

    exhibit state Mode {
        transition first start then Idle;
        state Idle;
        transition wake first Idle do send new Ping() via pings then Busy;
        state Busy;
    }
}

part def Machine {
    part device : Device;
    attribute step0 : Boolean;
    attribute dwell1 : Boolean;
}

verification def MachineCase {
    subject system : Machine;
}
`;

function entry(
    self: string,
    calledTransition: string,
    innerTraces: SemantifyrTraceEntry[] | null = null
): SemantifyrTraceEntry {
    const item = { parameter: "item", value: "semantifyr::sysml::model::global_Ping" };
    const isSend = calledTransition.endsWith("::Port::setOutgoingItem");
    return { self, calledTransition, arguments: isSend ? [item] : [], innerTraces };
}

const fire = "semantifyr::sysml::states::Transition::fire";
const send = "semantifyr::sysml::ports::Port::setOutgoingItem";
const passTime = "semantifyr::sysml::verification::VerificationCaseDefinition::passTime";

const machineTrace: SemantifyrTrace = {
    initialStep: { traces: [] },
    initializedStep: { traces: [entry("root.system.device.pings", send)] },
    steps: [
        { traces: [entry("root.system.device.Power.powerUp", fire), entry("root", passTime)] },
        {
            traces: [
                entry("root.system.device.Mode.wake", fire, [
                    entry("root.system.device.pings", send),
                ]),
                entry("root", passTime),
            ],
        },
    ],
};

describe("Semantifyr trace generation", () => {
    let shared: SysMLSharedServices;
    let model: Namespace;
    let trace: SemantifyrTrace;
    let generated: LangiumDocument;
    let machine: Namespace;

    async function build(document: LangiumDocument): Promise<void> {
        await shared.workspace.DocumentBuilder.build([document], <SysMLBuildOptions>{
            validation: true,
            standalone: false,
        });
    }

    function errors(document: LangiumDocument): string[] {
        return [
            ...document.parseResult.parserErrors.map((error) => error.message),
            ...(document.diagnostics ?? [])
                .filter((diagnostic: Diagnostic) => diagnostic.severity === 1)
                .map((diagnostic) => `${diagnostic.range.start.line + 1}: ${diagnostic.message}`),
        ];
    }

    beforeAll(async () => {
        ({ shared } = await setupServicesWithStdlib());
        const documents = await Promise.all(
            ["Verification.sysml", "crossroads.sysml"].map((file) =>
                shared.workspace.LangiumDocuments.getOrCreateDocument(
                    URI.file(path.join(modelsRoot, file))
                )
            )
        );
        await shared.workspace.DocumentBuilder.build(documents, <SysMLBuildOptions>{
            validation: false,
            standalone: false,
        });
        model = documents[1].parseResult.value as Namespace;
        trace = JSON.parse(
            await fs.readFile(path.join(modelsRoot, "etc", "crossroads-green.trace.json"), "utf-8")
        );

        const uri = URI.file(path.join(modelsRoot, "etc", "generated.trace.sysml"));
        generated = shared.workspace.LangiumDocumentFactory.fromString(
            mapSemantifyrTraceToSysML(model, trace, caseName),
            uri
        );
        shared.workspace.LangiumDocuments.addDocument(generated);
        await build(generated);

        const machineDocument = shared.workspace.LangiumDocumentFactory.fromString(
            machineModel,
            URI.file(path.join(modelsRoot, "etc", "machine.sysml"))
        );
        shared.workspace.LangiumDocuments.addDocument(machineDocument);
        await build(machineDocument);
        expect(errors(machineDocument)).toEqual([]);
        machine = machineDocument.parseResult.value as Namespace;
    }, 180_000);

    it("generates a trace that SysIDE validates without errors", () => {
        expect(errors(generated)).toEqual([]);
    });

    it("generates the reference pair's trace model", async () => {
        const reference = await shared.workspace.LangiumDocuments.getOrCreateDocument(
            URI.file(path.join(modelsRoot, "etc", "crossroads-green.trace.sysml"))
        );
        await build(reference);

        expect(errors(reference)).toEqual([]);
        expect(canonical(generated.parseResult.value)).toEqual(
            canonical(reference.parseResult.value)
        );
    }, 180_000);

    it("places sends by their enclosing transition however Semantifyr nests them", () => {
        const misnested: SemantifyrTrace = {
            initialStep: trace.initialStep,
            initializedStep: trace.initializedStep && {
                traces: nestUnderPrecedingSibling(trace.initializedStep.traces),
            },
            steps: trace.steps.map((step) => ({ traces: nestUnderPrecedingSibling(step.traces) })),
        };

        expect(mapSemantifyrTraceToSysML(model, misnested, caseName)).toEqual(
            mapSemantifyrTraceToSysML(model, trace, caseName)
        );
    });

    it("follows the transitions of every state a part exhibits", async () => {
        const text = mapSemantifyrTraceToSysML(machine, machineTrace, "MachineCase");
        const document = shared.workspace.LangiumDocumentFactory.fromString(
            text,
            URI.file(path.join(modelsRoot, "etc", "machine.trace.sysml"))
        );
        shared.workspace.LangiumDocuments.addDocument(document);
        await build(document);

        expect(errors(document)).toEqual([]);
        expect(text).toContain("exhibit state Power :>> Power {");
        expect(text).toContain("exhibit state Mode :>> Mode {");
        expect(text).toContain("action powerUp1 :> powerUp;");
        expect(text).toContain("action wake1 :> wake {");
        expect(text).toContain("connection : HappensDuring connect dwell2 to device.Power.on1;");
        expect(text).toContain("connection : HappensDuring connect dwell2 to device.Mode.busy1;");
    }, 180_000);

    it("names its own declarations apart from the features of the model", () => {
        const text = mapSemantifyrTraceToSysML(machine, machineTrace, "MachineCase");

        expect(text).toContain("action startup_1 {");
        expect(text).toContain("snapshot step0_1;");
        expect(text).toContain("timeslice dwell1_1 {");
        expect(text).toContain("connection : HappensWhile connect step0_1 to self.startShot;");
        expect(text).toContain("connection : HappensWhile connect step0_1 to device.startup_1;");
        expect(text).toContain("succession : HappensJustBefore first step1 then dwell1_1;");
    });

    it("takes the traced call from the trace, not from the element it is called on", () => {
        const unexpected = (traces: SemantifyrTraceEntry[]): SemantifyrTrace => ({
            initialStep: { traces: [] },
            initializedStep: null,
            steps: [{ traces }],
        });
        const setIncomingItem = "semantifyr::sysml::ports::Port::setIncomingItem";

        expect(() =>
            mapSemantifyrTraceToSysML(
                machine,
                unexpected([entry("root.system.device.pings", setIncomingItem)]),
                "MachineCase"
            )
        ).toThrow(`Unexpected traced call '${setIncomingItem}' on 'root.system.device.pings'`);
        expect(() =>
            mapSemantifyrTraceToSysML(
                machine,
                unexpected([entry("root.system.device.pings", fire)]),
                "MachineCase"
            )
        ).toThrow(`Unexpected traced call '${fire}' on 'root.system.device.pings'`);
        expect(() =>
            mapSemantifyrTraceToSysML(
                machine,
                unexpected([entry("root.system.device", passTime)]),
                "MachineCase"
            )
        ).toThrow(`Unexpected traced call '${passTime}' on 'root.system.device'`);
    });
});
