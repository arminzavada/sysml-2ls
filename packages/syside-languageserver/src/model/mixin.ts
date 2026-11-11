// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AbstractConstructor<Instance> = abstract new (...parameters: any[]) => Instance;

export type Class<Instance = object, Static = object> = AbstractConstructor<Instance> & Static;

type Constructor = new (...parameters: unknown[]) => object;

let mixinTarget: object | undefined;

export class MixinBase {
    constructor() {
        const target = mixinTarget;
        mixinTarget = undefined;
        // every base of a mixin initializes its fields on the one instance under construction
        if (target) return target as this;
    }
}

function prototypeChain(object: object): object[] {
    const chain = [object];
    for (let next = Object.getPrototypeOf(object); next; next = Object.getPrototypeOf(next)) {
        chain.push(next);
    }
    return chain;
}

function mixPrototypes(ingredients: object[], excluded: string[]): object {
    const chains = ingredients.map(prototypeChain);
    const others = chains.slice(1).map((chain) => {
        return new Set(chain);
    });
    const common =
        chains[0].find((prototype) => {
            return others.every((chain) => {
                return chain.has(prototype);
            });
        }) ?? Object.prototype;

    const mixed = Object.create(common);
    const visited = new Set(prototypeChain(common));
    for (const chain of chains) {
        for (let index = chain.length - 1; index >= 0; index--) {
            const prototype = chain[index];
            if (visited.has(prototype)) continue;
            visited.add(prototype);
            const descriptors = Object.getOwnPropertyDescriptors(prototype);
            for (const key of excluded) delete descriptors[key];
            Object.defineProperties(mixed, descriptors);
        }
    }
    return mixed;
}

export function Mixin<I1, S1, I2, S2>(
    first: Class<I1, S1>,
    second: Class<I2, S2>
): Class<I1 & I2, S1 & S2>;
export function Mixin<I1, S1, I2, S2, I3, S3>(
    first: Class<I1, S1>,
    second: Class<I2, S2>,
    third: Class<I3, S3>
): Class<I1 & I2 & I3, S1 & S2 & S3>;
export function Mixin(...ingredients: Class[]): Class {
    const constructors = ingredients as unknown as Constructor[];
    function Mixed(this: object, ...parameters: unknown[]): object {
        const instance = mixinTarget ?? this;
        for (const ingredient of constructors) {
            mixinTarget = instance;
            Reflect.construct(ingredient, parameters);
            mixinTarget = undefined;
        }
        return instance;
    }

    Mixed.prototype = mixPrototypes(
        ingredients.map((ingredient) => {
            return ingredient.prototype;
        }),
        ["constructor"]
    );
    Mixed.prototype.constructor = Mixed;
    Object.setPrototypeOf(Mixed, mixPrototypes(ingredients, ["constructor", "prototype"]));
    return Mixed as unknown as Class;
}

export function mix(
    first: { prototype: MixinBase },
    second: { prototype: MixinBase }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (decorated: any) => any {
    return (decorated) => {
        const mixed = Mixin(first as Class, second as Class, decorated);
        Object.defineProperty(mixed, "name", { value: decorated.name, writable: false });
        return mixed;
    };
}
