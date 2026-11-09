import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import {
    createConnection,
    createMessageConnection,
    MessageConnection,
    StreamMessageReader,
    StreamMessageWriter,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import { startServer } from "../../launch/index.js";
import { SysMLNodeFileSystem } from "../../node/node-file-system-provider.js";
import type {
    SemantifyrMapping,
    SemantifyrVerificationCase,
} from "../../services/lsp/semantifyr/SemantifyrMapper.js";
import { ClientParams } from "../../testing/index.js";
import { stdlibPath } from "./stdlib-fixture.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const languageServerRoot = path.resolve(currentDir, "..", "..", "..");
const modelsRoot = path.join(currentDir, "..", "resources", "semantifyr-models");
const uri = URI.file(path.join(languageServerRoot, "library", "crossroads.sysml")).toString();

describe("Semantifyr commands over the LSP connection", () => {
    let client: MessageConnection;
    let text: string;
    let version = 1;

    function execute<T>(command: string, argument: unknown): Promise<T> {
        return client.sendRequest("workspace/executeCommand", {
            command,
            arguments: [argument],
        });
    }

    async function edit(newText: string): Promise<void> {
        version++;
        await client.sendNotification("textDocument/didChange", {
            textDocument: {
                uri,
                version,
            },
            contentChanges: [
                {
                    text: newText,
                },
            ],
        });
    }

    beforeAll(async () => {
        const toServer = new PassThrough();
        const toClient = new PassThrough();
        startServer(
            createConnection(new StreamMessageReader(toServer), new StreamMessageWriter(toClient)),
            SysMLNodeFileSystem,
            {
                standardLibraryPath: stdlibPath,
                logStatistics: false,
                defaultBuildOptions: {
                    standalone: false,
                },
            }
        );
        client = createMessageConnection(
            new StreamMessageReader(toClient),
            new StreamMessageWriter(toServer)
        );
        client.onRequest(() => {
            return null;
        });
        client.onNotification(() => {
            return;
        });
        client.listen();

        await client.sendRequest("initialize", {
            ...ClientParams,
            rootPath: languageServerRoot,
            rootUri: null,
            workspaceFolders: [
                {
                    uri: URI.file(path.join(languageServerRoot, "library")).toString(),
                    name: "library",
                },
            ],
        });
        await client.sendNotification("initialized", {});

        text = await fs.readFile(path.join(modelsRoot, "crossroads.sysml"), "utf-8");
        await client.sendNotification("textDocument/didOpen", {
            textDocument: {
                uri,
                languageId: "sysml",
                version,
                text,
            },
        });
    }, 180_000);

    afterAll(() => {
        client.dispose();
    });

    it("finds the verification cases of the document with their ranges", async () => {
        const cases = await execute<SemantifyrVerificationCase[]>(
            "syside.semantifyr.sysml.verificationCases",
            uri
        );

        expect(cases.map((found) => found.name)).toContain("ControllerOperatingReachable");
        const reachable = cases.find((found) => found.name === "ControllerOperatingReachable");
        expect(text.split("\n")[reachable!.range.start.line]).toContain(
            "verification def ControllerOperatingReachable"
        );
    }, 120_000);

    it("returns the OXSTS of the document as text", async () => {
        const mapping = await execute<SemantifyrMapping>("syside.semantifyr.sysml.oxsts", uri);

        expect(mapping.diagnostics).toEqual([]);
        expect(mapping.oxsts).toContain("class ControllerOperatingReachable");
    }, 120_000);

    it("returns the SysML trace model of a named case", async () => {
        const trace = JSON.parse(
            await fs.readFile(path.join(modelsRoot, "etc", "crossroads-green.trace.json"), "utf-8")
        );
        const caseName = "TrafficLightABehaviorNormalGreenUnreachableViolated";

        const model = await execute<string>("syside.semantifyr.sysml.trace", {
            uri,
            caseName,
            trace,
        });

        expect(model).toContain(`part def ${caseName}Trace`);
    }, 120_000);

    it("sees an edit made just before the command", async () => {
        await edit(`${text}\npart unsupportedUsage;\n`);

        const mapping = await execute<SemantifyrMapping>("syside.semantifyr.sysml.oxsts", uri);

        expect(mapping.oxsts).toBeUndefined();
        expect(mapping.diagnostics.map((diagnostic) => diagnostic.range.start.line)).toEqual([
            text.split("\n").length,
        ]);
    }, 120_000);

    it("returns the errors of a broken document and no OXSTS", async () => {
        await edit(`${text}\npart def {`);

        const mapping = await execute<SemantifyrMapping>("syside.semantifyr.sysml.oxsts", uri);

        expect(mapping.oxsts).toBeUndefined();
        expect(mapping.diagnostics.length).toBeGreaterThan(0);
    }, 120_000);
});
