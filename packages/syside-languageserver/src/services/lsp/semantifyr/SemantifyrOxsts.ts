const keywords = [
    "abstract",
    "annotation",
    "any",
    "as",
    "assume",
    "bool",
    "choice",
    "class",
    "container",
    "containment",
    "contains",
    "datatype",
    "derived",
    "else",
    "enum",
    "extern",
    "false",
    "feature",
    "features",
    "for",
    "fun",
    "global",
    "havoc",
    "if",
    "import",
    "in",
    "init",
    "inline",
    "inlined",
    "int",
    "main",
    "nothing",
    "of",
    "opposite",
    "or",
    "oxsts",
    "package",
    "prop",
    "real",
    "record",
    "redefine",
    "redefines",
    "reference",
    "refers",
    "rem",
    "return",
    "self",
    "seq",
    "string",
    "subsets",
    "then",
    "tran",
    "true",
    "var",
    "witness",
];

export const libraryClasses = [
    "AbstractState",
    "AcceptAction",
    "AcceptItemAction",
    "AcceptTimeoutAction",
    "AcceptWhenAction",
    "Action",
    "AndOperatorExpression",
    "AssignmentAction",
    "Attribute",
    "AttributeReferenceExpression",
    "BinaryOperatorExpression",
    "BooleanAttribute",
    "CompositeAction",
    "ConjugatedPort",
    "Constraint",
    "ConstraintReferenceExpression",
    "DerivedAttribute",
    "DivisionOperatorExpression",
    "DoneState",
    "EntryState",
    "EqualityOperatorExpression",
    "Eventually",
    "ExhibitedParallelState",
    "ExhibitedState",
    "Expression",
    "Flow",
    "GreaterThanOperatorExpression",
    "GreaterThanOrEqualsOperatorExpression",
    "Guard",
    "InequalityOperatorExpression",
    "IntegerAttribute",
    "IsStateActiveExpression",
    "Item",
    "LessThanOperatorExpression",
    "LessThanOrEqualsOperatorExpression",
    "LiteralBooleanExpression",
    "LiteralExpression",
    "LiteralIntegerExpression",
    "MinusOperatorExpression",
    "MultiplicationOperatorExpression",
    "MustAlways",
    "NormalPort",
    "OrOperatorExpression",
    "ParallelState",
    "Part",
    "PlusOperatorExpression",
    "Port",
    "Requirement",
    "SendItemAction",
    "State",
    "StateNode",
    "TemporalOperatorExpression",
    "Transition",
    "UnaryMinusExpression",
    "UnaryNotExpression",
    "UnaryOperatorExpression",
    "UnaryPlusExpression",
    "VerificationCaseDefinition",
];

export const partMembers = [
    "attributes",
    "executeExhibitState",
    "executeFlows",
    "executeMainComponent",
    "exhibitState",
    "flows",
    "havocInputEvents",
    "parts",
    "passTime",
    "ports",
    "resetInputEvents",
    "resetOutputEvents",
];

export const stateMembers = [
    "activate",
    "activateRecursive",
    "activeState",
    "assumeNoInnerTransitionEnabled",
    "assumeNoLocalTransitionEnabled",
    "assumeNoTransitionEnabled",
    "complete",
    "deactivate",
    "deactivateRecursive",
    "deferTransitions",
    "done",
    "enter",
    "enterRecursive",
    "entryAction",
    "exit",
    "exitAction",
    "exitRecursive",
    "findCommonState",
    "fireInnerTransitions",
    "fireLocalTransitions",
    "fireTransitions",
    "incomingTransitions",
    "isActive",
    "isInnerStateActive",
    "outgoingTransitions",
    "parent",
    "passTime",
    "performOutgoing",
    "performing",
    "setActiveState",
    "start",
    "states",
    "transitions",
];

export const transitionMembers = [
    "acceptAction",
    "action",
    "fire",
    "from",
    "guard",
    "initialize",
    "isEnabled",
    "parentState",
    "passTime",
    "performTransition",
    "performWithin",
    "to",
];

export const compositeMembers = ["children"];

export const caseMembers = ["objective", "passTime", "subject"];

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class NameScope {
    private readonly used: Set<string>;

    constructor(reserved: readonly string[]) {
        this.used = new Set([...keywords, ...reserved]);
    }

    claim(name: string | undefined, fallback: string): string {
        if (name !== undefined && identifier.test(name) && !this.used.has(name)) {
            this.used.add(name);
            return name;
        }
        const base = name !== undefined && identifier.test(name) ? `${name}_` : fallback;
        let index = 1;
        while (this.used.has(`${base}${index}`)) {
            index++;
        }
        this.used.add(`${base}${index}`);
        return `${base}${index}`;
    }
}

export class OxstsNode {
    readonly children: OxstsNode[] = [];
    readonly scope: NameScope;

    constructor(
        readonly parent: OxstsNode | undefined,
        readonly name: string,
        readonly header: () => string,
        reserved: readonly string[] = [],
        readonly isClass = false
    ) {
        this.scope = new NameScope(reserved);
        parent?.children.push(this);
    }

    featureChain(): OxstsNode[] {
        if (this.isClass || !this.parent) {
            return [];
        }
        return [...this.parent.featureChain(), this];
    }

    classNode(): OxstsNode {
        return this.isClass || !this.parent ? this : this.parent.classNode();
    }

    path(): string {
        return [this.classNode(), ...this.featureChain()]
            .map((node) => {
                return node.name;
            })
            .join(".");
    }

    // the shortest name path that resolves from inside `from`, both in one class
    relativeTo(from: OxstsNode): string {
        const target = this.featureChain();
        const context = from.featureChain();
        let common = 0;
        while (
            common < target.length &&
            common < context.length &&
            target[common] === context[common]
        ) {
            common++;
        }
        return target
            .slice(Math.min(common, target.length - 1))
            .map((node) => {
                return node.name;
            })
            .join(".");
    }

    render(indent: string, lines: string[]): void {
        const header = this.header();
        if (this.children.length === 0) {
            lines.push(`${indent}${header}`);
            return;
        }
        lines.push(`${indent}${header} {`);
        for (const child of this.children) {
            child.render(`${indent}    `, lines);
        }
        lines.push(`${indent}}`);
    }
}
