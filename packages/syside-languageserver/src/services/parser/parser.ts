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
    AstNode,
    AstUtils,
    isAstNode,
    LangiumParser,
    Mutable,
    prepareLangiumParser,
} from "langium";
import {
    EndFeatureMembership,
    Expose,
    Feature,
    FeatureReferenceExpression,
    Import,
    MembershipExpose,
    MembershipImport,
    MembershipReference,
    NamespaceExpose,
    NamespaceImport,
    NamespaceReference,
    OperatorExpression,
    Package,
    ParameterMembership,
    ReferenceUsage,
    ReturnParameterMembership,
    SuccessionAsUsage,
    TransitionUsage,
    Usage,
    WhileLoopActionUsage,
} from "../../generated/ast.js";
import { typeIndex, TypeMap } from "../../model/types.js";
import { SysMLDefaultServices } from "../services.js";
import { compareRanges } from "../../utils/ast-util.js";
import { SysMLType, SysMLTypeList } from "../sysml-ast-reflection.js";

import { erase } from "../../utils/common.js";

const ClassificationTestOperator = ["istype", "hastype", "@", "as"];

/**
 * The grammar rules that calls `SelfReferenceExpression` rule breaks parsing
 * with Langium, resolve it here.
 */
function fixOperatorExpression(expr: OperatorExpression, services: SysMLDefaultServices): void {
    if (!expr.operands) expr.operands = [];
    if (
        expr.operands.length === 0 &&
        expr.operator &&
        ClassificationTestOperator.includes(expr.operator)
    ) {
        const reflection = services.shared.AstReflection;
        const expression = reflection.createNode(FeatureReferenceExpression, {
            $container: expr,
            $containerProperty: "operands",
            $containerIndex: 0,
        });

        const member = reflection.createNode(ReturnParameterMembership, {
            $container: expression,
            $containerProperty: "expression",
        });

        reflection.createNode(Feature, {
            $container: member,
            $containerProperty: "target",
        });
    }
}

function addLoopMember(node: WhileLoopActionUsage, services: SysMLDefaultServices): void {
    if (!node.condition) {
        const reflection = services.shared.AstReflection;
        const membership = reflection.createNode(ParameterMembership, {
            $container: node,
            $containerProperty: "condition",
        });

        reflection.createNode(Usage, {
            $container: membership,
            $containerProperty: "target",
        });
    }
}

function finalizeImport(node: Import, services: SysMLDefaultServices): void {
    const type: string = node.$type;
    if (type !== Import && type !== Expose) return;
    if (node.isNamespace || node.target) {
        if (node.targetRef) {
            (node.targetRef as Mutable<AstNode>).$type = node.isNamespace
                ? NamespaceReference
                : MembershipReference;
        }
        (node as Mutable<Import>).$type = type === Expose ? NamespaceExpose : NamespaceImport;
        if (node.target && node.targetRef) {
            // need to reparent `node.reference`
            const pack = node.target as Package;
            const imp = services.shared.AstReflection.createNode(
                node.isNamespace ? NamespaceImport : MembershipImport,
                {
                    $container: pack,
                    $containerProperty: "children",
                    $containerIndex: 0,
                    isRecursive: node.isRecursive,
                }
            );
            services.shared.AstReflection.assignNode(node.targetRef, {
                $container: imp,
                $containerProperty: "targetRef",
            });
            erase(node.$children, node.targetRef);
            delete node.targetRef;
        }

        // remove unneeded property
        delete node.isNamespace;
    } else {
        if (node.targetRef) (node.targetRef as Mutable<AstNode>).$type = MembershipReference;
        (node as Mutable<Import>).$type = type === Expose ? MembershipExpose : MembershipImport;
    }
}

// This only exists since Langium doesn't allow linking to elements without AST
// nodes (╯°□°)╯︵ ┻━┻
function createEmptyParametersInTransitionUsage(
    node: TransitionUsage,
    services: SysMLDefaultServices
): void {
    const reflection = services.shared.AstReflection;
    {
        const membership = reflection.createNode(ParameterMembership, {
            $container: node,
            $containerProperty: "transitionLinkSource",
        });

        reflection.createNode(ReferenceUsage, {
            $container: membership,
            $containerProperty: "target",
        });
    }

    if (!node.accepter) return;
    {
        const membership = reflection.createNode(ParameterMembership, {
            $container: node,
            $containerProperty: "payload",
        });

        reflection.createNode(ReferenceUsage, {
            $container: membership,
            $containerProperty: "target",
        });
    }
}

