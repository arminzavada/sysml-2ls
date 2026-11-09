import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { mapSysMLNamespaceToSemantifyr } from "../../services/lsp/semantifyr/SemantifyrMapper.js";
import type { Namespace } from "#generated/ast.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const part = (body: string): string => `
    part def Machine {
        ${body}
    }
`;

const state = (body: string): string =>
    part(`
    exhibit state behaviour {
        state on {
            ${body}
        }
    }
`);

const verification = (body: string): string => `
    part def Machine;
    verification def Check {
        subject machine: Machine;
        ${body}
    }
`;

interface UnsupportedCase {
    construct: string;
    model: string;
    reported: string;
}

const cases: UnsupportedCase[] = [
    {
        construct: "a package",
        model: `package Wrapped;`,
        reported: "package Wrapped;",
    },
    {
        construct: "a top-level usage",
        model: `part machine;`,
        reported: "part machine;",
    },
    {
        construct: "a second exhibit state",
        model: part(`
            exhibit state one;
            exhibit state other;
        `),
        reported: "exhibit state other;",
    },
    {
        construct: "part multiplicity",
        model: `
            part def Wheel;
            ${part(`part wheels: Wheel[4];`)}
        `,
        reported: "[4]",
    },
    {
        construct: "an attribute of an unsupported type",
        model: part(`attribute name: ScalarValues::String;`),
        reported: "attribute name: ScalarValues::String;",
    },
    {
        construct: "an untyped attribute",
        model: part(`attribute untyped;`),
        reported: "attribute untyped;",
    },
    {
        construct: "an action in a part",
        model: part(`action work;`),
        reported: "action work;",
    },
    {
        construct: "a do action",
        model: state(`do action work;`),
        reported: "do action work;",
    },
    {
        construct: "an empty entry action",
        model: state(`entry;`),
        reported: ";",
    },
    {
        construct: "a real number",
        model: part(`attribute ratio: ScalarValues::Integer = 1.5;`),
        reported: "1.5",
    },
    {
        construct: "an assume constraint",
        model: verification(`
            objective {
                assume constraint { true }
            }
        `),
        reported: "assume constraint { true }",
    },
];

describe("constructs the mapper does not support", () => {
    let shared: SysMLSharedServices;

    beforeAll(async () => {
        ({ shared } = await setupServicesWithStdlib());
        const verificationLibrary = await shared.workspace.LangiumDocuments.getOrCreateDocument(
            URI.file(path.resolve(currentDir, "..", "..", "..", "library", "Verification.sysml"))
        );
        await shared.workspace.DocumentBuilder.build([verificationLibrary], <SysMLBuildOptions>{
            validation: false,
            standalone: false,
        });
    }, 180_000);

    it.each(cases)("reports $construct on it and yields no OXSTS", async ({ model, reported }) => {
        const uri = URI.file(path.join(currentDir, "unsupported.sysml"));
        const document = shared.workspace.LangiumDocumentFactory.fromString(model, uri);
        shared.workspace.LangiumDocuments.addDocument(document);
        await shared.workspace.DocumentBuilder.build([document], <SysMLBuildOptions>{
            validation: false,
            standalone: false,
        });

        const mapping = mapSysMLNamespaceToSemantifyr(document.parseResult.value as Namespace);
        const ranges = mapping.diagnostics.map((diagnostic) => {
            return document.textDocument.getText(diagnostic.range);
        });
        shared.workspace.LangiumDocuments.deleteDocument(uri);
        shared.workspace.IndexManager.remove(uri);

        expect(document.parseResult.parserErrors).toHaveLength(0);
        expect(mapping.oxsts).toBeUndefined();
        expect(ranges).toContain(reported);
    });
});
