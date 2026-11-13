import { AstUtils, type AstNode } from "langium";
import { DiagnosticSeverity, type Diagnostic, type Range } from "vscode-languageserver";
import {
    isAcceptActionUsage,
    isActionUsage,
    isAllocationUsage,
    isAnnotatingElement,
    isAssignmentActionUsage,
    isAttributeUsage,
    isBindingConnectorAsUsage,
    isCalculationDefinition,
    isCalculationUsage,
    isConnectionUsage,
    isConstructorExpression,
    isControlNode,
    isDefinition,
    isEnumerationDefinition,
    isExhibitStateUsage,
    isFeatureChainExpression,
    isFeatureMembership,
    isFeatureReferenceExpression,
    isFeatureTyping,
    isImport,
    isInterfaceUsage,
    isInvocationExpression,
    isItemDefinition,
    isItemFlow,
    isItemUsage,
    isLibraryPackage,
    isLiteralBoolean,
    isLiteralExpression,
    isLiteralNumber,
    isMembership,
    isMetadataUsage,
    isMultiplicityRange,
    isObjectiveMembership,
    isOperatorExpression,
    isOwningMembership,
    isPackage,
    isPartDefinition,
    isPartUsage,
    isPerformActionUsage,
    isPortDefinition,
    isPortUsage,
    isReferenceSubsetting,
    isRequirementConstraintMembership,
    isRequirementUsage,
    isRequirementVerificationMembership,
    isSendActionUsage,
    isStateDefinition,
    isStateSubactionMembership,
    isStateUsage,
    isSubjectMembership,
    isSubsetting,
    isSuccessionAsUsage,
    isTransitionUsage,
    isTriggerInvocationExpression,
    isUsage,
    isVerificationCaseDefinition,
    type AcceptActionUsage,
    type ActionUsage,
    type AttributeUsage,
    type BindingConnectorAsUsage,
    type ConstraintUsage,
    type Element,
    type ElementReference,
    type Expression,
    type InvocationExpression,
    type Feature,
    type ItemDefinition,
    type ItemFlow,
    type Membership,
    type Namespace,
    type PartDefinition,
    type PartUsage,
    type PortDefinition,
    type PortUsage,
    type RequirementUsage,
    type StateDefinition,
    type StateUsage,
    type TransitionUsage,
    type Type,
    type VerificationCaseDefinition,
} from "#generated/ast";
import {
    SemantifyrConstructs,
    SemantifyrErrors,
    type SemantifyrConstruct,
    type SemantifyrConstructId,
    type SemantifyrErrorId,
} from "./SemantifyrConstructs";
import {
    elementPath,
    isLibraryFeature,
    ownedElements,
    transitionTarget,
} from "./SemantifyrElementPath";
import {
    hashModelText,
    type SemantifyrNameEntry,
    type SemantifyrNameMap,
} from "./SemantifyrNameMap";
import {
    caseMembers,
    compositeMembers,
    libraryClasses,
    OxstsNode,
    partMembers,
    requirementMembers,
    stateMembers,
    transitionMembers,
} from "./SemantifyrOxsts";
import {
    computeTick,
    durationArgument,
    literalDuration,
    type TickNormalization,
} from "./SemantifyrTick";

export const modelPackage = "semantifyr::sysml::model";

const libraryPackages = [
    "expressions",
    "attributes",
    "states",
    "parts",
    "ports",
    "items",
    "actions",
    "triggers",
    "verification",
];

const builtinCalculations = ["isStateActive", "mustAlways", "eventually"];

const binaryOperators = new Map([
    ["+", "PlusOperatorExpression"],
    ["-", "MinusOperatorExpression"],
    ["*", "MultiplicationOperatorExpression"],
    ["/", "DivisionOperatorExpression"],
    ["==", "EqualityOperatorExpression"],
    ["!=", "InequalityOperatorExpression"],
    ["<", "LessThanOperatorExpression"],
    ["<=", "LessThanOrEqualsOperatorExpression"],
    [">", "GreaterThanOperatorExpression"],
    [">=", "GreaterThanOrEqualsOperatorExpression"],
    ["and", "AndOperatorExpression"],
    ["or", "OrOperatorExpression"],
]);

const moduloPowerOperators = new Set(["%", "**", "^"]);

const unaryOperators = new Map([
    ["not", "UnaryNotExpression"],
    ["-", "UnaryMinusExpression"],
    ["+", "UnaryPlusExpression"],
]);

export interface SemantifyrMapping {
    oxsts?: string;
    nameMap?: SemantifyrNameMap;
    diagnostics: Diagnostic[];
}

type Multiplicity =
    | { kind: "one" }
    | { kind: "zero" }
    | { kind: "optional" }
    | { kind: "count"; count: number }
    | { kind: "other" };

interface PartContext {
    readonly definition: PartDefinition | StateDefinition;
}

type ExpressionContext =
    | { kind: "part"; definition: Element; node: OxstsNode }
    | { kind: "verification"; node: OxstsNode; subjects: Map<Element, OxstsNode> };

class Refusal extends Error {}

function rangeOf(node: AstNode): Range {
    let current: AstNode | undefined = node;
    while (current && !current.$cstNode) {
        current = current.$container;
    }
    return (
        current?.$cstNode?.range ?? {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        }
    );
}

function referenced(reference: ElementReference | undefined): Element | undefined {
    return reference?.parts.at(-1)?.ref;
}

function isAnnotation(element: Element | undefined): boolean {
    return isAnnotatingElement(element) || isMetadataUsage(element);
}

function typings(type: Type): Element[] {
    return type.heritage.filter(isFeatureTyping).flatMap((typing) => {
        const target = referenced(typing.targetRef);
        return target ? [target] : [];
    });
}

function hasFeatureSpecialization(type: Type): boolean {
    return type.heritage.some((relationship) => {
        return isSubsetting(relationship);
    });
}

function valueOf(feature: Element | undefined): Expression | undefined {
    return (feature as Feature | undefined)?.value?.target as Expression | undefined;
}

function multiplicityOf(feature: Feature): Multiplicity {
    const multiplicity = feature.multiplicity?.target;
    if (!multiplicity) {
        return { kind: "one" };
    }
    if (!isMultiplicityRange(multiplicity)) {
        return { kind: "other" };
    }
    const bound = multiplicity.range?.target;
    if (isLiteralNumber(bound) && Number.isInteger(bound.literal)) {
        if (bound.literal === 0) {
            return { kind: "zero" };
        }
        if (bound.literal === 1) {
            return { kind: "one" };
        }
        return { kind: "count", count: bound.literal };
    }
    if (isOperatorExpression(bound) && bound.operator === "..") {
        const [lower, upper] = bound.operands;
        if (
            isLiteralNumber(lower) &&
            isLiteralNumber(upper) &&
            lower.literal === 0 &&
            upper.literal === 1
        ) {
            return { kind: "optional" };
        }
        if (isLiteralNumber(lower) && isLiteralNumber(upper) && lower.literal === upper.literal) {
            if (lower.literal === 1) {
                return { kind: "one" };
            }
            if (lower.literal === 0) {
                return { kind: "zero" };
            }
            return { kind: "count", count: lower.literal };
        }
    }
    return { kind: "other" };
}

