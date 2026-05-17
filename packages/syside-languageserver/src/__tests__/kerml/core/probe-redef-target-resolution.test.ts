/********************************************************************************
 * EXPLORATION PROBE — Chunk 3 follow-up (2)
 *
 * Probe whether qualified-name redefinition target with a self-collision
 * resolves through inherited element (post-2025-11 pilot conformance) or
 * through self (pre-2025-11 buggy).
 *
 * Not a regression test; remove or repurpose after the question is answered.
 ********************************************************************************/
/* eslint-disable @typescript-eslint/no-explicit-any */

import { parseKerML } from "../../../testing";
import { Redefinition } from "#generated/ast.js";

test("PROBE 1: qualified-name redefinition target — A::x with self-collision in B", async () => {
    const result = await parseKerML(`
    class A {
        feature x;
    }
    class B specializes A {
        feature x;
        feature :>> A::x;
    }`);

    console.log("--- lexer errors ---");
    console.log(result.lexerErrors);
    console.log("--- parser errors ---");
    console.log(result.parserErrors);
    console.log("--- linking errors ---");
    console.log(result.value.$document?.diagnostics ?? []);

    // Walk the AST: find the Redefinition under the third feature of B
    const root = result.value;
    const bNs = root.children[1].target as any;
    console.log("B name:", bNs?.declaredName ?? bNs?.name);
    console.log("B children count:", bNs?.children?.length);

    const thirdMember = bNs?.children?.[1]; // 0 = `feature x`, 1 = `feature :>> A::x`
    console.log("B's second feature member:", thirdMember?.target?.$type);

    const heritage = thirdMember?.target?.heritage ?? [];
    for (const h of heritage) {
        console.log("  heritage entry:", {
            type: h.$type,
            isRedef: h.$type === Redefinition,
            targetText: h.targetRef?.$cstNode?.text,
            resolvedQN: h.targetRef?.$meta?.to?.target?.qualifiedName,
        });
    }

    // Pass-through; this probe only logs.
    expect(result.parserErrors).toHaveLength(0);
});

test("PROBE 2: redefinition target x::y where B has self x and inherited x — does x resolve through inherited?", async () => {
    // The 2025-11 pilot change: the *first segment* of a qualified-name
    // redefinition target should resolve through the inherited element,
    // not through self. So in B's `:>> x::y`, the `x` should be A's x
    // (which has y), not B's own self-x (which doesn't have y).
    const result = await parseKerML(`
    class A {
        classifier X {
            feature y;
        }
    }
    class B specializes A {
        classifier X {
            feature z;
        }
        feature :>> X::y;
    }`);

    console.log("--- parser errors (probe 2) ---");
    console.log(result.parserErrors);
    console.log("--- linking errors ---");
    console.log(result.value.$document?.diagnostics ?? []);

    const root = result.value;
    const bNs = root.children[1].target as any;
    console.log("B's children count:", bNs?.children?.length);
    bNs?.children?.forEach((c: any, i: number) => {
        console.log(`  B child[${i}]:`, c?.target?.$type, "name:", c?.target?.declaredName);
    });

    // Last child is the redefining feature
    const redefMember = bNs?.children?.at(-1);
    const heritage = redefMember?.target?.heritage ?? [];
    for (const h of heritage) {
        console.log("  heritage entry (probe 2):", {
            type: h.$type,
            targetText: h.targetRef?.$cstNode?.text,
            resolvedQN: h.targetRef?.$meta?.to?.target?.qualifiedName,
            resolvedName: h.targetRef?.$meta?.to?.target?.name,
        });
    }

    expect(result.parserErrors).toHaveLength(0);
    expect(heritage).toHaveLength(1);
    expect(heritage[0].$type).toBe(Redefinition.$type);
    expect(heritage[0].targetRef?.$meta?.to?.target?.qualifiedName).toBe("A::X::y");
});

test("PROBE 3: control case — same model WITHOUT self-collision (no `classifier X` in B)", async () => {
    // Sanity check: without the self-collision, X::y should resolve to A's X::y.
    const result = await parseKerML(`
    class A {
        classifier X {
            feature y;
        }
    }
    class B specializes A {
        feature :>> X::y;
    }`);

    const root = result.value;
    const bNs = root.children[1].target as any;
    const redefMember = bNs?.children?.at(-1);
    const heritage = redefMember?.target?.heritage ?? [];
    for (const h of heritage) {
        console.log("  heritage entry (probe 3, no collision):", {
            type: h.$type,
            targetText: h.targetRef?.$cstNode?.text,
            resolvedQN: h.targetRef?.$meta?.to?.target?.qualifiedName,
        });
    }

    expect(result.parserErrors).toHaveLength(0);
});
