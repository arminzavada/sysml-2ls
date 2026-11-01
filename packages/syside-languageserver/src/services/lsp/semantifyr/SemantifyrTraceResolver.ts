import { ast } from "../../..";
import { isVerificationCaseDefinition } from "#generated/ast";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { modelPackage } from "./SemantifyrRootNamespaceMapper";

const rootInstance = "root";

export class SemantifyrTraceResolver extends SemantifyrBaseMapper {
    public resolveVerificationCase(name: string): ast.VerificationCaseDefinition {
        const verificationCase = this.resolveQualifiedName(`${modelPackage}::${name}`);
        if (!isVerificationCaseDefinition(verificationCase)) {
            throw new Error(`No verification case is named '${name}'`);
        }
        return verificationCase;
    }

    public resolveInstance(
        verificationCase: ast.VerificationCaseDefinition,
        instancePath: string
    ): ast.Element[] {
        const [root, ...segments] = instancePath.split(".");
        if (root !== rootInstance) {
            throw new Error(`Instance path '${instancePath}' does not start at '${rootInstance}'`);
        }

        const chain: ast.Element[] = [verificationCase];
        for (const segment of segments) {
            if (segment.endsWith("]")) {
                throw new Error(`Indexed instance path '${instancePath}' is not supported`);
            }
            const element = this.member(chain[chain.length - 1], segment);
            if (element === undefined) {
                throw new Error(`Cannot resolve '${segment}' in instance path '${instancePath}'`);
            }
            chain.push(element);
        }
        return chain;
    }

    public resolveQualifiedName(qualifiedName: string): ast.Element | undefined {
        const separator = qualifiedName.lastIndexOf("::");
        if (separator < 0) {
            return undefined;
        }
        const scope = this.member(undefined, qualifiedName.slice(0, separator));
        return scope && this.member(scope, qualifiedName.slice(separator + 2));
    }
}