export class SemantifyrModelMapper {
    private readonly diagnostics: Diagnostic[] = [];
    private readonly root: OxstsNode;
    private readonly nodes = new Map<Element, OxstsNode>();
    private readonly entries: SemantifyrNameEntry[] = [];
    private readonly multiple = new Set<Element>();
    private readonly absent = new Set<Element>();
    private readonly derived = new Set<Element>();
    private readonly classNames = new Map<Element, string>();
    private readonly conjugatedClassNames = new Map<Element, string>();
    private readonly globalItems = new Map<Element, string>();
    private readonly requirements = new Set<RequirementUsage>();
    private readonly parallelStates: StateUsage[] = [];
    private readonly unnamedTransitions = new Map<string, TransitionUsage>();
    private readonly tick: TickNormalization;

    constructor(
        private readonly model: Namespace,
        private readonly text: string
    ) {
        this.root = new OxstsNode(undefined, modelPackage, () => "", libraryClasses, true);
        this.tick = computeTick(model);
    }

    map(): SemantifyrMapping {
        const members = ownedMembers(this.model);
        for (const element of members) {
            this.guard(element, () => {
                this.declareDefinition(element);
            });
        }
        // the cases last, so that the multiplicities of the parts they reference are known
        for (const element of [
            ...members.filter((member) => !isVerificationCaseDefinition(member)),
            ...members.filter(isVerificationCaseDefinition),
        ]) {
            this.guard(element, () => {
                this.mapTopLevel(element);
            });
        }
        this.warnRegionsSharingAttributes();
        if (
            this.diagnostics.some((diagnostic) => {
                return diagnostic.severity === DiagnosticSeverity.Error;
            })
        ) {
            return { diagnostics: this.diagnostics };
        }
        const lines = [
            `package ${modelPackage}`,
            "",
            ...libraryPackages.map((name) => {
                return `import semantifyr::sysml::${name}`;
            }),
        ];
        for (const node of this.root.children) {
            lines.push("");
            node.render("", lines);
        }
        return {
            oxsts: lines.join("\n") + "\n",
            nameMap: {
                modelHash: hashModelText(this.text),
                package: modelPackage,
                tick: this.tick.tick,
                entries: this.entries,
            },
            diagnostics: this.diagnostics,
        };
    }

    private report(
        node: AstNode,
        code: SemantifyrConstructId | SemantifyrErrorId,
        detail?: string
    ): void {
        const construct: SemantifyrConstruct | undefined =
            SemantifyrConstructs[code as SemantifyrConstructId];
        this.diagnostics.push({
            range: rangeOf(node),
            severity: construct?.warning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
            source: "semantifyr",
            code,
            message: detail ?? construct?.detail ?? SemantifyrErrors[code as SemantifyrErrorId],
        });
    }

    private refuse(
        node: AstNode,
        code: SemantifyrConstructId | SemantifyrErrorId,
        detail?: string
    ): never {
        this.report(node, code, detail);
        throw new Refusal();
    }

    // a refusal ends the translation of the construct it is reported on, and the next construct goes on
    private guard(node: AstNode, body: () => void): void {
        try {
            body();
        } catch (error) {
            if (error instanceof Refusal) {
                return;
            }
            if (error instanceof TypeError) {
                this.report(
                    node,
                    "translationFailure",
                    `Semantifyr cannot translate this element: ${error.message}`
                );
                return;
            }
            throw error;
        }
    }

    private declare(element: Element, node: OxstsNode, suffix = "", type?: string): void {
        if (suffix === "") {
            this.nodes.set(element, node);
        }
        this.entries.push({
            sysml: `${elementPath(element)}${suffix}`,
            oxsts: node.path(),
            ...(type !== undefined ? { type } : {}),
        });
    }

    // the node is looked up when the text is written, since a reference may precede the declaration it names
    private nodeOf(element: Element, at: AstNode): () => OxstsNode {
        if (this.multiple.has(element)) {
            this.refuse(at, "multipleReference");
        }
        if (this.absent.has(element)) {
            this.refuse(at, "translationFailure", "This usage has multiplicity [0] and is absent");
        }
        return () => {
            const node = this.nodes.get(element);
            if (!node) {
                throw new Error(`'${elementPath(element)}' has no translation`);
            }
            return node;
        };
    }

    private declareDefinition(element: Element): void {
        if (
            isPartDefinition(element) ||
            isStateDefinition(element) ||
            isVerificationCaseDefinition(element)
        ) {
            this.classNames.set(element, this.root.scope.claim(element.declaredName, "Definition"));
        } else if (isPortDefinition(element)) {
            const name = this.root.scope.claim(element.declaredName, "Port");
            this.classNames.set(element, name);
            this.conjugatedClassNames.set(
                element,
                this.root.scope.claim(`Conjugated${name}`, `Conjugated${name}`)
            );
        } else if (isItemDefinition(element)) {
            const name = this.root.scope.claim(element.declaredName, "Item");
            this.classNames.set(element, name);
            this.globalItems.set(
                element,
                this.root.scope.claim(`global_${name}`, `global_${name}`)
            );
        }
    }

    private className(element: Element): string {
        const name = this.classNames.get(element);
        if (name === undefined) {
            throw new TypeError(`'${element.declaredName}' is not translated`);
        }
        return name;
    }

    private mapTopLevel(element: Element): void {
        if (isImport(element) || isAnnotation(element)) {
            return;
        }
        if (isMembership(element) && !isOwningMembership(element)) {
            this.refuse(element, "alias");
        }
        if (isPackage(element) || isLibraryPackage(element)) {
            this.refuse(element, "package");
        }
        if (isPartDefinition(element)) {
            return this.mapPartDefinition(element);
        }
        if (isPortDefinition(element)) {
            return this.mapPortDefinition(element);
        }
        if (isItemDefinition(element)) {
            return this.mapItemDefinition(element);
        }
        if (isStateDefinition(element)) {
            return this.mapStateDefinition(element);
        }
        if (isVerificationCaseDefinition(element)) {
            return this.mapVerificationCase(element);
        }
        if (isCalculationDefinition(element)) {
            if (builtinCalculations.includes(element.declaredName ?? "")) {
                return;
            }
            this.refuse(element, "calculation");
        }
        if (isRequirementUsage(element)) {
            this.requirements.add(element);
            return;
        }
        if (isUsage(element)) {
            this.refuse(element, "topLevelUsage");
        }
        if (isEnumerationDefinition(element)) {
            this.refuse(element, "enumerationDefinition");
        }
        if (isDefinition(element)) {
            this.refuse(element, "topLevelDefinition");
        }
        this.refuse(element, "translationFailure");
    }

    private refuseSpecialization(type: Type): void {
        for (const relationship of type.heritage) {
            this.report(relationship, "definitionSpecialization");
        }
        if (type.heritage.length > 0) {
            throw new Refusal();
        }
    }

    private mapItemDefinition(item: ItemDefinition): void {
        const name = this.className(item);
        for (const relationship of item.heritage) {
            this.report(relationship, "itemSpecialization");
        }
        for (const member of ownedElements(item)) {
            if (!isAnnotation(member)) {
                this.report(member, "itemMember");
            }
        }
        const node = new OxstsNode(this.root, name, () => `class ${name} : Item`, [], true);
        this.declare(item, node);
        const global = this.globalItems.get(item)!;
        new OxstsNode(
            this.root,
            global,
            () => `global containment ${global}: ${name}[1]`,
            [],
            true
        );
    }

