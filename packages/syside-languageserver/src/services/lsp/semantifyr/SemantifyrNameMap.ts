export interface SemantifyrTick {
    value: string;
    unit: string;
}

export interface SemantifyrNameEntry {
    sysml: string;
    oxsts: string;
    type?: string;
}

export interface SemantifyrNameMap {
    modelHash: string;
    package: string;
    tick: SemantifyrTick;
    entries: SemantifyrNameEntry[];
}

const offset = 0xcbf29ce484222325n;
const prime = 0x100000001b3n;
const mask = 0xffffffffffffffffn;

export function hashModelText(text: string): string {
    let hash = offset;
    for (const byte of new TextEncoder().encode(text)) {
        hash = ((hash ^ BigInt(byte)) * prime) & mask;
    }
    return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}
