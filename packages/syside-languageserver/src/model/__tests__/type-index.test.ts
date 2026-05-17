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

import {
    Element,
    Comment,
    TextualAnnotatingElement,
    Feature,
    Namespace,
    Type,
    OperatorExpression,
    Definition,
    InvocationExpression,
    AnnotatingElement,
    Expression,
    Step,
    InlineExpression,
    Multiplicity,
    Subsetting,
    Redefinition,
    ReferenceSubsetting,
    MultiplicityRange,
    Documentation,
    MetadataFeature,
    MetadataUsage,
    TextualRepresentation,
    CrossSubsetting,
} from "#generated/ast.js";
import { typeIndex } from "../types.js";

test.concurrent.each([
    [Element.$type, []],
    [Comment.$type, [TextualAnnotatingElement.$type, AnnotatingElement.$type, Element.$type]],
    [Feature.$type, [Type.$type, Namespace.$type, Element.$type]],
    [
        OperatorExpression.$type,
        [
            InvocationExpression.$type,
            InlineExpression.$type,
            Expression.$type,
            Step.$type,
            Feature.$type,
            Type.$type,
            Namespace.$type,
            Element.$type,
        ],
    ],
])("type inheritance is sorted in inheritance order: %s", (type: string, expected: string[]) => {
    expect(Array.from(typeIndex.getInheritanceChain(type))).toStrictEqual(expected);
});

test.concurrent.each([
    [
        AnnotatingElement.$type,
        [
            Comment.$type,
            Documentation.$type,
            MetadataFeature.$type,
            MetadataUsage.$type,
            TextualAnnotatingElement.$type,
            TextualRepresentation.$type,
        ],
    ],
    [Multiplicity.$type, [MultiplicityRange.$type]],
    [Subsetting.$type, [CrossSubsetting.$type, Redefinition.$type, ReferenceSubsetting.$type]],
])("%s have subtypes computed", (supertype, subtypes) => {
    expect(subtypes).toEqual(expect.arrayContaining(Array.from(typeIndex.getSubtypes(supertype))));
});

test("map values are propagated to unset subtypes with `expandToDerivedTypes`", () => {
    expect(
        Object.fromEntries(
            typeIndex.expandToDerivedTypes({
                Type: Type.$type,
                Element: Element.$type,
                Definition: Definition.$type,
            })
        )
    ).toMatchObject({
        Element: Element.$type,
        Namespace: Element.$type,
        Type: Type.$type,
        Feature: Type.$type,
        Definition: Definition.$type,
        ConnectionDefinition: Definition.$type,
    });
});

test("mapped arrays are expanded and merged with subtypes with `expandAndMerge`", () => {
    expect(
        Object.fromEntries(
            typeIndex.expandAndMerge({
                Type: [Type.$type],
                Element: [Element.$type],
            })
        )
    ).toMatchObject({
        Element: [Element.$type],
        Namespace: [Element.$type],
        Type: expect.arrayContaining([Type.$type, Element.$type]),
        Feature: expect.arrayContaining([Type.$type, Element.$type]),
    });
});
