import { ast } from "../../..";

import { createSemantifyrMapperServices } from "./SemantifyrMapperModule";

export function mapSysMLNamespaceToSemantifyr(model: ast.Namespace): string {
    const services = createSemantifyrMapperServices();
    return services.rootNamespaceMapper.mapRootNamespace(model);
}
