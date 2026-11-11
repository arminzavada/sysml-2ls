import { beforeAll, describe, expect, it } from "vitest";
import { URI } from "vscode-uri";
import { AstNode, AstUtils, DocumentState, type LangiumDocument } from "langium";
import type { Namespace } from "#generated/ast.js";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { referenceTargets } from "../../testing/index.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";

describe("name resolution against the standard library", () => {
    let shared: SysMLSharedServices;
    let stdDocs: LangiumDocument[];
    let count = 0;

    beforeAll(async () => {
        ({ shared, stdDocs } = await setupServicesWithStdlib());
    }, 180_000);

    async function build(text: string, ext = "sysml"): Promise<LangiumDocument<Namespace>> {
        const doc = shared.workspace.LangiumDocumentFactory.fromString<Namespace>(
            text,
            URI.parse(`file:///tmp/stdlib-scoping-${count++}.${ext}`)
        );
        shared.workspace.LangiumDocuments.addDocument(doc);
        await shared.workspace.DocumentBuilder.build([doc], <SysMLBuildOptions>{
            validation: false,
            standalone: false,
        });
        return doc;
    }

    async function stdlibNode(file: string, name: string): Promise<AstNode> {
        const doc = stdDocs.find((d) => d.uri.path.endsWith(`/${file}`));
        if (doc) await shared.workspace.DocumentBuilder.waitUntil(DocumentState.Linked, doc.uri);
        const node =
            doc &&
            AstUtils.streamAst(doc.parseResult.value).find(
                (n) => (n.$meta as { qualifiedName?: string } | undefined)?.qualifiedName === name
            );
        expect(node, name).toBeDefined();
        return node as AstNode;
    }

    it("resolves a transition source and target in the transition's owning namespace", async () => {
        expect(
            referenceTargets(
                await stdlibNode("Actions.sysml", "Actions::AcceptAction::aState::aTransition")
            )
        ).toEqual([
            "start -> States::StateAction::start",
            "Anything -> Base::Anything",
            "receiver -> Transfers::AcceptPerformance::receiver",
            "done -> States::StateAction::done",
        ]);
    });

    it("resolves a function invoked in an operand to the private function, not the operator parameter", async () => {
        const targets = referenceTargets(
            await stdlibNode("CollectionFunctions.kerml", "CollectionFunctions::array#")
        ).filter((t) => t.startsWith("index ->"));
        expect(targets).toEqual([
            "index -> CollectionFunctions::array#::index",
            "index -> CollectionFunctions::array#::index",
        ]);
    });

    it("resolves names in operator operands outside the operator function", async () => {
        const doc = await build(
            `package P {
                private import ScalarValues::Integer;
                function y { in i : Integer; return : Integer; }
                function index { in i : Integer; return : Integer; }
                feature a : Integer;
                feature r1 = a + y(a);
                feature r2 = (1..3)#(index(a));
            }`,
            "kerml"
        );
        expect(referenceTargets(doc.parseResult.value)).toEqual(
            expect.arrayContaining(["y -> P::y", "index -> P::index"])
        );
    });

    it("resolves start and done of a state transition to the state's", async () => {
        const doc = await build(`package P {
            item def Sig;
            state def S {
                transition first start accept Sig then done;
            }
        }`);
        expect(referenceTargets(doc.parseResult.value)).toEqual([
            "start -> States::StateAction::start",
            "Sig -> P::Sig",
            "done -> States::StateAction::done",
        ]);
    });
});
