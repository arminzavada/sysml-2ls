/********************************************************************************
 * Integration test: full-stdlib diagnostics snapshot.
 *
 * Loads every file under SysML-v2-Release/sysml.library, runs all validation
 * checks, and snapshots the resulting diagnostics keyed by stdlib-relative
 * path. Replaces the legacy `run-validation.ts` script — refresh the snapshot
 * with `pnpm test -- -u` (or vitest's `--update` flag).
 ********************************************************************************/

import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import type { Diagnostic } from "vscode-languageserver";
import type { LangiumDocument } from "langium";
import { setupServicesWithStdlib, stdlibPath } from "./stdlib-fixture.js";

interface DiagnosticEntry {
    severity: Diagnostic["severity"];
    code: Diagnostic["code"];
    source: Diagnostic["source"];
    range: Diagnostic["range"];
    message: string;
}

function collectDiagnostics(docs: LangiumDocument[]): Record<string, DiagnosticEntry[]> {
    const result: Record<string, DiagnosticEntry[]> = {};
    for (const doc of docs) {
        if (!doc.diagnostics || doc.diagnostics.length === 0) continue;
        const key = path.relative(stdlibPath, doc.uri.fsPath).replaceAll(path.sep, "/");
        result[key] = doc.diagnostics.map((d) => ({
            severity: d.severity,
            code: d.code,
            source: d.source,
            range: d.range,
            message: d.message,
        }));
    }
    // sort keys for a stable snapshot regardless of filesystem traversal order
    return Object.fromEntries(
        Object.entries(result).sort(([a], [b]) => a.localeCompare(b))
    );
}

describe("stdlib diagnostics", () => {
    let diagnostics: Record<string, DiagnosticEntry[]>;

    beforeAll(async () => {
        const { stdDocs } = await setupServicesWithStdlib({ validateStdlib: true });
        diagnostics = collectDiagnostics(stdDocs);
    }, 300_000);

    it("matches the recorded snapshot", () => {
        expect(diagnostics).toMatchSnapshot();
    });
});
