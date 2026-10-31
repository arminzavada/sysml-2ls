import { ast } from "../../..";

import { createSemantifyrMapperServices } from "./SemantifyrMapperModule";
import { SemantifyrTrace, SemantifyrTraceGenerator } from "./SemantifyrTraceGenerator";

export type { SemantifyrTrace } from "./SemantifyrTraceGenerator";

export function mapSysMLNamespaceToSemantifyr(model: ast.Namespace): string {
    const services = createSemantifyrMapperServices();
    return services.rootNamespaceMapper.mapRootNamespace(model);
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
