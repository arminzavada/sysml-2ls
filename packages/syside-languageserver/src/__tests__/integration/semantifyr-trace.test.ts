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
import { mapSemantifyrTraceToSysML } from "../../services/lsp/semantifyr/SemantifyrMapper.js";
import type {
    SemantifyrReport,
    SemantifyrReportTrace,
} from "../../services/lsp/semantifyr/SemantifyrTraceInput.js";
import type { SemantifyrNameMap } from "../../services/lsp/semantifyr/SemantifyrNameMap.js";
import type { Namespace } from "#generated/ast.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const modelsRoot = path.resolve(currentDir, "..", "resources", "semantifyr-models");

interface Reference {
    report: SemantifyrReport;
    nameMap: SemantifyrNameMap;
}

describe("Semantifyr trace generation", () => {
    let shared: SysMLSharedServices;
    let model: Namespace;
    let reference: Reference;

    async function read<T>(name: string): Promise<T> {
        return JSON.parse(await fs.readFile(path.join(modelsRoot, "etc", name), "utf-8")) as T;
    }

    function generate(changes: Partial<Reference> = {}): string {
        return mapSemantifyrTraceToSysML(model, { ...structuredClone(reference), ...changes });
    }

    function withTrace(change: (trace: SemantifyrReportTrace) => void): Partial<Reference> {
        const report = structuredClone(reference.report);
        change(report.trace!);
        return { report };
    }

    function timed(): Partial<Reference> {
        return withTrace((trace) => {
            trace.steps[0].elapsed = 2;
            trace.steps[1].elapsed = "3/2";
        });
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
            report: await read("crossroads-green.report.json"),
            nameMap: await read("crossroads-green.names.json"),
        };
    }, 180_000);

    it("generates the reference trace from the reference report", async () => {
        const expected = await fs.readFile(
            path.join(modelsRoot, "etc", "crossroads-green.trace.sysml"),
            "utf-8"
        );

        expect(generate()).toEqual(expected);
    });

    it("generates a trace that SysIDE validates against the model, its waits included", async () => {
        const document = shared.workspace.LangiumDocumentFactory.fromString(
            generate(timed()),
            URI.file(path.join(modelsRoot, "etc", "generated.trace.sysml"))
        );
        shared.workspace.LangiumDocuments.addDocument(document);
        await shared.workspace.DocumentBuilder.build([document], <SysMLBuildOptions>{
            validation: true,
            standalone: false,
        });

        expect(errors(document)).toEqual([]);
    }, 180_000);

    it("states a step's elapsed time as a wait before its firings, in the name map's ticks", () => {
        const trace = generate(timed());
        const halfTicks = generate({
            ...timed(),
            nameMap: { ...reference.nameMap, tick: { value: "0.5", unit: "s" } },
        });

        expect(trace).toContain("first init then dwell1;");
        expect(trace).toContain("assert constraint { DurationOf(dwell1) == 2 [s] }");
        expect(trace).toContain("first dwell2 then step2;");
        expect(trace).toContain("assert constraint { DurationOf(dwell2) == (3 / 2) [s] }");
        expect(trace).not.toContain("dwell3");
        expect(halfTicks).toContain("assert constraint { DurationOf(dwell1) == 1 [s] }");
        expect(halfTicks).toContain("assert constraint { DurationOf(dwell2) == (3 / 4) [s] }");
    });

    it("shows no wait in a step of no elapsed time", () => {
        expect(generate()).not.toContain("dwell");
    });

    it("takes the verdict from the report", () => {
        const report = { ...structuredClone(reference.report), result: { verdict: "Passed" } };

        expect(generate()).toContain("return :>> verdict = VerdictKind::fail;");
        expect(generate({ report })).toContain("return :>> verdict = VerdictKind::pass;");
    });

    it("follows the traced entries and exits where the optimizer removed a state's flag", () => {
        const stripped = withTrace((trace) => {
            for (const state of trace.states) {
                for (const variable of Object.keys(state.values)) {
                    if (variable.endsWith(".activeState")) {
                        delete state.values[variable];
                    }
                }
            }
        });

        expect(generate(stripped)).toEqual(generate());
    });

    it("refuses a name map of another model text", () => {
        const nameMap = { ...reference.nameMap, modelHash: "fnv1a64:0000000000000000" };

        expect(() => {
            return generate({ nameMap });
        }).toThrow(/^names\.json\.modelHash: /);
    });

    it("refuses a report of a case the name map does not hold", () => {
        const report = {
            ...structuredClone(reference.report),
            verificationCase: "semantifyr::sysml::model::NoSuchCase",
        };

        expect(() => {
            return generate({ report });
        }).toThrow(/^report\.json\.verificationCase: 'semantifyr::sysml::model::NoSuchCase' is no/);
    });

    it("refuses a report of another version", () => {
        const report = { ...structuredClone(reference.report), version: 1 };

        expect(() => {
            return generate({ report });
        }).toThrow(/^report\.json\.version: version 1/);
    });

    it("refuses a report whose calls are missing, with their reason", () => {
        const missing = withTrace((trace) => {
            trace.missingCalls = "the calls were not recorded";
        });

        expect(() => {
            return generate(missing);
        }).toThrow(/^report\.json\.trace\.missingCalls: .*: the calls were not recorded$/);
    });

    it("refuses a step that does not start where the step before it ended", () => {
        const broken = withTrace((trace) => {
            trace.steps[1].source = 0;
        });

        expect(() => {
            return generate(broken);
        }).toThrow(/^report\.json\.trace\.steps\[1\]\.source: state 0, where/);
    });

    it("locates a malformed call of the trace", () => {
        const malformed = withTrace((trace) => {
            (trace.steps[1].calls[0] as unknown as Record<string, unknown>).self = 7;
        });

        expect(() => {
            return generate(malformed);
        }).toThrow("report.json.trace.steps[1].calls[0].self: expected a string");
    });

    it("locates a traced firing the states do not show", () => {
        const misplaced = withTrace((trace) => {
            const firing = trace.steps
                .flatMap((step) => {
                    return step.calls;
                })
                .find((call) => {
                    return call.transition.endsWith("::Transition::fire");
                })!;
            trace.steps[0].calls.push({ ...firing, calls: [] });
        });

        expect(() => {
            return generate(misplaced);
        }).toThrow(/^report\.json\.trace\.steps\[0\]\.calls\[\d+\]\.self: the states do not leave/);
    });

    it("locates an instance path the name map does not know", () => {
        const unknown = withTrace((trace) => {
            trace.steps[0].calls.push({
                self: "root.system.nothingHere",
                transition: "semantifyr::sysml::states::Transition::fire",
                arguments: {},
                calls: [],
            });
        });

        expect(() => {
            return generate(unknown);
        }).toThrow(/'nothingHere' of 'root\.system\.nothingHere' is in no entry of the name map$/);
    });

    it("leaves out a traced call of a site it does not show", () => {
        const unshown = withTrace((trace) => {
            trace.steps[0].calls.push({
                self: "root.system.controller",
                transition: "semantifyr::sysml::parts::Part::havocInputEvents",
                arguments: {},
                calls: [],
            });
        });

        expect(generate(unshown)).toEqual(generate());
    });
});
