import { describe, expect, it } from "vitest";
import {
    NameScope,
    partMembers,
    stateMembers,
    transitionMembers,
} from "../semantifyr/SemantifyrOxsts.js";

describe("the names the semantic library reserves", () => {
    it.each([
        { owner: "part", members: partMembers, name: "sendTimeSignals" },
        { owner: "state", members: stateMembers, name: "sendTimeSignals" },
        { owner: "transition", members: transitionMembers, name: "sendTimeSignal" },
    ])("rename a $owner's element named $name", ({ members, name }) => {
        expect(new NameScope(members).claim(name, "element")).toBe(`${name}_1`);
    });
});
