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
    "crossroads.sysml",
    "compressedspacecraft.sysml",
    "door_access.sysml",
    "orion_protocol.sysml",
];

describe("Semantifyr OXSTS transformation", () => {
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

            const oxsts = mapSysMLNamespaceToSemantifyr(doc.parseResult.value as Namespace);

            // Failure markers the mappers emit when they can't interpret a node.
            // None of the four pinned models should hit any of these.
            const failureMarkers = [
                "UNKNOWN_TYPE_OF_ACTION",
                "UNKNOWN_ACCEPT_ACTION",
                "UNKNOWN_TIMEOUT_EXPRESSION",
                "UNKNOWN_PORT_TYPE",
                "UNKNOWN_ATTRIBUTE_TYPE",
                "UNKNOWN_TYPE_OF_EXPRESSION",
                "UNKNOWN_TYPE_OF_INVOCATION",
                "UNKNOWN_KIND_OF_OPERATOR",
                "UNEXPECTED_LITERAL_EXPRESSION",
                "UNEXPECTED_EXPRESSION",
                "UNEXPECTED_ELEMENT",
                "UNEXPECTED_AMOUNT_OF_PARTS",
                "UNEXPECTED_PARTS",
                "UNRESOLVED_PORT_DEFINITION",
                "UNDEFINED_ELEMENT",
                "UNDEFINED_MEMBERSHIP",
                "EMPTY_PARTS",
            ];
            for (const marker of failureMarkers) {
                expect(oxsts).not.toContain(marker);
            }

            expect(oxsts).toMatchSnapshot();
        },
        180_000
    );
});
