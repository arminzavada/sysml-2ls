import { ast, ElementID } from "../../..";

type NameMap = Map<ElementID, string>;
type UniqueNameProviderMap = Map<ast.Element["$type"], UniqueNameProvider>;

class UniqueNameProvider {
    private lastId = 0;
    private readonly nameMap: NameMap = new Map();

    public getStableName(element: ast.Element): string {
        if (this.nameMap.has(element.$meta.elementId)) {
            return this.nameMap.get(element.$meta.elementId)!;
        }

        const name = this.calculateStableName(element);

        this.nameMap.set(element.$meta.elementId, name);

        return name;
    }

    protected calculateStableName(element: ast.Element): string {
        return `Unnamed${element.$type}${this.lastId++}`;
    }
}

export class StableElementNameProvider {
    private readonly uniqueNameProviders: UniqueNameProviderMap = new Map();
    private readonly namedElements = new Map<string, Set<ast.Element>>();

    public stableName(element: ast.Element): string {
        if (element == undefined) {
            return "UNDEFINED_ELEMENT";
        }

        const name =
            element.declaredName ?? this.getTypeNameProvider(element.$type).getStableName(element);
        this.record(name, element);
        return name;
    }

    public elementsNamed(name: string): ast.Element[] {
        return [...(this.namedElements.get(name) ?? [])];
    }

    private record(name: string, element: ast.Element): void {
        const elements = this.namedElements.get(name);
        if (elements) {
            elements.add(element);
        } else {
            this.namedElements.set(name, new Set([element]));
        }
    }

    protected getTypeNameProvider(type: ast.Element["$type"]): UniqueNameProvider {
        if (this.uniqueNameProviders.has(type)) {
            return this.uniqueNameProviders.get(type)!;
        }

        const provider = new UniqueNameProvider();
        this.uniqueNameProviders.set(type, provider);

        return provider;
    }
}
