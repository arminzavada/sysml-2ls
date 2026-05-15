/********************************************************************************
 * Integration test: stdlib loading + real-world SysML example parsing.
 *
 * Tests the full document-build flow that the test suite otherwise bypasses
 * via `standardLibrary: false`. Catches regressions in stdlib path
 * resolution, document collection, and parsing of real `SysML-v2-Release`
 * content.
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
const examplesRoot = path.join(repoRoot, "SysML-v2-Release", "sysml", "src", "examples");

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

async function setupServicesWithStdlib(): Promise<{
    shared: SysMLSharedServices;
    stdDocCount: number;
}> {
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
        stdlibUris.map((uri) => services.shared.workspace.LangiumDocuments.getOrCreateDocument(uri)),
    );
    for (const d of stdDocs) {
        (d as { isStandard?: boolean }).isStandard = true;
    }
    await services.shared.workspace.DocumentBuilder.build(stdDocs, <SysMLBuildOptions>{
        validation: false,
        standalone: false,
    });

    return { shared: services.shared, stdDocCount: stdDocs.length };
}

describe("SysML release integration", () => {
    let shared: SysMLSharedServices;
    let stdDocCount: number;

    beforeAll(async () => {
        const setup = await setupServicesWithStdlib();
        shared = setup.shared;
        stdDocCount = setup.stdDocCount;
    }, 120_000);

    it("stdlib path exists on disk", async () => {
        const stat = await fs.stat(stdlibPath);
        expect(stat.isDirectory()).toBe(true);
    });

    it("loaded all stdlib documents", () => {
        expect(stdDocCount).toBeGreaterThan(50);
    });

    it("validates `part def Vehicle` without stdlib errors", async () => {
        const docFactory = shared.workspace.LangiumDocumentFactory;
        const doc = docFactory.fromString(
            "part def Vehicle;",
            URI.parse("file:///tmp/stdlib-test-vehicle.sysml"),
        );
        shared.workspace.LangiumDocuments.addDocument(doc);
        await shared.workspace.DocumentBuilder.build([doc], <SysMLBuildOptions>{
            validation: { categories: ["built-in", "fast"] },
            standalone: false,
        });

        const errors = (doc.diagnostics ?? []).filter((d: Diagnostic) => d.severity === 1);
        if (errors.length > 0) {
            // eslint-disable-next-line no-console
            console.error("Errors:", errors.map((e: Diagnostic) => `${e.range.start.line + 1}: ${e.message}`));
        }
        expect(errors).toHaveLength(0);
    }, 120_000);

    it("validates `port def FuelCmdPort` without stdlib errors (the user's reported failure case)", async () => {
        const docFactory = shared.workspace.LangiumDocumentFactory;
        const doc = docFactory.fromString(
            "port def FuelCmdPort;",
            URI.parse("file:///tmp/stdlib-test-port.sysml"),
        );
        shared.workspace.LangiumDocuments.addDocument(doc);
        await shared.workspace.DocumentBuilder.build([doc], <SysMLBuildOptions>{
            validation: { categories: ["built-in", "fast"] },
            standalone: false,
        });

        const errors = (doc.diagnostics ?? []).filter((d: Diagnostic) => d.severity === 1);
        if (errors.length > 0) {
            // eslint-disable-next-line no-console
            console.error("Errors:", errors.map((e: Diagnostic) => `${e.range.start.line + 1}: ${e.message}`));
        }
        expect(errors).toHaveLength(0);
    }, 120_000);

    it("parses an Analysis example from SysML-v2-Release (parse errors only)", async () => {
        const exampleFile = path.join(examplesRoot, "Analysis Examples", "AnalysisAnnotation.sysml");
        const doc = await shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(exampleFile));
        await shared.workspace.DocumentBuilder.build([doc], <SysMLBuildOptions>{ validation: false });

        const parseErrors = doc.parseResult.parserErrors;
        expect(parseErrors).toHaveLength(0);
    }, 120_000);
});