    private mapPortDefinition(port: PortDefinition): void {
        this.refuseSpecialization(port);
        for (const member of ownedElements(port)) {
            if (!isAnnotation(member) && !(isItemUsage(member) && member.direction !== undefined)) {
                this.report(member, "portMember");
            }
        }
        const name = this.className(port);
        const conjugated = this.conjugatedClassNames.get(port)!;
        this.declare(
            port,
            new OxstsNode(this.root, name, () => `class ${name} : NormalPort`, [], true)
        );
        new OxstsNode(
            this.root,
            conjugated,
            () => `class ${conjugated} : ConjugatedPort`,
            [],
            true
        );
    }

    private mapPartDefinition(part: PartDefinition): void {
        this.refuseSpecialization(part);
        const name = this.className(part);
        const node = new OxstsNode(
            this.root,
            name,
            () => `class ${name} : Part`,
            partMembers,
            true
        );
        this.declare(part, node);
        const context: PartContext = { definition: part };
        const members = ownedElements(part);
        const rebound = new Map<Element, BindingConnectorAsUsage>();
        for (const member of members) {
            if (isBindingConnectorAsUsage(member)) {
                const source = this.bindingEnds(member)[0];
                if (source.length === 1 && isPortUsage(source[0])) {
                    rebound.set(source[0], member);
                }
            }
        }
        const performed = this.performedState(members);
        const isStructure = (member: Element): boolean => {
            return isPortUsage(member) || isPartUsage(member) || isAttributeUsage(member);
        };
        // structure first, so that multiplicities are known before behaviour references them
        for (const member of [
            ...members.filter(isStructure),
            ...members.filter((member) => !isStructure(member)),
        ]) {
            this.guard(member, () => {
                this.mapPartMember(context, node, member, rebound, performed);
            });
        }
    }

    // the one state a part performs: an exhibited state or its plain state
    private performedState(members: Element[]): Element | undefined {
        const plainStates = members.filter((member): member is StateUsage => {
            return isStateUsage(member) && !isExhibitStateUsage(member);
        });
        const candidates = members.filter((member) => {
            if (isExhibitStateUsage(member)) {
                const target = this.exhibitReference(member);
                return !(target && plainStates.includes(target as StateUsage));
            }
            return plainStates.includes(member as StateUsage);
        });
        for (const extra of candidates.slice(1)) {
            this.report(extra, "exhibitStateSecond");
        }
        return candidates[0];
    }

    private exhibitReference(exhibit: StateUsage): Element | undefined {
        const subsetting = exhibit.heritage.find(isReferenceSubsetting);
        return subsetting ? referenced(subsetting.targetRef) : undefined;
    }

    private mapPartMember(
        context: PartContext,
        node: OxstsNode,
        member: Element,
        rebound: Map<Element, BindingConnectorAsUsage>,
        performed: Element | undefined
    ): void {
        if (isAnnotation(member)) {
            return;
        }
        if (isItemFlow(member)) {
            return this.mapFlow(context, node, member);
        }
        if (isConnectionUsage(member) || isInterfaceUsage(member) || isAllocationUsage(member)) {
            this.refuse(member, "connection");
        }
        if (isBindingConnectorAsUsage(member)) {
            return this.mapBinding(node, member);
        }
        if (isPortUsage(member)) {
            if (rebound.has(member)) {
                return;
            }
            return this.mapPortUsage(node, member);
        }
        if (isPartUsage(member)) {
            return this.mapPartUsage(node, member);
        }
        if (isAttributeUsage(member)) {
            return this.mapAttribute(context, node, member);
        }
        if (isExhibitStateUsage(member)) {
            if (member !== performed) {
                const target = this.exhibitReference(member);
                if (target && target === performed) {
                    return;
                }
                throw new Refusal();
            }
            return this.mapExhibitState(context, node, member);
        }
        if (isStateUsage(member)) {
            if (member !== performed) {
                throw new Refusal();
            }
            return this.mapExhibitState(context, node, member, true);
        }
        if (isActionUsage(member) && !isCalculationUsage(member)) {
            this.refuse(member, "partAction");
        }
        this.refuse(member, "partMember");
    }

    private portType(port: PortUsage): string {
        const typingCount = port.heritage.filter(isFeatureTyping).length;
        if (typingCount > 1) {
            this.refuse(port, "multipleTypings");
        }
        if (typingCount === 0) {
            this.refuse(port, "portUsageUntyped");
        }
        const target = port.$meta.portDefinition()?.ast();
        if (!isPortDefinition(target)) {
            this.refuse(port, "portUsageUntyped");
        }
        return port.$meta.isConjugated()
            ? this.conjugatedClassNames.get(target)!
            : this.className(target);
    }

    private checkUsage(usage: Feature): void {
        if (hasFeatureSpecialization(usage)) {
            this.refuse(usage, "usageSpecialization");
        }
        const body = ownedElements(usage).filter((member) => {
            return !isAnnotation(member) && member !== usage.multiplicity?.target;
        });
        if (body.length > 0) {
            this.refuse(body[0], "usageBody");
        }
    }

    private mapPortUsage(parent: OxstsNode, port: PortUsage): void {
        this.checkUsage(port);
        const type = this.portType(port);
        this.mapCountedUsage(parent, port, type, "ports", "port");
    }

    private mapPartUsage(parent: OxstsNode, part: PartUsage): void {
        this.checkUsage(part);
        const types = typings(part);
        if (types.length > 1) {
            this.refuse(part, "multipleTypings");
        }
        if (!isPartDefinition(types[0])) {
            this.refuse(part, "partUsageUntyped");
        }
        this.mapCountedUsage(parent, part, this.className(types[0]), "parts", "part");
    }

    private mapCountedUsage(
        parent: OxstsNode,
        usage: PortUsage | PartUsage,
        type: string,
        feature: string,
        fallback: string
    ): void {
        const multiplicity = multiplicityOf(usage);
        if (multiplicity.kind === "zero") {
            this.absent.add(usage);
            return;
        }
        if (multiplicity.kind === "optional") {
            this.refuse(usage.multiplicity ?? usage, "multiplicityOptional");
        }
        if (multiplicity.kind === "other") {
            this.refuse(usage.multiplicity ?? usage, "multiplicityOther");
        }
        const name = parent.scope.claim(usage.declaredName, fallback);
        if (multiplicity.kind === "one") {
            this.declare(
                usage,
                new OxstsNode(parent, name, () => `contains ${name}: ${type} subsets ${feature}`),
                "",
                type
            );
            return;
        }
        this.multiple.add(usage);
        this.declare(
            usage,
            new OxstsNode(parent, name, () => `contains ${name}: ${type}[0..*] subsets ${feature}`)
        );
        for (let index = 1; index <= multiplicity.count; index++) {
            const instance = parent.scope.claim(`${name}_${index}`, `${name}_`);
            this.declare(
                usage,
                new OxstsNode(
                    parent,
                    instance,
                    () => `contains ${instance}: ${type} subsets ${name}`
                ),
                `[${index}]`,
                type
            );
        }
    }

