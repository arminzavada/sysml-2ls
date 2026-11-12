import { AstUtils, type AstNode } from "langium";
import {
    isElement,
    isReferenceSubsetting,
    isRelationship,
    type Element,
    type ElementReference,
    type Feature,
    type Namespace,
    type TransitionUsage,
} from "#generated/ast";

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

function referenced(reference: ElementReference | undefined): Element | undefined {
    return reference?.parts.at(-1)?.ref;
}

// the state a transition's `then` names, through a chain `A.B.C` too
export function transitionTarget(transition: TransitionUsage): Element | undefined {
    const succession = transition.then?.target as { ends?: { target?: Feature }[] } | undefined;
    const end = succession?.ends?.[1]?.target;
    const subsetting = end?.heritage.find(isReferenceSubsetting);
    if (subsetting?.targetChain) {
        return referenced(subsetting.targetChain.typeRelationships.at(-1)?.targetRef);
    }
    return subsetting ? referenced(subsetting.targetRef) : undefined;
}

// `start` and `done` of the standard library, which every state inherits
export function isLibraryFeature(
    element: Element | undefined,
    name: string,
    model: Element
): boolean {
    return (
        element?.declaredName === name &&
        AstUtils.getDocument(element) !== AstUtils.getDocument(model)
    );
}
