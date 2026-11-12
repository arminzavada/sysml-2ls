import { AstUtils, type AstNode } from "langium";
import {
    isActionUsage,
    isCalculationDefinition,
    isFeatureTyping,
    isInvocationExpression,
    isOperatorExpression,
    isPartUsage,
    isSendActionUsage,
    isStateSubactionMembership,
    isStateUsage,
    isTransitionFeatureMembership,
    isTransitionUsage,
    isVerificationCaseDefinition,
    type ActionUsage,
    type Element,
    type Namespace,
    type SendActionUsage,
    type StateUsage,
    type TransitionUsage,
    type Type,
} from "#generated/ast";
import { resolveElementPath } from "./SemantifyrElementPath";
import { hashModelText, type SemantifyrNameEntry } from "./SemantifyrNameMap";
import {
    SemantifyrTraceError,
    type SemantifyrTraceEntry,
    type SemantifyrTraceInput,
} from "./SemantifyrTraceInput";

const sites = {
    fire: "semantifyr::sysml::states::Transition::fire",
    enter: [
        "semantifyr::sysml::states::State::enter",
        "semantifyr::sysml::states::ParallelState::enter",
    ],
    exit: [
        "semantifyr::sysml::states::State::exit",
        "semantifyr::sysml::states::ParallelState::exit",
    ],
    send: "semantifyr::sysml::actions::SendItemAction::send",
    passTime: "semantifyr::sysml::verification::VerificationCaseDefinition::passTime",
};

interface TextNode {
    text: string;
    members: (TextNode | string)[];
    open?: boolean;
}

type Line = TextNode | string;

class Names {
    private readonly used = new Set<string>();

    constructor(private readonly inherited: ReadonlySet<string> = new Set()) {}

    indexed(base: string): string {
        let index = 1;
        while (this.taken(`${base}${index}`)) {
            index++;
        }
        return this.use(`${base}${index}`);
    }

    fresh(name: string): string {
        return this.taken(name) ? this.indexed(`${name}_`) : this.use(name);
    }

    private taken(name: string): boolean {
        return this.used.has(name) || this.inherited.has(name);
    }

    private use(name: string): string {
        this.used.add(name);
        return name;
    }
}

function featureNames(type: Element | undefined): Set<string> {
    if (!type) {
        return new Set();
    }
    return new Set(
        (type as Type).$meta
            .allFeatures()
            .flatMap((membership) => {
                return [membership.name, membership.shortName];
            })
            .nonNullable()
    );
}

function typeOf(element: Element): Element | undefined {
    return (element as Type).heritage?.find(isFeatureTyping)?.targetRef?.parts.at(-1)?.ref;
}

function lowerFirst(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
}

