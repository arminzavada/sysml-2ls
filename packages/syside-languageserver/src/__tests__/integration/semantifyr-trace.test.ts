import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import type { LangiumDocument } from "langium";
import type { Diagnostic } from "vscode-languageserver";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";
import {
    mapSemantifyrTraceToSysML,
    type SemantifyrTraceParameters,
} from "../../services/lsp/semantifyr/SemantifyrMapper.js";
import type {
    SemantifyrTrace,
    SemantifyrWitness,
    SemantifyrWitnessStep,
} from "../../services/lsp/semantifyr/SemantifyrTraceInput.js";
import type { SemantifyrNameMap } from "../../services/lsp/semantifyr/SemantifyrNameMap.js";
import type { Namespace } from "#generated/ast.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const modelsRoot = path.resolve(currentDir, "..", "resources", "semantifyr-models");
const caseName = "TrafficLightABehaviorNormalGreenUnreachableViolated";

interface Reference {
    witness: SemantifyrWitness;
    trace: SemantifyrTrace;
    nameMap: SemantifyrNameMap;
}

describe("Semantifyr trace generation", () => {
    let shared: SysMLSharedServices;
    let model: Namespace;
    let reference: Reference;

    async function read<T>(name: string): Promise<T> {
        return JSON.parse(await fs.readFile(path.join(modelsRoot, "etc", name), "utf-8")) as T;
    }

    function parameters(changes: Partial<Reference> = {}): SemantifyrTraceParameters {
        return { caseName, ...structuredClone(reference), ...changes };
    }

    function generate(changes: Partial<Reference> = {}): string {
        return mapSemantifyrTraceToSysML(model, parameters(changes));
    }

    function errors(document: LangiumDocument): string[] {
        return [
            ...document.parseResult.parserErrors.map((error) => {
                return error.message;
            }),
            ...(document.diagnostics ?? [])
                .filter((diagnostic: Diagnostic) => {
                    return diagnostic.severity === 1;
                })
                .map((diagnostic) => {
                    return `${diagnostic.range.start.line + 1}: ${diagnostic.message}`;
                }),
        ];
    }

    beforeAll(async () => {
        ({ shared } = await setupServicesWithStdlib());
        const documents = await Promise.all(
            [
                path.resolve(currentDir, "..", "..", "..", "library", "Verification.sysml"),
                path.join(modelsRoot, "crossroads.sysml"),
            ].map((file) => {
                return shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(file));
            })
        );
        await shared.workspace.DocumentBuilder.build(documents, <SysMLBuildOptions>{
            validation: false,
            standalone: false,
        });
        model = documents[1].parseResult.value as Namespace;
        reference = {
            witness: await read("crossroads-green.witness.json"),
            trace: await read("crossroads-green.trace.json"),
            nameMap: await read("crossroads-green.names.json"),
        };
    }, 180_000);

    it("generates the reference trace from the reference witness", async () => {
        const expected = await fs.readFile(
            path.join(modelsRoot, "etc", "crossroads-green.trace.sysml"),
            "utf-8"
        );

        expect(generate()).toEqual(expected);
    });

    it("generates a trace that SysIDE validates against the model", async () => {
        const document = shared.workspace.LangiumDocumentFactory.fromString(
            generate(),
            URI.file(path.join(modelsRoot, "etc", "generated.trace.sysml"))
        );
        shared.workspace.LangiumDocuments.addDocument(document);
        await shared.workspace.DocumentBuilder.build([document], <SysMLBuildOptions>{
            validation: true,
            standalone: false,
        });

        expect(errors(document)).toEqual([]);
    }, 180_000);

    it("follows the traced entries and exits where the optimizer removed a state's flag", () => {
        const strip = (step: SemantifyrWitnessStep): SemantifyrWitnessStep => {
            return {
                values: step.values.filter((value) => {
                    return !value.variable.endsWith(".activeState");
                }),
            };
        };
        const witness = {
            initializedStep: strip(reference.witness.initializedStep),
            steps: reference.witness.steps.map(strip),
        };

        expect(generate({ witness })).toEqual(generate());
    });

    it("refuses a name map of another model text", () => {
        const nameMap = { ...reference.nameMap, modelHash: "fnv1a64:0000000000000000" };

        expect(() => {
            return generate({ nameMap });
        }).toThrow(/^names\.json\.modelHash: /);
    });

    it("takes a missing innerTraces as null, as the Live backend's wire leaves it out", () => {
        const trace = JSON.parse(
            JSON.stringify(reference.trace, (key, value: unknown) => {
                return key === "innerTraces" && value === null ? undefined : value;
            })
        ) as SemantifyrTrace;

        expect(JSON.stringify(trace)).not.toContain('"innerTraces":null');
        expect(generate({ trace })).toEqual(generate());
    });

    it("locates a malformed entry of the trace", () => {
        const trace = structuredClone(reference.trace);
        (trace.steps[1].traces[0] as unknown as Record<string, unknown>).self = 7;

        expect(() => {
            return generate({ trace });
        }).toThrow("trace.json.steps[1].traces[0].self: expected a string");
    });

    it("locates a traced firing the witness does not show", () => {
        const trace = structuredClone(reference.trace);
        const firing = trace.steps
            .flatMap((step) => {
                return step.traces;
            })
            .find((entry) => {
                return entry.calledTransition.endsWith("::Transition::fire");
            })!;
        trace.steps[0].traces.push({ ...firing, innerTraces: null });

        expect(() => {
            return generate({ trace });
        }).toThrow(/^trace\.json\.steps\[0\]\.traces\[\d+\]\.self: the witness does not leave/);
    });

    it("locates an instance path the name map does not know", () => {
        const trace = structuredClone(reference.trace);
        trace.steps[0].traces.push({
            self: "root.system.nothingHere",
            calledTransition: "semantifyr::sysml::states::Transition::fire",
            arguments: [],
            innerTraces: null,
        });

        expect(() => {
            return generate({ trace });
        }).toThrow(/'nothingHere' of 'root\.system\.nothingHere' is in no entry of the name map$/);
    });

    it("leaves out a traced call of a site it does not show", () => {
        const trace = structuredClone(reference.trace);
        trace.steps[0].traces.push({
            self: "root.system.controller",
            calledTransition: "semantifyr::sysml::parts::Part::havocInputEvents",
            arguments: [],
            innerTraces: null,
        });

        expect(generate({ trace })).toEqual(generate());
    });
});
