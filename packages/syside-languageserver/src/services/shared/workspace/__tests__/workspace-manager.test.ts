import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
    AstUtils,
    Cancellation,
    DocumentState,
    LangiumDocument,
    OperationCancelled,
} from "langium";
import { URI } from "vscode-uri";
import { SysMLNodeFileSystem } from "../../../../node/node-file-system-provider.js";
import { ElementMeta } from "../../../../model/index.js";
import { createSysMLServices } from "../../../../sysml-module.js";
import { SysMLSharedServices } from "../../../services.js";
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
            path.join(root, "library", "Vehicles.sysml"),
            "standard library package Vehicles {\n    part def Wheel;\n    part def Car {\n        part wheel : Wheel;\n    }\n}\n"
        );
        await fs.writeFile(
            path.join(root, "workspace", "Model.sysml"),
            "part def Model :> Undefined;\n"
        );
    });

    afterAll(async () => {
        await fs.rm(root, { recursive: true, force: true });
    });

    async function createServices(): Promise<SysMLSharedServices> {
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
        return shared;
    }

    function initialize(
        shared: SysMLSharedServices,
        cancelToken = Cancellation.CancellationToken.None
    ): Promise<void> {
        return shared.workspace.WorkspaceManager.initializeWorkspace(
            [{ uri: URI.file(path.join(root, "workspace")).toString(), name: "workspace" }],
            cancelToken
        );
    }

    function messages(document: LangiumDocument | undefined): unknown[] | undefined {
        return document?.diagnostics?.map((diagnostic) => {
            return diagnostic.message;
        });
    }

    test("initialization validates the workspace documents but not the standard library", async () => {
        const shared = await createServices();
        await initialize(shared);
        const documents = shared.workspace.LangiumDocuments;
        const library = documents.getDocument(
            URI.file(path.join(root, "library", "Library.sysml"))
        );
        const model = documents.getDocument(URI.file(path.join(root, "workspace", "Model.sysml")));

        expect(messages(library)).toEqual([]);
        expect(messages(model)).toContainEqual(expect.stringContaining("Undefined"));

        await shared.workspace.DocumentBuilder.update([model!.uri], []);

        expect(messages(library)).toEqual([]);
        expect(messages(model)).toContainEqual(expect.stringContaining("Undefined"));
    });

    test("an update cancelling the initialization does not validate the standard library", async () => {
        const shared = await createServices();
        const source = new Cancellation.CancellationTokenSource();
        source.cancel();
        await expect(initialize(shared, source.token)).rejects.toBe(OperationCancelled);
        const documents = shared.workspace.LangiumDocuments;
        const library = documents.getDocument(
            URI.file(path.join(root, "library", "Library.sysml"))
        );
        const model = documents.getDocument(URI.file(path.join(root, "workspace", "Model.sysml")));

        await shared.workspace.DocumentBuilder.update([model!.uri], []);

        expect(messages(library)).toEqual([]);
        expect(messages(model)).toContainEqual(expect.stringContaining("Undefined"));
    });

    test("a request on a library document links all of it", async () => {
        const shared = await createServices();
        await initialize(shared);
        const uri = URI.file(path.join(root, "library", "Vehicles.sysml"));
        const document = shared.workspace.LangiumDocuments.getDocument(uri)!;
        const wheel = AstUtils.streamAst(document.parseResult.value)
            .map((node) => {
                return node.$meta as ElementMeta | undefined;
            })
            .find((element) => {
                return element?.qualifiedName === "Vehicles::Car::wheel";
            })!;

        expect(document.state).toBe(DocumentState.Validated);
        expect(wheel.setupState).toBe("none");

        await shared.workspace.DocumentBuilder.waitUntil(DocumentState.Linked, uri);

        expect(wheel.setupState).toBe("completed");
    });
});
