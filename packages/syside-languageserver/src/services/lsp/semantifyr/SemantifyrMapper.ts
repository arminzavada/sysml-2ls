import { ast } from "../../..";

import type { Diagnostic, Range } from "vscode-languageserver";
import { isVerificationCaseDefinition } from "#generated/ast";
import { createSemantifyrMapperServices } from "./SemantifyrMapperModule";
import { SemantifyrTrace, SemantifyrTraceGenerator } from "./SemantifyrTraceGenerator";

export type { SemantifyrTrace } from "./SemantifyrTraceGenerator";

export interface SemantifyrMapping {
    oxsts?: string;
    diagnostics: Diagnostic[];
}

export function mapSysMLNamespaceToSemantifyr(model: ast.Namespace): SemantifyrMapping {
    const services = createSemantifyrMapperServices();
    const oxsts = services.rootNamespaceMapper.mapRootNamespace(model);
    const diagnostics = services.unsupportedConstructs.diagnostics;
    if (diagnostics.length > 0) {
        return { diagnostics };
    }
    return { oxsts, diagnostics };
}

export interface SemantifyrVerificationCase {
    name: string;
    range: Range;
}

export function findSemantifyrVerificationCases(
    model: ast.Namespace
): SemantifyrVerificationCase[] {
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

export function mapSemantifyrTraceToSysML(
    model: ast.Namespace,
    trace: SemantifyrTrace,
    caseName: string
): string {
    const services = createSemantifyrMapperServices();
    services.rootNamespaceMapper.mapRootNamespace(model);
    return new SemantifyrTraceGenerator(services, caseName).generate(trace);
}