    // the elements each end of a binding names, the first one the part's own feature
    private bindingEnds(binding: BindingConnectorAsUsage): Element[][] {
        return binding.ends.map((end) => {
            const feature = end.target as Feature | undefined;
            if (!feature) {
                return [];
            }
            const chain = feature.typeRelationships.flatMap((relationship) => {
                const target = referenced(relationship.targetRef);
                return target ? [target] : [];
            });
            if (chain.length > 0) {
                return chain;
            }
            const subsetting = feature.heritage.find(isReferenceSubsetting);
            if (subsetting?.targetChain) {
                return subsetting.targetChain.typeRelationships.flatMap((relationship) => {
                    const target = referenced(relationship.targetRef);
                    return target ? [target] : [];
                });
            }
            const target = subsetting ? referenced(subsetting.targetRef) : undefined;
            return target ? [target] : [];
        });
    }

    private mapBinding(parent: OxstsNode, binding: BindingConnectorAsUsage): void {
        const [source, target] = this.bindingEnds(binding);
        const port = source?.[0];
        if (
            source?.length !== 1 ||
            !isPortUsage(port) ||
            target?.length !== 2 ||
            !isPartUsage(target[0]) ||
            !isPortUsage(target[1])
        ) {
            this.refuse(binding, "bindingOther");
        }
        this.checkUsage(port);
        const type = this.portType(port);
        if (multiplicityOf(port).kind !== "one") {
            this.refuse(port, "multipleReference");
        }
        const name = parent.scope.claim(port.declaredName, "port");
        const part = this.nodeOf(target[0], binding);
        const targetPort = this.nodeOf(target[1], binding);
        const node = new OxstsNode(parent, name, () => {
            return `refers ${name}: ${type} subsets ports = ${part().name}.${targetPort().name}`;
        });
        this.declare(port, node, "", type);
    }

    private flowEnd(flow: ItemFlow, index: number): [Element, Element] {
        const end = flow.ends[index]?.target as Feature | undefined;
        const subsetting = end?.heritage.find(isReferenceSubsetting);
        const part = subsetting ? referenced(subsetting.targetRef) : undefined;
        const members = end ? ownedElements(end) : [];
        const portFeature = members[0] as Feature | undefined;
        const port = portFeature?.heritage
            .map((relationship) => {
                return referenced(relationship.targetRef);
            })
            .find(isPortUsage);
        if (
            !isPartUsage(part) ||
            !port ||
            members.length !== 1 ||
            subsetting?.targetRef?.parts.length !== 1
        ) {
            this.refuse(end ?? flow, "flowEnd");
        }
        return [part, port];
    }

    private mapFlow(context: PartContext, parent: OxstsNode, flow: ItemFlow): void {
        const source = this.flowEnd(flow, 0);
        const target = this.flowEnd(flow, 1);
        for (const [part] of [source, target]) {
            if (part.$container?.$container !== context.definition) {
                this.refuse(flow, "flowEnd");
            }
        }
        const name = parent.scope.claim(flow.declaredName, "flow");
        const node = new OxstsNode(parent, name, () => `contains ${name}: Flow subsets flows`);
        this.declare(flow, node);
        const end = (feature: string, [part, port]: [Element, Element]): void => {
            const partNode = this.nodeOf(part, flow);
            const portNode = this.nodeOf(port, flow);
            new OxstsNode(node, feature, () => {
                return `redefine refers ${feature}: Port = ${partNode().name}.${portNode().name}`;
            });
        };
        end("source", source);
        end("target", target);
    }

    private mapAttribute(context: PartContext, parent: OxstsNode, attribute: AttributeUsage): void {
        if (hasFeatureSpecialization(attribute)) {
            this.refuse(attribute, "usageSpecialization");
        }
        const types = typings(attribute);
        if (types.length > 1) {
            this.refuse(attribute, "multipleTypings");
        }
        const typeName = types[0]?.$meta.qualifiedName;
        const kind =
            typeName === "ScalarValues::Integer"
                ? "IntegerAttribute"
                : typeName === "ScalarValues::Boolean"
                  ? "BooleanAttribute"
                  : undefined;
        if (typeName === "ScalarValues::Real" || isEnumerationDefinition(types[0])) {
            this.refuse(attribute, "attributeRealOrEnumeration");
        }
        if (!kind) {
            this.refuse(attribute, "attributeType");
        }
        const multiplicity = multiplicityOf(attribute);
        if (multiplicity.kind === "zero") {
            this.absent.add(attribute);
            return;
        }
        if (multiplicity.kind === "count") {
            this.refuse(attribute.multiplicity ?? attribute, "multiplicityAttribute");
        }
        if (multiplicity.kind === "optional") {
            this.refuse(attribute.multiplicity ?? attribute, "multiplicityOptional");
        }
        if (multiplicity.kind === "other") {
            this.refuse(attribute.multiplicity ?? attribute, "multiplicityOther");
        }
        const featureValue = attribute.value;
        const value = featureValue?.target as Expression | undefined;
        const name = parent.scope.claim(attribute.declaredName, "attribute");
        const isDerived = featureValue !== undefined && !featureValue.isInitial;
        if (isDerived) {
            this.derived.add(attribute);
        }
        const node = new OxstsNode(parent, name, () => {
            return `contains ${name}: ${isDerived ? "DerivedAttribute" : kind} subsets attributes`;
        });
        this.declare(attribute, node);
        if (value) {
            const expressionContext: ExpressionContext = {
                kind: "part",
                definition: context.definition,
                node,
            };
            this.mapExpression(
                node,
                isDerived ? "expression" : "initialValue",
                value,
                expressionContext
            );
        }
    }

    private mapExhibitState(
        context: PartContext,
        parent: OxstsNode,
        exhibit: StateUsage,
        plain = false
    ): void {
        const referencedState = plain ? undefined : this.exhibitReference(exhibit);
        const state = referencedState && isStateUsage(referencedState) ? referencedState : exhibit;
        if (state !== exhibit && ownedElements(exhibit).length > 0) {
            this.refuse(exhibit, "usageBody");
        }
        if (hasFeatureSpecialization(state) && state === exhibit && !referencedState) {
            this.refuse(state, "usageSpecialization");
        }
        const types = typings(state);
        if (types.length > 1) {
            this.refuse(state, "multipleTypings");
        }
        const name = parent.scope.claim(state.declaredName, "state");
        if (types.length === 1) {
            if (!isStateDefinition(types[0])) {
                this.refuse(
                    state,
                    "translationFailure",
                    "Semantifyr requires an exhibit state to be typed by a state definition"
                );
            }
            if (ownedElements(state).some((member) => !isAnnotation(member))) {
                this.refuse(state, "usageBody");
            }
            const type = this.className(types[0]);
            const node = new OxstsNode(
                parent,
                name,
                () => `contains ${name}: ${type} redefines exhibitState`
            );
            this.declare(state, node, "", type);
            if (state !== exhibit) {
                this.declare(exhibit, node, "", type);
            }
            return;
        }
        const type = state.isParallel ? "ExhibitedParallelState" : "ExhibitedState";
        const node = new OxstsNode(
            parent,
            name,
            () => `contains ${name}: ${type} redefines exhibitState`,
            stateMembers
        );
        this.declare(state, node);
        if (state !== exhibit) {
            this.declare(exhibit, node);
        }
        this.mapStateBody(context, node, state, state);
    }

    private mapStateDefinition(definition: StateDefinition): void {
        this.refuseSpecialization(definition);
        const name = this.className(definition);
        const type = definition.isParallel ? "ExhibitedParallelState" : "ExhibitedState";
        const node = new OxstsNode(
            this.root,
            name,
            () => `class ${name} : ${type}`,
            stateMembers,
            true
        );
        this.declare(definition, node);
        this.mapStateBody({ definition }, node, definition, definition);
    }

