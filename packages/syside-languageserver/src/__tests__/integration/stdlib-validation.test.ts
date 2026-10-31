import { beforeAll, describe, expect, it } from "vitest";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";
import type { LangiumDocument } from "langium";
import { Namespace, Type } from "#generated/ast.js";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import {
    ConnectorMeta,
    defaultSysMLPrinterContext,
    printModelElement,
    TypeMeta,
    UsageMeta,
} from "../../model/index.js";
import { print } from "../../utils/index.js";
import { streamModel } from "../../utils/ast-util.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";

const ENDS_K = `package EndsK { assoc A { end feature a; end feature b; } }`;

const PROBES: [string, "sysml" | "kerml", string, string[]][] = [
    [
        "AssignmentActionUsage_invalid",
        "sysml",
        `package AssignmentActionUsage_invalid {
                item i {
                    attribute a;
                    protected attribute b;
                    private attribute c;
                    action d;
                }
                action def A {
                    assign i.a := null;
                    assign i.b := null;
                    assign i.c := null;
                    assign i.d := null;
                }
            }`,
        ["validateAssignmentActionUsageReferentIsTimeVarying @ d"],
    ],
    [
        "Assign",
        "sysml",
        `package Assign {
                private import ScalarValues::Integer;
                attribute def D { attribute x : Integer; }
                attribute g : Integer;
                part def P {
                    attribute y : Integer;
                    attribute d : D;
                    constant attribute k : Integer = 0;
                    action act {
                        assign y := 1;
                        assign k := 1;
                        assign g := 1;
                        assign d.x := 1;
                    }
                }
            }`,
        [
            "validateAssignmentActionUsageReferentIsTimeVarying @ g",
            "validateAssignmentActionUsageReferentIsTimeVarying @ x",
        ],
    ],
    [
        "FlowConstant",
        "sysml",
        `package FlowConstant {
                item def X;
                part def A { out item o : X; in item i : X; }
                part def P {
                    part a : A;
                    part b : A;
                    constant flow f of X from a.o to b.i;
                    constant message m of X;
                    constant connection c connect a to b;
                    ref flow rf of X from a.o to b.i;
                    action act {
                        assign f := rf;
                        assign rf := f;
                        assign c := c;
                    }
                }
            }`,
        [
            "validateFeatureConstantIsVariable @ constant flow f of X from a.o to b.i;",
            "validateFeatureConstantIsVariable @ constant message m of X;",
            "validateAssignmentActionUsageReferentIsTimeVarying @ f",
        ],
    ],
    [
        "PortDefinitionConnections",
        "sysml",
        `package PortDefinitionConnections {
                item def X;
                port def PD {
                    out item o : X;
                    in item i : X;
                    connection c connect o to i;
                    flow f of X from o to i;
                    ref connection rc connect o to i;
                }
            }`,
        [
            "validatePortDefinitionOwnedUsagesNotComposite @ connection c connect o to i;",
            "validatePortDefinitionOwnedUsagesNotComposite @ flow f of X from o to i;",
            "validateFlowEndSubsetting @ o",
            "validateFlowEndSubsetting @ i",
            "validateConnectorRelatedFeatures @ flow f of X from o to i;",
        ],
    ],
    [
        "RedefinitionEnd",
        "kerml",
        `package RedefinitionEnd {
                classifier A { end feature e; }
                classifier B :> A { feature :>> e; }
                assoc R { end a : A; end b : B; }
                abstract connector r : R { end a; end b; }
                abstract assoc R1 :> R { feature a1 :>> a; }
                abstract connector r1 :> r { feature a1 :>> a; }
            }`,
        ["validateRedefinitionEndConformance @ a", "validateRedefinitionEndConformance @ a"],
    ],
    [
        "AssociationTest_CrossFeatures_invalid",
        "kerml",
        `package AssociationTest_CrossFeatures_invalid {
                class C1 { feature a : C2; }
                class C2 { feature b : C1; feature c subsets b; }
                assoc A1 {
                    end x : C1 crosses y.b;
                    end y : C2 crosses y.b;
                }
                assoc A2 specializes A1 {
                    end x : C1 crosses y.c;
                    end y : C2 crosses x.a;
                }
                assoc A3 {
                    end x1 [0..1] feature x : C1 crosses y.b {
                        public import y::y1;
                    }
                    end feature y : C2 crosses x.y1 {
                        member feature y1 [0..1] featured by C1;
                    }
                }
                class C3 { feature x : C3; feature y : C3; }
                assoc A4 {
                    end a : C3;
                    end b : C3 crosses a.x crosses a.y;
                }
            }`,
        [
            "validateFeatureCrossFeatureType @ y.b",
            "validateCrossSubsettingCrossedFeature @ y.b",
            "validateFeatureCrossFeatureSpecialization @ x.a",
            "checkFeatureCrossingSpecialization @ x1 [0..1]",
            "validateFeatureOwnedCrossSubsetting @ a.y",
        ],
    ],
    [
        "AssociationTest_EndTypes_invalid",
        "kerml",
        `package AssociationTest_EndTypes_invalid {
                class C1;
                class C2;
                class C3 specializes C1;
                assoc A1 {
                    end x : C1;
                    end y : C1, C2;
                }
                assoc A2 specializes A1 {
                    end x : C2;
                }
                assoc A3 specializes A1 {
                    end x : C3;
                }
            }`,
        [
            "validateAssociationEndTypes @ end y : C1, C2;",
            "validateAssociationEndTypes @ end x : C2;",
        ],
    ],
    [
        "MultiplicityAlias_valid",
        "kerml",
        `package MultiplicityAlias_valid {
                private import ScalarValues::*;
                class T;
                class K { feature f : T { multiplicity m [1..2]; } }
                class C { alias m for K::f::m; }
                class E {
                    multiplicity em [1..4];
                    feature k : Integer { alias a for em; }
                    feature v : Natural = em;
                }
                class M [0..1] { alias for Base::exactlyOne; }
                class M2 [0..1] { multiplicity extra [2]; }
            }`,
        ["validateTypeOwnedMultiplicity @ multiplicity extra [2];"],
    ],
    [
        "EndsAreUsages",
        "sysml",
        `package EndsAreUsages {
                abstract connection def B1 :> Links::BinaryLink;
                abstract flow def B2 :> Links::BinaryLink;
                part def X;
                connection def C2 :> Links::BinaryLink { end part s : X :>> source; end part t : X :>> target; }
            }
            package EndsAreUsages2 {
                private import EndsK::*;
                connection def D1 :> A;
                connection def D2 :> A { end part p :>> a; end part q :>> b; }
                connection def D3 :> A { end part p :>> a; }
                abstract connection def D4 :> A { end part p :>> b; }
                flow def G1 :> A;
            }`,
        [
            "validateConnectionDefinitionEndsAreUsages_ @ abstract connection def B1 :> Links::BinaryLink;",
            "validateFlowDefinitionEndsAreUsages_ @ abstract flow def B2 :> Links::BinaryLink;",
            "validateConnectionDefinitionEndsAreUsages_ @ connection def D1 :> A;",
            "validateConnectionDefinitionEndsAreUsages_ @ connection def D3 :> A { end part p :>> a; }",
            "validateFlowDefinitionEndsAreUsages_ @ flow def G1 :> A;",
        ],
    ],
    [
        "FlowUsage_Invalid",
        "sysml",
        `package FlowUsage_Invalid {
                part def A;
                abstract flow def F;
                abstract flow def G;
                abstract flow def H { end a; }
                flow def I :> H { end a; end b; end c; }
                flow def J :> I;
                part apart : A {
                    part b;
                    part c;
                    message : F from b to c;
                    message : F, G from b to c;
                    message :A from b to c;
                    message :apart from b to c;
                }
            }`,
        [
            "validateFlowDefinitionConnectionEnds @ end c;",
            "validateFlowDefinitionConnectionEnds @ flow def J :> I;",
            "validateFlowUsageTyping @ message :A from b to c;",
            "validateFlowUsageTyping @ message :apart from b to c;",
        ],
    ],
    [
        "Relationship_invalid_relatedElement",
        "sysml",
        `package Relationship_invalid_relatedElement {
                part def X;
                connection def C1 { end part a : X; end part b : X; }
                port def Pt;
                interface def I1 { end port a : Pt; end port b : Pt; }
                part v {
                    part b0;
                    part b1;
                    port p0 : Pt;
                    port p1 : Pt;
                    connection { end ::> b0; }
                    abstract connection { end ::> b0; }
                    connection c1 : C1 connect b0 to b1;
                    connection c2 = c1;
                    connection c3 : C1;
                    abstract connection c4 = c1;
                    interface i1 : I1 connect p0 to p1;
                    interface i = i1;
                    abstract interface ia = i1;
                }
            }`,
        [
            "validateConnectorRelatedFeatures @ connection { end ::> b0; }",
            "validateConnectorRelatedFeatures @ connection c2 = c1;",
            "validateConnectorRelatedFeatures @ connection c3 : C1;",
            "validateConnectorRelatedFeatures @ interface i = i1;",
        ],
    ],
    [
        "Relationship_invalid_relatedElement1",
        "sysml",
        `package 'Streaming Example' {
                part def A {
                    part def B {
                        out ref myOut;
                    }
                    part def C {
                        in ref myIn;
                    }
                    flow XXX from B::myOut to C::myIn;
                }
            }`,
        [
            "validateFlowEndSubsetting @ B::myOut",
            "validateFlowEndSubsetting @ C::myIn",
            "validateSubsettingFeaturingTypes @ B::myOut",
            "validateSubsettingFeaturingTypes @ C::myIn",
            "validateConnectorRelatedFeatures @ flow XXX from B::myOut to C::myIn;",
        ],
    ],
    [
        "Redefinition_OwningType_Invalid",
        "sysml",
        `package 'Redefinition Example' {
                part wheel : Wheel;
                part wheel1 redefines wheel;
                part def B {
                    alias eng1 for Vehicle::eng;
                }
                part def Vehicle specializes B {
                    part eng : Engine;
                    part smallEng : Engine redefines eng1;
                }
                part def Engine {
                    part cyl : Cylinder[4..6];
                }
                part def Cylinder;
                part def Wheel;
            }`,
        ["validateRedefinitionFeaturingTypes @ wheel", "validateRedefinitionFeaturingTypes @ eng1"],
    ],
    [
        "PortUsage_Invalid",
        "sysml",
        `package 'Port Example' {
                attribute def Vt;
                part def B;
                port def pd1 {
                    port p1 : pd1;
                    ref b1 : B;
                    part b2 : B;
                }
                port def pd2;
                part def FA {
                    port p1 : B;
                    port p2 : Vt;
                    port two_port_def_types: pd1, pd2 {
                        port p2 : pd2;
                        ref b3 : B;
                        part b4 : B;
                    }
                }
                part f: FA {
                    port pp redefines p1;
                }
                port def OutPort {
                    out ref anout;
                    in ref anin;
                }
                part p {
                    port aport : OutPort {
                        in ref redefines anout;
                        out ref redefines anin;
                    }
                }
            }`,
        [
            "validatePortDefinitionOwnedUsagesNotComposite @ part b2 : B;",
            "validatePortUsageTyping @ port p1 : B;",
            "validatePortUsageTyping @ port p2 : Vt;",
            "validatePortUsageNestedUsagesNotComposite @ part b4 : B;",
            "validatePortUsageTyping @ port pp redefines p1;",
            "validateRedefinitionDirectionConformance @ anout",
            "validateRedefinitionDirectionConformance @ anin",
        ],
    ],
    [
        "EnumerationUsage_invalid",
        "sysml",
        `package EnumerationUsage_invalid {
                attribute def A;
                enum def E {a; b; c;}
                enum def EE;
                attribute a1 : E;
                attribute a2 : E, A;
                attribute a3 : E, EE;
                enum e1 : E;
                enum e2 : A;
                enum e3 : E, EE;
            }`,
        [
            "validateAttributeUsageEnumerationType_ @ attribute a2 : E, A;",
            "validateAttributeUsageEnumerationType_ @ attribute a3 : E, EE;",
            "validateEnumerationUsageTyping @ enum e2 : A;",
            "validateEnumerationUsageTyping @ enum e3 : E, EE;",
        ],
    ],
    [
        "UsageDefinition_invalid",
        "sysml",
        `package UsageDefinition_invalid {
                attribute def A;
                attribute a;
                ref a1 : a, A;
                ref a2 : a;
                attribute a3 : a;
                item def I;
                item i;
                ref i1 : i, I;
                ref i2 : i;
                item i3 : i;
                part def P;
                part p;
                ref p1 : p, P;
                ref p2 : p;
                part p3 : p;
                action def Ac;
                action ac;
                ref ac1 : ac, Ac;
                ref ac2 : ac;
                action ac3 : ac;
            }`,
        [
            "validateUsageType_ @ ref a1 : a, A;",
            "validateUsageType_ @ ref a2 : a;",
            "validateAttributeUsageTyping @ attribute a3 : a;",
            "validateUsageType_ @ ref i1 : i, I;",
            "validateUsageType_ @ ref i2 : i;",
            "validateOccurrenceUsageTyping @ item i3 : i;",
            "validateUsageType_ @ ref p1 : p, P;",
            "validateUsageType_ @ ref p2 : p;",
            "validateOccurrenceUsageTyping @ part p3 : p;",
            "validateUsageType_ @ ref ac1 : ac, Ac;",
            "validateUsageType_ @ ref ac2 : ac;",
            "validateActionUsageTyping @ action ac3 : ac;",
        ],
    ],
    [
        "Feature_variable_invalid",
        "kerml",
        `package Feature_variable_invalid {
            class C {
                var feature x;
                portion var feature y;
            }
            datatype D {
                var feature z;
            }
        }`,
        [
            "validateFeaturePortionNotVariable @ portion var feature y;",
            "validateFeatureIsVariable @ var feature z;",
        ],
    ],
    [
        "ReferenceSubsetting_Invalid",
        "kerml",
        `package ReferenceSubsetting_invalid {
            feature a;
            feature b references a;
            feature c references a subsets b;
            feature d references b references c;
            connector cc {
                end x ::> a;
                end y ::> b ::> c ::> d;
            }
        }`,
        [
            "validateFeatureOwnedReferenceSubsetting @ c",
            "validateFeatureOwnedReferenceSubsetting @ c",
            "validateFeatureOwnedReferenceSubsetting @ d",
        ],
    ],
    [
        "Type_Multiplicity_invalid",
        "kerml",
        `package Type_Multiplicity {
            classifier C {
                multiplicity subsets Base::zeroOrOne;
                multiplicity subsets Base::zeroToMany;
            }
        }`,
        ["validateTypeOwnedMultiplicity @ multiplicity subsets Base::zeroToMany;"],
    ],
    [
        "Subsetting_constant_invalid",
        "kerml",
        `package Subsetting_constant_invalid {
            class A {
                const feature f;
                var feature g :> f;
            }
            class B :> A {
                var feature h :>> f;
                var feature i :> g;
            }
        }`,
        ["validateSubsettingConstantConformance @ f", "validateSubsettingConstantConformance @ f"],
    ],
    [
        "Variable",
        "sysml",
        `package Variable {
                private import ScalarValues::Integer;
                constant attribute k0 : Integer = 0;
                attribute g0 : Integer := 0;
                attribute def D {
                    constant attribute k1 : Integer = 1;
                    attribute x1 : Integer := 1;
                }
                part def P {
                    constant attribute k2 : Integer = 2;
                    attribute x2 : Integer := 2;
                    attribute s2 : Integer :> k2;
                    part q { attribute :>> k2; }
                }
            }`,
        [
            "validateFeatureConstantIsVariable @ constant attribute k0 : Integer = 0;",
            "validateFeatureValueIsInitial @ := 0",
            "validateFeatureConstantIsVariable @ constant attribute k1 : Integer = 1;",
            "validateFeatureValueIsInitial @ := 1",
            "validateSubsettingConstantConformance @ k2",
            "validateSubsettingConstantConformance @ k2",
        ],
    ],
    [
        "VariableK",
        "kerml",
        `package VariableK {
                var feature v0;
                datatype D { var feature v1; const feature c1; }
                class C { var feature v2; const feature c2; portion var feature pv; }
                struct S { const feature c3; feature f3 subsets c3; var feature f4 subsets c3; }
                class K { feature x := 1; }
            }`,
        [
            "validateFeatureIsVariable @ var feature v0;",
            "validateFeatureIsVariable @ var feature v1;",
            "validateFeatureIsVariable @ const feature c1;",
            "validateFeaturePortionNotVariable @ portion var feature pv;",
            "validateSubsettingConstantConformance @ c3",
            "validateFeatureValueIsInitial @ := 1",
        ],
    ],
    [
        "IndividualUsage_Valid",
        "sysml",
        `package IndividualUsage_Valid {
                part def Vehicle;
                part def Wheel;
                individual def Vehicle_1 :> Vehicle {
                    part leftFrontWheel : Wheel;
                    part rightFrontWheel : Wheel;
                }
                individual def Wheel_1 :> Wheel;
                individual vehicle_1 : Vehicle_1 {
                    snapshot vehicle_1_t0 {
                        individual leftFrontWheel_t0 : Wheel_1 :>> leftFrontWheel;
                    }
                    timeslice vehicle_1_t1 {
                        individual rightFrontWheel_t1 : Wheel_1 :>> rightFrontWheel;
                    }
                    first vehicle_1_t0 then vehicle_1_t1;
                }
            }`,
        [],
    ],
    [
        "IndividualPortion",
        "sysml",
        `package IndividualPortion {
                individual occurrence def Ind {
                    individual snapshot s;
                    individual timeslice t : Ind;
                }
            }`,
        ["validateOccurrenceUsageIndividualUsage @ individual snapshot s;"],
    ],
    [
        "TransitionUsage_invalid",
        "sysml",
        `package TransitionUsage_invalid {
                state def S1 parallel {
                    state S1_1;
                    then S1_2;
                    state S1_2;
                }
                item def A;
                state def S2 {
                    entry action init;
                    transition init accept A then S2_1;
                    state S2_1;
                    transition
                        first S2_1
                        if "test"
                        then S2_2;
                    state S2_2;
                }
                state s1 parallel {
                    state s1_1;
                    then s1_2;
                    state s1_2;
                }
            }`,
        [
            "validateStateDefinitionParallelSubactions @ then S1_2;",
            "validateTransitionUsageTriggerActions @ accept A",
            'validateTransitionFeatureMembershipGuardExpression @ "test"',
            "validateStateUsageParallelSubactions @ then s1_2;",
        ],
    ],
    [
        "Redefinition_DirectionConformance_invalid",
        "kerml",
        `package Redefinition_DirectionConformance {
                behavior A {
                    in x;
                    inout y;
                    composite step b : B {
                        in x1;
                    }
                }
                behavior B specializes A {
                    out x1;
                    out y1;
                }
                class C {
                    in z;
                }
                class D specializes C {
                    out :>> z;
                }
                feature d : D {
                    in :>> z;
                }
                class C1 conjugates C;
                class D1 specializes C1 {
                    in :>> z;
                }
            }`,
        [
            "validateRedefinitionDirectionConformance @ in x1;",
            "validateRedefinitionDirectionConformance @ out x1;",
            "validateRedefinitionDirectionConformance @ z",
            "validateRedefinitionDirectionConformance @ z",
            "validateRedefinitionDirectionConformance @ z",
        ],
    ],
    [
        "InvocationExpression_instantiatedType",
        "sysml",
        `package InvocationExpression_instantiatedType {
                part def P;
                calc def C { in x; return; }
                calc c : C;
                part p : P;
                ref r1 = P();
                ref r2 = C(1);
                ref r3 = c(1);
                ref r4 = p(1);
                ref r5 = new P();
                ref r6 = 1 + 2;
            }`,
        [
            "validateInvocationExpressionInstantiatedType @ P()",
            "validateInvocationExpressionInstantiatedType @ p(1)",
        ],
    ],
    [
        "TimeVaryingCarDriver",
        "kerml",
        `package TimeVaryingCarDriver {
                private import ScalarValues::*;
                struct Person1_ {
                    member feature isLicensed : Boolean [1] featured by Person_snapshots {
                        member feature Person_snapshots :>> Occurrences::Occurrence::snapshots featured by Person1_;
                    }
                    member feature name : String [1] featured by Person_snapshots {
                        member feature Person_snapshots :>> Occurrences::Occurrence::snapshots featured by Person1_;
                    }
                }
                struct Car1_ {
                    member feature driver : Person1_ [0..1] featured by Car_snapshots {
                        member feature Car_snapshots :>> Occurrences::Occurrence::snapshots featured by Car1_;
                    }
                    portion :>> startShot {
                        member feature :>> Car1_::driver [0] featured by Car_startShot_snapshots {
                            member feature Car_startShot_snapshots :>> Car_snapshots featured by Car1_::startShot;
                        }
                    }
                    succession first startShot then operated;
                    portion operated [0..*] :> timeSlices {
                        member feature :>> Car1_::driver [1] featured by Car_operated_snapshots {
                            member feature Car_operated_snapshots :>> Car_snapshots featured by Car1_::operated;
                            member feature isLicensed1 :>> Person1_::isLicensed featured by Car_operated_driver_snapshots = true {
                                member feature Car_operated_driver_snapshots :>> Occurrences::Occurrence::snapshots featured by Car1_::operated::driver;
                            }
                        }
                    }
                    member abstract feature carParts [0..*] featured by Car_snapshots {
                        member feature Car_snapshots :>> Occurrences::Occurrence::snapshots featured by Car1_;
                    }
                    member feature engine [1] :> carParts featured by Car_snapshots1 {
                        member feature Car_snapshots1 :>> Occurrences::Occurrence::snapshots featured by Car1_;
                    }
                    member feature transmission [1] :> carParts featured by Car_snapshots1 {
                        member feature Car_snapshots1 :>> Occurrences::Occurrence::snapshots featured by Car1_;
                    }
                    member connector drive featured by Car_snapshots from engine to transmission {
                        member feature Car_snapshots :>> Occurrences::Occurrence::snapshots featured by Car1_;
                    }
                }
            }`,
        [],
    ],
    [
        "VariableSnapshotFeaturing",
        "kerml",
        `package VariableSnapshotFeaturing {
                struct Car {
                    var feature engine;
                    var feature transmission;
                    member connector drive featured by snap from engine to transmission {
                        member feature snap :>> Occurrences::Occurrence::snapshots featured by Car;
                    }
                }
                struct Other {
                    member connector bad featured by snap from Car::engine to Car::transmission {
                        member feature snap :>> Occurrences::Occurrence::snapshots featured by Other;
                    }
                }
            }`,
        [
            "validateSubsettingFeaturingTypes @ Car::engine",
            "validateSubsettingFeaturingTypes @ Car::transmission",
        ],
    ],
];

