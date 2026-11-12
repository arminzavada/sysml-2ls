import { AstUtils } from "langium";
import type { Range } from "vscode-languageserver";
import { isVerificationCaseDefinition, type Namespace } from "#generated/ast";
import { SemantifyrModelMapper, type SemantifyrMapping } from "./SemantifyrModelMapper";
import { SemantifyrTraceGenerator } from "./SemantifyrTraceGenerator";
import { checkTraceInput, type SemantifyrTraceInput } from "./SemantifyrTraceInput";

export type { SemantifyrMapping } from "./SemantifyrModelMapper";
export type { SemantifyrNameMap } from "./SemantifyrNameMap";
export type {
    SemantifyrTrace,
    SemantifyrTraceInput,
    SemantifyrWitness,
} from "./SemantifyrTraceInput";
export { SemantifyrTraceError } from "./SemantifyrTraceInput";
export { semantifyrConstructTable } from "./SemantifyrConstructs";

export function mapSysMLNamespaceToSemantifyr(model: Namespace): SemantifyrMapping {
    return new SemantifyrModelMapper(
        model,
        AstUtils.getDocument(model).textDocument.getText()
    ).map();
}

export interface SemantifyrVerificationCase {
    name: string;
    range: Range;
}

export function findSemantifyrVerificationCases(model: Namespace): SemantifyrVerificationCase[] {
    return model.children.flatMap((membership) => {
        const element = membership.target;
        if (!isVerificationCaseDefinition(element) || !element.declaredName || !element.$cstNode) {
            return [];
        }
        return [
            {
                name: element.declaredName,
                range: element.$cstNode.range,
            },
        ];
    });
}

export interface SemantifyrTraceParameters {
    caseName: string;
    witness: unknown;
    trace: unknown;
    nameMap: unknown;
}

// the input comes from JSON, so its shape is checked before it is read
export function mapSemantifyrTraceToSysML(
    model: Namespace,
    parameters: SemantifyrTraceParameters
): string {
    checkTraceInput(parameters);
    return new SemantifyrTraceGenerator(model, parameters as SemantifyrTraceInput).generate();
}