    private mapStateBody(
        context: PartContext,
        node: OxstsNode,
        state: StateUsage | StateDefinition,
        machine: Element
    ): void {
        const substates: StateUsage[] = [];
        const transitions: TransitionUsage[] = [];
        const initialTransitions = new Set<TransitionUsage>();
        const skipped = new Set<Element>();
        // the transition right after the entry action, `entry; then X;` or `entry action a { ... } then X;`, is the initial one
        let followsEntry = false;
        for (const membership of state.children) {
            const afterEntry = followsEntry;
            followsEntry = false;
            if (isImport(membership)) {
                continue;
            }
            const member = (membership as Membership).target as Element | undefined;
            if (!member || isAnnotation(member)) {
                continue;
            }
            if (isStateSubactionMembership(membership)) {
                if (membership.kind === "do") {
                    const next = state.children[state.children.indexOf(membership) + 1];
                    const shorthand = (next as Membership | undefined)?.target;
                    if (
                        isTransitionUsage(shorthand) &&
                        shorthand.source === undefined &&
                        !shorthand.accepter &&
                        !shorthand.guard
                    ) {
                        this.report(membership, "targetTransitionEffect");
                        skipped.add(shorthand);
                    } else {
                        this.report(membership, "doAction");
                    }
                    continue;
                }
                const action = member as ActionUsage;
                if (membership.kind === "entry") {
                    followsEntry = true;
                }
                this.guard(membership, () => {
                    this.mapAction(
                        context,
                        node,
                        action,
                        membership.kind === "entry" ? "entryAction" : "exitAction"
                    );
                });
                continue;
            }
            if (isTransitionUsage(member)) {
                if (skipped.has(member)) {
                    continue;
                }
                if (state.isParallel) {
                    this.report(member, "transitionInParallel");
                    continue;
                }
                const isInitial =
                    member.source === undefined
                        ? afterEntry
                        : isLibraryFeature(
                              referenced(member.source.targetRef),
                              "start",
                              this.model
                          );
                if (isInitial) {
                    initialTransitions.add(member);
                }
                transitions.push(member);
                continue;
            }
            if (isStateUsage(member) && !isExhibitStateUsage(member)) {
                substates.push(member);
                continue;
            }
            this.report(member, isAttributeUsage(member) ? "attributeOutsidePart" : "stateMember");
        }
        for (const substate of substates) {
            this.guard(substate, () => {
                if (hasFeatureSpecialization(substate)) {
                    this.refuse(substate, "usageSpecialization");
                }
                if (typings(substate).length > 0) {
                    this.refuse(substate, "stateUsageTyped");
                }
                const name = node.scope.claim(substate.declaredName, "state");
                const type = substate.isParallel ? "ParallelState" : "State";
                const child = new OxstsNode(
                    node,
                    name,
                    () => `contains ${name}: ${type} subsets states`,
                    stateMembers
                );
                this.declare(substate, child);
                if (substate.isParallel) {
                    this.parallelStates.push(substate);
                }
                this.mapStateBody(context, child, substate, machine);
            });
        }
        for (const transition of transitions) {
            this.guard(transition, () => {
                this.mapTransition(
                    context,
                    node,
                    state,
                    transition,
                    machine,
                    initialTransitions.has(transition)
                );
            });
        }
        if (substates.length > 0 && !state.isParallel && initialTransitions.size === 0) {
            this.report(state, "compositeWithoutInitial");
        }
    }

    private isEmptyAction(action: ActionUsage): boolean {
        return (
            action.$type === "ActionUsage" &&
            action.declaredName === undefined &&
            ownedElements(action).length === 0
        );
    }

    private isStateOf(element: Element | undefined, machine: Element): element is StateUsage {
        let current = element;
        while (current && isStateUsage(current)) {
            if (current === machine) {
                return current !== element;
            }
            current = current.$container?.$container as Element | undefined;
        }
        return current === machine && current !== element;
    }

    private mapTransition(
        context: PartContext,
        parent: OxstsNode,
        owner: StateUsage | StateDefinition,
        transition: TransitionUsage,
        machine: Element,
        isInitial: boolean
    ): void {
        // a transition without `first` in a state's body leaves its owning state (SysML 7.18.3)
        const isTargetTransition = transition.source === undefined && !isInitial;
        const sourceElement = transition.source
            ? referenced(transition.source.targetRef)
            : isTargetTransition
              ? owner
              : undefined;
        if (isTargetTransition && !this.isStateOf(owner, machine)) {
            this.refuse(
                transition,
                "transitionTarget",
                "Semantifyr requires a transition without 'first' to be declared in a state below the exhibited state, which it leaves"
            );
        }
        if (!isInitial && !this.isStateOf(sourceElement, machine)) {
            this.refuse(transition.source ?? transition, "transitionTarget");
        }
        const targetElement = transitionTarget(transition);
        const isDone = isLibraryFeature(targetElement, "done", this.model);
        if (!isDone && !this.isStateOf(targetElement, machine)) {
            this.refuse(transition.then ?? transition, "transitionTarget");
        }
        const accept = transition.accepter?.target as AcceptActionUsage | undefined;
        const guard = transition.guard?.target as Expression | undefined;
        const effect = transition.effect?.target as ActionUsage | undefined;
        if (isInitial && accept) {
            this.refuse(transition.accepter!, "initialTrigger");
        }
        if (isInitial && isLiteralBoolean(guard) && !guard.literal) {
            this.refuse(guard, "initialGuardClosed");
        }
        if (!isInitial && transition.declaredName === undefined) {
            this.checkUnnamedTwin(owner, transition, sourceElement, targetElement);
        }
        const name = parent.scope.claim(
            transition.declaredName,
            isInitial ? "initial" : "transition"
        );
        const node = new OxstsNode(
            parent,
            name,
            () => `contains ${name}: Transition subsets transitions`,
            transitionMembers
        );
        this.declare(transition, node);
        const from = isInitial ? undefined : this.nodeOf(sourceElement!, transition);
        const to = isDone ? undefined : this.nodeOf(targetElement!, transition);
        new OxstsNode(node, "from", () => {
            return `redefine refers from: StateNode = ${from ? from().relativeTo(node) : "start"}`;
        });
        new OxstsNode(node, "to", () => {
            return `redefine refers to: StateNode = ${to ? to().relativeTo(node) : "done"}`;
        });
        const expressionContext: ExpressionContext = {
            kind: "part",
            definition: context.definition,
            node,
        };
        if (accept) {
            this.mapAccept(context, node, accept, expressionContext);
        }
        if (guard) {
            const guardNode = new OxstsNode(node, "guard", () => "redefine contains guard: Guard");
            this.mapExpression(guardNode, "expression", guard, {
                ...expressionContext,
                node: guardNode,
            });
        }
        if (effect) {
            this.mapAction(context, node, effect, "action");
        }
    }

    private checkUnnamedTwin(
        owner: Element,
        transition: TransitionUsage,
        source: Element | undefined,
        target: Element | undefined
    ): void {
        const text = (node: AstNode | undefined): string => {
            return node?.$cstNode?.text.replace(/\s+/g, " ") ?? "";
        };
        const key = [
            elementPath(owner),
            source ? elementPath(source) : "",
            target ? elementPath(target) : "",
            text(transition.accepter),
            text(transition.guard),
        ].join("\n");
        if (this.unnamedTransitions.has(key)) {
            this.report(transition, "unnamedTwins");
        } else {
            this.unnamedTransitions.set(key, transition);
        }
    }

