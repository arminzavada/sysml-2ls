import { describe, expect, it } from "vitest";
import { defaultOutput, nameMapPath } from "../semantifyr-util.js";

describe("semantifyr output names", () => {
    it.each([".semantifyr", ".oxsts", ".sem"])(
        "writes the name map beside an output of %s",
        (extension) => {
            expect(nameMapPath(`out/x${extension}`)).toBe("out/x.names.json");
        }
    );

    it("defaults the output to the input name with .semantifyr", () => {
        const output = defaultOutput("models/x.sysml");

        expect(output).toBe("models/x.semantifyr");
        expect(nameMapPath(output)).toBe("models/x.names.json");
    });
});
