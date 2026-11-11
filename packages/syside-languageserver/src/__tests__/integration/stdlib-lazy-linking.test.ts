/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { beforeAll, describe, expect, it } from "vitest";
import { URI } from "vscode-uri";
import { CompletionTriggerKind } from "vscode-languageserver";
import { AstUtils, DocumentState, type LangiumDocument } from "langium";
import type { Namespace } from "#generated/ast.js";
import type { SysMLDefaultServices, SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import type { ElementMeta } from "../../model/index.js";
import { findCursor, referenceTargets } from "../../testing/index.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";

describe("lazily linked standard library", () => {
    let shared: SysMLSharedServices;
    let stdDocs: LangiumDocument[];
    let count = 0;

    beforeAll(async () => {
        ({ shared, stdDocs } = await setupServicesWithStdlib());
    }, 180_000);

    async function build(text: string): Promise<LangiumDocument<Namespace>> {
        const document = shared.workspace.LangiumDocumentFactory.fromString<Namespace>(
            text,
            URI.parse(`file:///tmp/stdlib-lazy-linking-${count++}.sysml`)
        );
        shared.workspace.LangiumDocuments.addDocument(document);
        await shared.workspace.DocumentBuilder.build([document], <SysMLBuildOptions>{
            validation: true,
            standalone: false,
        });
        return document;
    }

    function libraryDocument(file: string): LangiumDocument {
        const document = stdDocs.find((candidate) => {
            return candidate.uri.path.endsWith(`/${file}`);
        });
        if (!document) throw new Error(`${file} is not loaded`);
        return document;
    }

    function libraryElement(file: string, name: string): ElementMeta {
        const node = AstUtils.streamAst(libraryDocument(file).parseResult.value).find(
            (candidate) => {
                return (candidate.$meta as ElementMeta | undefined)?.qualifiedName === name;
            }
        );
        if (!node) throw new Error(`${name} is not in ${file}`);
        return node.$meta as ElementMeta;
    }

    it("sets up a library element reached through a named import once a model uses it", async () => {
        const second = libraryElement("SI.sysml", "SI::second");
        expect(second.setupState).toBe("none");

        const document = await build(`package P {
            private import SI::s;
            state def Light {
                entry; then Yellow;
                state Yellow;
                state Black;
                transition first Yellow accept after 1 [s] then Black;
            }
        }`);

        const errors = document.diagnostics?.filter((diagnostic) => {
            return diagnostic.severity === 1;
        });
        expect(errors).toEqual([]);
        expect(second.setupState).toBe("completed");
    });

    it("completes the members a library package imports publicly", async () => {
        const { text, cursor } = findCursor(`package Q {
            attribute x : ISQ::|
        }`);
        const document = await build(text);
        const services = shared.ServiceRegistry.getServices(document.uri) as SysMLDefaultServices;
        const completion = await services.lsp.CompletionProvider?.getCompletion(document, {
            textDocument: { uri: document.uri.toString() },
            position: document.textDocument.positionAt(cursor),
            context: { triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: ":" },
        });

        const labels = completion?.items.map((item) => {
            return item.label;
        });
        expect(labels).toEqual(expect.arrayContaining(["LengthValue", "width"]));
    });

    it("links a whole library document once a request waits on it", async () => {
        const document = libraryDocument("ISQSpaceTime.sysml");
        const width = libraryElement("ISQSpaceTime.sysml", "ISQSpaceTime::width");

        await shared.workspace.DocumentBuilder.waitUntil(DocumentState.Linked, document.uri);

        expect(width.setupState).toBe("completed");
        expect(referenceTargets(width.ast()!)).toEqual(
            expect.arrayContaining(["LengthValue -> ISQBase::LengthValue"])
        );
    });
});
