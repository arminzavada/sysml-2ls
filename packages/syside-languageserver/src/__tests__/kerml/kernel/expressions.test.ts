import { parseKerML, referenceTargets } from "../../../testing/index.js";

describe("name resolution in expressions", () => {
    test("invoked names in arguments do not resolve to the invoked function's parameters", async () => {
        const result = await parseKerML(`package P {
            function f { in x; in y; }
            function y { in i; }
            feature a;
            feature r = f(y(a), a);
        }`);
        expect(result.parserErrors).toHaveLength(0);
        expect(referenceTargets(result.value)).toEqual([
            "f -> P::f",
            "y -> P::y",
            "a -> P::a",
            "a -> P::a",
        ]);
    });

    test("feature values resolve in the namespace owning the valued feature", async () => {
        const result = await parseKerML(`package P {
            class C { feature num; feature other; }
            feature num;
            class K {
                feature c1 : C = num;
                feature c2 : C { feature z = num; }
                feature c3 : C = other;
            }
        }`);
        expect(result.parserErrors).toHaveLength(0);
        expect(referenceTargets(result.value)).toEqual([
            "C -> P::C",
            "num -> P::num",
            "C -> P::C",
            "num -> P::C::num",
            "C -> P::C",
            "other -> undefined",
        ]);
    });

    test("constructor arguments resolve outside the constructor", async () => {
        const result = await parseKerML(`package P {
            class A { feature x; }
            behavior B {
                in feature x;
                out feature : A = new A(x);
            }
        }`);
        expect(result.parserErrors).toHaveLength(0);
        expect(referenceTargets(result.value)).toContain("x -> P::B::x");
    });
});
