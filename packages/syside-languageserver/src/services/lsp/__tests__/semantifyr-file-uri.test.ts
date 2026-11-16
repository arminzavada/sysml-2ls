import { describe, expect, it } from "vitest";
import { semantifyrFileUri } from "../semantifyr/SemantifyrMapper";

describe("semantifyrFileUri", () => {
    it("replaces the extension of the document", () => {
        expect(semantifyrFileUri("file:///models/x.sysml")).toBe("file:///models/x.semantifyr");
    });

    it("leaves a .sysml elsewhere in the address alone", () => {
        expect(semantifyrFileUri("file:///a.sysml/models/x.sysml")).toBe(
            "file:///a.sysml/models/x.semantifyr"
        );
    });
});
