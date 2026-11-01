import { ast, ElementID } from "../../..";

type NameMap = Map<ElementID, string>;
type UniqueNameProviderMap = Map<ast.Element["$type"], UniqueNameProvider>;
// undefined is the global scope, which holds the package
type Scope = ast.Element | undefined;

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
    private readonly members = new Map<Scope, Map<string, ast.Element>>();
    private readonly types = new Map<ast.Element, ast.Element>();

    public stableName(element: ast.Element): string {
        if (element == undefined) {
            return "UNDEFINED_ELEMENT";
        }

        return (
            element.declaredName ?? this.getTypeNameProvider(element.$type).getStableName(element)
        );
    }

    public declare(scope: Scope, element: ast.Element, name = this.stableName(element)): string {
        const members = this.members.get(scope);
        if (members) {
            members.set(name, element);
        } else {
            this.members.set(scope, new Map([[name, element]]));
        }
        return name;
    }

    public declareTyped(scope: Scope, element: ast.Element, type: ast.Element | undefined): string {
        if (type) {
            this.types.set(element, type);
        }
        return this.declare(scope, element);
    }

    public member(scope: Scope, name: string): ast.Element | undefined {
        const owner = scope && (this.types.get(scope) ?? scope);
        return this.members.get(owner)?.get(name);
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
