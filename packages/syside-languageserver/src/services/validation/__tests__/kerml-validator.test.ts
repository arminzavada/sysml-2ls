/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { vi, Assertion } from "vitest";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import {
    emptyDocument,
    parseKerML,
    ParseOptions,
    services,
    TEST_BUILD_OPTIONS,
} from "../../../testing/index.js";
import {
    basicIdProvider,
    EdgeContainer,
    ElementMeta,
    ExpressionMeta,
    FeatureMembershipMeta,
    FeatureMeta,
    FunctionMeta,
    ItemFeatureMeta,
    ItemFlowEndMeta,
    ItemFlowMeta,
    namespaceChildren,
    NamespaceMeta,
    ParameterMembershipMeta,
    ResultExpressionMembershipMeta,
    ReturnParameterMembershipMeta,
    SpecializationMeta,
    TypeMeta,
} from "../../../model/index.js";
import { ModelDiagnostic } from "../validation-registry.js";
import { SETTINGS_KEY } from "../../shared/index.js";
import { SysMLConfig } from "../../config.js";

const BUILD_OPTIONS: ParseOptions = { ...TEST_BUILD_OPTIONS, validationChecks: "all" };

export function expectValidations(
    text: string,
    code: string | (string | number | undefined)[],
    buildOptions = BUILD_OPTIONS
): Assertion<void, Promise<Diagnostic[]>> {
    return expect(
        parseKerML(text, { ...BUILD_OPTIONS, ...buildOptions }).then((result) => {
            expect(result.parserErrors).toHaveLength(0);
            if (Array.isArray(code)) return result.diagnostics.filter((d) => code.includes(d.code));
            return result.diagnostics.filter((d) => d.code === code);
        })
    );
}

const Validator = services.KerML.validation.KerMLValidator;

export function expectModelValidations(
    root: ElementMeta,
    code: string | (string | number | undefined)[]
): Assertion<void, Promise<ModelDiagnostic[]>> {
    return expect(
        services.KerML.validation.DocumentValidator.validateModel(root, root.document).then(
            (ds) => {
                if (Array.isArray(code)) return ds.filter((d) => code.includes(d.info.code));
                return ds.filter((d) => d.info.code === code);
            }
        )
    );
}

test("non-constructed elements with implied relationships trigger validation", () => {
    const accept = vi.fn();
    const doc = emptyDocument();
    const spec = SpecializationMeta.create(basicIdProvider(), doc, {
        isImplied: true,
    });
    Validator.validateElementIsImpliedIncluded(
        TypeMeta.create(basicIdProvider(), doc, {
            heritage: EdgeContainer.make([spec, TypeMeta.create(basicIdProvider(), doc)]),
        }),
        accept
    );
    expect(accept).toHaveBeenCalledTimes(1);
});

describe("Import", () => {
    test("public top level import trigger validation", async () => {
        return expectValidations(
            "public import A;",
            "validateImportTopLevelVisibility"
        ).resolves.toHaveLength(1);
    });

    test("import without visibility indicator trigger validation", async () => {
        return expectValidations(
            "import A;",
            "validateImportExplicitVisibility"
        ).resolves.toHaveLength(1);
    });
});

