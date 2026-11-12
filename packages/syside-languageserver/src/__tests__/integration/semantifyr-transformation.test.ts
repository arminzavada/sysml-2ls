/********************************************************************************
 * Integration test: snapshot the Semantifyr OXSTS output for each TestModel.
 * Locks in the current transformation so refactors can't regress silently.
 ********************************************************************************/

import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";
import { mapSysMLNamespaceToSemantifyr } from "../../services/lsp/semantifyr/SemantifyrMapper.js";
import type { Namespace } from "#generated/ast.js";

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
    "topdowntransition.sysml",
];

describe("Semantifyr OXSTS transformation", () => {
    let shared: SysMLSharedServices;

    beforeAll(async () => {
        ({ shared } = await setupServicesWithStdlib());
        const verificationUri = URI.file(
            path.resolve(currentDir, "..", "..", "..", "library", "Verification.sysml")
        );
        const verificationDoc =
            await shared.workspace.LangiumDocuments.getOrCreateDocument(verificationUri);
        await shared.workspace.DocumentBuilder.build([verificationDoc], <SysMLBuildOptions>{
            validation: false,
            standalone: false,
        });
    }, 180_000);

    it.each(MODELS)(
        "OXSTS output for %s matches the recorded snapshot",
        async (modelFile) => {
            const fullPath = path.join(modelsRoot, modelFile);
            const doc = await shared.workspace.LangiumDocuments.getOrCreateDocument(
                URI.file(fullPath)
            );
            await shared.workspace.DocumentBuilder.build([doc], <SysMLBuildOptions>{
                validation: false,
                standalone: false,
            });

            expect(doc.parseResult.parserErrors).toHaveLength(0);

            const { oxsts, diagnostics } = mapSysMLNamespaceToSemantifyr(
                doc.parseResult.value as Namespace
            );
            const errors = diagnostics.filter((diagnostic) => {
                return diagnostic.severity === 1;
            });
            expect(errors).toEqual([]);

            expect(oxsts).toMatchSnapshot();
        },
        180_000
    );
});
