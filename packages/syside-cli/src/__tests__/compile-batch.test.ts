import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileAction, compileBatchAction } from "../semantifyr-util.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const stdlibPath = path.join(repoRoot, "SysML-v2-Release", "sysml.library");
const modelsRoot = path.join(
    repoRoot,
    "packages",
    "syside-languageserver",
    "src",
    "__tests__",
    "resources",
    "semantifyr-models"
);

async function workspace(root: string, name: string, files: string[]): Promise<string> {
    const directory = path.join(root, name);
    await fs.mkdir(directory);
    for (const file of files) {
        await fs.copyFile(path.join(modelsRoot, file), path.join(directory, file));
    }
    return directory;
}

describe("compile-batch", () => {
    let root: string;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), "compile-batch-"));
        vi.spyOn(process, "exit").mockImplementation((code) => {
            throw new Error(`exit ${code}`);
        });
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.rm(root, { recursive: true });
    });

    it("writes what compile writes for each model of a directory", async () => {
        const directory = await workspace(root, "corpus", [
            "crossroads.sysml",
            "spacecraft.sysml",
            "Verification.sysml",
        ]);
        const crossroads = path.join(directory, "crossroads.sysml");
        const spacecraft = path.join(directory, "spacecraft.sysml");

        await compileBatchAction(stdlibPath, [crossroads, spacecraft], {
            outputDirectory: path.join(root, "batch"),
        });
        await compileAction(crossroads, stdlibPath, {
            output: path.join(root, "single", "crossroads.oxsts"),
        });

        expect(await fs.readFile(path.join(root, "batch", "crossroads.oxsts"), "utf-8")).toBe(
            await fs.readFile(path.join(root, "single", "crossroads.oxsts"), "utf-8")
        );
        expect(await fs.readFile(path.join(root, "batch", "spacecraft.oxsts"), "utf-8")).toContain(
            "Spacecraft"
        );
    }, 600_000);

    it("does not resolve names from the previous directory", async () => {
        const complete = await workspace(root, "complete", [
            "crossroads.sysml",
            "Verification.sysml",
        ]);
        const incomplete = await workspace(root, "incomplete", ["crossroads.sysml"]);

        await expect(
            compileBatchAction(
                stdlibPath,
                [
                    path.join(complete, "crossroads.sysml"),
                    path.join(incomplete, "crossroads.sysml"),
                ],
                {}
            )
        ).rejects.toThrow("exit 1");

        await expect(fs.access(path.join(complete, "crossroads.oxsts"))).resolves.toBeUndefined();
        await expect(fs.access(path.join(incomplete, "crossroads.oxsts"))).rejects.toThrow();
    }, 600_000);
});