    private ownPort(
        context: PartContext,
        at: AstNode,
        feature: Element | undefined
    ): () => OxstsNode {
        if (!isPortUsage(feature) || feature.$container?.$container !== context.definition) {
            this.refuse(at, "viaOther");
        }
        return this.nodeOf(feature, at);
    }

    private viaFeature(membership: Membership | undefined, at: AstNode): Element | undefined {
        if (!membership) {
            this.refuse(at, "acceptWithoutVia");
        }
        const value = valueOf(membership.target as Element);
        if (!isFeatureReferenceExpression(value)) {
            this.refuse(membership, "viaOther");
        }
        return referenced(value.expression.targetRef);
    }

    private itemOf(
        feature: Element | undefined,
        at: AstNode,
        construct: SemantifyrConstructId
    ): string {
        const item = feature ? typings(feature as Type).find(isItemDefinition) : undefined;
        const global = item ? this.globalItems.get(item) : undefined;
        if (global === undefined) {
            this.refuse(at, construct);
        }
        return global;
    }

    private mapAccept(
        context: PartContext,
        transition: OxstsNode,
        accept: AcceptActionUsage,
        expressionContext: ExpressionContext
    ): void {
        const payload = accept.payload?.target as Feature | undefined;
        const trigger = valueOf(payload);
        if (isTriggerInvocationExpression(trigger)) {
            if (trigger.kind === "at") {
                this.refuse(accept, "acceptAt");
            }
            if (trigger.kind === "after") {
                const duration = literalDuration(durationArgument(trigger));
                if (duration === undefined) {
                    this.refuse(trigger, "acceptAfterOther");
                }
                const ticks = (duration / this.tick.nanoseconds).toString();
                const node = new OxstsNode(
                    transition,
                    "acceptAction",
                    () => "redefine contains acceptAction: AcceptTimeoutAction"
                );
                this.declare(accept, node);
                new OxstsNode(node, "afterTime", () => `redefine refers afterTime: int = ${ticks}`);
                return;
            }
            let condition = durationArgument(trigger);
            if (
                isFeatureReferenceExpression(condition) &&
                isFeatureMembership(condition.expression)
            ) {
                condition = condition.expression.target as Expression;
            }
            if (!condition) {
                this.refuse(trigger, "translationFailure");
            }
            const node = new OxstsNode(
                transition,
                "acceptAction",
                () => "redefine contains acceptAction: AcceptWhenAction"
            );
            this.declare(accept, node);
            this.mapExpression(node, "expression", condition, { ...expressionContext, node });
            return;
        }
        const global = this.itemOf(payload, accept, "itemMember");
        const port = this.ownPort(context, accept, this.viaFeature(accept.receiver, accept));
        const node = new OxstsNode(
            transition,
            "acceptAction",
            () => "redefine contains acceptAction: AcceptItemAction"
        );
        this.declare(accept, node);
        new OxstsNode(
            node,
            "viaPort",
            () => `redefine refers viaPort: Port = ${port().relativeTo(node)}`
        );
        new OxstsNode(node, "payload", () => `redefine refers payload: Item = ${global}`);
    }

    // `feature` is the library feature an action redefines, or undefined for a child of a composite action
    private mapAction(
        context: PartContext,
        parent: OxstsNode,
        action: ActionUsage,
        feature?: string
    ): void {
        if (
            this.isEmptyAction(action) ||
            (action.$type === "ActionUsage" && ownedElements(action).length === 0)
        ) {
            return;
        }
        const header = (name: string, type: string): (() => string) => {
            if (feature) {
                return (): string => `redefine contains ${feature}: ${type}`;
            }
            return (): string => `contains ${name}: ${type} subsets children`;
        };
        const nameOf = (fallback: string): string => {
            return feature ?? parent.scope.claim(action.declaredName, fallback);
        };
        if (isSendActionUsage(action)) {
            if (action.receiver) {
                this.refuse(action.receiver, "sendTo");
            }
            const value = valueOf(action.payload?.target as Element);
            if (!isConstructorExpression(value)) {
                this.refuse(action.payload ?? action, "sendPayload");
            }
            if (value.operands.length > 0 || ownedElements(value).length > 0) {
                this.refuse(action, "sendArguments");
            }
            const global = this.itemOf(value, action.payload ?? action, "sendPayload");
            const port = this.ownPort(context, action, this.viaFeature(action.sender, action));
            const name = nameOf("send");
            const node = new OxstsNode(parent, name, header(name, "SendItemAction"));
            this.declare(action, node);
            new OxstsNode(
                node,
                "viaPort",
                () => `redefine refers viaPort: Port = ${port().relativeTo(node)}`
            );
            new OxstsNode(node, "payload", () => `redefine refers payload: Item = ${global}`);
            return;
        }
        if (isAssignmentActionUsage(action)) {
            const parts = action.targetMember?.targetRef?.parts ?? [];
            const target = parts.at(-1)?.ref;
            if (parts.length > 1 && isAttributeUsage(target)) {
                this.refuse(action.targetMember, "referenceOtherPart");
            }
            if (!isAttributeUsage(target) || target.$container?.$container !== context.definition) {
                this.refuse(
                    action.targetMember ?? action,
                    isAttributeUsage(target) ? "referenceOtherPart" : "assignmentTarget"
                );
            }
            if (this.derived.has(target)) {
                this.refuse(action, "assignmentToBound");
            }
            const value = valueOf(action.assignedValue?.target as Element);
            if (!value) {
                this.refuse(action, "translationFailure");
            }
            const name = nameOf("assignment");
            const node = new OxstsNode(parent, name, header(name, "AssignmentAction"));
            this.declare(action, node);
            const attribute = this.nodeOf(target, action);
            new OxstsNode(
                node,
                "attribute",
                () => `redefine refers attribute: Attribute = ${attribute().relativeTo(node)}`
            );
            this.mapExpression(node, "expression", value, {
                kind: "part",
                definition: context.definition,
                node,
            });
            return;
        }
        if (
            (isPerformActionUsage(action) || action.$type === "ActionUsage") &&
            !action.heritage.some(isReferenceSubsetting)
        ) {
            const children = this.orderedChildren(action);
            const name = nameOf("action");
            const node = new OxstsNode(
                parent,
                name,
                header(name, "CompositeAction"),
                compositeMembers
            );
            this.declare(action, node);
            for (const child of children) {
                this.guard(child, () => {
                    this.mapAction(context, node, child);
                });
            }
            return;
        }
        if (isAcceptActionUsage(action) || isControlNode(action)) {
            this.refuse(action, "actionAcceptOrControl");
        }
        this.refuse(action, "actionOther");
    }