function upperFirst(name: string): string {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function text(node: AstNode | undefined): string {
    return node?.$cstNode?.text.replace(/\s+/g, " ").trim() ?? "";
}

interface PartInstance {
    path: string;
    element: Element;
    index?: number;
    children: PartInstance[];
    machine?: StateInstance;
    name?: string;
}

interface StateInstance {
    path: string;
    element: Element;
    parallel: boolean;
    parent?: StateInstance;
    children: StateInstance[];
    part: PartInstance;
    spans: Span[];
}

interface Span {
    state: StateInstance;
    start: number;
    end?: number;
    name: string;
    names: Names;
    occurrences: Span[];
    entrySends: SendRun[];
    exitSends: SendRun[];
    firings: Firing[];
}

interface Firing {
    step: number;
    transition: TransitionUsage;
    owner: Span;
    source: Span;
    target?: Span;
    sends: SendRun[];
    name: string;
}

interface SendRun {
    send: SendActionUsage;
    actions: ActionUsage[];
}

interface StepChanges {
    entered: Set<StateInstance>;
    exited: Set<StateInstance>;
}

interface Located {
    entry: SemantifyrTraceEntry;
    location: string;
}

export class SemantifyrTraceGenerator {
    private readonly byOxsts = new Map<string, SemantifyrNameEntry>();
    private readonly states = new Map<string, StateInstance>();
    private readonly verificationCase: Element;
    private readonly caseClass: string;
    private readonly subject: PartInstance;
    private readonly stepCount: number;
    private readonly witnessSteps: Map<string, string>[];
    private readonly calls: Located[][];
    private readonly doneSteps = new Map<StateInstance, number>();

    constructor(
        private readonly model: Namespace,
        private readonly input: SemantifyrTraceInput
    ) {
        const modelHash = hashModelText(AstUtils.getDocument(model).textDocument.getText());
        if (modelHash !== input.nameMap.modelHash) {
            throw new SemantifyrTraceError(
                "names.json.modelHash",
                `${input.nameMap.modelHash} does not match the model's ${modelHash}, the model changed after it was translated`
            );
        }
        for (const entry of input.nameMap.entries) {
            this.byOxsts.set(entry.oxsts, entry);
        }
        const caseEntry = input.nameMap.entries.find((entry) => {
            const element = resolveElementPath(model, entry.sysml);
            return isVerificationCaseDefinition(element) && element.declaredName === input.caseName;
        });
        if (!caseEntry) {
            throw new SemantifyrTraceError(
                "names.json.entries",
                `no verification case is named '${input.caseName}'`
            );
        }
        this.verificationCase = this.element(caseEntry);
        this.caseClass = caseEntry.oxsts;
        const subjectEntry = input.nameMap.entries.find((entry) => {
            return entry.oxsts.startsWith(`${this.caseClass}.`) && entry.type !== undefined;
        });
        if (!subjectEntry) {
            throw new SemantifyrTraceError(
                "names.json.entries",
                `the case '${input.caseName}' has no subject`
            );
        }
        this.subject = this.buildPart(
            `root.${subjectEntry.oxsts.slice(this.caseClass.length + 1)}`,
            subjectEntry
        );
        this.stepCount = input.witness.steps.length;
        this.witnessSteps = [input.witness.initializedStep, ...input.witness.steps].map((step) => {
            return new Map(
                step.values.map((value) => {
                    return [value.variable, value.value];
                })
            );
        });
        this.calls = [input.trace.initializedStep, ...input.trace.steps].map((step, index) => {
            const location =
                index === 0
                    ? "trace.json.initializedStep.traces"
                    : `trace.json.steps[${index - 1}].traces`;
            return flatten(step.traces, location);
        });
    }

    private element(entry: SemantifyrNameEntry, location = "names.json.entries"): Element {
        const element = resolveElementPath(this.model, entry.sysml.replace(/\[\d+\]$/, ""));
        if (!element) {
            throw new SemantifyrTraceError(
                location,
                `'${entry.sysml}' names no element of the model`
            );
        }
        return element;
    }

    // the entries one segment below an OXSTS path, each once
    private members(scope: string): SemantifyrNameEntry[] {
        const seen = new Set<string>();
        return this.input.nameMap.entries.filter((entry) => {
            const rest = entry.oxsts.slice(scope.length + 1);
            if (
                !entry.oxsts.startsWith(`${scope}.`) ||
                rest.includes(".") ||
                seen.has(entry.oxsts)
            ) {
                return false;
            }
            seen.add(entry.oxsts);
            return true;
        });
    }

    private buildPart(path: string, entry: SemantifyrNameEntry): PartInstance {
        const index = /\[(\d+)\]$/.exec(entry.sysml)?.[1];
        const part: PartInstance = {
            path,
            element: this.element(entry),
            index: index === undefined ? undefined : Number(index),
            children: [],
        };
        const type = entry.type!;
        for (const member of this.members(type)) {
            const element = this.element(member);
            const memberPath = `${path}.${member.oxsts.slice(type.length + 1)}`;
            if (isPartUsage(element) && member.type !== undefined) {
                part.children.push(this.buildPart(memberPath, member));
            } else if (isStateUsage(element) && !part.machine) {
                const definition = member.type !== undefined ? typeOf(element) : undefined;
                part.machine = this.buildState(
                    memberPath,
                    member.type ?? member.oxsts,
                    element,
                    part,
                    undefined,
                    definition
                );
            }
        }
        return part;
    }

    private buildState(
        path: string,
        scope: string,
        element: Element,
        part: PartInstance,
        parent?: StateInstance,
        definition?: Element
    ): StateInstance {
        const state: StateInstance = {
            path,
            element,
            parallel: Boolean(((definition ?? element) as StateUsage).isParallel),
            parent,
            children: [],
            part,
            spans: [],
        };
        this.states.set(path, state);
        for (const member of this.members(scope)) {
            const child = this.element(member);
            if (isStateUsage(child)) {
                const name = member.oxsts.slice(scope.length + 1);
                state.children.push(
                    this.buildState(`${path}.${name}`, member.oxsts, child, part, state)
                );
            }
        }
        return state;
    }

    // the element an instance path names, read through the name map, with the instance path of every prefix
    private resolveInstance(
        path: string,
        location: string
    ): { element: Element; prefixes: string[] } {
        const [head, ...segments] = path.split(".");
        if (head !== "root") {
            throw new SemantifyrTraceError(location, `'${path}' does not start at 'root'`);
        }
        let scopes = [this.caseClass];
        let element: Element = this.verificationCase;
        const prefixes = ["root"];
        for (const segment of segments) {
            const entry = scopes
                .map((scope) => {
                    return this.byOxsts.get(`${scope}.${segment}`);
                })
                .find((candidate) => {
                    return candidate !== undefined;
                });
            if (!entry) {
                throw new SemantifyrTraceError(
                    location,
                    `'${segment}' of '${path}' is in no entry of the name map`
                );
            }
            element = this.element(entry, location);
            scopes = entry.type === undefined ? [entry.oxsts] : [entry.oxsts, entry.type];
            prefixes.push(`${prefixes.at(-1)}.${segment}`);
        }
        return { element, prefixes };
    }

    private stateAt(path: string | undefined, location: string): StateInstance {
        const state = path === undefined ? undefined : this.states.get(path);
        if (!state) {
            throw new SemantifyrTraceError(location, `'${path}' is no state of the subject`);
        }
        return state;
    }

    private descendants(state: StateInstance): StateInstance[] {
        return [
            state,
            ...state.children.flatMap((child) => {
                return this.descendants(child);
            }),
        ];
    }

    // the states below `common` on the way down to `state`, outermost first
    private below(state: StateInstance, common: StateInstance | undefined): StateInstance[] {
        const chain: StateInstance[] = [];
        let current: StateInstance | undefined = state;
        while (current && current !== common) {
            chain.unshift(current);
            current = current.parent;
        }
        return chain;
    }

    private common({ entry, location }: Located): StateInstance | undefined {
        const value = entry.arguments.find((argument) => {
            return argument.parameter === "commonState";
        })?.value;
        if (value === undefined) {
            throw new SemantifyrTraceError(
                `${location}.arguments`,
                "the call carries no commonState"
            );
        }
        return this.states.get(value);
    }

    private changes(step: number): StepChanges {
        const changes: StepChanges = { entered: new Set(), exited: new Set() };
        for (const call of this.calls[step]) {
            if (sites.enter.includes(call.entry.calledTransition)) {
                const target = this.stateAt(call.entry.self, `${call.location}.self`);
                for (const state of this.below(target, this.common(call))) {
                    changes.entered.add(state);
                    if (state.parallel) {
                        for (const region of state.children) {
                            changes.entered.add(region);
                        }
                    }
                }
            } else if (sites.exit.includes(call.entry.calledTransition)) {
                const source = this.stateAt(call.entry.self, `${call.location}.self`);
                const top = this.below(source, this.common(call))[0] ?? source;
                for (const state of this.descendants(top)) {
                    changes.exited.add(state);
                }
            }
        }
        return changes;
    }

    // the witness's flags, and where the optimizer removed one, the traced entries and exits since initialization
    private activity(changes: StepChanges[]): Map<StateInstance, boolean[]> {
        const reconstructed = new Map<StateInstance, StateInstance | undefined>();
        const activity = new Map<StateInstance, boolean[]>();
        const all = [...this.states.values()];
        for (let step = 0; step <= this.stepCount; step++) {
            for (const state of changes[step].exited) {
                if (state.parent && reconstructed.get(state.parent) === state) {
                    reconstructed.set(state.parent, undefined);
                }
            }
            for (const state of changes[step].entered) {
                if (state.parent && !state.parent.parallel) {
                    reconstructed.set(state.parent, state);
                }
            }
            const values = this.witnessSteps[step];
            const isActive = (state: StateInstance): boolean => {
                if (!state.parent) {
                    const performing = values.get(`${state.path}.performing`);
                    if (performing !== undefined) {
                        return performing === "true";
                    }
                    const done = this.doneSteps.get(state);
                    return done === undefined || step < done;
                }
                if (!isActive(state.parent)) {
                    return false;
                }
                if (state.parent.parallel) {
                    return true;
                }
                const active = values.get(`${state.parent.path}.activeState`);
                return active === undefined
                    ? reconstructed.get(state.parent) === state
                    : active === state.path;
            };
            for (const state of all) {
                if (!activity.has(state)) {
                    activity.set(state, []);
                }
                activity.get(state)!.push(isActive(state));
            }
        }
        return activity;
    }

    private targetOf(transition: TransitionUsage): Element | undefined {
        const succession = transition.then?.target as { ends?: { target?: Type }[] } | undefined;
        const end = succession?.ends?.[1]?.target;
        return end?.heritage[0]?.targetRef?.parts.at(-1)?.ref;
    }

    private instanceOf(
        element: Element | undefined,
        part: PartInstance
    ): StateInstance | undefined {
        return [...this.states.values()].find((state) => {
            return state.part === part && state.element === element;
        });
    }

    generate(): string {
        for (let step = 1; step <= this.stepCount; step++) {
            for (const call of this.calls[step]) {
                if (call.entry.calledTransition !== sites.fire) {
                    continue;
                }
                const transition = this.resolveInstance(
                    call.entry.self,
                    `${call.location}.self`
                ).element;
                const owner = this.states.get(
                    call.entry.self.slice(0, call.entry.self.lastIndexOf("."))
                );
                const target = isTransitionUsage(transition)
                    ? this.targetOf(transition)
                    : undefined;
                if (
                    owner &&
                    !owner.parent &&
                    target?.declaredName === "done" &&
                    !this.doneSteps.has(owner)
                ) {
                    this.doneSteps.set(owner, step);
                }
            }
        }
        const changes: StepChanges[] = [];
        for (let step = 0; step <= this.stepCount; step++) {
            changes.push(this.changes(step));
        }
        const activity = this.activity(changes);
        for (const state of this.states.values()) {
            let current: Span | undefined;
            activity.get(state)!.forEach((active, step) => {
                const reentered =
                    step > 0 && changes[step].entered.has(state) && changes[step].exited.has(state);
                if (current && (!active || reentered)) {
                    current.end = step;
                    current = undefined;
                }
                if (active && !current) {
                    current = {
                        state,
                        start: step,
                        name: "",
                        names: new Names(featureNames(state.element)),
                        occurrences: [],
                        entrySends: [],
                        exitSends: [],
                        firings: [],
                    };
                    state.spans.push(current);
                }
            });
        }
        for (const part of preorder(this.subject)) {
            const span = part.machine?.spans[0];
            if (span) {
                span.name = part.machine!.element.declaredName ?? "state";
                this.nest(span);
            }
        }
        const firings = new Map<number, Firing[]>();
        const passed = new Set<number>();
        for (let step = 0; step <= this.stepCount; step++) {
            const firingsOfStep: Firing[] = [];
            firings.set(step, firingsOfStep);
            for (const call of this.calls[step]) {
                if (call.entry.calledTransition === sites.fire) {
                    firingsOfStep.push(this.firing(step, call));
                } else if (call.entry.calledTransition === sites.passTime) {
                    passed.add(step);
                }
            }
            for (const call of this.calls[step]) {
                if (call.entry.calledTransition === sites.send) {
                    this.placeSend(step, call, firingsOfStep);
                }
            }
        }
        return this.render(firings, passed);
    }

    private spanAt(
        state: StateInstance | undefined,
        step: number,
        which: "start" | "end" | "during"
    ): Span | undefined {
        return state?.spans.find((span) => {
            if (which === "start") {
                return span.start === step;
            }
            if (which === "end") {
                return span.end === step;
            }
            return span.start <= step && (span.end === undefined || span.end > step);
        });
    }

    // the occurrences inside an occurrence, named in time order
    private nest(span: Span): void {
        const state = span.state;
        for (const child of state.children) {
            for (const childSpan of child.spans) {
                const inside =
                    childSpan.start >= span.start &&
                    (span.end === undefined ||
                        childSpan.start < span.end ||
                        (childSpan.start === span.start && childSpan.end === span.end));
                if (!inside) {
                    continue;
                }
                span.occurrences.push(childSpan);
            }
        }
        span.occurrences.sort((left, right) => {
            return left.start - right.start;
        });
        for (const occurrence of span.occurrences) {
            const declared = occurrence.state.element.declaredName ?? "state";
            occurrence.name = state.parallel ? declared : span.names.indexed(lowerFirst(declared));
            this.nest(occurrence);
        }
    }

    private firing(step: number, { entry, location }: Located): Firing {
        const transition = this.resolveInstance(entry.self, `${location}.self`).element;
        if (!isTransitionUsage(transition)) {
            throw new SemantifyrTraceError(`${location}.self`, `'${entry.self}' is no transition`);
        }
        const ownerState = this.stateAt(
            entry.self.slice(0, entry.self.lastIndexOf(".")),
            `${location}.self`
        );
        const sourceElement = transition.source?.targetRef?.parts.at(-1)?.ref;
        const source = this.spanAt(this.instanceOf(sourceElement, ownerState.part), step, "end");
        const targetElement = this.targetOf(transition);
        const isDone = targetElement?.declaredName === "done" && !isStateUsage(targetElement);
        const target = isDone
            ? undefined
            : this.spanAt(this.instanceOf(targetElement, ownerState.part), step, "start");
        if (!source || (!target && !isDone)) {
            throw new SemantifyrTraceError(
                `${location}.self`,
                `the witness does not leave the source and enter the target of '${entry.self}' in this step`
            );
        }
        const owner =
            this.spanAt(ownerState, step - 1, "during") ?? this.spanAt(ownerState, step, "during");
        if (!owner) {
            throw new SemantifyrTraceError(
                `${location}.self`,
                `the state declaring '${entry.self}' is not active in the witness`
            );
        }
        const sourceName = source.state.element.declaredName ?? "state";
        const name = owner.names.indexed(
            transition.declaredName !== undefined
                ? lowerFirst(transition.declaredName)
                : `${lowerFirst(sourceName)}To${upperFirst(target?.state.element.declaredName ?? "done")}`
        );
        const firing: Firing = { step, transition, owner, source, target, sends: [], name };
        owner.firings.push(firing);
        return firing;
    }

    // a send belongs to the entry, exit or effect its action is part of, read from the send action's path
    private placeSend(step: number, { entry, location }: Located, firings: Firing[]): void {
        const { element, prefixes } = this.resolveInstance(entry.self, `${location}.self`);
        if (!isSendActionUsage(element)) {
            throw new SemantifyrTraceError(`${location}.self`, `'${entry.self}' is no send action`);
        }
        const actions: ActionUsage[] = [];
        let current: AstNode | undefined = element.$container;
        while (
            current &&
            !isStateSubactionMembership(current) &&
            !isTransitionFeatureMembership(current)
        ) {
            if (isActionUsage(current)) {
                actions.unshift(current);
            }
            current = current.$container;
        }
        const run: SendRun = { send: element, actions };
        if (isTransitionFeatureMembership(current)) {
            const transition = current.$container;
            const firing = firings.find((candidate) => {
                return (
                    candidate.transition === transition &&
                    prefixes.some((prefix) => prefix === candidate.owner.state.path)
                );
            });
            if (!firing) {
                throw new SemantifyrTraceError(
                    `${location}.self`,
                    `'${entry.self}' ran in the effect of a transition that did not fire`
                );
            }
            firing.sends.push(run);
            return;
        }
        if (isStateSubactionMembership(current)) {
            const state = [...prefixes]
                .reverse()
                .map((prefix) => {
                    return this.states.get(prefix);
                })
                .find((candidate) => {
                    return candidate !== undefined;
                });
            const kind = current.kind;
            const span = this.spanAt(state, step, kind === "entry" ? "start" : "end");
            if (!span) {
                throw new SemantifyrTraceError(
                    `${location}.self`,
                    `'${entry.self}' ran in the ${kind} action of a state the witness does not ${kind === "entry" ? "enter" : "leave"} in this step`
                );
            }
            (kind === "entry" ? span.entrySends : span.exitSends).push(run);
            return;
        }
        throw new SemantifyrTraceError(
            `${location}.self`,
            `'${entry.self}' ran outside an entry, exit or effect`
        );
    }

    // a witness reaches what eventually asks for and breaks what mustAlways asks for, each negation flipping it
    private verdict(): string {
        const temporal = AstUtils.streamAst(this.verificationCase)
            .filter(isInvocationExpression)
            .find((invocation) => {
                const invoked = typeOf(invocation);
                return (
                    isCalculationDefinition(invoked) &&
                    ["mustAlways", "eventually"].includes(invoked.declaredName ?? "")
                );
            });
        let passes = temporal !== undefined && typeOf(temporal)?.declaredName === "eventually";
        for (let current = temporal?.$container; current; current = current.$container) {
            if (isOperatorExpression(current) && current.operator === "not") {
                passes = !passes;
            }
        }
        return passes ? "pass" : "fail";
    }

    private render(firings: Map<number, Firing[]>, passed: Set<number>): string {
        const tick = this.input.nameMap.tick;
        const system = typeOf(this.subject.element);
        const runNames = new Names(featureNames(system));
        const slices: { name: string; step: number; kind: "init" | "step" | "dwell" }[] = [
            { name: runNames.fresh("init"), step: 0, kind: "init" },
        ];
        for (let step = 1; step <= this.stepCount; step++) {
            if ((firings.get(step) ?? []).length > 0) {
                slices.push({ name: runNames.fresh(`step${step}`), step, kind: "step" });
            }
            if (passed.has(step)) {
                slices.push({ name: runNames.fresh(`dwell${step}`), step, kind: "dwell" });
            }
        }
        const dwells = new Map(
            slices
                .filter((slice) => {
                    return slice.kind === "dwell";
                })
                .map((slice) => {
                    return [slice.step, slice.name];
                })
        );
        this.nameParts(this.subject, runNames);
        const timeline: Line[] = [];
        slices.forEach((slice, index) => {
            if (index > 0) {
                timeline.push(
                    `succession : HappensJustBefore [1] first ${slices[index - 1].name} then ${slice.name};`
                );
            }
            const duration = slice.kind === "dwell" ? tick.value : "0";
            const members: Line[] = [
                `assert constraint { DurationOf(${slice.name}) == ${duration} [${tick.unit}] }`,
            ];
            if (slice.kind === "init") {
                for (const part of preorder(this.subject)) {
                    const span = part.machine?.spans.find((candidate) => candidate.start === 0);
                    if (span) {
                        members.push(`event ${this.partPath(part)}${span.name}.start [1];`);
                    }
                }
            }
            for (const firing of slice.kind === "step" ? (firings.get(slice.step) ?? []) : []) {
                members.push(`event ${this.firingPath(firing)} [1];`);
            }
            timeline.push({ text: `timeslice ${slice.name} [1]`, members });
        });
        const structure = this.renderPart(this.subject, dwells);
        const run: TextNode = {
            text: `part def Run :> ${system?.$meta.qualifiedName ?? ""}`,
            members: [
                `bind ${slices[0].name}.startShot = self.startShot;`,
                "",
                ...timeline,
                ...structure.flatMap((node) => {
                    return ["", node];
                }),
            ],
        };
        const caseName = this.verificationCase.declaredName!;
        const witness: TextNode = {
            text: `verification witness : ${this.verificationCase.$meta.qualifiedName}`,
            members: [
                `subject :>> ${this.subject.element.declaredName ?? "subject"} : Run;`,
                `return :>> verdict = VerdictKind::${this.verdict()};`,
            ],
        };
        const lines: string[] = [];
        printLines(
            [
                {
                    text: `package ${caseName}Trace`,
                    members: [
                        "private import Occurrences::HappensJustBefore;",
                        "private import Time::DurationOf;",
                        `private import SI::${tick.unit};`,
                        "private import VerificationCases::VerdictKind;",
                        "",
                        witness,
                        "",
                        run,
                    ],
                },
            ],
            "",
            lines
        );
        return lines.join("\n") + "\n";
    }

    private nameParts(part: PartInstance, names: Names): void {
        for (const child of part.children) {
            const declared = child.element.declaredName ?? "part";
            child.name =
                child.index === undefined
                    ? declared
                    : names.fresh(`${lowerFirst(declared)}${child.index}`);
            this.nameParts(child, new Names(featureNames(typeOf(child.element))));
        }
    }

    // the path of a part in Run, with a trailing dot unless the part is the subject
    private partPath(part: PartInstance): string {
        const names: string[] = [];
        let current: PartInstance | undefined = part;
        while (current && current !== this.subject) {
            names.unshift(`${current.name}.`);
            const child: PartInstance = current;
            current = [...preorder(this.subject)].find((candidate) => {
                return candidate.children.includes(child);
            });
        }
        return names.join("");
    }

    private spanPath(span: Span): string {
        const names: string[] = [];
        let current: Span | undefined = span;
        while (current) {
            names.unshift(current.name);
            const child: Span = current;
            current = [...this.states.values()]
                .flatMap((state) => state.spans)
                .find((candidate) => candidate.occurrences.includes(child));
        }
        return `${this.partPath(span.state.part)}${names.join(".")}`;
    }

    private firingPath(firing: Firing): string {
        return `${this.spanPath(firing.owner)}.${firing.name}`;
    }

    // an occurrence named from inside `from`: relative when it lies inside it, from Run otherwise
    private occurrenceReference(span: Span, from: Span): string {
        const target = this.spanPath(span);
        const prefix = `${this.spanPath(from)}.`;
        return target.startsWith(prefix) ? target.slice(prefix.length) : target;
    }

    private hasOccurrences(part: PartInstance): boolean {
        return (
            (part.machine?.spans.length ?? 0) > 0 ||
            part.children.some((child) => {
                return this.hasOccurrences(child);
            })
        );
    }

    private renderPart(part: PartInstance, dwells: Map<number, string>): Line[] {
        const lines: Line[] = [];
        const span = part.machine?.spans[0];
        if (span) {
            const keyword =
                part.machine!.element.$type === "ExhibitStateUsage" ? "exhibit state" : "state";
            lines.push({
                text: `${keyword} ${span.name} :>> ${span.name} [1]`,
                members: this.spanMembers(span, dwells),
            });
        }
        for (const child of part.children) {
            if (!this.hasOccurrences(child)) {
                continue;
            }
            const declared = child.element.declaredName ?? "part";
            const header =
                child.index === undefined
                    ? `part ${child.name} :>> ${child.name}`
                    : `part ${child.name} [1] :> ${declared}`;
            lines.push({ text: header, members: this.renderPart(child, dwells) });
        }
        return lines;
    }

    private spanMembers(span: Span, dwells: Map<number, string>): Line[] {
        const lines: Line[] = [...this.stateActions(span)];
        const ordered: { step: number; rank: number; line: () => Line }[] = [];
        for (const occurrence of span.occurrences) {
            const declared = occurrence.state.element.declaredName ?? "state";
            const header = span.state.parallel
                ? `state ${occurrence.name} :>> ${declared} [1]`
                : `state ${occurrence.name} [1] :> ${declared}`;
            ordered.push({
                step: occurrence.start,
                rank: 1,
                line: () => {
                    return { text: header, members: this.spanMembers(occurrence, dwells) };
                },
            });
        }
        for (const firing of span.firings) {
            ordered.push({
                step: firing.step,
                rank: 0,
                line: () => {
                    return this.renderFiring(firing);
                },
            });
        }
        ordered.sort((left, right) => {
            return left.step - right.step || left.rank - right.rank;
        });
        lines.push(
            ...ordered.map((item) => {
                return item.line();
            })
        );
        if (span.state.children.length === 0) {
            const covered = [...dwells.entries()].filter(([step]) => {
                return step >= span.start && (span.end === undefined || step < span.end);
            });
            if (covered.length > 0) {
                lines.push(`event occurrence firstDwell [1] ::> ${covered[0][1]};`);
                lines.push(`event occurrence lastDwell [1] ::> ${covered.at(-1)![1]};`);
            }
        }
        return lines;
    }

    private renderFiring(firing: Firing): TextNode {
        const transition = firing.transition;
        const header =
            transition.declaredName !== undefined
                ? `transition ${firing.name} [1] :> ${transition.declaredName}`
                : `transition ${firing.name} [1]`;
        const members: Line[] = [`first ${this.occurrenceReference(firing.source, firing.owner)}`];
        if (transition.accepter) {
            members.push(text(transition.accepter));
        }
        if (transition.guard) {
            members.push(text(transition.guard));
        }
        if (firing.sends.length > 0) {
            members.push({ text: "do action", members: this.renderSends(firing.sends, 1) });
        }
        members.push(
            `then ${firing.target ? this.occurrenceReference(firing.target, firing.owner) : "done"};`
        );
        return { text: header, members, open: true };
    }

    private stateActions(span: Span): Line[] {
        const lines: Line[] = [];
        for (const [keyword, sends] of [
            ["entry", span.entrySends],
            ["exit", span.exitSends],
        ] as const) {
            if (sends.length === 0) {
                continue;
            }
            if (sends.length === 1 && sends[0].actions.length === 0) {
                lines.push(
                    `${keyword} action send${this.itemName(sends[0].send)}1 ${this.sendText(sends[0].send)};`
                );
            } else {
                lines.push({ text: `${keyword} action`, members: this.renderSends(sends, 1) });
            }
        }
        return lines;
    }

    // the sends nested as the composite actions that ran them, below the entry, exit or effect action
    private renderSends(sends: SendRun[], depth: number): Line[] {
        const names = new Names();
        const order: (SendRun | ActionUsage)[] = [];
        const groups = new Map<ActionUsage, SendRun[]>();
        for (const run of sends) {
            const action = run.actions[depth];
            if (action === undefined) {
                order.push(run);
                continue;
            }
            if (!groups.has(action)) {
                groups.set(action, []);
                order.push(action);
            }
            groups.get(action)!.push(run);
        }
        return order.map((item) => {
            if ("send" in item) {
                return `action ${names.indexed(`send${this.itemName(item.send)}`)} [1] ${this.sendText(item.send)};`;
            }
            const name = names.indexed(lowerFirst(item.declaredName ?? "action"));
            return {
                text: `action ${name} [1]`,
                members: this.renderSends(groups.get(item)!, depth + 1),
            };
        });
    }

    private itemName(send: SendActionUsage): string {
        const value = (send.payload?.target as { value?: { target?: Element } } | undefined)?.value
            ?.target;
        return (value ? typeOf(value) : undefined)?.declaredName ?? "Item";
    }

    private sendText(send: SendActionUsage): string {
        return `send new ${this.itemName(send)}() via ${text(send.sender)}`;
    }
}

function flatten(entries: SemantifyrTraceEntry[], location: string): Located[] {
    return entries.flatMap((entry, index) => {
        const here = `${location}[${index}]`;
        return [
            { entry, location: here },
            ...flatten(entry.innerTraces ?? [], `${here}.innerTraces`),
        ];
    });
}

function* preorder(part: PartInstance): Generator<PartInstance> {
    yield part;
    for (const child of part.children) {
        yield* preorder(child);
    }
}

function printLines(lines: Line[], indent: string, output: string[]): void {
    for (const line of lines) {
        if (typeof line === "string") {
            output.push(line === "" ? "" : `${indent}${line}`);
            continue;
        }
        if (line.open) {
            output.push(`${indent}${line.text}`);
            printLines(line.members, `${indent}    `, output);
            continue;
        }
        if (line.members.length === 0) {
            output.push(`${indent}${line.text};`);
            continue;
        }
        output.push(`${indent}${line.text} {`);
        printLines(line.members, `${indent}    `, output);
        output.push(`${indent}}`);
    }
}
