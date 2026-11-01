import { ast } from "../../..";
import {
    isExhibitStateUsage,
    isItemDefinition,
    isOwningMembership,
    isPartUsage,
    isPortUsage,
    isStateUsage,
    isSubjectMembership,
    isTransitionUsage,
    isUsage,
} from "#generated/ast";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import { SemantifyrTraceResolver } from "./SemantifyrTraceResolver";

export interface SemantifyrTraceArgument {
    parameter: string;
    value: string;
}

export interface SemantifyrTraceEntry {
    self: string;
    calledTransition: string;
    arguments: SemantifyrTraceArgument[];
    innerTraces: SemantifyrTraceEntry[] | null;
}

export interface SemantifyrTraceStep {
    traces: SemantifyrTraceEntry[];
}

export interface SemantifyrTrace {
    initialStep: SemantifyrTraceStep;
    initializedStep: SemantifyrTraceStep | null;
    steps: SemantifyrTraceStep[];
}

type SysMLNode = string | { text: string; members: SysMLNode[] };

const fire = "semantifyr::sysml::states::Transition::fire";
const setOutgoingItem = "semantifyr::sysml::ports::Port::setOutgoingItem";
const passTime = "semantifyr::sysml::verification::VerificationCaseDefinition::passTime";

const imports = [
    "private import Occurrences::HappensDuring;",
    "private import Occurrences::HappensJustBefore;",
    "private import Occurrences::HappensWhile;",
    "private import SI::s;",
    "private import Time::DurationOf;",
];

// A name the trace declares must not hide a feature it inherits from the model.
class Names {
    private readonly used = new Set<string>();

    constructor(private readonly inherited: ReadonlySet<string>) {}

    unique(base: string): string {
        let index = 1;
        while (this.taken(`${base}${index}`)) {
            index++;
        }
        return this.use(`${base}${index}`);
    }

    fresh(name: string): string {
        return this.taken(name) ? this.unique(`${name}_`) : this.use(name);
    }

    private taken(name: string): boolean {
        return this.used.has(name) || this.inherited.has(name);
    }

    private use(name: string): string {
        this.used.add(name);
        return name;
    }
}

class Body {
    readonly members: SysMLNode[] = [];
    readonly names: Names;

    constructor(
        readonly text: string,
        readonly path: string,
        type?: ast.Type
    ) {
        this.names = new Names(featureNames(type));
    }

    get node(): SysMLNode {
        return { text: this.text, members: this.members };
    }
}

class StateOccurrence extends Body {
    readonly activeChildren: StateOccurrence[] = [];

    constructor(
        readonly state: ast.StateUsage,
        text: string,
        path: string
    ) {
        super(text, path, state);
    }

    activeChild(state: ast.StateUsage): StateOccurrence | undefined {
        return this.activeChildren.find((child) => child.state === state);
    }

    leaves(): StateOccurrence[] {
        if (this.activeChildren.length === 0) {
            return [this];
        }
        return this.activeChildren.flatMap((child) => child.leaves());
    }
}

class PartInstance {
    readonly children: PartInstance[] = [];
    readonly machines: StateOccurrence[] = [];
    readonly names: Names;
    startup?: Body;

    constructor(
        readonly text: string,
        readonly path: string,
        type: ast.Type
    ) {
        this.names = new Names(featureNames(type));
    }

    qualify(name: string): string {
        return this.path === "" ? name : `${this.path}.${name}`;
    }

    members(): SysMLNode[] {
        const sections = [
            this.startup?.node,
            ...this.machines.map((machine) => machine.node),
            ...this.children.map((child) => child.node()),
        ].filter((node) => node !== undefined);
        return sections.flatMap((node, index) => (index === 0 ? [node] : ["", node]));
    }

    node(): SysMLNode | undefined {
        const members = this.members();
        return members.length === 0 ? undefined : { text: this.text, members };
    }

    *preorder(): Generator<PartInstance> {
        yield this;
        for (const child of this.children) {
            yield* child.preorder();
        }
    }
}

interface Firing {
    transition: ast.TransitionUsage;
    part: PartInstance;
    machine: StateOccurrence;
    sends: Sending[];
}

interface Sending {
    port: ast.PortUsage;
    part: PartInstance;
    item: ast.ItemDefinition;
}

interface StepEvents {
    firings: Firing[];
    sends: Sending[];
    advancesTime: boolean;
}

