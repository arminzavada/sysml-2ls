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
import { isSendActionUsage, Namespace } from "#generated/ast.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const modelsRoot = path.resolve(currentDir, "..", "resources", "semantifyr-models");
const caseName = "TrafficLightABehaviorNormalGreenUnreachableViolated";

// Send occurrences are named by hand in the reference pair; nothing refers to them.
function canonical(node: AstNode): Record<string, unknown> {
    const result: Record<string, unknown> = { $type: node.$type };
    for (const [key, value] of Object.entries(node)) {
        if (!key.startsWith("$") && !(key === "declaredName" && isSendActionUsage(node))) {
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

describe("Semantifyr trace generation", () => {
    let shared: SysMLSharedServices;
    let model: Namespace;
    let trace: SemantifyrTrace;
    let generated: LangiumDocument;

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
});