    // the children of a composite action in the topological order of its successions, textual order among the unordered
    private orderedChildren(action: ActionUsage): ActionUsage[] {
        const members = ownedElements(action);
        const children: ActionUsage[] = [];
        const edges: [Element, Element][] = [];
        members.forEach((member, index) => {
            if (isAnnotation(member)) {
                return;
            }
            if (isSuccessionAsUsage(member)) {
                const ends = member.ends.map((end) => {
                    const subsetting = (end.target as Feature | undefined)?.heritage.find(
                        isReferenceSubsetting
                    );
                    return subsetting ? referenced(subsetting.targetRef) : undefined;
                });
                const source = ends[0] ?? members.slice(0, index).reverse().find(isActionUsage);
                const target = ends[1] ?? members.slice(index + 1).find(isActionUsage);
                if (isLibraryFeature(target, "done", this.model) || !source || !target) {
                    this.refuse(member, "actionOther");
                }
                edges.push([source, target]);
                return;
            }
            if (isActionUsage(member) && !isAcceptActionUsage(member)) {
                children.push(member);
                return;
            }
            if (isAcceptActionUsage(member)) {
                this.refuse(member, "actionAcceptOrControl");
            }
            this.refuse(member, "actionOther");
        });
        const ordered: ActionUsage[] = [];
        const remaining = [...children];
        while (remaining.length > 0) {
            const next = remaining.find((candidate) => {
                return !edges.some(([source, target]) => {
                    return target === candidate && remaining.includes(source as ActionUsage);
                });
            });
            if (!next) {
                this.refuse(action, "successionCycle");
            }
            ordered.push(next);
            remaining.splice(remaining.indexOf(next), 1);
        }
        return ordered;
    }

    // `temporal` admits mustAlways and eventually here: at the root of a constraint, below its negations only
    private mapExpression(
        parent: OxstsNode,
        feature: string,
        expression: Expression,
        context: ExpressionContext,
        temporal = false,
        subsetted?: string
    ): void {
        // a required constraint subsets its collection, every other expression redefines a library feature
        const node = (type: string): OxstsNode => {
            if (subsetted !== undefined) {
                return new OxstsNode(
                    parent,
                    feature,
                    () => `contains ${feature}: ${type} subsets ${subsetted}`
                );
            }
            return new OxstsNode(parent, feature, () => `redefine contains ${feature}: ${type}`);
        };
        if (
            isFeatureReferenceExpression(expression) &&
            isFeatureMembership(expression.expression)
        ) {
            const inner = expression.expression.target as Expression | undefined;
            if (!inner) {
                this.refuse(expression, "translationFailure");
            }
            return this.mapExpression(parent, feature, inner, context, temporal, subsetted);
        }
        if (isLiteralNumber(expression)) {
            if (
                !Number.isInteger(expression.literal) ||
                /[.eE]/.test(expression.$cstNode?.text ?? "")
            ) {
                this.refuse(expression, "literalReal");
            }
            const literal = node("LiteralIntegerExpression");
            new OxstsNode(
                literal,
                "value",
                () =>
                    `redefine refers value: int = ${expression.$cstNode?.text ?? expression.literal}`
            );
            return;
        }
        if (isLiteralBoolean(expression)) {
            const literal = node("LiteralBooleanExpression");
            new OxstsNode(
                literal,
                "value",
                () => `redefine refers value: bool = ${expression.literal}`
            );
            return;
        }
        if (isLiteralExpression(expression) || expression.$type === "NullExpression") {
            this.refuse(expression, "literalOther");
        }
        if (isFeatureReferenceExpression(expression) || isFeatureChainExpression(expression)) {
            const attribute = this.attributeReference(expression, context);
            const reference = node("AttributeReferenceExpression");
            new OxstsNode(
                reference,
                "attribute",
                () => `redefine refers attribute: Attribute = ${attribute()}`
            );
            return;
        }
        if (isOperatorExpression(expression)) {
            const operator = expression.operator ?? "";
            if (expression.operands.length === 1 && unaryOperators.has(operator)) {
                const operation = node(unaryOperators.get(operator)!);
                this.mapExpression(
                    operation,
                    "operand",
                    expression.operands[0],
                    context,
                    temporal && operator === "not"
                );
                return;
            }
            if (expression.operands.length === 2 && binaryOperators.has(operator)) {
                const operation = node(binaryOperators.get(operator)!);
                this.mapExpression(operation, "left", expression.operands[0], context);
                this.mapExpression(operation, "right", expression.operands[1], context);
                return;
            }
            if (moduloPowerOperators.has(operator)) {
                this.refuse(expression, "operatorModuloPower");
            }
            this.refuse(expression, "operatorOther");
        }
        if (isInvocationExpression(expression)) {
            const invoked = typings(expression)[0];
            const name = isCalculationDefinition(invoked) ? invoked.declaredName : undefined;
            if (name === "mustAlways" || name === "eventually") {
                if (!temporal) {
                    this.refuse(expression, "temporalMixed");
                }
                const body = this.arguments(expression)[0];
                if (!body) {
                    this.refuse(expression, "translationFailure");
                }
                const operation = node(name === "mustAlways" ? "MustAlways" : "Eventually");
                this.mapExpression(operation, "body", body, context);
                return;
            }
            if (name !== "isStateActive") {
                this.refuse(expression, "calculation");
            }
            const argument = this.arguments(expression)[0];
            if (!argument) {
                this.refuse(expression, "translationFailure");
            }
            const state = this.stateReference(argument, context);
            const active = node("IsStateActiveExpression");
            new OxstsNode(
                active,
                "state",
                () => `redefine refers state: AbstractState = ${state()}`
            );
            return;
        }
        this.refuse(expression, "operatorOther");
    }

    private arguments(invocation: Expression): Expression[] {
        return (invocation as InvocationExpression).$meta.arguments().flatMap((argument) => {
            const value = argument.ast() as Expression | undefined;
            return value ? [value] : [];
        });
    }

    // the features a reference names, the first one resolved in the reference's scope
    private referenceChain(expression: Expression): Element[] {
        if (isFeatureReferenceExpression(expression)) {
            const target = referenced(expression.expression.targetRef);
            if (isFeatureMembership(expression.expression)) {
                this.refuse(expression, "translationFailure");
            }
            return target ? [target] : [];
        }
        if (isFeatureChainExpression(expression)) {
            const head = this.referenceChain(expression.operands[0]);
            const tail = expression.children[0];
            if (isOwningMembership(tail)) {
                const feature = tail.target as Feature | undefined;
                return [
                    ...head,
                    ...(feature?.typeRelationships ?? []).flatMap((relationship) => {
                        const target = referenced(relationship.targetRef);
                        return target ? [target] : [];
                    }),
                ];
            }
            const target = isMembership(tail) ? referenced(tail.targetRef) : undefined;
            return target ? [...head, target] : head;
        }
        this.refuse(expression, "referenceNonAttribute");
    }

    private renderChain(chain: Element[], context: ExpressionContext, at: AstNode): () => string {
        if (context.kind === "part") {
            if (chain.length !== 1) {
                this.refuse(
                    at,
                    chain.length > 1 && isAttributeUsage(chain.at(-1))
                        ? "referenceOtherPart"
                        : "referenceNonAttribute"
                );
            }
            const target = this.nodeOf(chain[0], at);
            return () => target().relativeTo(context.node);
        }
        const [head, ...rest] = chain;
        const subject = head ? context.subjects.get(head) : undefined;
        if (!subject) {
            this.refuse(at, "referenceNonAttribute");
        }
        const nodes = rest.map((element) => {
            return this.nodeOf(element, at);
        });
        return () => [subject, ...nodes.map((node) => node())].map((node) => node.name).join(".");
    }

