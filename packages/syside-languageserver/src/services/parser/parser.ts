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
    assignMandatoryAstProperties,
    CstNode,
    CstNodeBuilder,
    GrammarAST,
    isAstNode,
    LangiumParser,
    Mutable,
    prepareLangiumParser,
    streamContents,
    streamCst,
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

const { isRuleCall } = GrammarAST;
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
    node.$children.push(...streamContents(node).toArray());
    node.$children.sort((a, b) => compareRanges(a.$cstNode?.range, b.$cstNode?.range));
    node.$children.forEach((child, index) => ((child as Mutable<AstNode>).$childIndex = index));
}

/**
 * Extension of Langium CST node builder that performs some postprocessing on
 * the parsed AST nodes.
 */
export class SysMLCstNodeBuilder extends CstNodeBuilder {
    protected readonly postprocessingMap;
    protected readonly services: SysMLDefaultServices;

    constructor(services: SysMLDefaultServices) {
        super();

        this.services = services;

        // map to postprocess specific AST node types after parsing
        const map: ProcessingMap = {
            OperatorExpression: fixOperatorExpression,
            WhileLoopActionUsage: addLoopMember,
            Import: finalizeImport,
            TransitionUsage: createEmptyParametersInTransitionUsage,
            SuccessionAsUsage: createMissingEndsInSuccessionAsUsage,
        };

        this.postprocessingMap = typeIndex.expandToDerivedTypes(
            map as TypeMap<SysMLTypeList, ProcessingFunction>
        );
    }

    override construct(item: { $type: string | symbol | undefined; $cstNode: CstNode }): void {
        super.construct(item);
        if (typeof item.$type === "string") {
            this.postprocessingMap.get(item.$type)?.call(undefined, item as AstNode, this.services);
        }
    }
}

interface MutableLangiumParser extends Mutable<LangiumParser> {
    nodeBuilder: CstNodeBuilder;
}

/**
 * Create and finalize a SysML-flavoured Langium parser.
 *
 * Langium 2.x does not expose its grammar-walker (`createParser` in
 * `parser-builder-base`) on the public surface, so the historic shape of
 * subclassing `LangiumParser` cannot reach upstream's parser builder anymore.
 * Instead we lean on the public extension point that Langium 2.x does
 * provide: the DI module returns the parser instance, and the builder
 * `prepareLangiumParser` exposes the instance before finalization. We compose
 * SysML behaviour onto that instance:
 *
 * - Swap the CST node builder with {@link SysMLCstNodeBuilder} so postprocessing
 *   runs after each AST node is constructed.
 * - Wrap `construct` so children are collected after Langium's mandatory-
 *   property assignment runs (order matters: mandatory arrays must exist
 *   before `streamContents` reads them).
 *
 * The prototype patch for `assignWithoutOverride` (defined later in this file)
 * still applies to the same `LangiumParser` instance via the prototype chain,
 * so SysML's CST-repointing behaviour during subrule merges is preserved.
 */
export function createSysMLParser(services: SysMLDefaultServices): LangiumParser {
    const parser = prepareLangiumParser(services);
    const mutable = parser as unknown as MutableLangiumParser;
    mutable.nodeBuilder = new SysMLCstNodeBuilder(services);

    const originalConstruct = parser.construct.bind(parser);
    mutable.construct = function (pop?: boolean): unknown {
        const value = originalConstruct(pop);
        if (isAstNode(value)) collectChildren(value);
        return value;
    } as LangiumParser["construct"];

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

// CST-repointing patch: when a non-fragment subrule's result merges into a
// wrapping AST node, Langium's default `assignWithoutOverride` doesn't update
// CST→AST links on the merged subrule's CST subtree to point at the new
// target. SysML reuses those `cstNode.astNode` links in downstream services
// (scope provider, linker, …), so we patch in the repointing here.
//
// TODO: retire when https://github.com/langium/langium/pull/898 (or an
// equivalent fix) lands upstream. Verified still needed against
// langium@2.1.3: `LangiumParser.prototype.assignWithoutOverride` does not
// perform CST repointing.
LangiumParser.prototype["assignWithoutOverride"] = function (
    target: Record<string, unknown> & { $cstNode: CstNode },
    source: object & { $type?: string; $cstNode?: CstNode }
): Record<string, unknown> {
    const hasType = target.$type !== undefined;

    for (const [name, existingValue] of Object.entries(source)) {
        const newValue = target[name];
        if (newValue === undefined) {
            target[name] = existingValue;
        } else if (Array.isArray(newValue) && Array.isArray(existingValue)) {
            existingValue.push(...newValue);
            target[name] = existingValue;
        }
    }

    if (!hasType && source.$type) {
        // there seems to be a parser bug where very rarely the target won't
        // have mandatory properties assigned after setting $type
        const reflection = (this as unknown as { astReflection: import("langium").AstReflection })
            .astReflection;
        assignMandatoryAstProperties(reflection, target as unknown as AstNode);
        collectChildren(target as unknown as AstNode);
    }

    if (source.$cstNode) {
        // Langium 2.x renamed the grammar-source pointer from `feature` to
        // `grammarSource` (keeping `feature` as a deprecated alias).
        const feature = (source.$cstNode as unknown as { grammarSource?: unknown })
            .grammarSource as Parameters<typeof isRuleCall>[0] | undefined;
        if (feature && isRuleCall(feature) && feature.rule.ref && !feature.rule.ref.fragment) {
            // Merging `source` from a subrule into target; need to update the
            // source and its children CST nodes to point to the merged AST
            // node instead. Use the public `astNode` setter rather than
            // poking at `_astNode` directly.
            const iterator = streamCst(source.$cstNode).iterator();
            let current = iterator.next();
            while (!current.done) {
                const node = current.value;
                let matches = false;
                try {
                    matches = (node as unknown as { astNode: AstNode }).astNode === source;
                } catch {
                    matches = false;
                }
                if (matches) {
                    // Repoint to the merged target. We resolve target via a
                    // late getter so further merges that replace `target`
                    // continue to be reflected.
                    (node as unknown as { astNode: AstNode }).astNode = target as unknown as AstNode;
                } else {
                    iterator.prune();
                }

                current = iterator.next();
            }
        }
    }

    return target;
};
