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

import { formatString } from "typescript-string-operations";
import {
    anything,
    withQualifiedName,
    qualifiedTypeReference,
    parseKerML,
    NO_ERRORS,
    childrenNames,
    sanitizeTree,
    recursiveObjectContaining,
} from "../../../testing/index.js";
import {
    Feature,
    MultiplicityRange,
    LiteralNumber,
    LiteralInfinity,
    Disjoining,
    FeatureChaining,
    FeatureInverting,
    TypeFeaturing,
} from "#generated/ast.js";
import { Visibility } from "../../../utils/scope-util.js";

test.concurrent.each([
    "typed by A, B subsets f redefines g",
    "redefines g typed by A subsets f typed by B",
])("feature specializations can appear in any order: '%s'", async (feature: string) => {
    const matcher = expect(
        formatString(
            `
    class A;
    class B;
    feature f;
    feature g;
    feature x {0};
    `,
            feature
        )
    );
    const expected = {
        children: [
            ...anything(4),
            {
                target: {
                    $type: Feature.$type,
                    ...withQualifiedName("x"),
                    heritage: expect.arrayContaining(
                        ["A", "B", "f", "g"].map((name) =>
                            recursiveObjectContaining({ targetRef: qualifiedTypeReference(name) })
                        )
                    ),
                },
            },
        ],
    };

    await matcher.toParseKerML(expected);
});

test("features without subsetting, redefinition and conjugation relationships subset Base::things", async () => {
    const result = await parseKerML(
        `
    package Base {
        abstract classifier Anything {}
        abstract feature things: Anything [0..*] nonunique {   
            feature that : Anything[1];
        }
    }
    classifier Person;
    abstract feature person : Person;
    `,
        {
            standardLibrary: "local",
            ignoreMetamodelErrors: true,
            standalone: true,
            validationChecks: "none",
        }
    );
    expect(result).toMatchObject(NO_ERRORS);
    expect(childrenNames(result.value.children[2].target, Visibility.private)).toEqual([
        "Base::things::that", // from things
    ]);
    expect(sanitizeTree(result.value.children[2].target, undefined, "include $meta")).toMatchObject(
        {
            $type: Feature.$type,
            ...withQualifiedName("person"),
            heritage: [{ targetRef: qualifiedTypeReference("Person") }],
        }
    );
});

test.concurrent.each([
    ["in", "direction", "in"],
    ["out", "direction", "out"],
    ["inout", "direction", "inout"],
    ["abstract", "isAbstract", true],
    ["composite", "isComposite", true],
    ["portion", "isPortion", true],
    ["const", "isConstant", true],
    ["var", "isVariable", true],
    ["derived", "isDerived", true],
    ["end", "isEnd", true],
])("feature prefix '%s' is parsed", async (prefix: string, property: string, value: unknown) => {
    const result = await parseKerML(prefix + " feature a;");
    expect(result).toMatchObject(NO_ERRORS);
    await expect(result.value.children[0].target?.$meta).toMatchObject({
        qualifiedName: "a",
        [property]: value,
    });
});

test.fails("conjugating feature with a non-feature issues a warning", async () => {
    return expect(`
    classifier A;
    feature a ~ A;`).toParseKerML({}, { buildOptions: { validationChecks: "all" } });
});

test("feature multiplicity can be specified after identification", async () => {
    return expect(`
        class Person;
        feature parent[2] : Person;
    `).toParseKerML({
        children: [
            ...anything(1),
            {
                target: {
                    ...withQualifiedName("parent"),
                    multiplicity: {
                        target: {
                            $type: MultiplicityRange.$type,
                            range: {
                                target: {
                                    $type: LiteralNumber.$type,
                                    literal: 2,
                                },
                            },
                        },
                    },
                    heritage: [{ targetRef: qualifiedTypeReference("Person") }],
                },
            },
        ],
    });
});

test("feature multiplicity can be specified after one specialization", async () => {
    return expect(`
        class Person;
        feature parent : Person [2];
    `).toParseKerML({
        children: [
            ...anything(1),
            {
                target: {
                    ...withQualifiedName("parent"),
                    multiplicity: {
                        target: {
                            $type: MultiplicityRange.$type,
                            range: {
                                target: {
                                    $type: LiteralNumber.$type,
                                    literal: 2,
                                },
                            },
                        },
                    },
                    heritage: [{ targetRef: qualifiedTypeReference("Person") }],
                },
            },
        ],
    });
});

test.concurrent.each([
    ["nonunique", true, false],
    ["ordered", false, true],
    ["nonunique ordered", true, true],
    ["ordered nonunique", true, true],
])(
    "multiplicity keywords '%s' are parsed",
    async (keyword: string, nonunique: boolean, ordered: boolean) => {
        await expect(`
    datatype Real;
    feature readings : Real [*] ${keyword};`).toParseKerML({
            children: [
                ...anything(1),
                {
                    target: {
                        $type: Feature.$type,
                        ...withQualifiedName("readings"),
                        multiplicity: {
                            target: {
                                $type: MultiplicityRange.$type,
                                range: {
                                    target: {
                                        $type: LiteralInfinity.$type,
                                    },
                                },
                            },
                        },
                        isNonunique: nonunique,
                        isOrdered: ordered,
                    },
                },
            ],
        });
    }
);

test.concurrent.each([
    ["disjoint from", Disjoining.$type],
    ["chains", FeatureChaining.$type],
    ["inverse of", FeatureInverting.$type],
])("feature relationships '%s' are parsed", async (relationship: string, type: string) => {
    await expect(`
    feature a {
        feature c;
    }
    feature b ${relationship} a.c;`).toParseKerML({
        children: [
            ...anything(1),
            {
                target: {
                    ...withQualifiedName("b"),
                    typeRelationships: expect.arrayContaining([
                        recursiveObjectContaining({
                            $type: type,
                            // reference: qualifiedTypeReference("a"),
                        }),
                    ]),
                },
            },
        ],
    });
});

test("feature can be featured", async () => {
    return expect(`
    feature a; 
    feature b featured by a;`).toParseKerML({
        children: [
            ...anything(1),
            {
                target: {
                    ...withQualifiedName("b"),
                    typeRelationships: [
                        {
                            $type: TypeFeaturing.$type,
                            targetRef: qualifiedTypeReference("a"),
                        },
                    ],
                },
            },
        ],
    });
});
