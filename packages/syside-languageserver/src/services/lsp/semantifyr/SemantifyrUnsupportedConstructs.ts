import type { AstNode } from "langium";
import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";

function rangeOf(node: AstNode): Range {
    let current: AstNode | undefined = node;
    while (current && !current.$cstNode) {
        current = current.$container;
    }
    return (
        current?.$cstNode?.range ?? {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        }
    );
}

export class SemantifyrUnsupportedConstructs {
    readonly diagnostics: Diagnostic[] = [];

    // The empty text keeps mapping going, so every construct is reported; the mapping is discarded.
    report(node: AstNode, message: string): string {
        this.diagnostics.push({
            range: rangeOf(node),
            severity: DiagnosticSeverity.Error,
            source: "semantifyr",
            message,
        });
        return "";
    }
}