describe("Duplicate member names", () => {
    test("duplicate names in the same scope issue a diagnostic", async () => {
        return expectValidations(
            "class A; struct A;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(2);
    });

    test("indentical short and regular names don't trigger validation", async () => {
        return expectValidations(
            "struct <A> A;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(0);
    });

    test("duplicate short names in the same scope issue a diagnostic", async () => {
        return expectValidations(
            "class <A>; struct <A>;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(2);
    });

    test("duplicates names and imports in the same scope issue a diagnostic", async () => {
        return expectValidations(
            "package P { class A; } import P::A; struct <A>;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(2);
    });

    test("recursively importing member doesn't trigger validation", async () => {
        return expectValidations(
            "package P { class A; } import P::**;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(0);
    });

    test("duplicate mixed names in the same scope issue a diagnostic", async () => {
        return expectValidations(
            "class <A>; struct A;",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(2);
    });

    test.fails("duplicate inherited names issue a diagnostic", async () => {
        return expectValidations(
            "class A { class B; } struct B :> A { struct B; }",
            "validateNamespaceDistinguishability"
        ).resolves.toHaveLength(1);
    });
});

test.fails("mixed specializations and conjugations trigger validation", () => {
    return expectValidations(
        "feature A :> B ~ C;",
        "validateSpecializationSpecificNotConjugated"
    ).resolves.toHaveLength(1);
});

test.fails("multiple conjugations trigger validation", () => {
    return expectValidations(
        "feature A ~ B ~ C;",
        "validateTypeAtMostOneConjugator"
    ).resolves.toHaveLength(2);
});

test.each([
    ["unions", "validateTypeOwnedUnioningNotOne"],
    ["intersects", "validateTypeOwnedIntersectingNotOne"],
    ["differences", "validateTypeOwnedDifferencingNotOne"],
    ["chains", "validateFeatureChainingFeatureNotOne"],
])("it is not allowable for a type to have just one of '%s' relationship", async (token, code) => {
    return expectValidations(`feature B ${token} A;`, code).resolves.toHaveLength(1);
});

test.each([
    ["unions", "validateTypeUnioningTypesNotSelf"],
    ["intersects", "validateTypeIntersectingTypesNotSelf"],
    ["differences", "validateTypeDifferencingTypesNotSelf"],
    ["chains", "validateFeatureChainingFeaturesNotSelf"],
])("it is not allowable for a type to have just one of '%s' relationship", async (token, code) => {
    return expectValidations(`feature B ${token} B;`, code).resolves.toHaveLength(1);
});

describe("Multiplicity", () => {
    test("multiple multiplicities trigger validation", async () => {
        return expectValidations(
            "class C [1] { multiplicity m [2]; }",
            "validateTypeOwnedMultiplicity"
        ).resolves.toMatchObject([{ severity: DiagnosticSeverity.Error }]);
    });

    test("multiplicity aliases do not trigger validation", async () => {
        return expectValidations(
            "class T; class K { feature f : T { multiplicity m [1..2]; } } class C [0..1] { alias m for K::f::m; }",
            "validateTypeOwnedMultiplicity"
        ).resolves.toHaveLength(0);
    });

    it("multiplicities with featuring types owned by non-features trigger validation", () => {
        return expectValidations(
            "class A { multiplicity multi [1]; } class B; featuring A::multi by B;",
            "validateClassifierMultiplicityDomain"
        ).resolves.toHaveLength(1);
    });

    it("multiplicities with different featuring types owned by features trigger validation", () => {
        return expectValidations(
            "feature A { multiplicity multi [1]; } class B; featuring A::multi by B;",
            "validateFeatureMultiplicityDomain"
        ).resolves.toHaveLength(1);
    });
});

describe("Feature validations", () => {
    test("untyped features trigger validation", async () => {
        return expectValidations("feature a;", "validateFeatureTyping").resolves.toHaveLength(1);
    });

    test("reference subsettings after the first trigger validation", async () => {
        const text = "feature a references b references c;";
        return expectValidations(
            text,
            "validateFeatureOwnedReferenceSubsetting"
        ).resolves.toMatchObject([
            {
                severity: DiagnosticSeverity.Error,
                range: { start: { character: text.indexOf("c;") } },
            },
        ]);
    });

    test("constant features that are not variable trigger validation", async () => {
        return expectModelValidations(
            FeatureMeta.create(basicIdProvider(), emptyDocument(), { isConstant: true }),
            "validateFeatureConstantIsVariable"
        ).resolves.toHaveLength(1);
    });

    test("const features are variable", async () => {
        return expectValidations(
            "class C { const feature c; }",
            "validateFeatureConstantIsVariable"
        ).resolves.toHaveLength(0);
    });

    test.each([
        ["var feature v;", 1],
        ["datatype D { var feature v; const feature c; }", 2],
    ])(
        "variable features not owned by an occurrence type trigger validation: %s",
        async (text, expected) => {
            return expectValidations(text, "validateFeatureIsVariable").resolves.toHaveLength(
                expected
            );
        }
    );

    test("variable features owned by an occurrence type do not trigger validation", async () => {
        return expectValidations(
            "package Occurrences { class Occurrence; } class C :> Occurrences::Occurrence { var feature v; const feature c; }",
            "validateFeatureIsVariable"
        ).resolves.toHaveLength(0);
    });

    test.each([
        ["portion var feature p;", 1],
        ["portion feature p;", 0],
    ])("variable portions trigger validation: %s", async (feature, expected) => {
        return expectValidations(
            `class C { ${feature} }`,
            "validateFeaturePortionNotVariable"
        ).resolves.toHaveLength(expected);
    });
});

describe("Redefinition end conformance", () => {
    const base = `
        classifier A { end feature e; }
        assoc R { end feature a : A; end feature b : A; }
        abstract connector r : R { end a; end b; }`;

    test.each([
        "abstract assoc R1 :> R { feature a1 :>> a; }",
        "abstract connector r1 :> r { feature a1 :>> a; }",
    ])(
        "non-end features of associations and connectors redefining ends trigger validation: %s",
        async (text) => {
            return expectValidations(
                base + text,
                "validateRedefinitionEndConformance"
            ).resolves.toHaveLength(1);
        }
    );

    test.each([
        "classifier B :> A { feature :>> e; }",
        "abstract assoc R1 :> R { end feature a1 :>> a; }",
    ])("other redefinitions of ends do not trigger validation: %s", async (text) => {
        return expectValidations(
            base + text,
            "validateRedefinitionEndConformance"
        ).resolves.toHaveLength(0);
    });
});

describe("Feature chaining", () => {
    test("feature chainings are validated", async () => {
        return expectValidations(
            `
            class A; class B;
            feature a featured by A {
                feature b featured by B;
            }
            feature c chains a.b;`,
            "validateFeatureChainingFeatureConformance"
        ).resolves.toHaveLength(1);
    });
});

describe("Subsettings", () => {
    test.each([
        ["feature f subsets c;", 0],
        ["const feature f subsets c;", 0],
        ["var feature f subsets c;", 1],
        ["var feature f redefines c;", 1],
        ["var feature f = c;", 0],
    ])(
        "variable features specializing constant features must be constant: %s",
        async (feature, expected) => {
            return expectValidations(
                `struct S { const feature c; } struct T :> S { ${feature} }`,
                "validateSubsettingConstantConformance"
            ).resolves.toHaveLength(expected);
        }
    );

    test.each(["subsets a;", "; subset b :> a;"])(
        "nonunique feature subsetting unique feature issues a diagnostic",
        async (suffix: string) => {
            return expectValidations(
                `
        feature a[*];
        feature b[*] nonunique ${suffix}`,
                "validateSubsettingUniquenessConformance"
            ).resolves.toHaveLength(1);
        }
    );

    test("redefining features must have greater or equal lower multiplicity bound", async () => {
        return expectValidations(
            `class A {feature a[5..10]; }
        class B :> A {
            :>> a[0..2];
        }`,
            "validateRedefinitionMultiplicityConformance"
        ).resolves.toHaveLength(1);
    });

    test("subsetting features must have lower or equal upper multiplicity bound", async () => {
        return expectValidations(
            `class A {feature a[5..10]; }
        class B :> A {
            feature c :> a[0..100];
        }`,
            "validateSubsettingMultiplicityConformance"
        ).resolves.toHaveLength(1);
    });

    test("infinity bounds don't trigger upper bound validation", async () => {
        return expectValidations(
            `class A {feature a : A [*]; }
        class B :> A {
            feature c : a[0..100];
        }`,
            "validateSubsettingMultiplicityConformance"
        ).resolves.toHaveLength(0);
    });

    test("0..1 bounds don't trigger upper bound validation", async () => {
        return expectValidations(
            `class A {feature a[0..1]; }
        class B :> A {
            feature c :> a[1];
        }`,
            "validateSubsettingMultiplicityConformance"
        ).resolves.toHaveLength(0);
    });

    test("subsetted end feature doesn't trigger multiplicity validation", async () => {
        return expectValidations(
            `class A { end feature a[5..10]; }
        class B :> A {
            feature c :> a[0..100];
        }`,
            "validateSubsettingMultiplicityConformance"
        ).resolves.toHaveLength(0);
    });

    test("redefining feature from the owning type triggers validation", async () => {
        return expectValidations(
            `
            class A {
                feature a : A;
            }
            feature b :>> A::a featured by A;`,
            "validateRedefinitionFeaturingTypes"
        ).resolves.toHaveLength(1);
    });

    test("redefining base type feature with the same name does not trigger validation", async () => {
        return expectValidations(
            `
            class A {
                feature a : A;
            }
            class B :> A {
                feature a :>> a;
            }`,
            "validateRedefinitionFeaturingTypes"
        ).resolves.toHaveLength(0);
    });

    test("redefining package feature triggers validation", async () => {
        return expectValidations(
            `
            feature a : A;
            feature b :>> a;`,
            "validateRedefinitionFeaturingTypes"
        ).resolves.toHaveLength(1);
    });

    test("subsetting a feature with different featuring types triggers validation", async () => {
        return expectValidations(
            `
            class A {
                feature a : A;
            }
            feature b :>> A::a;`,
            "validateSubsettingFeaturingTypes"
        ).resolves.toMatchObject([{ severity: DiagnosticSeverity.Error }]);
    });

    test("features featured by snapshot features redefining a common feature can access each other", async () => {
        return expectValidations(
            `
            class Occurrence { feature snapshots; }
            class Car specializes Occurrence {
                member abstract feature carParts featured by snapshots1 {
                    member feature snapshots1 :>> Occurrence::snapshots featured by Car;
                }
                member feature engine :> carParts featured by snapshots2 {
                    member feature snapshots2 :>> Occurrence::snapshots featured by Car;
                }
                member feature transmission :> carParts featured by snapshots3 {
                    member feature snapshots3 :>> Occurrence::snapshots featured by Car;
                }
                member connector drive featured by snapshots4 from engine to transmission {
                    member feature snapshots4 :>> Occurrence::snapshots featured by Car;
                }
            }`,
            ["validateSubsettingFeaturingTypes", "validateConnectorTypeFeaturing"]
        ).resolves.toHaveLength(0);
    });

    test("behavior parameters implicitly redefine the general parameters by position", async () => {
        return expectValidations(
            `
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
            }`,
            "validateRedefinitionDirectionConformance"
        ).resolves.toMatchObject([
            { range: { start: { line: 5 } } },
            { range: { start: { line: 9 } } },
        ]);
    });

    test("redefining features with incompatible directions triggers validation ", async () => {
        return expectValidations(
            `
        function A {
            in feature a;
            out feature b;
            inout feature c;
        }
        feature a : A {
            :>> a = 2;
            :>> b = 2;
            :>> c = 2;
        }`,
            "validateRedefinitionDirectionConformance"
        ).resolves.toHaveLength(3);
    });

    test("redefining features with compatible directions do not trigger validation", async () => {
        return expectValidations(
            "class C { in z; out w; inout v; } class D :> C { in :>> z; out :>> w; in :>> v; }",
            "validateRedefinitionDirectionConformance"
        ).resolves.toHaveLength(0);
    });

    test("conjugation reverses the redefined direction", async () => {
        const text =
            "class C { in z; } class C1 conjugates C; class D1 :> C1 { in :>> z; } class D2 :> C1 { out :>> z; }";
        return expectValidations(
            text,
            "validateRedefinitionDirectionConformance"
        ).resolves.toMatchObject([
            { range: { start: { character: text.indexOf("z; } class D2") } } },
        ]);
    });

    test("redefining features featured by a subset of the featuring types do not trigger validation", async () => {
        return expectValidations(
            "class A; class B; feature f featured by A, B; feature g :>> f featured by A;",
            "validateRedefinitionFeaturingTypes"
        ).resolves.toHaveLength(0);
    });
});

describe("CrossSubsettings", () => {
    test("chain of 2 features does not trigger validation", async () => {
        return expectValidations(
            `
        feature a { 
          end feature b { feature c; }
          end feature c => b.c;
        }`,
            "validateCrossSubsettingCrossedFeature"
        ).resolves.toHaveLength(0);
    });

    test("no chain triggers validation", async () => {
        return expectValidations(
            `
        feature a {
          end feature b;
          end feature c => a;
        }`,
            "validateCrossSubsettingCrossedFeature"
        ).resolves.toHaveLength(1);
    });

    test("chain of 3 features triggers validation", async () => {
        return expectValidations(
            `
        feature a { 
          end feature b { feature c; }
          end feature c => a.b.c;
        }`,
            "validateCrossSubsettingCrossedFeature"
        ).resolves.toHaveLength(1);
    });

    test("chaining through opposite feature does not trigger validation", async () => {
        return expectValidations(
            `
        feature a { 
          end feature b { feature c; }
          end feature c => b.c;
        }`,
            "validateCrossSubsettingCrossedFeature"
        ).resolves.toHaveLength(0);
    });

    test("chaining through non-opposite feature triggers validation", async () => {
        return expectValidations(
            `
        feature a { 
          end feature b;
          end feature c => a.b;
        }`,
            "validateCrossSubsettingCrossedFeature"
        ).resolves.toHaveLength(1);
    });

    test("chaining with more than 2 ends does not trigger validation", async () => {
        return expectValidations(
            `
        feature a { 
          end feature b { feature c; }
          end feature c => b.c;
          end feature d;
        }`,
            "validateCrossSubsettingCrossingFeature"
        ).resolves.toHaveLength(0);
    });

    test("lone end feature with explicit cross subsetting triggers validation", async () => {
        return expectValidations(
            `
        feature a {
          end feature b => a.b;
        }`,
            "validateCrossSubsettingCrossingFeature"
        ).resolves.toHaveLength(1);
    });
});

describe("Cross features", () => {
    test("implicit cross subsettings do not trigger validation", async () => {
        return expectValidations(
            `
        feature a { 
          end [1] feature b;
          end [1] feature c;
        }`,
            "validateFeatureCrossFeatureType"
        ).resolves.toHaveLength(0);
    });

    test("explicit cross subsettings to features with the same types do not trigger validation", async () => {
        return expectValidations(
            `
        class A;
        feature a { 
          end [1] feature b { feature c : A; }
          end feature c : A => b.c;
        }`,
            "validateFeatureCrossFeatureType"
        ).resolves.toHaveLength(0);
    });

    test("explicit cross subsettings to features with different types trigger validation", async () => {
        return expectValidations(
            `
        class A; class B;
        feature a { 
          end [1] feature b : A { feature c : A; }
          end feature c : B => b.c;
        }`,
            "validateFeatureCrossFeatureType"
        ).resolves.toHaveLength(1);
    });

    test("implicit cross subsettings and redefinitions do not trigger validation", async () => {
        return expectValidations(
            `
        feature A { 
          end [1] feature b;
          end [1] feature c;
        }
        feature a :> A { 
          end [1] feature b;
          end [1] feature c;
        }`,
            "validateFeatureCrossFeatureSpecialization"
        ).resolves.toHaveLength(0);
    });

    test.each(["", " :>>"])(
        "explicit cross subsettings trigger validation when the cross feature does not redefine other cross features",
        (redef) => {
            return expectValidations(
                `
        class C;
        feature A { 
          end [1] feature b : C;
          end [1] feature c : C;
        }
        feature a :> A { 
          end [1] feature b { feature c : C; }
          end feature${redef} c : C => b.c;
        }`,
                "validateFeatureCrossFeatureSpecialization"
            ).resolves.toHaveLength(1);
        }
    );

    test("cross subsettings do not contribute types to redefining ends", async () => {
        return expectValidations(
            `
        class C1 { feature a : C2; }
        class C2 { feature b : C1; feature c subsets b; }
        assoc A1 { end x : C1 crosses y.b; end y : C2 crosses y.b; }
        assoc A2 :> A1 { end x : C1 crosses y.c; end y : C2 crosses x.a; }`,
            "validateFeatureCrossFeatureType"
        ).resolves.toMatchObject([{ range: { start: { line: 3 } } }]);
    });

    test("cross subsettings after the first trigger validation", async () => {
        const text = "feature x; feature y; feature a => x => y;";
        return expectValidations(
            text,
            "validateFeatureOwnedCrossSubsetting"
        ).resolves.toMatchObject([{ range: { start: { character: text.lastIndexOf("y") } } }]);
    });

    test("explicit cross subsetting with an owned cross feature triggers validation", async () => {
        return expectValidations(
            `
        class A;
        feature a {
          end [1] feature b :A { feature c : A; }
          end [1] feature c :A [1] => b.c;
        }`,
            "checkFeatureCrossingSpecialization"
        ).resolves.toMatchObject([{ range: { start: { line: 4, character: 14 } } }]);
    });

    test("end feature with [1..1] multiplicity does not trigger validation", async () => {
        return expectValidations(
            `
        end feature x [1..1];
        end feature y [1];`,
            "validateFeatureEndFeatureMultiplicity"
        ).resolves.toHaveLength(0);
    });

    test("end feature with not [1..1] multiplicity triggers validation", async () => {
        return expectValidations(
            `
        end feature x [0..1];`,
            "validateFeatureEndFeatureMultiplicity"
        ).resolves.toHaveLength(1);
    });

    test("end feature inheriting no [1..1] multiplicity triggers validation", async () => {
        return expectValidations(
            `
        assoc A { end feature a [0..*]; end feature b [1]; }
        assoc B specializes A { end feature x; end feature y; }`,
            "validateFeatureEndFeatureMultiplicity"
        ).resolves.toMatchObject([
            { range: { start: { line: 1 } } },
            { range: { start: { line: 2, character: 32 } } },
        ]);
    });

    test("implicit n-ary cross features do not trigger validation", async () => {
        return expectValidations(
            `
        feature a { 
          end [1] feature b;
          end [1] feature c;
          end [1] feature d;
        }`,
            [
                "validateFeatureCrossFeatureSpecialization",
                "validateFeatureCrossFeatureType",
                "validateFeatureOwnedCrossSubsetting",
            ]
        ).resolves.toHaveLength(0);
    });

    test("explicit n-ary cross features do not trigger validation", async () => {
        return expectValidations(
            `
        class ShoppingCart;
        class Product;
        class Account;
        
        assoc ProductSelection3 {
          end cart: ShoppingCart[1] crosses cart::product_account.inCart {
            member feature inCart: ShoppingCart[0..1] featured by Product_Account {
              member feature Product_Account : Account featured by Product;
            }
            member feature product_account : inCart::Product_Account featured by ProductSelection3 {
              public import inCart;
            }
          }
          end feature selectedProduct: Product[1];
          end feature account : Account[1];
        }
        
        assoc SingleProductSelection3 specializes ProductSelection3 {
          end cart: ShoppingCart[1] redefines cart crosses cart::product_account1.inCart1 {
            member feature inCart1: ShoppingCart[0..1] featured by Product_Account1 {
              member feature Product_Account1 subsets Product_Account : Account featured by Product;
            }
            member feature product_account1 : inCart1::Product_Account1 featured by ProductSelection3 {
              public import inCart1;
            }
          }
          end feature selectedProduct: Product[1];
          end feature account : Account[1];
        }`,
            [
                "validateFeatureCrossFeatureSpecialization",
                "validateFeatureCrossFeatureType",
                "validateFeatureOwnedCrossSubsetting",
            ]
        ).resolves.toHaveLength(0);
    });

    test("cross features with redefinitions of ends without cross features do not trigger validation", async () => {
        return expectValidations(
            `
        class SelectionInfo;
        class ShoppingCart { feature selectedProducts : Product; }
        class Product { feature inCart: ShoppingCart;}
        
        assoc Assoc {
          end feature source;
          end feature target;
        }

        assoc ProductSelection :> Assoc {
          end feature cart: ShoppingCart[1] crosses selectedProduct.inCart;
          end feature selectedProduct: Product[1] crosses cart.selectedProducts;
        }`,
            [
                "validateFeatureCrossFeatureSpecialization",
                "validateFeatureCrossFeatureType",
                "validateFeatureOwnedCrossSubsetting",
            ]
        ).resolves.toHaveLength(0);
    });
});

describe("DataType", () => {
    test.each(["class", "assoc"])("specializing %s triggers validation", (tok) => {
        return expectValidations(
            `${tok} A; datatype B :> A;`,
            "validateDatatypeSpecialization"
        ).resolves.toHaveLength(1);
    });
});

describe("Class", () => {
    test.each(["datatype", "assoc"])("specializing %s triggers validation", (tok) => {
        return expectValidations(
            `${tok} A; class B :> A;`,
            "validateClassSpecialization"
        ).resolves.toHaveLength(1);
    });
});

describe.each([
    ["AssocStruct", "assoc struct"],
    ["Interaction", "interaction"],
])("%s", (_, tok) => {
    test("specializing datatype triggers validation", () => {
        return expectValidations(
            `datatype A; ${tok} B :> A;`,
            "validateClassSpecialization"
        ).resolves.toHaveLength(1);
    });

    test("specializing assoc does not trigger validation", () => {
        return expectValidations(
            `assoc A; ${tok} B :> A;`,
            "validateClassSpecialization"
        ).resolves.toHaveLength(0);
    });
});

describe.each([
    ["connector", ":", "validateConnectorBinarySpecialization"],
    ["assoc", ":>", "validateAssociationBinarySpecialization"],
])("Invalid binary %s", (tok, spec, code) => {
    it("owned ends after the second trigger validation", () => {
        return expectValidations(
            `package Links { class BinaryLink; } ${tok} A ${spec} Links::BinaryLink {end a; end b; end c; end d;}`,
            code,
            { standardLibrary: "local" }
        ).resolves.toHaveLength(2);
    });

    it("binary ends should not trigger validation", () => {
        return expectValidations(
            `package Links { class BinaryLink; } ${tok} A ${spec} Links::BinaryLink {end a; end b; }`,
            code,
            { standardLibrary: "local" }
        ).resolves.toHaveLength(0);
    });
});

describe("Binary specialization with inherited ends", () => {
    const links = "package Links { class BinaryLink; }";

    test("associations only count owned ends", () => {
        return expectValidations(
            `${links} assoc A :> Links::BinaryLink { end a; end b; end c; } assoc B :> A { end x; }`,
            "validateAssociationBinarySpecialization",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(1);
    });

    test("connectors with at most two owned ends but more ends trigger validation on the connector", () => {
        return expectValidations(
            `${links} assoc A :> Links::BinaryLink { end a; end b; end c; }
            connector k : A { end x; end y; }`,
            "validateConnectorBinarySpecialization",
            { standardLibrary: "local" }
        ).resolves.toMatchObject([{ range: { start: { line: 1 } } }]);
    });

    test("connectors subsetting connectors with more than two ends trigger validation", () => {
        return expectValidations(
            `${links} connector k1 : Links::BinaryLink { end a; end b; end c; } connector k2 :> k1;`,
            "validateConnectorBinarySpecialization",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(2);
    });

    test("explicitly redefined ends are not counted", () => {
        return expectValidations(
            `${links} assoc A :> Links::BinaryLink { end a; end b; end c; }
            connector k : A { end x; end y :>> c; }`,
            "validateConnectorBinarySpecialization",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(0);
    });
});

describe.each([
    ["connector", "validateConnectorRelatedFeatures"],
    ["assoc", "validateAssociationRelatedTypes"],
])("%s related types", (tok, code) => {
    test("concrete types with less than 2 ends trigger validation", async () => {
        return expectValidations(`${tok} A;`, code).resolves.toHaveLength(1);
    });

    test("abstract types do not trigger validation", async () => {
        return expectValidations(`abstract ${tok} A;`, code).resolves.toHaveLength(0);
    });
});

describe("Connector related features", () => {
    const base = "feature f; feature g; connector c1 from f to g;";

    test("ends without reference subsettings trigger validation", async () => {
        return expectValidations(
            "assoc A { end a; end b; } connector c : A;",
            "validateConnectorRelatedFeatures"
        ).resolves.toHaveLength(1);
    });

    test("ends inherited from subsetted connectors do not trigger validation", async () => {
        return expectValidations(
            `${base} connector c2 :> c1;`,
            "validateConnectorRelatedFeatures"
        ).resolves.toHaveLength(0);
    });

    test("ends of a bound connector trigger validation", async () => {
        return expectValidations(
            `${base} connector c2 = c1;`,
            "validateConnectorRelatedFeatures"
        ).resolves.toHaveLength(1);
    });
});

describe("Association related types", () => {
    test("ends with less than 2 types in total trigger validation", async () => {
        return expectValidations(
            "class X; assoc A { end a : X; end b; }",
            "validateAssociationRelatedTypes"
        ).resolves.toHaveLength(1);
    });

    test("ends with 2 types in total do not trigger validation", async () => {
        return expectValidations(
            "class X; assoc A { end a : X; end b : X; }",
            "validateAssociationRelatedTypes"
        ).resolves.toHaveLength(0);
    });
});

describe("Association end types", () => {
    test("ends with more than one type trigger validation", async () => {
        return expectValidations(
            "class C1; class C2; assoc A { end x : C1; end y : C1, C2; }",
            "validateAssociationEndTypes"
        ).resolves.toHaveLength(1);
    });

    test("ends redefining ends of unrelated types trigger validation", async () => {
        return expectValidations(
            `class C1; class C2; class C3 :> C1;
            assoc A1 { end x : C1; end y : C1; }
            assoc A2 :> A1 { end x : C2; }
            assoc A3 :> A1 { end x : C3; }`,
            "validateAssociationEndTypes"
        ).resolves.toMatchObject([{ range: { start: { line: 2 } } }]);
    });
});

describe("binding connectors", () => {
    it("should trigger validation for >2 ends", () => {
        return expectValidations(
            "binding of a = b { end c; }",
            "validateBindingConnectorIsBinary"
        ).resolves.toHaveLength(1);
    });

    test("binding connectors with non-conforming end types trigger validation", async () => {
        return expectValidations(
            `
            class A; class B;
            feature a : A; feature b : B;
            binding of a = b;`,
            "validateBindingConnectorTypeConformance"
        ).resolves.toHaveLength(1);
    });
});

describe("Connectors", () => {
    test("referenced features without featuring types don't trigger validation", async () => {
        return expectValidations(
            "feature a; feature b; connector C from a to b;",
            "validateConnectorTypeFeaturing"
        ).resolves.toHaveLength(0);
    });

    test("referenced features featured by conforming types trigger validation", async () => {
        return expectValidations(
            "class A; feature a featured by A; feature b featured by A; connector C featured by A from a to b;",
            "validateConnectorTypeFeaturing"
        ).resolves.toHaveLength(0);
    });

    test("inaccessible referenced features trigger the subsetting validation on the end", async () => {
        return expectValidations("feature a; feature b featured by a; connector C from a to b;", [
            "validateConnectorTypeFeaturing",
            "validateSubsettingFeaturingTypes",
        ]).resolves.toMatchObject([
            { code: "validateSubsettingFeaturingTypes", severity: DiagnosticSeverity.Error },
        ]);
    });

    test("referenced features not featured within every connector featuring type trigger validation", async () => {
        const text =
            "class A; class B; feature a featured by A; feature b featured by A; connector C featured by A, B from a to b;";
        return expectValidations(text, [
            "validateConnectorTypeFeaturing",
            "validateSubsettingFeaturingTypes",
        ]).resolves.toMatchObject([
            {
                code: "validateConnectorTypeFeaturing",
                severity: DiagnosticSeverity.Error,
                range: { start: { character: text.indexOf("a to b") } },
            },
            {
                code: "validateConnectorTypeFeaturing",
                range: { start: { character: text.indexOf("b;", text.indexOf("a to b")) } },
            },
        ]);
    });
});

describe("parameter memberships", () => {
    it("parameter membership should trigger validation for invalid owning types", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = NamespaceMeta.create(id, doc, {
            children: namespaceChildren([
                ParameterMembershipMeta.create(id, doc),
                FeatureMeta.create(id, doc),
            ]),
        });

        return expectModelValidations(
            ns,
            "validateParameterMembershipOwningType"
        ).resolves.toHaveLength(1);
    });

    it.each([
        ["function", FunctionMeta, "validateFunctionReturnParameterMembership"],
        ["expression", ExpressionMeta, "validateExpressionReturnParameterMembership"],
    ] as const)("multiple result expressions trigger %s validation", (_, type, code) => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = (type as typeof FeatureMeta).create(id, doc, {
            children: namespaceChildren(
                [ReturnParameterMembershipMeta.create(id, doc), ExpressionMeta.create(id, doc)],
                [ReturnParameterMembershipMeta.create(id, doc), ExpressionMeta.create(id, doc)]
            ),
        });

        return expectModelValidations(ns, code).resolves.toHaveLength(2);
    });

    it.each([
        ["result", ResultExpressionMembershipMeta, "validateResultExpressionMembershipOwningType"],
        ["return", ReturnParameterMembershipMeta, "validateReturnParameterMembershipOwningType"],
    ] as const)(
        "%s parameter membership should trigger validation for invalid owning types",
        (_, type, code) => {
            const doc = emptyDocument();
            const id = basicIdProvider();
            const ns = NamespaceMeta.create(id, doc, {
                children: namespaceChildren([
                    (type as typeof ParameterMembershipMeta).create(id, doc),
                    ExpressionMeta.create(id, doc),
                ]),
            });

            return expectModelValidations(ns, code).resolves.toHaveLength(1);
        }
    );
});

describe("Feature chain expressions", () => {
    test("feature chain expressions are validated", async () => {
        return expectValidations(
            `
            class A; class B;
            feature a featured by A {
                member feature b featured by B;
            }
            feature c = a.b;`,
            "validateFeatureChainExpressionFeatureConformance"
        ).resolves.toHaveLength(1);
    });
});

describe("Invocation expressions", () => {
    test("invoking a non-behavior triggers validation", async () => {
        const text = `
        behavior B; class K;
        feature b : B; feature k : K;
        feature x1 = B(); feature x2 = b(); feature x3 = new K();
        feature y1 = K(); feature y2 = k();`;
        return expectValidations(
            text,
            "validateInvocationExpressionInstantiatedType"
        ).resolves.toMatchObject([
            { range: { start: { character: text.split("\n")[4].indexOf("K()") } } },
            { range: { start: { character: text.split("\n")[4].indexOf("k()") } } },
        ]);
    });

    test("redefining the same parameter twice triggers validation", async () => {
        return expectValidations(
            `
        function A {
            in feature a;
            out feature b;
        }
        feature a = A(a=1,a=2);`,
            "validateInvocationExpressionNoDuplicateParameterRedefinition"
        ).resolves.toHaveLength(1);
    });

    test("redefining an out parameter triggers validation", async () => {
        return expectValidations(
            `
        function A {
            in feature a;
            out feature b;
        }
        feature a = A(a=1,b=2);`,
            "validateInvocationExpressionParameterRedefinition"
        ).resolves.toHaveLength(1);
    });
});

describe("Operator expressions", () => {
    test("casting non-conforming types triggers validation", async () => {
        return expectValidations(
            `
        class A; feature a : A;
        class B;
        feature x = a as B;
        `,
            "validateOperatorExpressionCastConformance"
        ).resolves.toHaveLength(1);
    });

    test("square brackets trigger validation", async () => {
        return expectValidations(
            "feature a = 1 [0];",
            "validateOperatorExpressionBracketOperator"
        ).resolves.toHaveLength(1);
    });
});

describe("Item flows", () => {
    it("should trigger validation for multiple item features", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = ItemFlowMeta.create(id, doc, {
            item: [FeatureMembershipMeta.create(id, doc), ItemFeatureMeta.create(id, doc)],
            children: namespaceChildren([
                FeatureMembershipMeta.create(id, doc),
                ItemFeatureMeta.create(id, doc),
            ]),
        });

        return expectModelValidations(ns, "validateFlowItemFeature").resolves.toHaveLength(1);
    });

    it("should trigger validation for item flow ends without owned features", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = ItemFlowEndMeta.create(id, doc, {});

        return expectModelValidations(ns, "validateFlowEndNestedFeature").resolves.toHaveLength(1);
    });

    it("should trigger validation for invalid item feature owning type", () => {
        const doc = emptyDocument();
        const id = basicIdProvider();
        const ns = NamespaceMeta.create(id, doc, {
            children: namespaceChildren([
                FeatureMembershipMeta.create(id, doc),
                ItemFlowEndMeta.create(id, doc),
            ]),
        });

        return expectModelValidations(ns, "validateFlowEndOwningType").resolves.toHaveLength(1);
    });

    test("invalid implicit subsetting triggers validation", async () => {
        return expectValidations(
            `
            package Transfers {
                class Transfer {
                    end feature source {
                        out feature sourceOutput;
                    }
                    end feature target {
                        in feature targetInput; 
                    }
                }
            }

            feature a { feature x; }
            feature b { feature y; }
            flow from a::x to b::y;`,
            "validateFlowEndImplicitSubsetting",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(2);
    });

    test("ends referencing non-nested features with qualified names trigger validation", async () => {
        return expectValidations(
            `
            feature a;
            feature b;
            flow from a to b;`,
            "validateFlowEndSubsetting"
        ).resolves.toHaveLength(2);
    });

    test("ends referencing nested features with chains do not trigger validation", async () => {
        return expectValidations(
            `
            package Transfers {
                class Transfer {
                    end feature source {
                        out feature sourceOutput;
                    }
                    end feature target {
                        in feature targetInput; 
                    }
                }
            }

            feature a { feature x; }
            feature b { feature y; }
            flow from a.x to b.y;`,
            [
                "validateConnectorTypeFeaturing",
                "validateSubsettingFeaturingTypes",
                "validateFlowEndSubsetting",
                "validateFlowEndImplicitSubsetting",
            ]
        ).resolves.toHaveLength(0);
    });
});

describe("feature values", () => {
    it("should  trigger validation when redefining feature with a non-default value", async () => {
        return expectValidations(
            `
            class A {
                feature a = 3;
            }
            class B :> A {
                :>> a = 4;
            }
            `,
            "validateFeatureValueOverriding"
        ).resolves.toHaveLength(1);
    });

    it.each([
        ["feature x := 1;", 1],
        ["var feature x := 1;", 0],
        ["feature x = 1;", 0],
    ])(
        "initial values of non-variable features trigger validation: %s",
        async (feature, expected) => {
            return expectValidations(
                `class C { ${feature} }`,
                "validateFeatureValueIsInitial"
            ).resolves.toHaveLength(expected);
        }
    );
});

describe("multiplicity range return type", () => {
    it("should trigger validation for non-integer types", () => {
        return expectValidations(
            "class A; feature [0 as A];",
            "validateMultiplicityRangeBoundResultTypes"
        ).resolves.toHaveLength(1);
    });

    it.each(["-", "+", "*", "**", "^"])(
        "%s should not trigger validation with integer types",
        (op) => {
            return expectValidations(
                `class A; feature [0 ${op} 1];`,
                "validateMultiplicityRangeBoundResultTypes"
            ).resolves.toHaveLength(0);
        }
    );

    it("should not trigger validation for integer extent expressions", () => {
        return expectValidations(
            "class A; feature [0..1];",
            "validateMultiplicityRangeBoundResultTypes"
        ).resolves.toHaveLength(0);
    });

    it("should not trigger validation for conforming referenced features", () => {
        return expectValidations(
            "package ScalarValues { datatype Integer; } feature bound : ScalarValues::Integer; feature [bound];",
            "validateMultiplicityRangeBoundResultTypes",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(0);
    });
});

describe("Metadata feature validations", () => {
    test("missing metaclass typing triggers validation", async () => {
        return expectValidations(
            "class M; metadata m : M;",
            "validateMetadataFeatureMetaclass"
        ).resolves.toHaveLength(1);
    });

    test("abstract typings trigger validation", async () => {
        return expectValidations(
            "abstract metaclass M; metadata m : M;",
            "validateMetadataFeatureMetaclassNotAbstract"
        ).resolves.toHaveLength(1);
    });

    test("invalid annotated element types trigger validation", async () => {
        return expectValidations(
            `
        package Metaobjects {
            metaclass Metaobject {
                abstract feature annotatedElement: Element[1..*];
            }
        }
        
        package KerML {
            package Kernel {
                metaclass Function;
                metaclass Class;
            }
        }
        
        package P {
            metaclass M :> Metaobjects::Metaobject {
                :> annotatedElement: KerML::Kernel::Function;
            }

            #M class C;
        }`,
            "validateMetadataFeatureAnnotatedElement",
            { standardLibrary: "local" }
        ).resolves.toHaveLength(1);
    });

    test("body features must redefine supertype features", async () => {
        return expectValidations(
            `
        metaclass M { feature a; }
        class C {
            @M {
                feature b;
            }
        }`,
            "validateMetadataFeatureBody"
        ).resolves.toHaveLength(1);
    });

    test("body features with user-defined function values trigger validation", async () => {
        return expectValidations(
            `
        function Fn;
        metaclass M { feature a; }
        class C {
            @M {
                :>> a = Fn();
            }
        }`,
            "validateMetadataFeatureBody"
        ).resolves.toHaveLength(1);
    });
});

describe("Element filter memberships", () => {
    test("user-defined functions trigger validation", async () => {
        return expectValidations(
            "function Fn; import a::*[Fn()];",
            "validatePackageElementFilterIsModelLevelEvaluable"
        ).resolves.toHaveLength(1);
    });

    test("non-boolean filters trigger validation", async () => {
        return expectValidations(
            "import a::*[not 1];",
            "validatePackageElementFilterIsBoolean"
        ).resolves.toHaveLength(1);
    });

    test("boolean filters don't trigger validation", async () => {
        return expectValidations(
            `
            package ScalarValues {
                datatype Boolean;
            }
            package BaseFunctions {
                abstract function '@'{ 
                    return : ScalarValues::Boolean[1];
                }
            }
            import a::*[@Safety];`,
            "validatePackageElementFilterIsBoolean",
            { ...BUILD_OPTIONS, standardLibrary: "local" }
        ).resolves.toHaveLength(0);
    });
});

describe("Standard library package validation", () => {
    let settings: SysMLConfig;
    beforeAll(() => (settings = services.shared.workspace.ConfigurationProvider.get()));
    afterEach(() =>
        services.shared.workspace.ConfigurationProvider.updateConfiguration({
            settings: { [SETTINGS_KEY]: settings },
        })
    );

    test("no standard library path triggers a warning", async () => {
        return expectValidations(
            "standard library package P {}",
            "validateLibraryPackageNotStandard_"
        ).resolves.toMatchObject([{ severity: DiagnosticSeverity.Warning }]);
    });

    test("non standard library packages don't trigger validation", async () => {
        return expectValidations(
            "library package P {}",
            "validateLibraryPackageNotStandard_"
        ).resolves.toHaveLength(0);
    });

    test("documents outside standard library path trigger validation", async () => {
        const config = { ...settings };
        config.standardLibraryPath = "/some/path";
        services.shared.workspace.ConfigurationProvider.updateConfiguration({
            settings: { [SETTINGS_KEY]: config },
        });
        return expectValidations(
            "standard library package P {}",
            "validateLibraryPackageNotStandard_"
        ).resolves.toHaveLength(1);
    });
});
