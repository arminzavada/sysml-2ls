export type SemantifyrConstructStatus = "supported" | "warned" | "refused";

export interface SemantifyrConstruct {
    readonly construct: string;
    readonly status: SemantifyrConstructStatus;
    readonly detail: string;
}

function supported(construct: string, detail = ""): SemantifyrConstruct {
    return { construct, status: "supported", detail };
}

function warned(construct: string, detail: string): SemantifyrConstruct {
    return { construct, status: "warned", detail };
}

function refused(construct: string, detail: string): SemantifyrConstruct {
    return { construct, status: "refused", detail };
}

export const SemantifyrConstructs = {
    package: refused(
        "Package",
        "Semantifyr requires the model's elements at the top level of the file"
    ),
    import: supported("Import", "names are resolved by SysIDE"),
    alias: refused("Alias", "Semantifyr does not support aliases"),
    annotation: supported("Comment, documentation and metadata", "not translated"),
    builtinCalculation: supported(
        "The calculation definitions `isStateActive`, `mustAlways` and `eventually`",
        "Semantifyr's extensions, not translated"
    ),
    calculation: refused(
        "User calculation definition or invocation",
        "Semantifyr supports only the calculations isStateActive, mustAlways and eventually"
    ),
    topLevelUsage: refused(
        "Top-level usage other than a requirement",
        "Semantifyr supports only requirement usages at the top level"
    ),
    topLevelDefinition: refused(
        "Action, constraint, requirement, attribute, enumeration, occurrence, connection, interface and allocation definitions",
        "Semantifyr does not support this definition"
    ),
    partDefinition: supported("Part definition"),
    definitionSpecialization: refused(
        "Specialization of a part, port, state or verification definition",
        "Semantifyr does not support specialization here"
    ),
    partUsage: supported("Part usage typed by one part definition"),
    partUsageUntyped: refused(
        "Part usage not typed by a part definition",
        "Semantifyr requires a part to be typed by a part definition"
    ),
    multipleTypings: refused(
        "Usage with more than one typing",
        "Semantifyr supports one typing per usage"
    ),
    usageSpecialization: refused(
        "Part, port, attribute or state usage subsetting or redefining another feature",
        "Semantifyr does not support subsetting or redefinition here"
    ),
    usageBody: refused(
        "Part, port or subject usage with a body",
        "Semantifyr does not support a body here"
    ),
    multiplicityZero: supported("Usage with multiplicity `[0]`", "absent"),
    multiplicityLiteral: supported(
        "Part or port usage with a literal multiplicity `[n]`",
        "n instances"
    ),
    multiplicityAttribute: refused(
        "Attribute with a literal multiplicity `[n]`",
        "Semantifyr supports one value per attribute"
    ),
    multiplicityOther: refused(
        "Multiplicity other than `[1]`, `[0]` and a literal `[n]`, `[0..1]` included",
        "Semantifyr supports the multiplicities [1], [0] and a literal [n]"
    ),
    multipleReference: refused(
        "Reference through a part or port usage with multiplicity `[n]`",
        "Semantifyr does not support a reference to a usage with several instances"
    ),
    partMember: refused(
        "Other member of a part definition: actions, `perform`, `assert constraint`, item usages, constraints",
        "Semantifyr does not support this member of a part definition"
    ),
    connection: refused(
        "Connection, interface and allocation usages",
        "Semantifyr does not support connections, interfaces and allocations"
    ),
    portDefinition: supported("Port definition"),
    portItem: supported(
        "`in`, `out` and `inout` item usages of a port definition",
        "merged into the port's one incoming and one outgoing slot"
    ),
    portMember: refused(
        "Other member of a port definition",
        "Semantifyr does not support this member of a port definition"
    ),
    portUsage: supported("Port usage typed by a port definition"),
    portConjugation: supported("Conjugated port usage `~P`", "the conjugation is not read"),
    portUsageUntyped: refused(
        "Port usage not typed by a port definition",
        "Semantifyr requires a port to be typed by a port definition"
    ),
    itemDefinition: supported("Item definition", "every item of one definition is one signal"),
    itemMember: refused(
        "Attribute or other member of an item definition",
        "Semantifyr does not support item payloads"
    ),
    itemSpecialization: warned(
        "Item definition specializing another",
        "An accept of an item definition does not accept its specializations"
    ),
    flow: supported("Flow from a sub-part's port to a sub-part's port"),
    flowItemType: supported(
        "Flow with an item type, `flow of X`",
        "the item type is not read, a declared contradiction"
    ),
    flowEnd: refused(
        "Flow end other than a sub-part's port",
        "Semantifyr requires a flow end to name a sub-part and its port"
    ),
    binding: supported("Binding of the part's own port to a sub-part's port"),
    bindingOther: refused(
        "Other binding",
        "Semantifyr supports only a binding of the part's own port to a sub-part's port"
    ),
    attribute: supported("Attribute typed by Integer or Boolean"),
    attributeType: refused(
        "Attribute of another type: Real, String, Natural, quantities, enumerations, attribute definitions",
        "Semantifyr supports attributes of type Integer and Boolean"
    ),
    attributeBinding: supported("Attribute value `= e`", "derived, never assigned"),
    attributeInitial: supported("Attribute value `:= e` and `default := e`", "the initial value"),
    attributeDefault: supported(
        "Attribute value `default e`",
        "a default binding, derived like `= e`"
    ),
    attributeUnvalued: supported("Attribute without a value", "any initial value"),
    attributeOutsidePart: refused(
        "Attribute outside a part definition",
        "Semantifyr supports attributes only in part definitions"
    ),
    assignmentToBound: refused(
        "Assignment to an attribute bound by `=` or `default`",
        "Semantifyr does not support an assignment to a bound attribute"
    ),
    exhibitState: supported("Exhibit state owned by its part"),
    exhibitStateReferenced: supported("`exhibit s;` of the part's own state"),
    exhibitStateTyped: supported(
        "Exhibit state typed by a state definition",
        "a class per state definition"
    ),
    partState: supported("A part's plain `state`", "performed as the part's exhibited state"),
    exhibitStateSecond: refused(
        "Second exhibited state of a part",
        "Semantifyr supports one exhibited state per part"
    ),
    stateDefinition: supported("State definition"),
    stateUsage: supported("State usage in a state"),
    stateUsageTyped: refused(
        "State usage in a state typed by a state definition",
        "Semantifyr supports state definitions only for exhibited states"
    ),
    parallelState: supported("Parallel state"),
    stateMember: refused(
        "Other member of a state: attributes, actions, constraints, nested definitions",
        "Semantifyr does not support this member of a state"
    ),
    compositeWithoutInitial: refused(
        "Composite state without an initial transition",
        "Semantifyr requires a composite state to have an initial transition"
    ),
    initialTransition: supported("`entry; then X;` and `transition first start then X;`"),
    initialTrigger: refused(
        "Trigger on an initial transition",
        "Semantifyr does not support a trigger on an initial transition"
    ),
    initialGuardClosed: refused(
        "Initial transition whose guard is the literal `false`",
        "This initial transition can never be taken"
    ),
    entryAction: supported("Entry action"),
    exitAction: supported("Exit action"),
    doAction: refused("Do action", "Semantifyr does not support do actions"),
    transition: supported("Transition between states"),
    transitionDone: supported("Transition to `done`"),
    transitionTarget: refused(
        "Transition source or target other than a state of the model or the owning state's `done`: actions, decision, terminate",
        "Semantifyr requires a transition between states of the model"
    ),
    transitionInParallel: refused(
        "Transition declared in a parallel state",
        "Semantifyr does not support a transition between the regions of a parallel state"
    ),
    unnamedTwins: warned(
        "Two unnamed transitions equal in owner, source, target, trigger and guard",
        "Name one of these transitions so that the trace can tell them apart"
    ),
    acceptItem: supported(
        "`accept X via p` and `accept x : X via p`",
        "the payload name is not read"
    ),
    acceptWithoutVia: refused(
        "Accept or send without `via`",
        "Semantifyr requires an accept or a send to name its port with 'via'"
    ),
    viaOther: refused(
        "`via` naming something other than a port of the part",
        "Semantifyr requires 'via' to name a port of the part"
    ),
    acceptAfter: supported("`accept after d` with a literal duration", "a count of ticks"),
    acceptAfterOther: refused(
        "`accept after` with a non-literal duration or without a unit",
        "Semantifyr requires a literal duration in seconds, minutes, hours or days"
    ),
    acceptWhen: supported(
        "`accept when c`",
        "enabled in every step c holds, a declared contradiction"
    ),
    acceptAt: refused("`accept at t`", "Semantifyr does not support at triggers"),
    guard: supported("Transition guard"),
    effect: supported("Transition effect"),
    send: supported("`send new X() via p`"),
    sendTo: refused("Send with `to`", "Semantifyr does not support a send's 'to'"),
    sendPayload: refused(
        "Send of an expression other than `new X()`, or with arguments",
        "Semantifyr requires a send of 'new X()' of an item definition X"
    ),
    assignment: supported("Assignment to the part's own attribute"),
    assignmentTarget: refused(
        "Assignment to something other than the part's own attribute",
        "Semantifyr supports assignments only to the part's own attributes"
    ),
    compositeAction: supported("Composite action"),
    succession: supported(
        "Successions between the children of a composite action",
        "the children run in an order consistent with the successions"
    ),
    successionCycle: refused(
        "Successions forming a cycle",
        "Semantifyr requires the successions of a composite action to be acyclic"
    ),
    actionOther: refused(
        "Other action: accept outside a trigger, if, loops, control nodes, `perform` by reference, terminate, `then done`",
        "Semantifyr does not support this action"
    ),
    regionsAssignOne: warned(
        "Two regions of a parallel state assigning one attribute",
        "Two regions assign this attribute; within a step they run in textual order"
    ),
    literal: supported("Integer and Boolean literals"),
    literalOther: refused(
        "Real, String, null and infinity literals",
        "Semantifyr supports Integer and Boolean literals"
    ),
    operator: supported("The operators `+ - * / == != < <= > >= and or not` and unary `+` and `-`"),
    operatorOther: refused(
        "Other operators: `xor`, `implies`, `%`, `**`, `if ? else`, `??`, `===`",
        "Semantifyr does not support this operator"
    ),
    reference: supported("Reference to the part's own attribute"),
    referenceOtherPart: refused(
        "Reference to another part's attribute outside a verification case or requirement",
        "A part may reference only its own attributes"
    ),
    referenceNonAttribute: refused(
        "Reference to a feature other than an attribute in an expression",
        "Semantifyr supports references to attributes in expressions"
    ),
    isStateActive: supported("`isStateActive(s)`"),
    verificationCase: supported("Verification case definition"),
    subject: supported("Subject typed by a part definition"),
    subjectOther: refused(
        "Subject not typed by a part definition",
        "Semantifyr requires the subject to be typed by a part definition"
    ),
    objectiveMissing: refused(
        "Verification case without an objective",
        "Semantifyr requires a verification case to have an objective"
    ),
    objectiveRequire: supported(
        "Objective's own `require constraint`",
        "checked when there is no `verify`"
    ),
    verify: supported("`verify requirement { require constraint { ... } }`"),
    verifyReference: supported("`verify r;` of a top-level requirement usage"),
    requirementUsage: supported("Top-level requirement usage", "translated where it is verified"),
    requireSecond: refused(
        "Second `require constraint` of a requirement",
        "Semantifyr supports one required constraint per requirement"
    ),
    verifySecond: refused(
        "Second `verify` of a verification case",
        "Semantifyr supports one verified requirement per case"
    ),
    verifyAndRequire: refused(
        "Objective with both its own `require` and a `verify`",
        "Semantifyr supports either a verified requirement or the objective's own constraint"
    ),
    assume: refused("`assume constraint`", "Semantifyr does not support assume constraints"),
    temporal: supported("`mustAlways(c)` and `eventually(c)` at the root of a constraint"),
    untemporal: supported("Constraint without a temporal operator", "read as mustAlways"),
    temporalMixed: refused(
        "Temporal operator below the root of a constraint",
        "Semantifyr supports mustAlways and eventually only at the root of a constraint"
    ),
    caseMember: refused(
        "Other member of a verification case or requirement",
        "Semantifyr does not support this member here"
    ),
    translationFailure: refused(
        "Element of a shape the translator cannot read",
        "Semantifyr cannot translate this element"
    ),
} as const satisfies Record<string, SemantifyrConstruct>;

export type SemantifyrConstructId = keyof typeof SemantifyrConstructs;

export function semantifyrConstructTable(): string {
    const rows = Object.values(SemantifyrConstructs).map((construct: SemantifyrConstruct) => {
        return [construct.construct, construct.status, construct.detail].join("\t");
    });
    return ["construct\tstatus\tdetail", ...rows].join("\n") + "\n";
}
