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

import { AstNode, CstNode, Mutable, PropertyMetaData, TypeMetaData } from "langium";
import * as ast from "#generated/ast.js";
import { typeIndex } from "../model/types.js";
import { AstContainer, AstParent, AstPropertiesFor } from "../utils/ast-util.js";
import { SysMLReferenceInfo } from "./references/linker.js";

export type SysMLType = {
    [K in keyof ast.SysMLAstType]: ast.SysMLAstType[K] extends string ? never : K;
}[keyof ast.SysMLAstType];
export type SysMLTypeList = { [K in SysMLType]: ast.SysMLAstType[K] };
export type SysMLInterface<K extends SysMLType> = SysMLTypeList[K];

export type SubtypeList<Bound extends AstNode> = {
    [K in SysMLType]: SysMLTypeList[K] extends Bound ? SysMLTypeList[K] : never;
};
export type SubtypeKeys<Bound extends AstNode> = {
    [K in SysMLType]: SysMLTypeList[K] extends Bound ? K : never;
}[SysMLType];
export type Subtypes<Bound extends AstNode> = SysMLTypeList[SubtypeKeys<Bound>];

export class SysMLAstReflection extends ast.SysMLAstReflection {
    protected readonly metadata = new Map<string, TypeMetaData>();

    override getReferenceType(refInfo: SysMLReferenceInfo): string {
        // references are split by scope and chain tokens and stored in the same
        // array so have to programmatically determine reference types

        const container = refInfo.container;

        if (refInfo.index === container.parts.length - 1) {
            // last element
            switch (container.$type) {
                case ast.TypeReference.$type:
                    return ast.Type.$type;
                case ast.ClassifierReference.$type:
                    return ast.Classifier.$type;
                case ast.MetaclassReference.$type:
                    return ast.Metaclass.$type;
                case ast.MembershipReference.$type:
                    return ast.Membership.$type;
                case ast.NamespaceReference.$type:
                    return ast.Namespace.$type;
                case ast.FeatureReference.$type:
                    return ast.Feature.$type;
                case ast.ConjugatedPortReference.$type:
                    return ast.ConjugatedPortDefinition.$type;
            }
        }

        return ast.Element.$type;
    }

    override isSubtype(subtype: string, supertype: string): boolean {
        return typeIndex.isSubtype(subtype, supertype);
    }

    override getTypeMetaData(type: string): TypeMetaData {
        let meta = this.metadata.get(type);
        if (meta) return meta;

        const properties: { [name: string]: PropertyMetaData } = {};
        const ownProperties = super.getTypeMetaData(type).properties;
        for (const name in ownProperties) {
            properties[name] = ownProperties[name];
        }

        // the default langium implementation doesn't care about hierarchy
        // members resulting in some arrays/booleans being left undefined... fix
        // that here
        for (const base of typeIndex.getInheritanceChain(type)) {
            const baseMeta = super.getTypeMetaData(base);
            for (const name in baseMeta.properties) {
                if (properties[name]) continue;
                properties[name] = baseMeta.properties[name];
            }
        }

        // also make sure all nodes have $children member
        properties["$children"] = { name: "$children", defaultValue: [] };

        meta = {
            name: type,
            properties,
            superTypes: super.getTypeMetaData(type).superTypes ?? [],
        };
        this.metadata.set(type, meta);
        return meta;
    }

    private assignMandatoryProperties(obj: { $type: string }): void {
        const typeMetaData = this.getTypeMetaData(obj.$type);
        const out = obj as Record<string, unknown>;
        for (const name in typeMetaData.properties) {
            const property = typeMetaData.properties[name];
            if (property.defaultValue === undefined) continue;
            const value = out[name];
            if (Array.isArray(property.defaultValue) && !Array.isArray(value)) {
                out[name] = [];
            } else if (typeof property.defaultValue === "boolean" && value === undefined) {
                out[name] = property.defaultValue;
            }
        }

        if (out["$childIndex"] === undefined) out["$childIndex"] = 0;
    }