describe("validation against the standard library", () => {
    let shared: SysMLSharedServices;
    let count = 0;

    beforeAll(async () => {
        ({ shared } = await setupServicesWithStdlib());
        await build(ENDS_K, "kerml");
    }, 180_000);

    async function build(text: string, ext = "sysml"): Promise<LangiumDocument<Namespace>> {
        const doc = shared.workspace.LangiumDocumentFactory.fromString<Namespace>(
            text,
            URI.parse(`file:///tmp/stdlib-validation-${count++}.${ext}`)
        );
        shared.workspace.LangiumDocuments.addDocument(doc);
        await shared.workspace.DocumentBuilder.build([doc], <SysMLBuildOptions>{
            validation: { categories: ["built-in", "fast"] },
            standalone: false,
        });
        return doc;
    }

    function find<T extends TypeMeta>(doc: LangiumDocument<Namespace>, name: string): T {
        const element = streamModel(doc.parseResult.value.$meta).find(
            (e) => e.is(Type.$type) && e.qualifiedName === name
        );
        expect(element, name).toBeDefined();
        return element as T;
    }

    it.each(PROBES)("%s reports as in the pilot", async (_, ext, text, expected) => {
        const doc = await build(text, ext);
        const errors = (doc.diagnostics ?? []).filter(
            (d) => d.code !== undefined && d.severity === DiagnosticSeverity.Error
        );
        expect(
            errors.map((d) => `${d.code} @ ${doc.textDocument.getText(d.range)}`).sort()
        ).toEqual([...expected].sort());
    });

    describe("time-varying end usages", () => {
        const text = `package EndConst {
    part def A;
    connection def C {
        end part a : A;
        end part b : A;
    }
    part def P {
        part x : A;
        part y : A;
        connection c : C connect x to y;
        binding bc bind x = y;
        connection c2 : C {
            part s :> a;
        }
    }
}
`;
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(text);
        });

        it("are constant", () => {
            const end = find<UsageMeta>(doc, "EndConst::C::a");
            expect(end.isConstant).toBe(true);
            expect(end.isConstantExplicitly).toBe(false);
            const ends = find<ConnectorMeta>(doc, "EndConst::P::c").connectorEnds();
            expect(ends.map((e) => e.isConstant)).toEqual([true, true]);
        });

        it("are not constant if they cannot vary", () => {
            const ends = find<ConnectorMeta>(doc, "EndConst::P::bc").connectorEnds();
            expect(ends.map((e) => e.isConstant)).toEqual([false, false]);
        });

        it("must be subsetted by constant features", () => {
            expect(
                (doc.diagnostics ?? [])
                    .filter((d) => d.code === "validateSubsettingConstantConformance")
                    .map((d) => d.range.start.line + 1)
            ).toEqual([13]);
        });

        it("print without the derived constant", () => {
            expect(
                print(printModelElement(doc.parseResult.value.$meta, defaultSysMLPrinterContext()))
            ).toEqual(text);
        });
    });
});
