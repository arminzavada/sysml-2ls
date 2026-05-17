/********************************************************************************
 * Integration test: parsing + validating Semantifyr SysML test models against
 * the full stdlib, mirroring `stdlib-loading.test.ts`.
 ********************************************************************************/

import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import type { Diagnostic } from "vscode-languageserver";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const modelsRoot = path.resolve(currentDir, "..", "resources", "semantifyr-models");

const MODELS = [
    "aircraft_engine.sysml",
    "autonomous_driving.sysml",
    "compressedspacecraft.sysml",
    "crossroads.sysml",
    "door_access.sysml",
    "orion_protocol.sysml",
    "power_subsystems.sysml",
    "semanticstest.sysml",
    "spacecraft.sysml",
];

describe("Semantifyr SysML test models", () => {
    let shared: SysMLSharedServices;

    beforeAll(async () => {
        ({ shared } = await setupServicesWithStdlib());
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
});
