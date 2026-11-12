import { AstUtils, type AstNode } from "langium";
import { isElement, isRelationship, type Element, type Namespace } from "#generated/ast";

// the elements an element owns, through the memberships that own them, in document order
export function ownedElements(owner: AstNode): Element[] {
    return AstUtils.streamContents(owner)
        .toArray()
        .flatMap((child) => {
            if (isRelationship(child) && child.target && child.target.$container === child) {
                return [child.target];
            }
            return [];
        });
}

function owningElement(element: Element): Element | undefined {
    let current = element.$container;
    while (current && !(isElement(current) && !isRelationship(current))) {
        current = current.$container;
    }
    return current as Element | undefined;
}

// a named element is its name, an unnamed one its index among its owner's elements
export function elementPath(element: Element): string {
    const segments: string[] = [];
    let current: Element | undefined = element;
    while (current) {
        const owner = owningElement(current);
        if (!owner) {
            break;
        }
        segments.unshift(current.declaredName ?? `#${ownedElements(owner).indexOf(current)}`);
        current = owner;
    }
    return segments.join("::");
}

export function resolveElementPath(root: Namespace, path: string): Element | undefined {
    let current: Element | undefined = root;
    for (const segment of path.split("::")) {
        if (!current) {
            return undefined;
        }
        const owned = ownedElements(current);
        current = segment.startsWith("#")
            ? owned[Number(segment.slice(1))]
            : owned.find((candidate) => {
                  return candidate.declaredName === segment;
              });
    }
    return current;
}
