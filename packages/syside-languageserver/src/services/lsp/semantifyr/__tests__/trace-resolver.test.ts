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

function members(store: StableElementNameProvider, ...names: string[]): ast.Element | undefined {
    let scope: ast.Element | undefined = undefined;
    for (const name of names) {
        scope = store.member(scope, name);
    }
    return scope;
}

describe("StableElementNameProvider scopes", () => {
    it("records each name in the scope the mapper declared it in", async () => {
        const store = (await mapped()).elementNameProvider;
        const behaviour = ["semantifyr::sysml::model", "Controller", "Behaviour"];

        expect(members(store, ...behaviour, "Normal", "Yellow")?.$meta.qualifiedName).toBe(
            "Controller::Behaviour::Normal::Yellow"
        );
        expect(members(store, ...behaviour, "Blinking", "Yellow")?.$meta.qualifiedName).toBe(
            "Controller::Behaviour::Blinking::Yellow"
        );
        expect(members(store, ...behaviour, "Yellow")).toBeUndefined();
        const transition = members(store, ...behaviour, "Blinking", "UnnamedTransitionUsage2");
        expect(isTransitionUsage(transition) && store.stableName(transition)).toBe(
            "UnnamedTransitionUsage2"
        );
    });

    it("resolves the members of a typed feature in its type", async () => {
        const store = (await mapped()).elementNameProvider;

        expect(
            members(store, "semantifyr::sysml::model", "Crossing", "left", "lamp")?.$meta
                .qualifiedName
        ).toBe("Controller::lamp");
    });

    it("knows no element by a name it never declared", () => {
        expect(new StableElementNameProvider().member(undefined, "semantifyr::sysml::model")).toBe(
            undefined
        );
    });
});

describe("SemantifyrTraceResolver", () => {
    it("resolves the verification case by name", async () => {
        const services = await mapped();
        const verificationCase = services.traceResolver.resolveVerificationCase("Case");
        expect(isVerificationCaseDefinition(verificationCase)).toBe(true);
        expect(() => services.traceResolver.resolveVerificationCase("Missing")).toThrow(
            /No verification case is named 'Missing'/
        );
        expect(() => services.traceResolver.resolveVerificationCase("Controller")).toThrow(
            /No verification case is named 'Controller'/
        );
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

    it("resolves a traced item argument by the qualified name the mapper emitted", async () => {
        const resolver = (await mapped()).traceResolver;
        const item = resolver.resolveQualifiedName("semantifyr::sysml::model::global_Light");

        expect(isItemDefinition(item) && item.declaredName).toBe("Light");
        expect(resolver.resolveQualifiedName("semantifyr::sysml::other::global_Light")).toBe(
            undefined
        );
        expect(resolver.resolveQualifiedName("semantifyr::sysml::model::global_Lamp")).toBe(
            undefined
        );
        expect(resolver.resolveQualifiedName("global_Light")).toBe(undefined);
    });
});