function createMissingEndsInSuccessionAsUsage(
    node: SuccessionAsUsage,
    services: SysMLDefaultServices
): void {
    // `ends` may not have been created yet so it may be undefined
    node.ends ??= [];
    const ends = node.ends.length;
    if (ends >= 2) return;

    const reflection = services.shared.AstReflection;
    // NB: adding CST nodes to the owning element for better validation
    // locations

    let insert = [0, 1];
    // ends === 0 or ends === undefined -> EmptySuccessionMember rule
    // ends === 1 -> missing empty MultiplicitySourceEndMember
    if (ends === 1) {
        if ((node.ends[0].target as Feature).multiplicity) insert = [1];
        else insert = [0];
    }
    for (const index of insert) {
        const member = reflection.createNode(EndFeatureMembership, {
            $container: node,
            $containerProperty: "ends",
            $containerIndex: index,
            $cstNode: node.$cstNode,
        });
        reflection.createNode(Feature, {
            $container: member,
            $containerProperty: "target",
            $cstNode: node.$cstNode,
        });
    }
}

type ProcessingFunction<T extends AstNode = AstNode> = (
    node: T,
    services: SysMLDefaultServices
) => void;
type ProcessingMap = { [K in SysMLType]?: ProcessingFunction<SysMLTypeList[K]> };

/**
 * Collect and cache children AST nodes
 * @param node Node to collect children nodes for
 */
function collectChildren(node: AstNode): void {
    node.$children.length = 0;
    node.$children.push(...AstUtils.streamContents(node).toArray());
    node.$children.sort((a, b) => compareRanges(a.$cstNode?.range, b.$cstNode?.range));
    node.$children.forEach((child, index) => ((child as Mutable<AstNode>).$childIndex = index));
}

function buildPostprocessingMap(): Map<string, ProcessingFunction> {
    const map: ProcessingMap = {
        OperatorExpression: fixOperatorExpression,
        WhileLoopActionUsage: addLoopMember,
        Import: finalizeImport,
        TransitionUsage: createEmptyParametersInTransitionUsage,
        SuccessionAsUsage: createMissingEndsInSuccessionAsUsage,
    };

    return typeIndex.expandToDerivedTypes(
        map as TypeMap<SysMLTypeList, ProcessingFunction>
    );
}

interface MutableLangiumParser extends Mutable<LangiumParser> {
    construct: (...args: unknown[]) => unknown;
}

/**
 * Create and finalize a SysML-flavoured Langium parser.
 *
 * Composes SysML behaviour onto the public parser instance returned by
 * `prepareLangiumParser` (before finalization). The `construct` wrapper runs
 * Langium's own construction (which finalises the CST, fills in mandatory
 * properties, etc.) first, then collects `$children` and applies
 * type-specific SysML postprocessing in the right order — `$children` and
 * other mandatory arrays must exist before postprocessors that splice into
 * them (e.g. `finalizeImport`) can run.
 */
export function createSysMLParser(services: SysMLDefaultServices): LangiumParser {
    const parser = prepareLangiumParser(services);
    const mutable = parser as unknown as MutableLangiumParser;

    const postprocessingMap = buildPostprocessingMap();
    const originalConstruct = mutable.construct.bind(mutable);
    mutable.construct = function (...args: unknown[]): unknown {
        const value = originalConstruct(...args);
        if (isAstNode(value)) {
            collectChildren(value);
            if (typeof value.$type === "string") {
                postprocessingMap.get(value.$type)?.call(undefined, value, services);
            }
        }
        return value;
    };

    parser.finalize();
    return parser;
}

/**
 * Re-export of {@link createSysMLParser} preserved for backwards compatibility
 * with callers that historically expected a `SysMLParser`-typed return.
 *
 * @deprecated use {@link createSysMLParser}; this alias may be removed in a
 * future Langium upgrade.
 */
export const SysMLParser = LangiumParser;
export type SysMLParser = LangiumParser;

declare module "../../generated/ast.js" {
    interface ElementReference {
        text?: string;
    }
}

declare module "langium" {
    interface AstNode {
        /**
         * Direct children of this AST node
         */
        readonly $children: AstNode[];

        /**
         * Index of this AST node in parent {@link $children} container
         */
        readonly $childIndex: number;
    }
}