export class SemantifyrTraceGenerator extends SemantifyrBaseMapper {
    private readonly traceResolver: SemantifyrTraceResolver;
    private readonly verificationCase: ast.VerificationCaseDefinition;
    private readonly system: ast.Classifier;
    private readonly parts = new Map<string, PartInstance>();
    private readonly root: PartInstance;
    private readonly timeline: SysMLNode[] = [];
    private readonly timePoints: string[] = [];
    private readonly coincidences: string[] = [];
    private readonly durations: string[] = [];

    constructor(
        services: SemantifyrMapperServices,
        private readonly caseName: string
    ) {
        super(services);

        this.traceResolver = services.traceResolver;
        this.verificationCase = this.traceResolver.resolveVerificationCase(caseName);
        const subject = this.verificationCase.children
            .filter(isSubjectMembership)
            .map((membership) => membership.target)
            .find(isUsage);
        const system = subject && this.featureClassifier(subject);
        if (system === undefined) {
            throw new Error(`Verification case '${caseName}' has no typed subject`);
        }
        this.system = system;
        this.root = this.createPart(system, system, "", "");
    }

    public generate(trace: SemantifyrTrace): string {
        for (const part of this.root.preorder()) {
            for (const machine of part.machines) {
                this.activateRecursive(machine, machine);
            }
        }

        this.react(0, this.collect(trace.initializedStep?.traces ?? []));
        trace.steps.forEach((step, index) => this.react(index + 1, this.collect(step.traces)));

        const successions = this.timePoints
            .slice(1)
            .map(
                (point, index) =>
                    `succession : HappensJustBefore first ${this.timePoints[index]} then ${point};`
            );
        const sections: SysMLNode[][] = [
            this.root.members(),
            this.timeline,
            [
                `connection : HappensWhile connect ${this.timePoints[0]} to self.startShot;`,
                ...successions,
            ],
            this.coincidences,
            this.durations,
        ];
        const members = sections
            .filter((section) => section.length > 0)
            .flatMap((section, index) => (index === 0 ? section : ["", ...section]));
        const header = `part def ${this.caseName}Trace :> ${this.system.$meta.qualifiedName}`;

        const lines = [...imports, ""];
        printNodes([{ text: header, members }], "", lines);
        return lines.join("\n") + "\n";
    }

    private createPart(
        feature: ast.Type,
        type: ast.Classifier,
        text: string,
        path: string
    ): PartInstance {
        const part = new PartInstance(text, path, feature);
        this.parts.set(path, part);
        for (const element of ownedElements(type)) {
            if (isExhibitStateUsage(element)) {
                const name = this.stableName(element);
                part.machines.push(
                    new StateOccurrence(
                        element,
                        `exhibit state ${name} :>> ${name}`,
                        part.qualify(name)
                    )
                );
            } else if (isPartUsage(element)) {
                const classifier = this.featureClassifier(element);
                if (classifier !== undefined) {
                    const name = this.stableName(element);
                    part.children.push(
                        this.createPart(
                            element,
                            classifier,
                            `part ${name} :>> ${name}`,
                            part.qualify(name)
                        )
                    );
                }
            }
        }
        return part;
    }

    private collect(entries: SemantifyrTraceEntry[]): StepEvents {
        const events: StepEvents = { firings: [], sends: [], advancesTime: false };
        this.collectInto(entries, undefined, events);
        return events;
    }

    // A send belongs to its nearest enclosing firing, whatever traced calls nest between them.
    private collectInto(
        entries: SemantifyrTraceEntry[],
        enclosing: Firing | undefined,
        events: StepEvents
    ): void {
        for (const entry of entries) {
            const chain = this.traceResolver.resolveInstance(this.verificationCase, entry.self);
            const element = chain[chain.length - 1];
            let innerEnclosing = enclosing;
            if (entry.calledTransition === fire && isTransitionUsage(element)) {
                const part = this.partOf(chain);
                innerEnclosing = {
                    transition: element,
                    part,
                    machine: machineOf(part, chain),
                    sends: [],
                };
                events.firings.push(innerEnclosing);
            } else if (entry.calledTransition === setOutgoingItem && isPortUsage(element)) {
                const sending = { port: element, part: this.partOf(chain), item: this.item(entry) };
                (enclosing?.sends ?? events.sends).push(sending);
            } else if (entry.calledTransition === passTime && element === this.verificationCase) {
                events.advancesTime = true;
            } else {
                throw new Error(
                    `Unexpected traced call '${entry.calledTransition}' on '${entry.self}', a ${element.$type}`
                );
            }
            this.collectInto(entry.innerTraces ?? [], innerEnclosing, events);
        }
    }

