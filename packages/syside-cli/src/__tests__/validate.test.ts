import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAction } from "../semantifyr-util.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const stdlibPath = path.join(repoRoot, "SysML-v2-Release", "sysml.library");

describe("validate", () => {
    let directory: string;

    async function write(name: string, text: string): Promise<string> {
        const file = path.join(directory, name);
        await fs.writeFile(file, text);
        return file;
    }

    beforeEach(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), "validate-"));
        vi.spyOn(process, "exit").mockImplementation((code) => {
            throw new Error(`exit ${code}`);
        });
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.rm(directory, { recursive: true });
    });

    it("passes a file that the mapper would refuse and that uses its directory", async () => {
        await write(
            "Library.sysml",
            `
            package Library {
                part def Machine;
            }
            `
        );
        const file = await write(
            "model.sysml",
            `
            package Model {
                part machine: Library::Machine;
            }
            `
        );

        await expect(validateAction(file, stdlibPath)).resolves.toBeUndefined();
    }, 300_000);

    it("exits non-zero on an unresolved reference", async () => {
        const file = await write(
            "model.sysml",
            `
            package Model {
                part machine: Missing::Machine;
            }
            `
        );

        await expect(validateAction(file, stdlibPath)).rejects.toThrow("exit 1");
    }, 300_000);
});
