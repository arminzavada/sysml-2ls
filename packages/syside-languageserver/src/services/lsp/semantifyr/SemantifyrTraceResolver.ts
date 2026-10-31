import { ast } from "../../..";
import { isFeature, isStateUsage, isVerificationCaseDefinition } from "#generated/ast";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrItemMapper } from "./SemantifyrItemMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";

const rootInstance = "root";

export class SemantifyrTraceResolver extends SemantifyrBaseMapper {
    private readonly itemMapper: SemantifyrItemMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);

        this.itemMapper = services.itemMapper;
    }

    public resolveVerificationCase(name: string): ast.VerificationCaseDefinition {
        const candidates = this.elementsNamed(name).filter(isVerificationCaseDefinition);
        if (candidates.length !== 1) {
            throw new Error(
                `Expected one verification case named '${name}', found ${candidates.length}`
            );
        }
        return candidates[0];
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
            const scope = this.memberScope(chain[chain.length - 1]);
            const candidates = this.elementsNamed(segment).filter(
                (element) => scope !== undefined && element.$meta.owner()?.ast() === scope
            );
            if (candidates.length !== 1) {
                throw new Error(`Cannot resolve '${segment}' in instance path '${instancePath}'`);
            }
            chain.push(candidates[0]);
        }
        return chain;
    }

    public resolveItem(value: string): ast.ItemDefinition | undefined {
        return this.itemMapper.globalItemDefinition(value.split("::").at(-1) ?? value);
    }

    private memberScope(element: ast.Element): ast.Element | undefined {
        if (isStateUsage(element) || isVerificationCaseDefinition(element)) {
            return element;
        }
        if (isFeature(element)) {
            return this.featureClassifier(element);
        }
        return undefined;
    }
}
