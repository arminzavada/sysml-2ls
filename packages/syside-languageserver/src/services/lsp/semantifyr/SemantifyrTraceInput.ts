import type { SemantifyrNameMap } from "./SemantifyrNameMap";

export interface SemantifyrTraceArgument {
    parameter: string;
    value: string;
}

export interface SemantifyrTraceEntry {
    self: string;
    calledTransition: string;
    arguments: SemantifyrTraceArgument[];
    innerTraces?: SemantifyrTraceEntry[] | null;
}

export interface SemantifyrTraceStep {
    traces: SemantifyrTraceEntry[];
}

export interface SemantifyrTrace {
    initializedStep: SemantifyrTraceStep;
    steps: SemantifyrTraceStep[];
}

export interface SemantifyrWitnessValue {
    variable: string;
    value: string;
}

export interface SemantifyrWitnessStep {
    values: SemantifyrWitnessValue[];
}

export interface SemantifyrWitness {
    initializedStep: SemantifyrWitnessStep;
    steps: SemantifyrWitnessStep[];
}

export interface SemantifyrTraceInput {
    caseName: string;
    witness: SemantifyrWitness;
    trace: SemantifyrTrace;
    nameMap: SemantifyrNameMap;
}

export class SemantifyrTraceError extends Error {
    constructor(
        readonly location: string,
        message: string
    ) {
        super(`${location}: ${message}`);
    }
}

type Check = (value: unknown, location: string) => void;

function fail(location: string, expected: string): never {
    throw new SemantifyrTraceError(location, `expected ${expected}`);
}

const string: Check = (value, location) => {
    if (typeof value !== "string") {
        fail(location, "a string");
    }
};

function object(fields: Record<string, Check>, optional: readonly string[] = []): Check {
    return (value, location) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            fail(location, "an object");
        }
        for (const [field, check] of Object.entries(fields)) {
            const member = (value as Record<string, unknown>)[field];
            if (member === undefined && optional.includes(field)) {
                continue;
            }
            check(member, `${location}.${field}`);
        }
    };
}

function array(element: Check, nullable = false): Check {
    return (value, location) => {
        if (nullable && value === null) {
            return;
        }
        if (!Array.isArray(value)) {
            fail(location, nullable ? "an array or null" : "an array");
        }
        value.forEach((item, index) => {
            element(item, `${location}[${index}]`);
        });
    };
}

const entry: Check = (value, location) => {
    object({
        self: string,
        calledTransition: string,
        arguments: array(object({ parameter: string, value: string })),
        innerTraces: array(entry, true),
    }, ["innerTraces"])(value, location);
};

const traceStep = object({ traces: array(entry) });
const witnessStep = object({ values: array(object({ variable: string, value: string })) });

const checks: Record<"trace" | "witness" | "nameMap", Check> = {
    trace: object({ initializedStep: traceStep, steps: array(traceStep) }),
    witness: object({ initializedStep: witnessStep, steps: array(witnessStep) }),
    nameMap: object({
        modelHash: string,
        package: string,
        tick: object({ value: string, unit: string }),
        entries: array(object({ sysml: string, oxsts: string, type: string }, ["type"])),
    }),
};

export function checkTraceInput(input: {
    witness: unknown;
    trace: unknown;
    nameMap: unknown;
}): asserts input is {
    witness: SemantifyrWitness;
    trace: SemantifyrTrace;
    nameMap: SemantifyrNameMap;
} {
    checks.witness(input.witness, "witness.json");
    checks.trace(input.trace, "trace.json");
    checks.nameMap(input.nameMap, "names.json");
    const witness = input.witness as SemantifyrWitness;
    const trace = input.trace as SemantifyrTrace;
    if (witness.steps.length !== trace.steps.length) {
        throw new SemantifyrTraceError(
            "trace.json.steps",
            `${trace.steps.length} steps, where witness.json has ${witness.steps.length}`
        );
    }
}
