import type { SemantifyrNameMap } from "./SemantifyrNameMap";

const reportVersion = 2;

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
    root: string;
    initial: SemantifyrReportInitialEntry;
    states: SemantifyrReportState[];
    steps: SemantifyrReportStep[];
    missingCalls?: string | null;
}

interface SemantifyrReportResult {
    verdict: string;
}

export interface SemantifyrReport {
    version: number;
    result: SemantifyrReportResult;
    trace?: SemantifyrReportTrace | null;
}

export interface SemantifyrTraceParameters {
    caseName: string;
    report: unknown;
    nameMap: unknown;
}

export interface SemantifyrTraceInput {
    caseName: string;
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
            version: index,
            result: object({ verdict: string }),
            trace: nullable(
                object(
                    {
                        root: string,
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
                        missingCalls: nullable(string),
                    },
                    ["missingCalls"]
                )
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
    if (report.version !== reportVersion) {
        throw new SemantifyrTraceError(
            "report.json.version",
            `version ${report.version}, where the trace is read from version ${reportVersion}`
        );
    }
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
    if (typeof trace.missingCalls === "string") {
        throw new SemantifyrTraceError(
            "report.json.trace.missingCalls",
            `the report holds no calls, which the SysML trace is built from: ${trace.missingCalls}`
        );
    }
    checkStates(trace);
    return {
        caseName: parameters.caseName,
        verdict,
        trace,
        nameMap: parameters.nameMap as SemantifyrNameMap,
    };
}
