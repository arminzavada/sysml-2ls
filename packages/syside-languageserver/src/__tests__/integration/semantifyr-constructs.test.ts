import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { mapSysMLNamespaceToSemantifyr } from "../../services/lsp/semantifyr/SemantifyrMapper.js";
import { DiagnosticSeverity, type Diagnostic } from "vscode-languageserver";
import {
    SemantifyrConstructs,
    type SemantifyrConstructId,
    type SemantifyrErrorId,
} from "../../services/lsp/semantifyr/SemantifyrConstructs.js";
import type { Namespace } from "#generated/ast.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const header = `
private import ScalarValues::Integer;
private import ScalarValues::Boolean;
private import SI::*;

item def Signal;
port def Feed {
    in item signal : Signal;
}
`;

// a part with a port, an attribute and a state, its body and its state's body filled in
const machine = (body: string, behaviour = ""): string => `
${header}
part def Machine {
    port input : Feed;
    attribute count : Integer := 0;
    ${body}
    exhibit state Behaviour {
        entry; then Idle;
        state Idle;
        ${behaviour}
    }
}
`;

// a state Waiting with the given body, entered from Idle, beside a state Busy
const waiting = (body: string): string => {
    return machine("", `state Waiting { ${body} } state Busy; transition first Idle then Waiting;`);
};

const checked = (constraint: string, model = machine("")): string => `
${model}
verification def Check {
    subject machine : Machine;
    objective {
        verify requirement {
            require constraint { ${constraint} }
        }
    }
}
`;

interface ConstructCase {
    construct: SemantifyrConstructId;
    model: string;
    // the text a diagnostic is located on, for a construct that draws a warning or is refused
    located?: string;
    // a line the OXSTS holds, for a construct that translates
    emits?: string;
}

interface ErrorCase {
    error: SemantifyrErrorId;
    model: string;
    located: string;
}

const errorCases: ErrorCase[] = [
    {
        error: "assignmentToBound",
        model: machine(
            "attribute limit : Integer = 3;",
            "transition first Idle do assign limit := 4 then Idle;"
        ),
        located: "assign limit := 4",
    },
    {
        error: "initialGuardClosed",
        model: `${header}\npart def Machine { exhibit state Behaviour { transition first start if false then Idle; state Idle; } }`,
        located: "false",
    },
    {
        error: "successionCycle",
        model: machine(
            "",
            "state Busy { entry action steps { action one assign count := 1; action two assign count := 2; first one then two; first two then one; } }"
        ),
        located:
            "action steps { action one assign count := 1; action two assign count := 2; first one then two; first two then one; }",
    },
];

const cases: ConstructCase[] = [
    {
        construct: "package",
        model: "package Wrapped;",
        located: "package Wrapped;",
    },
    {
        construct: "import",
        model: machine(""),
        emits: "class Machine : Part",
    },
    {
        construct: "alias",
        model: `${header}\nalias Other for Signal;`,
        located: "alias Other for Signal;",
    },
    {
        construct: "annotation",
        model: machine("doc /* a machine */"),
        emits: "class Machine : Part",
    },
    {
        construct: "builtinCalculation",
        model: `${machine("")}\ncalc def eventually { in x : Boolean; return : Boolean; }`,
        emits: "class Machine : Part",
    },
    {
        construct: "calculation",
        model: `${machine("")}\ncalc def twice { in x : Integer; return : Integer; }`,
        located: "calc def twice { in x : Integer; return : Integer; }",
    },
    {
        construct: "topLevelUsage",
        model: `${machine("")}\npart machine : Machine;`,
        located: "part machine : Machine;",
    },
    {
        construct: "topLevelDefinition",
        model: `${machine("")}\naction def Work;`,
        located: "action def Work;",
    },
    {
        construct: "enumerationDefinition",
        model: `${machine("")}\nenum def Colour { enum red; enum green; }`,
        located: "enum def Colour { enum red; enum green; }",
    },
    {
        construct: "partDefinition",
        model: machine(""),
        emits: "class Machine : Part",
    },
    {
        construct: "definitionSpecialization",
        model: `${machine("")}\npart def Special :> Machine;`,
        located: "Machine",
    },
    {
        construct: "partUsage",
        model: `${machine("")}\npart def Plant { part machine : Machine; }`,
        emits: "contains machine: Machine subsets parts",
    },
    {
        construct: "partUsageUntyped",
        model: `${machine("")}\npart def Plant { part machine; }`,
        located: "part machine;",
    },
    {
        construct: "multipleTypings",
        model: `${machine("")}\npart def Other;\npart def Plant { part machine : Machine, Other; }`,
        located: "part machine : Machine, Other;",
    },
    {
        construct: "usageSpecialization",
        model: `${machine("")}\npart def Plant { part machine : Machine; part other :> machine; }`,
        located: "part other :> machine;",
    },
    {
        construct: "usageBody",
        model: `${machine("")}\npart def Plant { part machine : Machine { attribute extra : Integer; } }`,
        located: "attribute extra : Integer;",
    },
    {
        construct: "multiplicityZero",
        model: `${machine("")}\npart def Plant { part machine : Machine[0]; }`,
        emits: "class Plant : Part",
    },
    {
        construct: "multiplicityLiteral",
        model: `${machine("")}\npart def Plant { part machines : Machine[2]; }`,
        emits: "contains machines_2: Machine subsets machines",
    },
    {
        construct: "multiplicityAttribute",
        model: machine("attribute counts : Integer[3];"),
        located: "[3]",
    },
    {
        construct: "multiplicityOptional",
        model: `${machine("")}\npart def Plant { part machine : Machine[0..1]; }`,
        located: "[0..1]",
    },
    {
        construct: "multiplicityOther",
        model: `${machine("")}\npart def Plant { part machines : Machine[1..*]; }`,
        located: "[1..*]",
    },
    {
        construct: "multipleReference",
        model: `${machine("")}\npart def Plant { part machines : Machine[2]; port feed : ~Feed; bind feed = machines.input; }`,
        located: "bind feed = machines.input;",
    },
    {
        construct: "partAction",
        model: machine("action work;"),
        located: "action work;",
    },
    {
        construct: "partMember",
        model: machine("assert constraint { count >= 0 }"),
        located: "assert constraint { count >= 0 }",
    },
    {
        construct: "connection",
        model: `${machine("")}\npart def Plant { part a : Machine; part b : Machine; connect a.input to b.input; }`,
        located: "connect a.input to b.input;",
    },
    {
        construct: "portDefinition",
        model: machine(""),
        emits: "class ConjugatedFeed : ConjugatedPort",
    },
    {
        construct: "portItem",
        model: `${machine("")}\nport def Duplex { in item request : Signal; out item reply : Signal; }`,
        emits: "class Duplex : NormalPort",
    },
    {
        construct: "portItemType",
        model: machine(""),
        emits: "class Feed : NormalPort",
    },
    {
        construct: "portMember",
        model: `${machine("")}\nport def Other { attribute rate : Integer; }`,
        located: "attribute rate : Integer;",
    },
    {
        construct: "portUsage",
        model: machine(""),
        emits: "contains input: Feed subsets ports",
    },
    {
        construct: "portConjugation",
        model: machine("port output : ~Feed;"),
        emits: "contains output: ConjugatedFeed subsets ports",
    },
    {
        construct: "portUsageUntyped",
        model: machine("port loose;"),
        located: "port loose;",
    },
    {
        construct: "itemDefinition",
        model: machine(""),
        emits: "global containment global_Signal: Signal[1]",
    },
    {
        construct: "itemMember",
        model: `${machine("")}\nitem def Payload { attribute value : Integer; }`,
        located: "attribute value : Integer;",
    },
    {
        construct: "itemSpecialization",
        model: `${machine("")}\nitem def Special :> Signal;`,
        located: "Signal",
    },
    {
        construct: "flow",
        model: `${machine("port output : ~Feed;")}\npart def Plant { part a : Machine; part b : Machine; flow from a.output to b.input; }`,
        emits: "redefine refers source: Port = a.output",
    },
    {
        construct: "flowItemType",
        model: `${machine("port output : ~Feed;")}\npart def Plant { part a : Machine; part b : Machine; flow of Signal from a.output to b.input; }`,
        emits: "redefine refers target: Port = b.input",
    },
    {
        construct: "flowEnd",
        model: `${machine("port output : ~Feed;")}\npart def Plant { port feed : Feed; part b : Machine; flow from feed to b.input; }`,
        located: "feed",
    },
    {
        construct: "binding",
        model: `${machine("")}\npart def Plant { port feed : Feed; part machine : Machine; bind feed = machine.input; }`,
        emits: "refers feed: Feed subsets ports = machine.input",
    },
    {
        construct: "bindingOther",
        model: `${machine("")}\npart def Plant { port feed : Feed; part machine : Machine; bind machine.input = feed; }`,
        located: "bind machine.input = feed;",
    },
    {
        construct: "attribute",
        model: machine("attribute ready : Boolean := true;"),
        emits: "contains ready: BooleanAttribute subsets attributes",
    },
    {
        construct: "attributeRealOrEnumeration",
        model: machine("attribute ratio : ScalarValues::Real;"),
        located: "attribute ratio : ScalarValues::Real;",
    },
    {
        construct: "attributeType",
        model: machine("attribute label : ScalarValues::String;"),
        located: "attribute label : ScalarValues::String;",
    },
    {
        construct: "attributeBinding",
        model: machine("attribute doubled : Integer = count * 2;"),
        emits: "contains doubled: DerivedAttribute subsets attributes",
    },
    {
        construct: "attributeInitial",
        model: machine("attribute start : Integer default := -1;"),
        emits: "redefine contains initialValue: UnaryMinusExpression",
    },
    {
        construct: "attributeDefault",
        model: machine("attribute limit : Integer default 3;"),
        emits: "contains limit: DerivedAttribute subsets attributes",
    },
    {
        construct: "attributeUnvalued",
        model: machine("attribute free : Integer;"),
        emits: "contains free: IntegerAttribute subsets attributes",
    },
    {
        construct: "attributeOutsidePart",
        model: machine("", "state Busy { attribute local : Integer; }"),
        located: "attribute local : Integer;",
    },
    {
        construct: "exhibitState",
        model: machine(""),
        emits: "contains Behaviour: ExhibitedState redefines exhibitState",
    },
    {
        construct: "exhibitStateReferenced",
        model: `${header}\npart def Machine { state behaviour { entry; then Idle; state Idle; } exhibit behaviour; }`,
        emits: "contains behaviour: ExhibitedState redefines exhibitState",
    },
    {
        construct: "exhibitStateTyped",
        model: `${header}\nstate def Cycle { entry; then Idle; state Idle; }\npart def Machine { exhibit state behaviour : Cycle; }`,
        emits: "contains behaviour: Cycle redefines exhibitState",
    },
    {
        construct: "partState",
        model: `${header}\npart def Machine { state behaviour { entry; then Idle; state Idle; } }`,
        emits: "contains behaviour: ExhibitedState redefines exhibitState",
    },
    {
        construct: "exhibitStateSecond",
        model: `${header}\npart def Machine { exhibit state One; exhibit state Other; }`,
        located: "exhibit state Other;",
    },
    {
        construct: "stateDefinition",
        model: `${header}\nstate def Cycle { entry; then Idle; state Idle; }`,
        emits: "class Cycle : ExhibitedState",
    },
    {
        construct: "stateUsage",
        model: machine(""),
        emits: "contains Idle: State subsets states",
    },
    {
        construct: "stateUsageTyped",
        model: `${header}\nstate def Cycle;\npart def Machine { exhibit state Behaviour { entry; then Idle; state Idle : Cycle; } }`,
        located: "state Idle : Cycle;",
    },
    {
        construct: "parallelState",
        model: machine("", "state Both parallel { state Left; state Right; }"),
        emits: "contains Both: ParallelState subsets states",
    },
    {
        construct: "stateMember",
        model: machine("", "state Busy { action work; }"),
        located: "action work;",
    },
    {
        construct: "compositeWithoutInitial",
        model: machine("", "state Busy { state Inner; }"),
        located: "state Busy { state Inner; }",
    },
    {
        construct: "initialTransition",
        model: `${header}\npart def Machine { exhibit state Behaviour { transition first start then Idle; state Idle; } }`,
        emits: "redefine refers from: StateNode = start",
    },
    {
        construct: "initialTrigger",
        model: `${header}\npart def Machine { port input : Feed; exhibit state Behaviour { transition first start accept Signal via input then Idle; state Idle; } }`,
        located: "accept Signal via input",
    },
    {
        construct: "entryAction",
        model: machine("", "state Busy { entry assign count := 1; }"),
        emits: "redefine contains entryAction: AssignmentAction",
    },
    {
        construct: "exitAction",
        model: machine("", "state Busy { exit assign count := 1; }"),
        emits: "redefine contains exitAction: AssignmentAction",
    },
    {
        construct: "doAction",
        model: machine("", "state Busy { do action work; }"),
        located: "do action work;",
    },
    {
        construct: "transition",
        model: machine("", "transition go first Idle then Idle;"),
        emits: "contains go: Transition subsets transitions",
    },
    {
        construct: "transitionDone",
        model: machine("", "transition first Idle then done;"),
        emits: "redefine refers to: StateNode = done",
    },
    {
        construct: "transitionTarget",
        model: machine("", "action work; transition first Idle then work;"),
        located: "work",
    },
    {
        construct: "transitionInParallel",
        model: machine(
            "",
            "state Both parallel { state Left; state Right; transition first Left then Right; }"
        ),
        located: "transition first Left then Right;",
    },
    {
        construct: "unnamedTwins",
        model: machine("", "transition first Idle then Idle; transition first Idle then Idle;"),
        located: "transition first Idle then Idle;",
    },
    {
        construct: "acceptItem",
        model: machine("", "transition first Idle accept signal : Signal via input then Idle;"),
        emits: "redefine contains acceptAction: AcceptItemAction",
    },
    {
        construct: "acceptWithoutVia",
        model: machine("", "transition first Idle accept Signal then Idle;"),
        located: "Signal",
    },
    {
        construct: "viaOther",
        model: `${machine("")}\npart def Plant { part machine : Machine; exhibit state Behaviour { entry; then Idle; state Idle; transition first Idle accept Signal via machine.input then Idle; } }`,
        located: "machine.input",
    },
    {
        construct: "acceptAfter",
        model: machine(
            "",
            "transition first Idle accept after 2 [min] then Idle; transition first Idle accept after 30 [s] then Idle;"
        ),
        emits: "redefine refers afterTime: int = 4",
    },
    {
        construct: "acceptAfterOther",
        model: machine("", "transition first Idle accept after count [s] then Idle;"),
        located: "after count [s]",
    },
    {
        construct: "acceptWhen",
        model: machine("", "transition first Idle accept when count > 2 then Idle;"),
        emits: "redefine contains acceptAction: AcceptWhenAction",
    },
    {
        construct: "acceptAt",
        model: machine("", "transition first Idle accept at count then Idle;"),
        located: "at count",
    },
    {
        construct: "guard",
        model: machine("", "transition first Idle if count < 3 then Idle;"),
        emits: "redefine contains guard: Guard",
    },
    {
        construct: "effect",
        model: machine("", "transition first Idle do assign count := count + 1 then Idle;"),
        emits: "redefine contains action: AssignmentAction",
    },
    {
        construct: "send",
        model: machine("", "transition first Idle do send new Signal() via input then Idle;"),
        emits: "redefine contains action: SendItemAction",
    },
    {
        construct: "sendTo",
        model: machine(
            "",
            "transition first Idle do send new Signal() via input to input then Idle;"
        ),
        located: "input",
    },
    {
        construct: "sendPayload",
        model: machine("", "transition first Idle do send count via input then Idle;"),
        located: "count",
    },
    {
        construct: "sendArguments",
        model: machine("", "transition first Idle do send new Signal(1) via input then Idle;"),
        located: "send new Signal(1) via input",
    },
    {
        construct: "sendArguments",
        model: machine("", "transition first Idle do send new Signal(x = 1) via input then Idle;"),
        located: "send new Signal(x = 1) via input",
    },
    {
        construct: "assignment",
        model: machine("", "transition first Idle do assign count := 2 then Idle;"),
        emits: "redefine refers attribute: Attribute = count",
    },
    {
        construct: "assignmentTarget",
        model: machine("", "transition first Idle do assign input := 2 then Idle;"),
        located: "input",
    },
    {
        construct: "compositeAction",
        model: machine(
            "",
            "state Busy { entry action { assign count := 1; send new Signal() via input; } }"
        ),
        emits: "redefine contains entryAction: CompositeAction",
    },
    {
        construct: "succession",
        model: machine(
            "",
            "state Busy { entry action { action later assign count := 2; action sooner assign count := 1; first sooner then later; } }"
        ),
        emits: "contains sooner: AssignmentAction subsets children",
    },
    {
        construct: "actionOther",
        model: machine("", "state Busy { entry action { if count > 1 { assign count := 1; } } }"),
        located: "if count > 1 { assign count := 1; }",
    },
    {
        construct: "actionAcceptOrControl",
        model: machine("", "state Busy { entry action { accept Signal via input; } }"),
        located: "accept Signal via input;",
    },
    {
        construct: "regionsAssignOne",
        model: machine(
            "",
            "state Both parallel { state Left { entry assign count := 1; } state Right { entry assign count := 2; } }"
        ),
        located: "assign count := 2;",
    },
    {
        construct: "literal",
        model: machine("attribute flag : Boolean := true;"),
        emits: "redefine contains initialValue: LiteralBooleanExpression",
    },
    {
        construct: "literalReal",
        model: machine("attribute ratio : Integer := 1.5;"),
        located: "1.5",
    },
    {
        construct: "literalReal",
        model: machine("attribute ratio : Integer := 1.0;"),
        located: "1.0",
    },
    {
        construct: "literalReal",
        model: machine("attribute ratio : Integer := 1e3;"),
        located: "1e3",
    },
    {
        construct: "literalOther",
        model: machine('attribute label : Integer := "text";'),
        located: '"text"',
    },
    {
        construct: "operator",
        model: machine("attribute next : Integer := count + 1;"),
        emits: "redefine contains initialValue: PlusOperatorExpression",
    },
    {
        construct: "operatorDivision",
        model: machine("attribute half : Integer := count / 2;"),
        emits: "redefine contains initialValue: DivisionOperatorExpression",
    },
    {
        construct: "operatorModuloPower",
        model: machine("attribute rest : Integer := count % 2;"),
        located: "count % 2",
    },
    {
        construct: "operatorOther",
        model: machine("attribute flag : Boolean := true xor false;"),
        located: "true xor false",
    },
    {
        construct: "reference",
        model: machine("attribute next : Integer := count;"),
        emits: "redefine contains initialValue: AttributeReferenceExpression",
    },
    {
        construct: "referenceOtherPart",
        model: `${machine("")}\npart def Plant { part machine : Machine; attribute copy : Integer := machine.count; }`,
        located: "machine.count",
    },
    {
        construct: "referenceNonAttribute",
        model: machine("attribute wrong : Integer := input;"),
        located: "input",
    },
    {
        construct: "isStateActive",
        model: checked("mustAlways(isStateActive(machine.Behaviour.Idle))"),
        emits: "redefine contains body: IsStateActiveExpression",
    },
    {
        construct: "verificationCase",
        model: checked("mustAlways(machine.count >= 0)"),
        emits: "class Check : VerificationCaseDefinition",
    },
    {
        construct: "subject",
        model: checked("mustAlways(machine.count >= 0)"),
        emits: "contains machine: Machine[1] redefines subject",
    },
    {
        construct: "subjectOther",
        model: `${machine("")}\nverification def Check { subject machine; objective { require constraint { true } } }`,
        located: "machine;",
    },
    {
        construct: "objectiveMissing",
        model: `${machine("")}\nverification def Check { subject machine : Machine; }`,
        located: "verification def Check { subject machine : Machine; }",
    },
    {
        construct: "objectiveRequire",
        model: `${machine("")}\nverification def Check { subject machine : Machine; objective { require constraint { mustAlways(machine.count >= 0) } } }`,
        emits: "contains constraint1: MustAlways subsets requiredConstraints",
    },
    {
        construct: "verify",
        model: checked("eventually(machine.count > 0)"),
        emits: "contains requirement1: Constraint subsets verifiedRequirements",
    },
    {
        construct: "verifyReference",
        model: `${machine("")}\nrequirement positive { subject machine : Machine; require constraint { mustAlways(machine.count >= 0) } }\nverification def Check { subject plant : Machine; objective { verify positive; } }`,
        emits: "redefine refers attribute: Attribute = plant.count",
    },
    {
        construct: "requirementUsage",
        model: `${machine("")}\nrequirement positive { subject machine : Machine; require constraint { true } }`,
        emits: "class Machine : Part",
    },
    {
        construct: "requireSecond",
        model: `${machine("")}\nverification def Check { subject machine : Machine; objective { verify requirement { require constraint { true } require constraint { false } } } }`,
        located: "constraint { false }",
    },
    {
        construct: "verifySecond",
        model: `${machine("")}\nverification def Check { subject machine : Machine; objective { verify requirement { require constraint { true } } verify requirement { require constraint { false } } } }`,
        located: "verify requirement { require constraint { false } }",
    },
    {
        construct: "verifyAndRequire",
        model: `${machine("")}\nverification def Check { subject machine : Machine; objective { require constraint { true } verify requirement { require constraint { false } } } }`,
        located: "constraint { true }",
    },
    {
        construct: "assume",
        model: `${machine("")}\nverification def Check { subject machine : Machine; objective { assume constraint { true } require constraint { true } } }`,
        located: "assume constraint { true }",
    },
    {
        construct: "temporal",
        model: checked("not eventually(machine.count > 5)"),
        emits: "redefine contains operand: Eventually",
    },
    {
        construct: "untemporal",
        model: checked("machine.count >= 0"),
        emits: "contains constraint1: MustAlways subsets requiredConstraints",
    },
    {
        construct: "temporalMixed",
        model: checked("mustAlways(machine.count >= 0) and eventually(machine.count > 1)"),
        located: "mustAlways(machine.count >= 0)",
    },
    {
        construct: "caseMember",
        model: `${machine("")}\nverification def Check { subject machine : Machine; attribute extra : Integer; objective { require constraint { true } } }`,
        located: "attribute extra : Integer;",
    },
    {
        construct: "targetTransition",
        model: waiting("accept Signal via input then Busy;"),
        emits: "redefine refers from: StateNode = Waiting",
    },
    {
        construct: "targetTransition",
        model: waiting("if count > 0 then Busy;"),
        emits: "redefine refers to: StateNode = Busy",
    },
    {
        construct: "targetTransitionEffect",
        model: waiting("do action { assign count := 1; } then Busy;"),
        located: "do action { assign count := 1; }",
    },
    {
        construct: "targetTransition",
        model: waiting("accept after 2 [s] then Busy;"),
        emits: "redefine contains acceptAction: AcceptTimeoutAction",
    },
    {
        construct: "transitionTarget",
        model: machine("", "state Busy; accept Signal via input then Busy;"),
        located: "accept Signal via input then Busy;",
    },
    {
        construct: "actionOther",
        model: waiting(
            "entry action { action setup assign count := 1; action reset assign count := 0; if count > 0 then setup; }"
        ),
        located: "if count > 0 then setup;",
    },
    {
        construct: "initialTransition",
        model: `${header}\npart def Machine { attribute count : Integer := 0; exhibit state Behaviour { entry action initialize { assign count := 1; } then Idle; state Idle; } }`,
        emits: "redefine contains entryAction: CompositeAction",
    },
    {
        construct: "initialTransition",
        model: `${header}\npart def Machine { attribute count : Integer := 0; exhibit state Behaviour { entry assign count := 1; then Idle; state Idle; } }`,
        emits: "contains initial1: Transition subsets transitions",
    },
];

describe("the SysML constructs of the translation", () => {
    let shared: SysMLSharedServices;

    beforeAll(async () => {
        ({ shared } = await setupServicesWithStdlib());
        const verificationLibrary = await shared.workspace.LangiumDocuments.getOrCreateDocument(
            URI.file(path.resolve(currentDir, "..", "..", "..", "library", "Verification.sysml"))
        );
        await shared.workspace.DocumentBuilder.build([verificationLibrary], <SysMLBuildOptions>{
            validation: false,
            standalone: false,
        });
    }, 180_000);

    it("cover every construct of the registry", () => {
        const covered = new Set(
            cases.map((testCase) => {
                return testCase.construct;
            })
        );
        const missing = Object.keys(SemantifyrConstructs).filter((construct) => {
            return !covered.has(construct as SemantifyrConstructId);
        });
        expect(missing).toEqual([]);
    });

    const translate = async (
        model: string
    ): Promise<{
        oxsts: string | undefined;
        diagnostics: { code: Diagnostic["code"]; severity: Diagnostic["severity"]; text: string }[];
    }> => {
        const uri = URI.file(path.join(currentDir, "construct.sysml"));
        const document = shared.workspace.LangiumDocumentFactory.fromString(model, uri);
        shared.workspace.LangiumDocuments.addDocument(document);
        await shared.workspace.DocumentBuilder.build([document], <SysMLBuildOptions>{
            validation: false,
            standalone: false,
        });
        const mapping = mapSysMLNamespaceToSemantifyr(document.parseResult.value as Namespace);
        const diagnostics = mapping.diagnostics.map((diagnostic) => {
            return {
                code: diagnostic.code,
                severity: diagnostic.severity,
                text: document.textDocument.getText(diagnostic.range),
            };
        });
        shared.workspace.LangiumDocuments.deleteDocument(uri);
        shared.workspace.IndexManager.remove(uri);
        expect(document.parseResult.parserErrors).toHaveLength(0);
        return { oxsts: mapping.oxsts, diagnostics };
    };

    it.each(cases)("$construct", async ({ construct, model, located, emits }) => {
        const { oxsts, diagnostics } = await translate(model);
        const { outcome, warning } = SemantifyrConstructs[construct];
        if (outcome === "planned" || outcome === "unsupported") {
            expect(diagnostics).toContainEqual({
                code: construct,
                severity: DiagnosticSeverity.Error,
                text: located,
            });
            expect(oxsts).toBeUndefined();
            return;
        }
        expect(diagnostics).toEqual(
            warning
                ? [{ code: construct, severity: DiagnosticSeverity.Warning, text: located }]
                : []
        );
        if (emits !== undefined) {
            const lines = oxsts?.split("\n").map((line) => {
                return line.trim().replace(/ \{$/, "");
            });
            expect(lines).toContain(emits);
        }
        expect(oxsts).toBeDefined();
    });

    it.each(errorCases)("$error", async ({ error, model, located }) => {
        const { oxsts, diagnostics } = await translate(model);
        expect(diagnostics).toContainEqual({
            code: error,
            severity: DiagnosticSeverity.Error,
            text: located,
        });
        expect(oxsts).toBeUndefined();
    });
});