    /**
     * Programmatically create an AST node with a given {@link type}
     * @param type AST node type
     * @param values AST node values
     * @returns Constructed AST node
     */
    createNode<
        V extends SysMLType,
        T extends AstParent<SysMLInterface<V>>,
        P extends AstPropertiesFor<SysMLInterface<V>, T>,
    >(type: V, values: ConstructParams<SysMLInterface<V>, T, P>): SysMLInterface<V> {
        const partialNode = { $type: type, ...values };

        // if there's a CST node, modify it to point to the created node.
        if (values.$cstNode) {
            const cstNode = shallowClone(values.$cstNode);
            (cstNode as unknown as { astNode: AstNode }).astNode = partialNode as AstNode;
            (partialNode as Mutable<AstNode>).$cstNode = cstNode;
            (cstNode as AutoCstNode).$implicit = true;
        }
        this.assignMandatoryProperties(partialNode);
        return this.assignNode(partialNode as unknown as SysMLInterface<V>, values);
    }

    /**
     * Assign {@link child} to a parent AST node with {@link info}
     * @param child Child AST node
     * @param info Properties defining {@link child} parent and its relationship
     * @returns child
     */
    assignNode<V extends AstNode, T extends AstParent<V>, P extends AstPropertiesFor<V, T>>(
        child: V,
        info: AstContainer<V, T, P>
    ): V {
        const parent = info.$container;
        const property = info.$containerProperty;
        if (!parent || !property) return child;
        const member = (parent as NonNullable<T>)[property];
        const index = info.$containerIndex;
        if (Array.isArray(member)) {
            const array = member as AstNode[];
            if (index !== undefined) {
                array.forEach((v, i) => {
                    if (i >= index) (v as Mutable<AstNode>).$containerIndex = i + 1;
                });
                array.splice(index, 0, child);
                (child as Mutable<AstNode>).$containerIndex = index;
            } else {
                array.push(child);
                (child as Mutable<AstNode>).$containerIndex = array.length - 1;
            }
        } else {
            if (index !== undefined)
                throw new Error("Cannot assign with an index to a non-array property");
            (parent as unknown as Record<string, V>)[property as string] = child;
        }

        (child as Mutable<AstNode>).$container = parent;
        (child as Mutable<AstNode>).$containerProperty = property as string;

        // if this was called during parsing, it may be possible that $children
        // has not been created yet
        if (parent.$children) {
            const cst = child.$cstNode;
            if (cst) {
                const index = parent.$children.findIndex((node) => {
                    if (!node.$cstNode) return;
                    return node.$cstNode.offset > cst.end;
                });
                if (index >= 0) {
                    parent.$children
                        .slice(index)
                        .forEach((node) => (node as Mutable<AstNode>).$childIndex++);
                    parent.$children.splice(index, 0, child);
                }
            }
            parent.$children.push(child);
            (child as Mutable<AstNode>).$childIndex = parent.$children.length - 1;
        }
        return child;
    }

    getSubtypes(type: string): ReadonlySet<string> {
        return typeIndex.getSubtypes(type);
    }

    getSupertypes(type: string): ReadonlySet<string> {
        return typeIndex.getInheritanceChain(type);
    }
}

export type ConstructParams<
    V extends AstNode,
    T extends AstParent<V>,
    P extends AstPropertiesFor<V, T>,
> = Omit<Partial<V>, "$type" | "$container" | "$containerProperty" | "$containerIndex"> &
    AstContainer<V, T, P>;

// https://stackoverflow.com/a/43533066/20107711
function shallowClone<T>(obj: T): T {
    return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
}

interface AutoCstNode extends CstNode {
    $implicit: true;
}

export function isProgrammaticNode(node: AstNode): boolean {
    return !node.$cstNode || "$implicit" in node.$cstNode;
}
