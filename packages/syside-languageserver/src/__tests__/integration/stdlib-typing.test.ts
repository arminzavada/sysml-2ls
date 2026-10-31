import { beforeAll, describe, expect, it } from "vitest";
import { URI } from "vscode-uri";
import type { LangiumDocument } from "langium";
import { Namespace, Redefinition, Type } from "#generated/ast.js";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import type {
    ConcernUsageMeta,
    FeatureMeta,
    FlowUsageMeta,
    TypeMeta,
    UsageMeta,
} from "../../model/index.js";
import { streamModel } from "../../utils/ast-util.js";
import { setupServicesWithStdlib } from "./stdlib-fixture.js";

describe("implicit typing against the standard library", () => {
    let shared: SysMLSharedServices;
    let count = 0;

    beforeAll(async () => {
        ({ shared } = await setupServicesWithStdlib());
    }, 180_000);

    async function build(text: string, ext = "sysml"): Promise<LangiumDocument<Namespace>> {
        const doc = shared.workspace.LangiumDocumentFactory.fromString<Namespace>(
            text,
            URI.parse(`file:///tmp/stdlib-typing-${count++}.${ext}`)
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

    function implied(type: TypeMeta): (string | undefined)[] {
        return type
            .specializations()
            .filter((s) => s.isImplied)
            .map((s) => s.element()?.qualifiedName)
            .sort();
    }

    function codes(doc: LangiumDocument): unknown[] {
        return (doc.diagnostics ?? []).map((d) => d.code);
    }

    describe("compositeness", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package C {
                attribute def AD { part p; item i; action a; constraint c { true } }
                attribute av { part p; }
                part def PD { attribute atr { part p; } part q; variation part v { variant part r; } }
                variation part def VD { variant part s; }
                variation part v2 { variant part r; }
                attribute def AtD { variation part v { variant part r; } }
                action def AcD { variation action v { variant action r; } }
                requirement def RD { variation requirement v { variant requirement r; } }
                port def PoD { variation port v { variant port r; } }
            }`);
        });

        it.each(["C::AD::p", "C::AD::i", "C::AD::a", "C::AD::c", "C::av::p", "C::PD::atr::p"])(
            "%s featured by an attribute is referential",
            (name) => {
                expect(find<UsageMeta>(doc, name).isComposite).toBe(false);
            }
        );

        it("attribute-featured usages keep their base supertype", () => {
            expect(find<UsageMeta>(doc, "C::PD::q").isComposite).toBe(true);
            expect(implied(find(doc, "C::AD::p"))).toEqual(["Parts::parts"]);
        });

        it.each([
            ["C::PD::v::r", true],
            ["C::VD::s", false],
            ["C::v2::r", false],
            ["C::AtD::v::r", false],
        ])(
            "variant %s takes the featuring type of its variation (composite: %s)",
            (name, expected) => {
                expect(find<UsageMeta>(doc, name).isComposite).toBe(expected);
            }
        );

        it("composite variants get no owner-dependent supertypes", () => {
            expect(implied(find(doc, "C::PD::v::r"))).toEqual(["C::PD::v", "Parts::parts"]);
            for (const name of ["C::AcD::v::r", "C::RD::v::r"]) {
                expect(find<UsageMeta>(doc, name).isComposite, name).toBe(true);
                const supertypes = implied(find(doc, name));
                expect(supertypes).not.toContain("Actions::Action::subactions");
                expect(supertypes).not.toContain("Performances::Performance::subperformances");
                expect(supertypes).not.toContain("Requirements::RequirementCheck::subrequirements");
            }
        });

        it("a composite variant port has no owning type, so it must be referential", () => {
            expect(find<UsageMeta>(doc, "C::PoD::v::r").isComposite).toBe(true);
            expect(codes(doc)).toContain("validatePortUsageIsReference");
        });
    });

    describe("variants", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package V {
                part def P {
                    variation action va { variant action r; }
                    variation occurrence vo { variant event occurrence ve; }
                    state st {
                        state s1;
                        ref state s2;
                        variation state vs { variant state s3; }
                    }
                    state ps parallel { state s4; }
                }
                view def VW {
                    variation view vv { variant view sv; }
                    variation viewpoint vvp { variant viewpoint svp; }
                }
                rendering def RW { variation rendering vr { variant rendering sr; } }
            }`);
        });

        it.each([
            ["V::P::va::r", ["Actions::actions", "V::P::va"]],
            ["V::P::vo::ve", ["Occurrences::occurrences", "V::P::vo"]],
            ["V::P::st::vs::s3", ["States::stateActions", "V::P::st::vs"]],
            ["V::VW::vv::sv", ["V::VW::vv", "Views::views"]],
            ["V::VW::vvp::svp", ["V::VW::vvp", "Views::viewpointChecks"]],
            ["V::RW::vr::sr", ["V::RW::vr", "Views::renderings"]],
        ])("variant %s gets no owner-dependent supertypes", (name, expected) => {
            expect(implied(find(doc, name))).toEqual(expected);
        });

        it("only composite states are exclusive states", () => {
            expect(implied(find(doc, "V::P::st::s1"))).toContain(
                "States::StateAction::exclusiveStates"
            );
            expect(implied(find(doc, "V::P::st::s2"))).not.toContain(
                "States::StateAction::exclusiveStates"
            );
            expect(implied(find(doc, "V::P::ps::s4"))).toContain("States::StateAction::substates");
        });
    });

    describe("connection and flow compositeness", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package T3 {
                item def X;
                port def Q;
                part def A { out item o : X; in item i : X; port q : Q; }
                connection def C { end a : A; end b : A; }
                part a1 : A;
                part a2 : A;
                connection pc connect a1 to a2;
                part def S {
                    part sa : A;
                    part sb : A;
                    connection c connect sa to sb;
                    connection ct : C connect sa to sb;
                    ref connection rc connect sa to sb;
                    interface ifc connect sa.q to sb.q;
                    allocation al allocate sa to sb;
                    flow f of X from sa.o to sb.i;
                    message m of X;
                    ref flow rf of X from sa.o to sb.i;
                    binding bc bind sa = sb;
                    succession s first sa then sb;
                }
                action def AD {
                    action b1 { out x : X; }
                    action b2 { in y : X; }
                    flow af from b1.x to b2.y;
                }
                occurrence def OD { part p : A; part q : A; connection oc connect p to q; }
            }`);
        });

        it.each([
            ["T3::S::c", true],
            ["T3::S::ct", true],
            ["T3::S::ifc", true],
            ["T3::S::al", true],
            ["T3::S::f", true],
            ["T3::S::m", true],
            ["T3::AD::af", true],
            ["T3::OD::oc", true],
            ["T3::pc", false],
            ["T3::S::rc", false],
            ["T3::S::rf", false],
            ["T3::S::bc", false],
            ["T3::S::s", false],
        ])("%s isComposite is %s", (name, expected) => {
            expect(find<UsageMeta>(doc, name).isComposite).toBe(expected);
        });

        it.each([
            ["T3::pc", ["Connections::binaryConnections"]],
            ["T3::S::c", ["Connections::binaryConnections", "Items::Item::subparts"]],
            [
                "T3::S::ct",
                ["Connections::binaryConnections", "Items::Item::subparts", "Objects::objects"],
            ],
            ["T3::S::rc", ["Connections::binaryConnections"]],
            ["T3::S::ifc", ["Interfaces::binaryInterfaces", "Items::Item::subparts"]],
            ["T3::S::al", ["Allocations::allocations", "Items::Item::subparts"]],
            [
                "T3::S::f",
                [
                    "Flows::flows",
                    "Objects::Object::ownedPerformances",
                    "Occurrences::Occurrence::suboccurrences",
                    "Parts::Part::ownedActions",
                ],
            ],
            [
                "T3::S::m",
                [
                    "Flows::messages",
                    "Objects::Object::ownedPerformances",
                    "Occurrences::Occurrence::suboccurrences",
                    "Parts::Part::ownedActions",
                ],
            ],
            ["T3::S::rf", ["Flows::flows"]],
            [
                "T3::AD::af",
                [
                    "Actions::Action::subactions",
                    "Flows::flows",
                    "Occurrences::Occurrence::suboccurrences",
                    "Performances::Performance::subperformances",
                ],
            ],
            [
                "T3::OD::oc",
                ["Connections::binaryConnections", "Occurrences::Occurrence::suboccurrences"],
            ],
        ])("%s implicitly specializes %s", (name, expected) => {
            expect(implied(find(doc, name))).toEqual([...expected].sort());
        });

        it("a composite flow is not time-varying", () => {
            expect(find<UsageMeta>(doc, "T3::S::f").isVariable).toBe(false);
            expect(find<UsageMeta>(doc, "T3::S::rf").isVariable).toBe(true);
            expect(find<UsageMeta>(doc, "T3::S::c").isVariable).toBe(true);
        });
    });

    describe("occurrence usages", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package Obj {
                part def P;
                occurrence def O;
                attribute def D;
                part p : P;
                occurrence o : P;
                occurrence od : D;
                part def S {
                    part sp : P;
                    occurrence so : P;
                    occurrence sd : O;
                    view v;
                    rendering r;
                }
                occurrence def OD { part odp : P; part odq; }
                occurrence ou { occurrence ouo; part oup : P; }
                item def I { occurrence io : P; }
            }`);
        });

        it.each([
            ["Obj::p", ["Objects::objects", "Parts::parts"]],
            ["Obj::o", ["Objects::objects", "Occurrences::occurrences"]],
            ["Obj::od", ["Base::dataValues", "Occurrences::occurrences"]],
            ["Obj::S::sp", ["Items::Item::subparts", "Objects::objects"]],
            ["Obj::S::so", ["Objects::Object::subobjects", "Occurrences::occurrences"]],
            ["Obj::S::sd", ["Occurrences::Occurrence::suboccurrences", "Occurrences::occurrences"]],
            ["Obj::S::v", ["Items::Item::subparts", "Views::views"]],
            ["Obj::S::r", ["Items::Item::subparts", "Views::renderings"]],
            ["Obj::OD::odp", ["Objects::objects", "Parts::parts"]],
            ["Obj::OD::odq", ["Occurrences::Occurrence::suboccurrences", "Parts::parts"]],
            [
                "Obj::ou::ouo",
                ["Occurrences::Occurrence::suboccurrences", "Occurrences::occurrences"],
            ],
            ["Obj::ou::oup", ["Objects::objects", "Parts::parts"]],
            ["Obj::I::io", ["Objects::Object::subobjects", "Occurrences::occurrences"]],
        ])("%s implicitly specializes %s", (name, expected) => {
            expect(implied(find(doc, name))).toEqual([...expected].sort());
        });
    });

    describe("portion usages", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package Po {
                private import ScalarValues::Integer;
                part def P {
                    attribute a : Integer;
                    snapshot s { attribute :>> a; }
                    timeslice part t;
                }
                occurrence def O { attribute oa : Integer; }
                occurrence o : O { timeslice ot; }
                attribute x = o.ot.oa;
            }`);
        });

        it.each([
            [
                "Po::P::s",
                [
                    "Occurrences::Occurrence::snapshots",
                    "Occurrences::Occurrence::suboccurrences",
                    "Occurrences::occurrences",
                ],
            ],
            ["Po::P::t", ["Items::Item::subparts", "Occurrences::Occurrence::timeSlices"]],
            [
                "Po::o::ot",
                [
                    "Occurrences::Occurrence::suboccurrences",
                    "Occurrences::Occurrence::timeSlices",
                    "Occurrences::occurrences",
                ],
            ],
        ])("%s is not typed by its owner", (name, expected) => {
            expect(implied(find(doc, name))).toEqual(expected);
        });

        it("a redefinition in a portion still finds the owner's feature", () => {
            const a = find<FeatureMeta>(doc, "Po::P::s::a");
            expect(a.types(Redefinition.$type).head()?.qualifiedName).toBe("Po::P::a");
        });

        it("owner features are not members of a portion", () => {
            expect((doc.diagnostics ?? []).map((d) => d.message)).toContain(
                "Could not resolve reference to Feature named 'oa'."
            );
        });
    });

    describe("default supertypes by owned ends", () => {
        let doc: LangiumDocument<Namespace>;
        let kerml: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package Ends {
                part def A;
                connection def C { end a : A; end b : A; }
                connection def C2 :> C;
                connection c : C;
            }`);
            kerml = await build(
                `package EndsK2 {
                    class A;
                    assoc As1 { end feature a : A; end feature b : A; }
                    assoc As2 specializes As1;
                    connector k : As1;
                }`,
                "kerml"
            );
        });

        it.each([
            ["Ends::C", ["Connections::BinaryConnection"]],
            ["Ends::C2", ["Connections::Connection"]],
            ["Ends::c", ["Connections::connections", "Objects::objects"]],
        ])("%s implicitly specializes %s", (name, expected) => {
            expect(implied(find(doc, name))).toEqual(expected);
        });

        it.each([
            ["EndsK2::As2", ["Links::Link"]],
            ["EndsK2::k", ["Links::links"]],
        ])("%s implicitly specializes %s", (name, expected) => {
            expect(implied(find(kerml, name))).toEqual(expected);
        });
    });

    describe("default supertypes by owned typings", () => {
        let doc: LangiumDocument<Namespace>;
        let kerml: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package Dt {
                part def Pt;
                part pt : Pt;
                attribute def Ad;
                attribute ad : Ad;
                metadata def <pk> PkMeta :> Metaobjects::SemanticMetadata {
                    :>> baseType = pt meta SysML::Usage;
                }
                part def Owner {
                    ref r1 :> pt;
                    ref r2 : Pt;
                    ref r3 :> ad;
                    attribute a :> pt;
                }
                #pk u;
            }`);
            kerml = await build(
                `package Dk {
                    struct S;
                    class C;
                    assoc struct As { end feature a; end feature b; }
                    feature s : S;
                    feature c : C;
                    struct Owner {
                        composite feature f1 :> s;
                        feature f2 :> c;
                        feature ts : S { composite feature n1 : C; }
                        feature ss :> s { composite feature n2 : C; }
                        connector k1 : As from f1 to f2;
                        connector k2 subsets k1 from f1 to f2;
                    }
                    class K { portion feature p : C; feature x { portion feature q : C; } }
                }`,
                "kerml"
            );
        });

        it.each([
            ["Dt::Owner::r1", ["Base::things"]],
            ["Dt::Owner::r2", ["Objects::objects"]],
            ["Dt::Owner::r3", ["Base::things"]],
            ["Dt::Owner::a", ["Base::dataValues"]],
            ["Dt::u", ["Base::things", "Dt::pt"]],
        ])("%s implicitly specializes %s", (name, expected) => {
            expect(implied(find(doc, name))).toEqual(expected);
        });

        it.each([
            ["Dk::Owner::f1", ["Base::things"]],
            ["Dk::Owner::f2", ["Base::things"]],
            ["Dk::Owner::ts::n1", ["Occurrences::Occurrence::suboccurrences"]],
            ["Dk::Owner::ss::n2", ["Occurrences::occurrences"]],
            ["Dk::Owner::k1", ["Objects::binaryLinkObjects"]],
            ["Dk::Owner::k2", ["Links::binaryLinks"]],
            ["Dk::K::p", ["Occurrences::Occurrence::portions"]],
            ["Dk::K::x::q", ["Occurrences::occurrences"]],
        ])("%s implicitly specializes %s", (name, expected) => {
            expect(implied(find(kerml, name))).toEqual(expected);
        });
    });

    describe("requirements", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package R {
                concern def CD;
                concern cc : CD;
                requirement def RD { frame concern c1; frame cc; concern c2; requirement r; }
                verification def VD { objective { verify requirement vr; } }
            }`);
        });

        it.each(["R::RD::c1", "R::RD::cc"])("framed concern %s is not a subrequirement", (name) => {
            const concern = find<ConcernUsageMeta>(doc, name);
            expect(concern.isSubrequirement()).toBe(false);
            expect(implied(concern)).toContain("Requirements::RequirementCheck::concerns");
            expect(implied(concern)).not.toContain(
                "Requirements::RequirementCheck::subrequirements"
            );
        });

        it("a verified requirement is not a subrequirement", () => {
            const vr = find(doc, "R::VD::obj")
                .ownedFeatures()
                .find((f) => f.name === "vr");
            expect(vr).toBeDefined();
            const supertypes = implied(vr as TypeMeta);
            expect(supertypes).toContain(
                "VerificationCases::VerificationCase::obj::requirementVerifications"
            );
            expect(supertypes).not.toContain("Requirements::RequirementCheck::subrequirements");
        });

        it.each(["R::RD::c2", "R::RD::r"])("%s is a subrequirement", (name) => {
            expect(implied(find(doc, name))).toContain(
                "Requirements::RequirementCheck::subrequirements"
            );
        });
    });

    describe("ports", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package P {
                port def Q;
                port def PD { port sub; port typed : Q; ref port r : Q; }
                part def Pp { port p : Q; port q; timeslice port ts : Q; }
                part pu { port p : Q; }
                port pp : Q { port n : Q; }
            }`);
        });

        it.each([
            ["P::Pp::p", ["Parts::Part::ownedPorts", "Objects::objects"]],
            ["P::Pp::q", ["Parts::Part::ownedPorts"]],
            [
                "P::Pp::ts",
                [
                    "Parts::Part::ownedPorts",
                    "Occurrences::Occurrence::timeSlices",
                    "Objects::objects",
                ],
            ],
            ["P::pu::p", ["Parts::Part::ownedPorts", "Objects::objects"]],
            ["P::pp", ["Ports::ports", "Objects::objects"]],
            ["P::pp::n", ["Ports::Port::subports", "Objects::Object::subobjects"]],
            [
                "P::PD::sub",
                [
                    "Ports::Port::subports",
                    "Occurrences::Occurrence::suboccurrences",
                    "Objects::Object::subobjects",
                ],
            ],
            ["P::PD::typed", ["Ports::Port::subports", "Objects::Object::subobjects"]],
            ["P::PD::r", ["Ports::ports", "Objects::objects"]],
        ])("%s implicitly specializes %s", (name, expected) => {
            expect(implied(find(doc, name))).toEqual([...expected].sort());
        });
    });

    describe("flows", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package F {
                item def X;
                part def A { out item o : X; in item i : X; event occurrence e; }
                part a : A;
                part b : A;
                part def S {
                    message m1 of X;
                    message m2 of X from a.e to b.e;
                    flow f1 of X;
                    flow f2 of X from a.o to b.i;
                    succession flow sf of X;
                }
                abstract flow def F0;
                flow def F2 { end a : A; end b : A; }
                flow def F3 { end a : A; end b : A; end c : A; }
            }`);
        });

        it.each(["F::S::m1", "F::S::m2", "F::S::f1"])(
            "%s without ends is an abstract message",
            (name) => {
                const flow = find<FlowUsageMeta>(doc, name);
                expect(implied(flow)).toContain("Flows::messages");
                expect(implied(flow)).not.toContain("Flows::flows");
                expect(flow.isAbstract).toBe(true);
                expect(flow.isAbstractExplicitly).toBe(false);
            }
        );

        it("a flow with ends is a concrete flow", () => {
            const flow = find<FlowUsageMeta>(doc, "F::S::f2");
            expect(implied(flow)).toContain("Flows::flows");
            expect(flow.isAbstract).toBe(false);
        });

        it("a succession flow without ends is abstract", () => {
            expect(find<FlowUsageMeta>(doc, "F::S::sf").isAbstract).toBe(true);
        });

        it.each([
            ["F::S::f2::source", "Flows::flows::source"],
            ["F::S::f2::target", "Flows::flows::target"],
        ])("flow end %s has no default supertype", (name, expected) => {
            expect(implied(find(doc, name))).toEqual([expected]);
        });

        it("a flow end without dot notation cannot be identified", async () => {
            const ends = await build(`package F5 {
                part def A {
                    part def B { out ref myOut; }
                    part def C { in ref myIn; }
                    flow XXX from B::myOut to C::myIn;
                }
            }`);
            expect(codes(ends).filter((c) => c === "validateFlowEndSubsetting")).toHaveLength(2);
        });

        it.each([
            ["F::F0", "Flows::MessageAction"],
            ["F::F2", "Flows::Message"],
            ["F::F3", "Flows::MessageAction"],
        ])("%s implicitly specializes %s", (name, expected) => {
            expect(implied(find(doc, name))).toEqual([expected]);
        });

        it("a flow def with more than two ends is not a binary association", () => {
            expect(codes(doc)).not.toContain("validateAssociationBinarySpecialization");
        });

        it("a concrete flow def without ends has too few related types", async () => {
            expect(codes(await build(`package F4 { flow def F; }`))).toContain(
                "validateAssociationRelatedTypes"
            );
        });
    });

    describe("time-varying usages", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package T {
                private import ScalarValues::Integer;
                attribute def D { attribute x : Integer; }
                attribute g : Integer;
                part def P {
                    attribute y : Integer;
                    constant attribute k : Integer = 0;
                    attribute d : D { attribute :>> x; }
                    part sp;
                    action act;
                    ref action ract;
                    snapshot part snap;
                    action a1;
                    action a2;
                    succession s first a1 then a2;
                    binding bc bind y = y;
                }
            }`);
        });

        it.each([
            ["T::P::y", true],
            ["T::P::k", true],
            ["T::P::sp", true],
            ["T::P::ract", true],
            ["T::P::act", false],
            ["T::P::snap", false],
            ["T::P::d::x", false],
            ["T::D::x", false],
            ["T::g", false],
            ["T::P::s", false],
            ["T::P::bc", false],
        ])("%s isVariable is %s", (name, expected) => {
            expect(find<UsageMeta>(doc, name).isVariable).toBe(expected);
        });
    });

    describe("semantic metadata", () => {
        let doc: LangiumDocument<Namespace>;

        beforeAll(async () => {
            doc = await build(`package M {
                private import Metaobjects::SemanticMetadata;
                port def Interface;
                port interfaces : Interface;
                metadata def <service> ServiceMetadata :> SemanticMetadata {
                    :>> baseType default interfaces meta SysML::PortUsage;
                }
                metadata def <iface> InterfaceMetadata :> SemanticMetadata {
                    :>> baseType default Interface meta SysML::PortDefinition;
                }
                #service def Service;
                #service port s;
                #iface port i;
            }`);
        });

        it("a classifier specializes the types of a feature base type", () => {
            const supertypes = implied(find(doc, "M::Service"));
            expect(supertypes).toContain("M::Interface");
            expect(supertypes).not.toContain("M::interfaces");
        });

        it("a feature subsets a feature base type", () => {
            expect(implied(find(doc, "M::s"))).toContain("M::interfaces");
        });

        it("a feature ignores a classifier base type", () => {
            expect(implied(find(doc, "M::i"))).not.toContain("M::Interface");
        });
    });
});