    private item(entry: SemantifyrTraceEntry): ast.ItemDefinition {
        const value = entry.arguments.find((argument) => argument.parameter === "item")?.value;
        const item =
            value === undefined ? undefined : this.traceResolver.resolveQualifiedName(value);
        if (!isItemDefinition(item)) {
            throw new Error(`The trace of '${entry.self}' carries no item`);
        }
        return item;
    }

    private partOf(chain: ast.Element[]): PartInstance {
        const names: string[] = [];
        for (const element of chain.slice(2)) {
            if (!isPartUsage(element)) {
                break;
            }
            names.push(this.stableName(element));
        }
        const part = this.parts.get(names.join("."));
        if (part === undefined) {
            throw new Error(`No part instance at '${names.join(".")}'`);
        }
        return part;
    }

    private react(step: number, events: StepEvents): void {
        const snapshot = this.root.names.fresh(`step${step}`);
        if (step === 0 || events.firings.length > 0) {
            this.timeline.push(`snapshot ${snapshot};`);
            this.timePoints.push(snapshot);
        }

        const startups: Body[] = [];
        for (const sending of events.sends) {
            if (step !== 0) {
                throw new Error(`A send in step ${step} has no enclosing transition`);
            }
            const part = sending.part;
            if (part.startup === undefined) {
                const name = part.names.fresh("startup");
                part.startup = new Body(`action ${name}`, part.qualify(name));
                startups.push(part.startup);
            }
            this.addSend(part.startup, sending, part);
        }
        for (const startup of startups) {
            this.coincidences.push(
                `connection : HappensWhile connect ${snapshot} to ${startup.path};`
            );
        }

        for (const firing of events.firings) {
            const occurrence = this.fire(firing);
            for (const sending of firing.sends) {
                this.addSend(occurrence, sending, firing.part);
            }
            this.coincidences.push(
                `connection : HappensWhile connect ${snapshot} to ${occurrence.path};`
            );
        }

        if (events.advancesTime) {
            const dwell = this.root.names.fresh(`dwell${step}`);
            this.timeline.push({
                text: `timeslice ${dwell}`,
                members: [`assert constraint { DurationOf(${dwell}) == 1 [s] }`],
            });
            this.timePoints.push(dwell);
            for (const part of this.root.preorder()) {
                for (const leaf of part.machines.flatMap((machine) => machine.leaves())) {
                    this.durations.push(
                        `connection : HappensDuring connect ${dwell} to ${leaf.path};`
                    );
                }
            }
        }
    }

    private addSend(body: Body, sending: Sending, from: PartInstance): void {
        const name = body.names.unique(`send${this.stableName(sending.item)}`);
        const item = sending.item.$meta.qualifiedName;
        body.members.push(
            `action ${name} send new ${item}() via ${this.portReference(sending, from)};`
        );
    }

    private portReference(sending: Sending, from: PartInstance): string {
        const port = this.stableName(sending.port);
        if (sending.part === from) {
            return port;
        }
        if (from.path !== "" && sending.part.path.startsWith(`${from.path}.`)) {
            return `${sending.part.path.slice(from.path.length + 1)}.${port}`;
        }
        return sending.part.qualify(port);
    }

    private fire(firing: Firing): Body {
        const machine = firing.machine;
        const transition = firing.transition;
        const source = asState(transition.$meta.sourceFeature()?.ast());
        const target = targetState(transition);
        const owner = asState(transition.$meta.owner()?.ast());

        this.ensureActive(machine, source);
        const ownerOccurrence = this.ensureActive(machine, owner);

        const name = ownerOccurrence.names.unique(
            transition.declaredName !== undefined
                ? lowerFirst(transition.declaredName)
                : `to${this.stableName(target)}`
        );
        const occurrence = new Body(
            `action ${name} :> ${transition.declaredName ?? "stateTransitions"}`,
            `${ownerOccurrence.path}.${name}`,
            transition
        );
        ownerOccurrence.members.push(occurrence.node);

        this.exit(machine, ownerOccurrence, source);
        this.enter(machine, ownerOccurrence, target);
        return occurrence;
    }

    private statePath(machine: StateOccurrence, state: ast.StateUsage): ast.StateUsage[] {
        const path: ast.StateUsage[] = [];
        let current: ast.Element | undefined = state;
        while (isStateUsage(current)) {
            path.unshift(current);
            if (current === machine.state) {
                return path;
            }
            current = current.$meta.owner()?.ast();
        }
        throw new Error(`State '${state.$meta.qualifiedName}' is not in '${machine.path}'`);
    }

