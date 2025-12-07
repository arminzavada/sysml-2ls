import {
    Connection,
    WorkspaceEdit,
    CreateFile,
    TextDocumentEdit,
    TextEdit,
    Position,
    OptionalVersionedTextDocumentIdentifier,
} from "vscode-languageserver";

export async function upsertTextFile(
    connection: Connection,
    uri: string,
    content: string,
    label = "Create/replace file"
): Promise<void> {
    const edit: WorkspaceEdit = {
        documentChanges: [
            CreateFile.create(uri, { overwrite: true }),
            TextDocumentEdit.create(OptionalVersionedTextDocumentIdentifier.create(uri, null), [
                TextEdit.insert(Position.create(0, 0), content),
            ]),
        ],
    };

    const response = await connection.workspace.applyEdit({ label, edit });
    if (!response.applied) {
        throw new Error(response.failureReason ?? "applyEdit was rejected by the client");
    }
}
