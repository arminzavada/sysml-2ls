import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import type { LangiumDocument } from "langium";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { mapSysMLNamespaceToSemantifyr } from "../../services/lsp/semantifyr/SemantifyrMapper.js";
import {
    elementPath,
    resolveElementPath,
} from "../../services/lsp/semantifyr/SemantifyrElementPath.js";
import { hashModelText } from "../../services/lsp/semantifyr/SemantifyrNameMap.js";
import type { Namespace } from "#generated/ast.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const modelsRoot = path.resolve(currentDir, "..", "resources", "semantifyr-models");

describe("the name map of a translation", () => {
    let shared: SysMLSharedServices;
    let document: LangiumDocument;

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
        document = documents[1];
    }, 180_000);

    it("names every entry's element by a path that resolves back to it", () => {
        const model = document.parseResult.value as Namespace;
        const nameMap = mapSysMLNamespaceToSemantifyr(model).nameMap!;

        const unresolved = nameMap.entries.filter((entry) => {
            const element = resolveElementPath(model, entry.sysml);
            return !element || elementPath(element) !== entry.sysml;
        });

        expect(nameMap.entries.length).toBeGreaterThan(100);
        expect(unresolved).toEqual([]);
    });

    it("declares the children of a composite effect", () => {
        const nameMap = mapSysMLNamespaceToSemantifyr(
            document.parseResult.value as Namespace
        ).nameMap!;

        expect(nameMap.entries).toContainEqual({
            sysml: "CentralController::Behaviour::Operating::#2::#1::#0",
            oxsts: "CentralController.Behaviour.Operating.transition1.action.send1",
        });
    });

    it("carries the hash of the model text and the tick of its durations", () => {
        const nameMap = mapSysMLNamespaceToSemantifyr(
            document.parseResult.value as Namespace
        ).nameMap!;

        expect(nameMap.modelHash).toEqual(hashModelText(document.textDocument.getText()));
        expect(nameMap.tick).toEqual({ value: "1", unit: "s" });
    });
});
