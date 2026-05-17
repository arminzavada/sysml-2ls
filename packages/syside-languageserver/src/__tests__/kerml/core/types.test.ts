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

import { withQualifiedName, qualifiedTypeReference } from "../../../testing/index.js";
import {
    MultiplicityRange,
    LiteralNumber,
    Feature,
    Disjoining,
    Subclassification,
    Conjugation,
    Namespace,
    Class,
} from "#generated/ast.js";

const Common = `
abstract datatype Anything;
`;

test("types can be disjoint", async () => {
    return expect(
        Common +
            `
    class B;
    class A specializes Anything disjoint from B;`
    ).toParseKerML({
        children: [
            { target: withQualifiedName("Anything") },
            { target: withQualifiedName("B") },
            {
                target: {
                    ...withQualifiedName("A"),
                    heritage: [
                        {
                            $type: Subclassification.$type,
                            targetRef: qualifiedTypeReference("Anything"),
                        },
                    ],
                    typeRelationships: [
                        { $type: Disjoining.$type, targetRef: qualifiedTypeReference("B") },
                    ],
                },
            },
        ],
    });
});

test("types can conjugate", async () => {
    return expect(`
    class A;
    class C conjugates A;`).toParseKerML({
        children: [
            { target: withQualifiedName("A") },
            {
                target: {
                    ...withQualifiedName("C"),
                    heritage: [
                        { $type: Conjugation.$type, targetRef: qualifiedTypeReference("A") },
                    ],
                },
            },
        ],
    });
});

test("types can be abstract", async () => {
    return expect(
        Common +
            `
    abstract class A specializes Anything;`
    ).toParseKerML({
        children: [
            { target: withQualifiedName("Anything") },
            {
                target: {
                    ...withQualifiedName("A"),
                    heritage: [{ targetRef: qualifiedTypeReference("Anything") }],
                    isAbstract: "abstract",
                },
            },
        ],
    });
});

test("types can have multiplicity", async () => {
    return expect(
        Common +
            `
    type Singleton[1] specializes Anything;`
    ).toParseKerML({
        children: [
            { target: withQualifiedName("Anything") },
            {
                target: {
                    ...withQualifiedName("Singleton"),
                    heritage: [{ targetRef: qualifiedTypeReference("Anything") }],
                    multiplicity: {
                        target: {
                            $type: MultiplicityRange.$type,
                            range: {
                                target: {
                                    $type: LiteralNumber.$type,
                                    literal: 1,
                                },
                            },
                        },
                    },
                },
            },
        ],
    });
});

test("type children can reference private child members", async () => {
    return expect(
        Common +
            `
    class Super specializes Anything {
        private namespace N {
            class Sub specializes Super;
        }
        protected feature f : N::Sub;
        member feature f1 : Super featured by N::Sub;
        member feature f2 : Super featured by N::Sub;
    }`
    ).toParseKerML({
        children: [
            { target: withQualifiedName("Anything") },
            {
                target: {
                    ...withQualifiedName("Super"),
                    heritage: [{ targetRef: qualifiedTypeReference("Anything") }],
                    children: [
                        {
                            visibility: "private",
                            target: {
                                $type: Namespace.$type,
                                ...withQualifiedName("Super::N"),
                                children: [
                                    {
                                        target: {
                                            ...withQualifiedName("Super::N::Sub"),
                                            heritage: [
                                                { targetRef: qualifiedTypeReference("Super") },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            visibility: "protected",
                            target: {
                                $type: Feature.$type,
                                ...withQualifiedName("Super::f"),
                                heritage: [{ targetRef: qualifiedTypeReference("Super::N::Sub") }],
                            },
                        },
                        {
                            target: {
                                $type: Feature.$type,
                                ...withQualifiedName("Super::f1"),
                                heritage: [{ targetRef: qualifiedTypeReference("Super") }],
                                typeRelationships: [
                                    { targetRef: qualifiedTypeReference("Super::N::Sub") },
                                ],
                            },
                        },
                        {
                            target: {
                                $type: Feature.$type,
                                ...withQualifiedName("Super::f2"),
                                heritage: [{ targetRef: qualifiedTypeReference("Super") }],
                                typeRelationships: [
                                    { targetRef: qualifiedTypeReference("Super::N::Sub") },
                                ],
                            },
                        },
                    ],
                },
            },
        ],
    });
});

test("types can be sufficient", async () => {
    return expect(`
    abstract class MaterialThing;
    class Wheel;
    class all Car specializes MaterialThing {
        feature wheels[4] : Wheel;
    }`).toParseKerML({
        children: [
            {
                target: {
                    $type: Class.$type,
                    ...withQualifiedName("MaterialThing"),
                    isAbstract: "abstract",
                },
            },
            {
                target: {
                    $type: Class.$type,
                    ...withQualifiedName("Wheel"),
                },
            },
            {
                target: {
                    $type: Class.$type,
                    ...withQualifiedName("Car"),
                    isSufficient: true,
                    heritage: [{ targetRef: qualifiedTypeReference("MaterialThing") }],
                    children: [
                        {
                            target: {
                                $type: Feature.$type,
                                ...withQualifiedName("Car::wheels"),
                                multiplicity: {
                                    target: {
                                        $type: MultiplicityRange.$type,
                                        range: {
                                            target: {
                                                $type: LiteralNumber.$type,
                                                literal: 4,
                                            },
                                        },
                                    },
                                },
                                heritage: [{ targetRef: qualifiedTypeReference("Wheel") }],
                            },
                        },
                    ],
                },
            },
        ],
    });
});
