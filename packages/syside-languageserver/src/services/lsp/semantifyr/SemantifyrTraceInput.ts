import type { SemantifyrNameMap } from "./SemantifyrNameMap";

export type SemantifyrReportValue =
    | boolean
    | number
    | string
    | null
    | SemantifyrReportValue[]
    | { [field: string]: SemantifyrReportValue };

export interface SemantifyrReportCall {
    self: string;
    transition: string;
    arguments: Record<string, SemantifyrReportValue>;
    calls: SemantifyrReportCall[];
}

interface SemantifyrReportInitialEntry {
    state: number;
    calls: SemantifyrReportCall[];
}

interface SemantifyrReportState {
    values: Record<string, SemantifyrReportValue>;
}

interface SemantifyrReportStep {
    source: number;
    target: number;
    elapsed: number | string;
    calls: SemantifyrReportCall[];
}

export interface SemantifyrReportTrace {
    initial: SemantifyrReportInitialEntry;
    states: SemantifyrReportState[];
    steps: SemantifyrReportStep[];
}

interface SemantifyrReportResult {
    verdict: string;
}

export interface SemantifyrReport {
    verificationCase: string;
    result: SemantifyrReportResult;
    trace?: SemantifyrReportTrace | null;
}

export interface SemantifyrTraceParameters {
    report: unknown;
    nameMap: unknown;
}

export interface SemantifyrTraceInput {
    verificationCase: string;
    verdict: "pass" | "fail";
    trace: SemantifyrReportTrace;
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

const index: Check = (value, location) => {
    if (!Number.isInteger(value) || (value as number) < 0) {
        fail(location, "an index");
    }
};

const fraction: Check = (value, location) => {
    const whole = Number.isInteger(value) && (value as number) >= 0;
    if (!whole && !(typeof value === "string" && /^\d+(\/[1-9]\d*)?$/.test(value))) {
        fail(location, "a fraction");
    }
};

function nullable(check: Check): Check {
    return (value, location) => {
        if (value !== null) {
            check(value, location);
        }
    };
}

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

function array(element: Check): Check {
    return (value, location) => {
        if (!Array.isArray(value)) {
            fail(location, "an array");
        }
        value.forEach((item, position) => {
            element(item, `${location}[${position}]`);
        });
    };
}

const call: Check = (value, location) => {
    object({
        self: string,
        transition: string,
        arguments: object({}),
        calls: array(call),
    })(value, location);
};

const checks: Record<"report" | "nameMap", Check> = {
    report: object(
        {
            verificationCase: string,
            result: object({ verdict: string }),
            trace: nullable(
                object({
                    initial: object({ state: index, calls: array(call) }),
                    states: array(object({ values: object({}) })),
                    steps: array(
                        object({
                            source: index,
                            target: index,
                            elapsed: fraction,
                            calls: array(call),
                        })
                    ),
                })
            ),
        },
        ["trace"]
    ),
    nameMap: object({
        modelHash: string,
        package: string,
        tick: object({ value: string, unit: string }),
        entries: array(object({ sysml: string, oxsts: string, type: string }, ["type"])),
    }),
};

const verdicts: Record<string, "pass" | "fail"> = {
    Passed: "pass",
    Failed: "fail",
};

function checkStates(trace: SemantifyrReportTrace): void {
    const location = "report.json.trace";
    const state = (value: number, at: string): void => {
        if (value >= trace.states.length) {
            throw new SemantifyrTraceError(
                at,
                `state ${value}, where the trace has ${trace.states.length}`
            );
        }
    };
    state(trace.initial.state, `${location}.initial.state`);
    let previous = trace.initial.state;
    trace.steps.forEach((step, position) => {
        state(step.source, `${location}.steps[${position}].source`);
        state(step.target, `${location}.steps[${position}].target`);
        if (step.source !== previous) {
            throw new SemantifyrTraceError(
                `${location}.steps[${position}].source`,
                `state ${step.source}, where the step before it ended in state ${previous}`
            );
        }
        previous = step.target;
    });
}

export function readTraceInput(parameters: SemantifyrTraceParameters): SemantifyrTraceInput {
    checks.report(parameters.report, "report.json");
    checks.nameMap(parameters.nameMap, "names.json");
    const report = parameters.report as SemantifyrReport;
    const verdict = verdicts[report.result.verdict];
    if (verdict === undefined) {
        throw new SemantifyrTraceError(
            "report.json.result.verdict",
            `${report.result.verdict}, where a trace is shown for Passed or Failed`
        );
    }
    const trace = report.trace;
    if (!trace) {
        throw new SemantifyrTraceError("report.json.trace", "the report holds no trace");
    }
    checkStates(trace);
    return {
        verificationCase: report.verificationCase,
        verdict,
        trace,
        nameMap: parameters.nameMap as SemantifyrNameMap,
    };
}