    private attributeReference(expression: Expression, context: ExpressionContext): () => string {
        const chain = this.referenceChain(expression);
        const target = chain.at(-1);
        if (!isAttributeUsage(target)) {
            this.refuse(expression, "referenceNonAttribute");
        }
        if (
            context.kind === "part" &&
            chain.length === 1 &&
            target.$container?.$container !== context.definition
        ) {
            this.refuse(expression, "referenceOtherPart");
        }
        return this.renderChain(chain, context, expression);
    }

    private stateReference(expression: Expression, context: ExpressionContext): () => string {
        const chain = this.referenceChain(expression);
        if (!isStateUsage(chain.at(-1))) {
            this.refuse(expression, "referenceNonAttribute");
        }
        return this.renderChain(chain, context, expression);
    }

    private mapVerificationCase(verification: VerificationCaseDefinition): void {
        this.refuseSpecialization(verification);
        const name = this.className(verification);
        const node = new OxstsNode(
            this.root,
            name,
            () => `@VerificationCase\nclass ${name} : VerificationCaseDefinition`,
            caseMembers,
            true
        );
        this.declare(verification, node);
        let subject: OxstsNode | undefined;
        let subjectElement: Element | undefined;
        let objective: RequirementUsage | undefined;
        for (const membership of verification.children) {
            const member = (membership as Membership).target as Element | undefined;
            if (isImport(membership) || !member || isAnnotation(member)) {
                continue;
            }
            if (isSubjectMembership(membership)) {
                subjectElement = member;
                subject = this.mapSubject(node, member as Feature);
                continue;
            }
            if (isObjectiveMembership(membership)) {
                objective = member as RequirementUsage;
                continue;
            }
            this.refuse(member, "caseMember");
        }
        if (!subject || !subjectElement) {
            this.refuse(verification, "subjectOther");
        }
        if (!objective) {
            this.refuse(verification, "objectiveMissing");
        }
        const subjects = new Map<Element, OxstsNode>([[subjectElement, subject]]);
        const objectiveNode = new OxstsNode(
            node,
            "objective",
            () => "redefine contains objective: Requirement[1]",
            requirementMembers
        );
        const verified = objective.children.filter(isRequirementVerificationMembership);
        const own = this.requiredConstraints(objective, subjects, subject);
        for (const extra of verified.slice(1)) {
            this.report(extra, "verifySecond");
        }
        if (verified.length > 0 && own.length > 0) {
            this.refuse(own[0], "verifyAndRequire");
        }
        if (verified.length === 0) {
            if (own.length === 0) {
                this.refuse(objective, "objectiveMissing");
            }
            this.mapConstraint(objectiveNode, own[0], {
                kind: "verification",
                node: objectiveNode,
                subjects,
            });
            return;
        }
        let requirement = verified[0].target as RequirementUsage;
        const reference = requirement.heritage.find(isReferenceSubsetting);
        if (reference) {
            const target = referenced(reference.targetRef);
            if (!isRequirementUsage(target) || !this.requirements.has(target)) {
                this.refuse(verified[0], "caseMember");
            }
            requirement = target;
        }
        const constraints = this.requiredConstraints(requirement, subjects, subject);
        if (constraints.length === 0) {
            this.refuse(verified[0], "objectiveMissing");
        }
        const requirementName = objectiveNode.scope.claim(requirement.declaredName, "requirement");
        const verifyNode = new OxstsNode(
            objectiveNode,
            requirementName,
            () => `contains ${requirementName}: Constraint subsets verifiedRequirements`,
            requirementMembers
        );
        this.declare(requirement, verifyNode);
        this.mapConstraint(verifyNode, constraints[0], {
            kind: "verification",
            node: verifyNode,
            subjects,
        });
    }

    private mapSubject(parent: OxstsNode, subject: Feature): OxstsNode {
        this.checkUsage(subject);
        const types = typings(subject);
        if (types.length !== 1 || !isPartDefinition(types[0])) {
            this.refuse(subject, "subjectOther");
        }
        const type = this.className(types[0]);
        const name = parent.scope.claim(subject.declaredName, "subject");
        const node = new OxstsNode(
            parent,
            name,
            () => `contains ${name}: ${type}[1] redefines subject`
        );
        this.declare(subject, node, "", type);
        return node;
    }

    // the require constraints of a requirement; its own subject reads the case's subject
    private requiredConstraints(
        requirement: RequirementUsage,
        subjects: Map<Element, OxstsNode>,
        subject: OxstsNode
    ): ConstraintUsage[] {
        const constraints: ConstraintUsage[] = [];
        for (const membership of requirement.children) {
            const member = (membership as Membership).target as Element | undefined;
            if (
                isImport(membership) ||
                !member ||
                isAnnotation(member) ||
                isRequirementVerificationMembership(membership)
            ) {
                continue;
            }
            if (isSubjectMembership(membership)) {
                subjects.set(member, subject);
                continue;
            }
            if (isRequirementConstraintMembership(membership)) {
                if (membership.kind === "assume") {
                    this.refuse(membership, "assume");
                }
                constraints.push(member as ConstraintUsage);
                continue;
            }
            this.refuse(member, "caseMember");
        }
        for (const extra of constraints.slice(1)) {
            this.report(extra, "requireSecond");
        }
        return constraints;
    }

    private mapConstraint(
        parent: OxstsNode,
        constraint: ConstraintUsage,
        context: ExpressionContext
    ): void {
        const expression = constraint.result?.target as Expression | undefined;
        if (!expression) {
            this.refuse(constraint, "translationFailure");
        }
        const hasTemporal = AstUtils.streamAst(expression).some((candidate) => {
            const invoked =
                isInvocationExpression(candidate) && !isOperatorExpression(candidate)
                    ? typings(candidate)[0]
                    : undefined;
            return (
                isCalculationDefinition(invoked) &&
                ["mustAlways", "eventually"].includes(invoked.declaredName ?? "")
            );
        });
        const name = parent.scope.claim(constraint.declaredName, "constraint");
        if (hasTemporal) {
            this.mapExpression(parent, name, expression, context, true, "requiredConstraints");
            this.declare(constraint, parent.children.at(-1)!);
            return;
        }
        const node = new OxstsNode(
            parent,
            name,
            () => `contains ${name}: MustAlways subsets requiredConstraints`
        );
        this.declare(constraint, node);
        this.mapExpression(node, "body", expression, { ...context, node });
    }

    private warnRegionsSharingAttributes(): void {
        for (const parallel of this.parallelStates) {
            const assigned = new Map<Element, StateUsage>();
            for (const region of ownedElements(parallel).filter(isStateUsage)) {
                const seen = new Set<Element>();
                for (const assignment of AstUtils.streamAst(region).filter(
                    isAssignmentActionUsage
                )) {
                    const attribute = assignment.targetMember?.targetRef?.parts.at(-1)?.ref;
                    if (!attribute || seen.has(attribute)) {
                        continue;
                    }
                    seen.add(attribute);
                    const other = assigned.get(attribute);
                    if (other && other !== region) {
                        this.report(assignment, "regionsAssignOne");
                    } else {
                        assigned.set(attribute, region);
                    }
                }
            }
        }
    }
}

function ownedMembers(namespace: Namespace): Element[] {
    return namespace.children.flatMap((membership) => {
        if (isImport(membership)) {
            return [membership];
        }
        if (!isOwningMembership(membership)) {
            return [membership];
        }
        return membership.target ? [membership.target] : [];
    });
}