    private ensureActive(machine: StateOccurrence, state: ast.StateUsage): StateOccurrence {
        let occurrence = machine;
        for (const element of this.statePath(machine, state).slice(1)) {
            occurrence = this.activate(occurrence, element);
        }
        return occurrence;
    }

    // A sequential state has one active substate, so activating another one ends the current one.
    private activate(parent: StateOccurrence, state: ast.StateUsage): StateOccurrence {
        const active = parent.activeChild(state);
        if (active !== undefined) {
            return active;
        }
        if (!parent.state.isParallel) {
            parent.activeChildren.length = 0;
        }
        const stateName = this.stableName(state);
        const name = parent.names.unique(lowerFirst(stateName));
        const occurrence = new StateOccurrence(
            state,
            `state ${name} :> ${stateName}`,
            `${parent.path}.${name}`
        );
        parent.members.push(occurrence.node);
        parent.activeChildren.push(occurrence);
        return occurrence;
    }

    private activateRecursive(machine: StateOccurrence, occurrence: StateOccurrence): void {
        const state = occurrence.state;
        if (state.isParallel) {
            for (const region of ownedElements(state).filter(isStateUsage)) {
                this.activateRecursive(machine, this.activate(occurrence, region));
            }
            return;
        }
        const initials = ownedElements(state)
            .filter(isTransitionUsage)
            .filter((transition) => !isStateOf(machine, transition.$meta.sourceFeature()?.ast()));
        // The trace does not record which of several initial transitions was taken.
        if (initials.length === 1) {
            this.enter(machine, occurrence, targetState(initials[0]));
        }
    }

    private exit(machine: StateOccurrence, owner: StateOccurrence, source: ast.StateUsage): void {
        const path = this.statePath(machine, source);
        const ownerIndex = path.indexOf(owner.state);
        const from = ownerIndex >= 0 ? owner : machine;
        const top = path[ownerIndex >= 0 ? ownerIndex + 1 : 1];
        const exited = top === undefined ? undefined : from.activeChild(top);
        if (exited !== undefined) {
            from.activeChildren.splice(from.activeChildren.indexOf(exited), 1);
        }
    }

    private enter(machine: StateOccurrence, owner: StateOccurrence, target: ast.StateUsage): void {
        const path = this.statePath(machine, target);
        const ownerIndex = path.indexOf(owner.state);
        let occurrence = ownerIndex >= 0 ? owner : machine;
        for (const state of path.slice(ownerIndex >= 0 ? ownerIndex + 1 : 1)) {
            occurrence = this.activate(occurrence, state);
        }
        this.activateRecursive(machine, occurrence);
    }
}

function featureNames(type: ast.Type | undefined): Set<string> {
    return new Set(
        type?.$meta
            .allFeatures()
            .flatMap((membership) => [membership.name, membership.shortName])
            .nonNullable()
    );
}

function machineOf(part: PartInstance, chain: ast.Element[]): StateOccurrence {
    const machine = part.machines.find((candidate) => chain.includes(candidate.state));
    if (machine === undefined) {
        throw new Error(
            `'${chain.at(-1)?.$meta.qualifiedName}' is in no state that part '${part.path}' exhibits`
        );
    }
    return machine;
}

function ownedElements(namespace: ast.Namespace): ast.Element[] {
    return namespace.children
        .filter(isOwningMembership)
        .flatMap((membership) => membership.target ?? []);
}

function asState(element: ast.Element | undefined): ast.StateUsage {
    if (!isStateUsage(element)) {
        throw new Error(`Expected a state, found ${element?.$type ?? "nothing"}`);
    }
    return element;
}

function targetState(transition: ast.TransitionUsage): ast.StateUsage {
    return asState(transition.$meta.then?.element()?.relatedFeatures()[1]?.ast());
}

function isStateOf(machine: StateOccurrence, element: ast.Element | undefined): boolean {
    let current = element;
    while (isStateUsage(current)) {
        if (current === machine.state) {
            return true;
        }
        current = current.$meta.owner()?.ast();
    }
    return false;
}

function lowerFirst(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
}

function printNodes(nodes: SysMLNode[], indent: string, lines: string[]): void {
    for (const node of nodes) {
        if (typeof node === "string") {
            lines.push(node === "" ? "" : `${indent}${node}`);
        } else if (node.members.length === 0) {
            lines.push(`${indent}${node.text};`);
        } else {
            lines.push(`${indent}${node.text} {`);
            printNodes(node.members, `${indent}    `, lines);
            lines.push(`${indent}}`);
        }
    }
}
