import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LangiumDocument } from "langium";
import { URI } from "vscode-uri";
import { SysMLNodeFileSystem } from "../../../../node/node-file-system-provider.js";
import { createSysMLServices } from "../../../../sysml-module.js";
import { TEST_SERVER_OPTIONS } from "../../../../testing/index.js";

describe("Workspace manager", () => {
    let root: string;

    beforeAll(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), "syside-workspace-"));
        await fs.mkdir(path.join(root, "library"));
        await fs.mkdir(path.join(root, "workspace"));
        await fs.writeFile(
            path.join(root, "library", "Library.sysml"),
            "standard library package Library {\n    part def Base;\n    part def Base;\n}\n"
        );
        await fs.writeFile(
            path.join(root, "workspace", "Model.sysml"),
            "part def Model :> Undefined;\n"
        );
    });

    afterAll(async () => {
        await fs.rm(root, { recursive: true, force: true });
    });

    test("initialization validates the workspace documents but not the standard library", async () => {
        const libraryPath = path.join(root, "library");
        const { shared } = createSysMLServices(SysMLNodeFileSystem, {
            ...TEST_SERVER_OPTIONS,
            standardLibrary: true,
            standardLibraryPath: libraryPath,
            skipWorkspaceInit: false,
            defaultBuildOptions: {
                standalone: false,
            },
        });
        shared.workspace.FileSystemProvider.updateStandardLibrary(libraryPath);
        await shared.workspace.ConfigurationProvider.initialized({});
        await shared.workspace.WorkspaceManager.initializeWorkspace([
            { uri: URI.file(path.join(root, "workspace")).toString(), name: "workspace" },
        ]);

        const documents = shared.workspace.LangiumDocuments;
        const library = documents.getDocument(URI.file(path.join(libraryPath, "Library.sysml")));
        const model = documents.getDocument(URI.file(path.join(root, "workspace", "Model.sysml")));
        const messages = (document: LangiumDocument | undefined): unknown[] | undefined => {
            return document?.diagnostics?.map((diagnostic) => {
                return diagnostic.message;
            });
        };

        expect(messages(library)).toEqual([]);
        expect(messages(model)).toContainEqual(expect.stringContaining("Undefined"));

        await shared.workspace.DocumentBuilder.update([model!.uri], []);

        expect(messages(library)).toEqual([]);
        expect(messages(model)).toContainEqual(expect.stringContaining("Undefined"));
    });
});
