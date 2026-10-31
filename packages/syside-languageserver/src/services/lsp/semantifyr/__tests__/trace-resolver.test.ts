import { describe, expect, it } from "vitest";
import { parseSysML } from "../../../../testing/utils.js";
import {
    createSemantifyrMapperServices,
    SemantifyrMapperServices,
} from "../SemantifyrMapperModule.js";
import { StableElementNameProvider } from "../StableNameStore.js";
import { ast } from "../../../../index.js";
import {
    isItemDefinition,
    isPartUsage,
    isPortUsage,
    isStateUsage,
    isTransitionUsage,
    isUsage,
    isVerificationCaseDefinition,
} from "#generated/ast.js";

const model = `
item def Toggle;
item def Light;
port def Control { in item toggle: Toggle; }
port def Lamp { out item light: Light; }

part def Controller {
    port control: ~Control;
    port lamp: Lamp;
    exhibit state Behaviour {
        state Normal {
            state Yellow;
            transition first Yellow accept Toggle via control do send new Light() via lamp then Red;
            state Red;
        }
        transition first Normal accept Toggle via control then Blinking;
        state Blinking {
            state Yellow;
            transition first Yellow accept Toggle via control then Off;
            state Off;
        }
    }
}

part def Crossing {
    part left: Controller;
    part right: Controller;
}

verification def Case {
    subject system: Crossing;
}
`;

async function mapped(): Promise<SemantifyrMapperServices> {
    const result = await parseSysML(model);
    expect(result.parserErrors).toHaveLength(0);
    const services = createSemantifyrMapperServices();
    services.rootNamespaceMapper.mapRootNamespace(result.value as ast.Namespace);
    return services;
}

function qualifiedNames(elements: ast.Element[]): string[] {
    return elements.map((element) => element.$meta.qualifiedName);
}

describe("StableElementNameProvider inverse", () => {
    it("returns every element a name was given to", async () => {
        const services = await mapped();
        const store = services.elementNameProvider;

        expect(qualifiedNames(store.elementsNamed("Yellow"))).toEqual([
            "Controller::Behaviour::Normal::Yellow",
            "Controller::Behaviour::Blinking::Yellow",
        ]);
        const transitions = store.elementsNamed("UnnamedTransitionUsage1");
        expect(transitions).toHaveLength(1);
        expect(isTransitionUsage(transitions[0])).toBe(true);
        expect(store.stableName(transitions[0])).toBe("UnnamedTransitionUsage1");
    });

    it("knows no element by a name it never gave", () => {
        expect(new StableElementNameProvider().elementsNamed("Yellow")).toEqual([]);
    });
});

describe("SemantifyrTraceResolver", () => {
    it("resolves the verification case by name", async () => {
        const services = await mapped();
        const verificationCase = services.traceResolver.resolveVerificationCase("Case");
        expect(isVerificationCaseDefinition(verificationCase)).toBe(true);
        expect(() => services.traceResolver.resolveVerificationCase("Missing")).toThrow(/found 0/);
    });

    it("resolves an instance path to the containment chain", async () => {
        const services = await mapped();
        const resolver = services.traceResolver;
        const verificationCase = resolver.resolveVerificationCase("Case");

        const chain = resolver.resolveInstance(
            verificationCase,
            "root.system.right.Behaviour.Normal.UnnamedTransitionUsage0"
        );

        expect(chain).toHaveLength(6);
        expect(chain[0]).toBe(verificationCase);
        expect(isUsage(chain[1]) && chain[1].declaredName).toBe("system");
        expect(isPartUsage(chain[2]) && chain[2].declaredName).toBe("right");
        expect(qualifiedNames(chain.slice(3, 5))).toEqual([
            "Controller::Behaviour",
            "Controller::Behaviour::Normal",
        ]);
        const transition = chain[5];
        expect(isTransitionUsage(transition)).toBe(true);
        expect(transition.$meta.owner()?.ast()).toBe(chain[4]);
    });

    it("tells same-named states apart by their owner", async () => {
        const services = await mapped();
        const resolver = services.traceResolver;
        const verificationCase = resolver.resolveVerificationCase("Case");

        const normal = resolver.resolveInstance(
            verificationCase,
            "root.system.left.Behaviour.Normal.Yellow"
        );
        const blinking = resolver.resolveInstance(
            verificationCase,
            "root.system.left.Behaviour.Blinking.Yellow"
        );

        expect(isStateUsage(normal[5])).toBe(true);
        expect(normal[5].$meta.qualifiedName).toBe("Controller::Behaviour::Normal::Yellow");
        expect(blinking[5].$meta.qualifiedName).toBe("Controller::Behaviour::Blinking::Yellow");
    });

    it("resolves ports and the root itself", async () => {
        const services = await mapped();
        const resolver = services.traceResolver;
        const verificationCase = resolver.resolveVerificationCase("Case");

        const port = resolver.resolveInstance(verificationCase, "root.system.left.lamp");
        expect(isPortUsage(port[3]) && port[3].$meta.qualifiedName).toBe("Controller::lamp");
        expect(resolver.resolveInstance(verificationCase, "root")).toEqual([verificationCase]);
    });

    it("rejects paths it cannot resolve", async () => {
        const services = await mapped();
        const resolver = services.traceResolver;
        const verificationCase = resolver.resolveVerificationCase("Case");

        expect(() => resolver.resolveInstance(verificationCase, "system.left")).toThrow(
            /does not start at 'root'/
        );
        expect(() => resolver.resolveInstance(verificationCase, "root.system.third")).toThrow(
            /Cannot resolve 'third'/
        );
        expect(() => resolver.resolveInstance(verificationCase, "root.system.Yellow")).toThrow(
            /Cannot resolve 'Yellow'/
        );
        expect(() => resolver.resolveInstance(verificationCase, "root.system.left[1]")).toThrow(
            /not supported/
        );
    });

    it("resolves a traced item argument through the global item name", async () => {
        const services = await mapped();
        const item = services.traceResolver.resolveItem("semantifyr::sysml::model::global_Light");

        expect(isItemDefinition(item) && item.declaredName).toBe("Light");
        expect(services.traceResolver.resolveItem("semantifyr::sysml::model::Light")).toBe(
            undefined
        );
    });
});
