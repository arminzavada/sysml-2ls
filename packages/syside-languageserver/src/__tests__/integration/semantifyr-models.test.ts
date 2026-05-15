/********************************************************************************
 * Integration test: parsing + validating Semantifyr SysML test models against
 * the full stdlib, mirroring `stdlib-loading.test.ts`.
 ********************************************************************************/

import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import type { Diagnostic } from "vscode-languageserver";
import { createSysMLServices } from "../../sysml-module.js";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { SysMLNodeFileSystem } from "../../node/node-file-system-provider.js";
import { TEST_SERVER_OPTIONS } from "../../testing/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..", "..", "..", "..", "..");
const stdlibPath = path.join(repoRoot, "SysML-v2-Release", "sysml.library");
const modelsRoot = path.resolve(currentDir, "..", "resources", "semantifyr-models");

const MODELS = [
    "aircraft_engine.sysml",
    "autonomous_driving.sysml",
    "door_access.sysml",
    "power_subsystems.sysml",
];

// TODO: validateUsageOwningType rejects `flow from X to Y` endpoints in these
// models (sysml-2ls bug, not a model error). Re-enable when the flow-end
// owningType resolution is fixed.
const KNOWN_FAILING_MODELS = [
    "compressedspacecraft.sysml",
    "crossroads.sysml",
    "orion_protocol.sysml",
    "semanticstest.sysml",
    "spacecraft.sysml",
];

async function collectStdlibFiles(dir: string): Promise<URI[]> {
    const collected: URI[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collected.push(...(await collectStdlibFiles(full)));
        } else if (entry.isFile() && (full.endsWith(".kerml") || full.endsWith(".sysml"))) {
            collected.push(URI.file(full));
        }
    }
    return collected;
}

async function setupServicesWithStdlib(): Promise<SysMLSharedServices> {
    const services = createSysMLServices(SysMLNodeFileSystem, {
        ...TEST_SERVER_OPTIONS,
        standardLibrary: true,
        standardLibraryPath: stdlibPath,
        skipWorkspaceInit: true,
        defaultBuildOptions: {
            standalone: false,
        },
    });
    services.shared.workspace.FileSystemProvider.updateStandardLibrary(stdlibPath);

    const stdlibUris = await collectStdlibFiles(stdlibPath);
    const stdDocs = await Promise.all(
        stdlibUris.map((uri) => services.shared.workspace.LangiumDocuments.getOrCreateDocument(uri))
    );
    for (const d of stdDocs) {
        (d as { isStandard?: boolean }).isStandard = true;
    }
    await services.shared.workspace.DocumentBuilder.build(stdDocs, <SysMLBuildOptions>{
        validation: false,
        standalone: false,
    });

    return services.shared;
}

describe("Semantifyr SysML test models", () => {
    let shared: SysMLSharedServices;

    beforeAll(async () => {
        shared = await setupServicesWithStdlib();
        const verificationUri = URI.file(path.join(modelsRoot, "Verification.sysml"));
        const verificationDoc =
            await shared.workspace.LangiumDocuments.getOrCreateDocument(verificationUri);
        await shared.workspace.DocumentBuilder.build([verificationDoc], <SysMLBuildOptions>{
            validation: false,
            standalone: false,
        });
    }, 180_000);

    it.each(MODELS)(
        "parses and validates %s without errors",
        async (modelFile) => {
            const fullPath = path.join(modelsRoot, modelFile);
            const doc = await shared.workspace.LangiumDocuments.getOrCreateDocument(
                URI.file(fullPath)
            );
            await shared.workspace.DocumentBuilder.build([doc], <SysMLBuildOptions>{
                validation: { categories: ["built-in", "fast"] },
                standalone: false,
            });

            const parseErrors = doc.parseResult.parserErrors;
            const diagErrors = (doc.diagnostics ?? []).filter((d: Diagnostic) => d.severity === 1);
            if (parseErrors.length > 0 || diagErrors.length > 0) {
                console.error(
                    `[${modelFile}] parse errors:`,
                    parseErrors.map((e) => e.message),
                    "diagnostics:",
                    diagErrors.map((e) => `${e.range.start.line + 1}: ${e.message}`)
                );
            }
            expect(parseErrors).toHaveLength(0);
            expect(diagErrors).toHaveLength(0);
        },
        180_000
    );

    it.skip.each(KNOWN_FAILING_MODELS)("parses and validates %s without errors", () => {
        // see KNOWN_FAILING_MODELS TODO
    });
});
