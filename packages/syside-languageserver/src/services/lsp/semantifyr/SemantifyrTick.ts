import { AstUtils } from "langium";
import {
    isFeatureReferenceExpression,
    isLiteralNumber,
    isOperatorExpression,
    isTriggerInvocationExpression,
    type Element,
    type Expression,
    type Namespace,
    type TriggerInvocationExpression,
} from "#generated/ast";
import type { SemantifyrTick } from "./SemantifyrNameMap";

const nanosecondsPerSecond = 1_000_000_000n;

const units = [
    {
        name: "day",
        symbol: "d",
        nanoseconds: 86_400n * nanosecondsPerSecond,
    },
    {
        name: "hour",
        symbol: "h",
        nanoseconds: 3_600n * nanosecondsPerSecond,
    },
    {
        name: "minute",
        symbol: "min",
        nanoseconds: 60n * nanosecondsPerSecond,
    },
    {
        name: "second",
        symbol: "s",
        nanoseconds: nanosecondsPerSecond,
    },
];

function unitOf(element: Element | undefined): (typeof units)[number] | undefined {
    const owner = element?.$container?.$container as Element | undefined;
    if (owner?.declaredName !== "SI") {
        return undefined;
    }
    return units.find((unit) => {
        return unit.name === element?.declaredName;
    });
}

function parseDecimal(text: string): bigint | undefined {
    const match = /^(\d+)(?:\.(\d{1,9}))?$/.exec(text.trim());
    if (!match) {
        return undefined;
    }
    const fraction = (match[2] ?? "").padEnd(9, "0");
    return BigInt(match[1]) * nanosecondsPerSecond + BigInt(fraction);
}

export function durationArgument(trigger: TriggerInvocationExpression): Expression | undefined {
    const parameter = trigger.children[0]?.target as { value?: { target?: Element } } | undefined;
    return parameter?.value?.target as Expression | undefined;
}

// the duration of `after d` in nanoseconds, when d is a literal number with a time unit
export function literalDuration(expression: Expression | undefined): bigint | undefined {
    if (!isOperatorExpression(expression) || expression.operator !== "[") {
        return undefined;
    }
    const [amount, unitReference] = expression.operands;
    if (!isLiteralNumber(amount) || !isFeatureReferenceExpression(unitReference)) {
        return undefined;
    }
    const unit = unitOf(unitReference.expression.targetRef?.parts.at(-1)?.ref);
    const value = parseDecimal(amount.$cstNode?.text ?? "");
    if (!unit || value === undefined) {
        return undefined;
    }
    return (value * unit.nanoseconds) / nanosecondsPerSecond;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
    return right === 0n ? left : greatestCommonDivisor(right, left % right);
}

export interface TickNormalization {
    tick: SemantifyrTick;
    nanoseconds: bigint;
}

// the largest duration in seconds, minutes, hours or days dividing every literal `after` duration of the model
export function computeTick(model: Namespace): TickNormalization {
    const durations = AstUtils.streamAst(model)
        .filter(isTriggerInvocationExpression)
        .filter((trigger) => {
            return trigger.kind === "after";
        })
        .map((trigger) => {
            return literalDuration(durationArgument(trigger));
        })
        .nonNullable()
        .filter((duration) => {
            return duration > 0n;
        })
        .toArray();
    const nanoseconds =
        durations.length === 0 ? nanosecondsPerSecond : durations.reduce(greatestCommonDivisor);
    const unit = units.find((candidate) => {
        return nanoseconds % candidate.nanoseconds === 0n;
    });
    if (unit) {
        return {
            tick: { value: (nanoseconds / unit.nanoseconds).toString(), unit: unit.symbol },
            nanoseconds,
        };
    }
    const fraction = (nanoseconds % nanosecondsPerSecond).toString().padStart(9, "0");
    return {
        tick: {
            value: `${nanoseconds / nanosecondsPerSecond}.${fraction.replace(/0+$/, "")}`,
            unit: "s",
        },
        nanoseconds,
    };
}
