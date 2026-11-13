export type SemantifyrOutcome =
    "conformant" | "abstracted" | "deviating" | "extension" | "planned" | "unsupported";

export interface SemantifyrConstruct {
    readonly construct: string;
    readonly outcome: SemantifyrOutcome;
    readonly warning: boolean;
    readonly detail: string;
}

function withOutcome(
    outcome: SemantifyrOutcome
): (construct: string, detail?: string) => SemantifyrConstruct {
    return (construct, detail = "") => {
        return { construct, outcome, warning: false, detail };
    };
}

const conformant = withOutcome("conformant");
const abstracted = withOutcome("abstracted");
const deviating = withOutcome("deviating");
const extension = withOutcome("extension");
const planned = withOutcome("planned");
const unsupported = withOutcome("unsupported");

function warned(construct: SemantifyrConstruct): SemantifyrConstruct {
    return { ...construct, warning: true };
}

export const SemantifyrConstructs = {
    package: planned(
        "Package",
        "Semantifyr requires the model's elements at the top level of the file"
    ),
    import: conformant("Import", "names are resolved by SysIDE"),
    alias: unsupported("Alias", "Semantifyr does not support aliases"),
    annotation: conformant("Comment, documentation and metadata", "not translated"),
    builtinCalculation: extension(
        "The calculation definitions `isStateActive`, `mustAlways` and `eventually`",
        "Semantifyr's extensions, which SysML v2 does not have, not translated"
    ),
    calculation: unsupported(
        "User calculation definition or invocation",
        "Semantifyr supports only the calculations isStateActive, mustAlways and eventually"
    ),
    topLevelUsage: unsupported(
        "Top-level usage other than a requirement",
        "Semantifyr supports only requirement usages at the top level"
    ),
    enumerationDefinition: planned(
        "Enumeration definition",
        "Semantifyr does not support enumeration definitions"
    ),
    topLevelDefinition: unsupported(
        "Action, constraint, requirement, attribute, occurrence, connection, interface and allocation definitions",
        "Semantifyr does not support this definition"
    ),
    partDefinition: conformant("Part definition"),
    definitionSpecialization: unsupported(
        "Specialization of a part, port, state or verification definition",
        "Semantifyr does not support specialization here"
    ),
    partUsage: abstracted(
        "Part usage typed by one part definition",
        "a fixed tree of parts alive for the whole run, reacting concurrently in the step"
    ),
    partUsageUntyped: unsupported(
        "Part usage not typed by a part definition",
        "Semantifyr requires a part to be typed by a part definition"
    ),
    multipleTypings: planned(
        "Usage with more than one typing",
        "Semantifyr supports one typing per usage"
    ),
    usageSpecialization: unsupported(
        "Part, port, attribute or state usage subsetting or redefining another feature",
        "Semantifyr does not support subsetting or redefinition here"
    ),
    usageBody: unsupported(
        "Part, port or subject usage with a body",
        "Semantifyr does not support a body here"
    ),
    multiplicityZero: conformant("Usage with multiplicity `[0]`", "absent"),
    multiplicityLiteral: conformant(
        "Part or port usage with a literal multiplicity `[n]`",
        "n instances"
    ),
    multiplicityAttribute: planned(
        "Attribute with a literal multiplicity `[n]`",
        "Semantifyr supports one value per attribute"
    ),
    multiplicityOptional: planned(
        "Usage with multiplicity `[0..1]`",
        "Semantifyr does not support the multiplicity [0..1]"
    ),
    multiplicityOther: unsupported(
        "Multiplicity other than `[1]`, `[0]`, `[0..1]` and a literal `[n]`",
        "Semantifyr supports the multiplicities [1], [0] and a literal [n]"
    ),
    multipleReference: unsupported(
        "Reference through a part or port usage with multiplicity `[n]`",
        "Semantifyr does not support a reference to a usage with several instances"
    ),
    partAction: planned(
        "Action or `perform` in a part definition",
        "Semantifyr does not support actions in a part definition"
    ),
    partMember: unsupported(
        "Other member of a part definition: `assert constraint`, item usages, constraints, calculations",
        "Semantifyr does not support this member of a part definition"
    ),
    connection: unsupported(
        "Connection, interface and allocation usages",
        "Semantifyr does not support connections, interfaces and allocations"
    ),
    portDefinition: conformant("Port definition"),
    portItem: abstracted(
        "`in`, `out` and `inout` item usages of a port definition",
        "merged into the port's one incoming and one outgoing slot"
    ),
    portItemType: deviating(
        "Item type of a port definition's `in`, `out` or `inout` item usage",
        "not read, so a port admits an item it does not declare"
    ),
    portMember: unsupported(
        "Other member of a port definition",
        "Semantifyr does not support this member of a port definition"
    ),
    portUsage: conformant("Port usage typed by a port definition"),
    portConjugation: deviating(
        "Conjugated port usage `~P`",
        "the conjugation is not read, so a send against the port's direction is admitted"
    ),
    portUsageUntyped: unsupported(
        "Port usage not typed by a port definition",
        "Semantifyr requires a port to be typed by a port definition"
    ),
    itemDefinition: abstracted("Item definition", "every item of one definition is one signal"),
    itemMember: planned(
        "Attribute or other member of an item definition",
        "Semantifyr does not support item payloads"
    ),
    itemSpecialization: warned(
        deviating(
            "Item definition specializing another",
            "An accept of an item definition does not accept its specializations"
        )
    ),
    flow: abstracted(
        "Flow from a sub-part's port to a sub-part's port",
        "the item arrives at the end of the step and is held for the next step only"
    ),
    flowItemType: deviating(
        "Flow with an item type, `flow of X`",
        "the item type is not read, so an item of another type crosses the flow, a declared contradiction"
    ),
    flowEnd: unsupported(
        "Flow end other than a sub-part's port",
        "Semantifyr requires a flow end to name a sub-part and its port"
    ),
    binding: conformant("Binding of the part's own port to a sub-part's port"),
    bindingOther: unsupported(
        "Other binding",
        "Semantifyr supports only a binding of the part's own port to a sub-part's port"
    ),
    attribute: conformant("Attribute typed by Integer or Boolean"),
    attributeRealOrEnumeration: planned(
        "Attribute of type Real or of an enumeration",
        "Semantifyr does not support attributes of type Real or of an enumeration"
    ),
    attributeType: unsupported(
        "Attribute of another type: String, Natural, quantities, attribute definitions",
        "Semantifyr supports attributes of type Integer and Boolean"
    ),
    attributeBinding: conformant("Attribute value `= e`", "derived, never assigned"),
    attributeInitial: conformant("Attribute value `:= e` and `default := e`", "the initial value"),
    attributeDefault: conformant(
        "Attribute value `default e`",
        "a default binding, derived like `= e`"
    ),
    attributeUnvalued: conformant("Attribute without a value", "any initial value"),
    attributeOutsidePart: unsupported(
        "Attribute outside a part definition",
        "Semantifyr supports attributes only in part definitions"
    ),
    exhibitState: abstracted(
        "Exhibit state owned by its part",
        "performed from the part's initialization until it reaches `done`"
    ),
    exhibitStateReferenced: abstracted(
        "`exhibit s;` of the part's own state",
        "performed as an owned exhibited state"
    ),
    exhibitStateTyped: abstracted(
        "Exhibit state typed by a state definition",
        "a class per state definition, performed as an owned exhibited state"
    ),
    partState: deviating(
        "A part's plain `state`",
        "performed as the part's exhibited state, where SysML v2 performs only exhibited states"
    ),
    exhibitStateSecond: planned(
        "Second exhibited state of a part",
        "Semantifyr supports one exhibited state per part"
    ),
    stateDefinition: conformant("State definition"),
    stateUsage: conformant("State usage in a state"),
    stateUsageTyped: unsupported(
        "State usage in a state typed by a state definition",
        "Semantifyr supports state definitions only for exhibited states"
    ),
    parallelState: abstracted(
        "Parallel state",
        "every region reacts in the same step, the regions in textual order"
    ),
    stateMember: unsupported(
        "Other member of a state: attributes, actions, constraints, nested definitions",
        "Semantifyr does not support this member of a state"
    ),
    compositeWithoutInitial: unsupported(
        "Composite state without an initial transition",
        "Semantifyr requires a composite state to have an initial transition"
    ),
    initialTransition: conformant(
        "`entry; then X;`, `entry action a { ... } then X;` and `transition first start then X;`",
        "the transition right after the entry action, which is kept"
    ),
    initialTrigger: unsupported(
        "Trigger on an initial transition",
        "Semantifyr does not support a trigger on an initial transition"
    ),
    entryAction: abstracted(
        "Entry action",
        "atomic, complete in the step that activates its state"
    ),
    exitAction: abstracted(
        "Exit action",
        "atomic, the exits bottom-up and then the sibling regions"
    ),
    doAction: planned("Do action", "Semantifyr does not support do actions"),
    transition: abstracted(
        "Transition between states",
        "atomic at zero duration, the inner transition before the outer"
    ),
    transitionDone: conformant("Transition to `done`"),
    transitionTarget: unsupported(
        "Transition source or target other than a state of the model or the owning state's `done`: actions, decision, terminate",
        "Semantifyr requires a transition between states of the model"
    ),
    targetTransition: conformant(
        "Transition without `first` in a state's body: `accept ... then X;`, `if c then X;`",
        "a transition from the owning state"
    ),
    targetTransitionEffect: planned(
        "Transition without `first` with an effect, `do ... then X;`, in a state's body",
        "SysIDE reads 'do ... then X;' in a state's body as a do action and a separate transition; write 'transition first <state> do ... then X;'"
    ),
    transitionInParallel: unsupported(
        "Transition declared in a parallel state",
        "Semantifyr does not support a transition between the regions of a parallel state"
    ),
    unnamedTwins: warned(
        conformant(
            "Two unnamed transitions equal in owner, source, target, trigger and guard",
            "Name one of these transitions so that the trace can tell them apart"
        )
    ),
    acceptItem: abstracted(
        "`accept X via p` and `accept x : X via p`",
        "consumed by at most one transition per part per step and dropped when not accepted in its arrival step; the payload name is not read"
    ),
    acceptWithoutVia: unsupported(
        "Accept or send without `via`",
        "Semantifyr requires an accept or a send to name its port with 'via'"
    ),
    viaOther: unsupported(
        "`via` naming something other than a port of the part",
        "Semantifyr requires 'via' to name a port of the part"
    ),
    acceptAfter: abstracted("`accept after d` with a literal duration", "a count of ticks"),
    acceptAfterOther: unsupported(
        "`accept after` with a non-literal duration or without a unit",
        "Semantifyr requires a literal duration in seconds, minutes, hours or days"
    ),
    acceptWhen: abstracted(
        "`accept when c`",
        "enabled in every step c holds, a selection: the change signal, sent when c turns true or holds at first evaluation, stays acceptable until the source state is left"
    ),
    acceptAt: unsupported("`accept at t`", "Semantifyr does not support at triggers"),
    guard: conformant("Transition guard"),
    effect: abstracted(
        "Transition effect",
        "atomic at zero duration, between the exits and the entries"
    ),
    send: abstracted(
        "`send new X() via p`",
        "one item per port per step, the last of several kept"
    ),
    sendTo: unsupported("Send with `to`", "Semantifyr does not support a send's 'to'"),
    sendArguments: planned(
        "Send of `new X(...)` with arguments",
        "Semantifyr does not support item payloads"
    ),
    sendPayload: unsupported(
        "Send of an expression other than `new X()`",
        "Semantifyr requires a send of 'new X()' of an item definition X"
    ),
    assignment: conformant("Assignment to the part's own attribute"),
    assignmentTarget: unsupported(
        "Assignment to something other than the part's own attribute",
        "Semantifyr supports assignments only to the part's own attributes"
    ),
    compositeAction: abstracted(
        "Composite action",
        "the children run one after another, never concurrently"
    ),
    succession: abstracted(
        "Successions between the children of a composite action",
        "the children run in an order consistent with the successions"
    ),
    actionAcceptOrControl: planned(
        "Accept action inside an action, control nodes",
        "Semantifyr does not support accept actions inside actions and control nodes"
    ),
    actionOther: unsupported(
        "Other action: if, loops, `perform` by reference, terminate, `then done`",
        "Semantifyr does not support this action"
    ),
    regionsAssignOne: warned(
        abstracted(
            "Two regions of a parallel state assigning one attribute",
            "Two regions assign this attribute; within a step they run in textual order"
        )
    ),
    literal: conformant("Integer and Boolean literals"),
    literalReal: planned("Real literals", "Semantifyr does not support Real literals"),
    literalOther: unsupported(
        "String, null and infinity literals",
        "Semantifyr supports Integer and Boolean literals"
    ),
    operator: conformant("The operators `+ - * == != < <= > >= and or not` and unary `+` and `-`"),
    operatorDivision: deviating(
        "The division `/` of two integers",
        "an integer, where KerML's division of two integers returns a rational"
    ),
    operatorModuloPower: planned(
        "The operators `%`, `**` and `^`",
        "Semantifyr does not support the operators %, ** and ^"
    ),
    operatorOther: unsupported(
        "Other operators: `xor`, `implies`, `if ? else`, `??`, `===`",
        "Semantifyr does not support this operator"
    ),
    reference: conformant("Reference to the part's own attribute"),
    referenceOtherPart: unsupported(
        "Reference to another part's attribute outside a verification case or requirement",
        "A part may reference only its own attributes"
    ),
    referenceNonAttribute: unsupported(
        "Reference to a feature other than an attribute in an expression",
        "Semantifyr supports references to attributes in expressions"
    ),
    isStateActive: extension(
        "`isStateActive(s)`",
        "Semantifyr's extension, which SysML v2 does not have"
    ),
    verificationCase: abstracted(
        "Verification case definition",
        "a closed subject whose environment may put an item on every input in every step"
    ),
    subject: conformant("Subject typed by a part definition"),
    subjectOther: unsupported(
        "Subject not typed by a part definition",
        "Semantifyr requires the subject to be typed by a part definition"
    ),
    objectiveMissing: unsupported(
        "Verification case without an objective",
        "Semantifyr requires a verification case to have an objective"
    ),
    objectiveRequire: conformant(
        "Objective's own `require constraint`",
        "checked when there is no `verify`"
    ),
    verify: conformant("`verify requirement { require constraint { ... } }`"),
    verifyReference: conformant("`verify r;` of a top-level requirement usage"),
    requirementUsage: conformant("Top-level requirement usage", "translated where it is verified"),
    requireSecond: planned(
        "Second `require constraint` of a requirement",
        "Semantifyr supports one required constraint per requirement"
    ),
    verifySecond: planned(
        "Second `verify` of a verification case",
        "Semantifyr supports one verified requirement per case"
    ),
    verifyAndRequire: unsupported(
        "Objective with both its own `require` and a `verify`",
        "Semantifyr supports either a verified requirement or the objective's own constraint"
    ),
    assume: unsupported("`assume constraint`", "Semantifyr does not support assume constraints"),
    temporal: extension(
        "`mustAlways(c)` and `eventually(c)` at the root of a constraint",
        "Semantifyr's extensions, SysML v2 has no temporal operators"
    ),
    untemporal: extension(
        "Constraint without a temporal operator",
        "read as mustAlways, SysML v2 gives a constraint no temporal reading"
    ),
    temporalMixed: planned(
        "Temporal operator below the root of a constraint",
        "Semantifyr supports mustAlways and eventually only at the root of a constraint"
    ),
    caseMember: unsupported(
        "Other member of a verification case or requirement",
        "Semantifyr does not support this member here"
    ),
} as const satisfies Record<string, SemantifyrConstruct>;

export type SemantifyrConstructId = keyof typeof SemantifyrConstructs;

export const SemantifyrErrors = {
    assignmentToBound: "Semantifyr does not support an assignment to a bound attribute",
    initialGuardClosed: "This initial transition can never be taken",
    successionCycle: "Semantifyr requires the successions of a composite action to be acyclic",
    translationFailure: "Semantifyr cannot translate this element",
} as const satisfies Record<string, string>;

export type SemantifyrErrorId = keyof typeof SemantifyrErrors;

export function semantifyrConstructTable(): string {
    const rows = Object.values(SemantifyrConstructs).map((construct: SemantifyrConstruct) => {
        return [
            construct.construct,
            construct.outcome,
            construct.warning ? "yes" : "no",
            construct.detail,
        ].join("\t");
    });
    return ["construct\toutcome\twarning\tdetail", ...rows].join("\n") + "\n";
}
