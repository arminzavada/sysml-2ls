/********************************************************************************
 * Copyright (c) 2022-2025 Sensmetry UAB and others
 *
 * model program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * model Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { AstNode } from "langium";
import { SysMLInterface, SysMLType } from "../services/index.js";
import * as ast from "../generated/ast.js";
import {
    ActionUsageMeta,
    AnnotationMeta,
    BasicMetamodel,
    ElementMeta,
    EventOccurrenceUsageMeta,
    ExpressionMeta,
    FeatureMembershipMeta,
    FeatureMeta,
    ItemFeatureMeta,
    MembershipMeta,
    MetadataFeatureMeta,
    MultiplicityRangeMeta,
    Operator,
    OwningMembershipMeta,
    ParameterMembershipMeta,
    ReferenceUsageMeta,
    RelationshipMeta,
    getFeatureDirectionKind,
    getTransitionFeatureKind,
    getVisibility,
    prettyAnnotationBody,
    sanitizeName,
    typeIndex,
} from "../model/index.js";
import { streamModel } from "./ast-util.js";
import { Visibility } from "./scope-util.js";

type AstToModelFunction<T extends AstNode = AstNode> = (
    model: NonNullable<T["$meta"]>,
    node: T
) => void;

const AstToModel: {
    [K in SysMLType]?: AstToModelFunction<SysMLInterface<K>>;
} & { default: AstToModelFunction } = {
    default(model, node) {
        model["_ast"] = node;
        model["setParent"](node.$container?.$meta);
    },

    [ast.Comment.$type](model, node) {
        if (node.locale) model.locale = node.locale.substring(1, node.locale.length - 1);
    },

    [ast.FeatureReferenceExpression.$type](model, node) {
        model["_expression"] = node.expression.$meta as MembershipMeta<FeatureMeta>;
    },

    [ast.LiteralBoolean.$type](model, node) {
        model.literal = node.literal;
    },

    [ast.LiteralNumber.$type](model, node) {
        // only check the cst node text for exponential or decimal notation
        model["_isInteger"] = !/[eE.]/.test(node.$cstNode?.text ?? "");
        model["_literal"] = node.literal;
    },

    [ast.LiteralString.$type](model, node) {
        model.literal = node.literal.slice(1, node.literal.length - 1);
    },

    [ast.OperatorExpression.$type](model, node) {
        if (node.operator) model.operator = `'${node.operator}'` as Operator;
    },

    [ast.InvocationExpression.$type](model, node) {
        model["_operands"] = node.operands.map((e) => e.$meta);
    },

    [ast.ElementReference.$type](model, node) {
        model.text = node.text ?? node.$cstNode?.text ?? "";
        model.found.length = node.parts.length;
    },

    [ast.FeatureValue.$type](model, node) {
        model.isDefault = node.isDefault;
        model.isInitial = node.isInitial;
    },

    [ast.Import.$type](model, node) {
        model.isRecursive = !!node.isRecursive;
        model["_importsAll"] = node.importsAll;
        if (model.parent()?.is(ast.Package.$type) && model.parent()?.parent()?.is(ast.Import.$type)) {
            model.visibility = Visibility.public;
        }
    },

    [ast.AnnotatingElement.$type](model, node) {
        model["_annotations"] = node.about.map((a) => a.$meta);
    },

    [ast.Connector.$type](model, node) {
        model["_ends"] = node.ends.map((e) => e.$meta);
    },

    [ast.Element.$type](model, node) {
        model.declaredName = sanitizeName(node.declaredName);
        model.declaredShortName = sanitizeName(node.declaredShortName);
    },

    [ast.Expression.$type](model, node) {
        model["_result"] = node.result?.$meta;
    },

    [ast.SysMLFunction.$type](model, node) {
        model["_result"] = node.result?.$meta;
    },

    [ast.Feature.$type](model, node) {
        model["_value"] = node.value?.$meta;
        model.isOrdered = node.isOrdered;

        model.direction = getFeatureDirectionKind(node.direction);
        model.isPortion = !!node.isPortion;
        model.isComposite = !!node.isComposite || model.isPortion;
        model.isReadonly = !!node.isReadOnly;
        model.isDerived = !!node.isDerived;
        model.isEnd = !!node.isEnd;

        model.isOrdered = node.isOrdered;
        model.isNonUnique = node.isNonunique;
        model["_crossingFeature"] = node.crossingFeature
            ?.$meta as OwningMembershipMeta<FeatureMeta>;
    },

    [ast.Invariant.$type](model, node) {
        model.isNegated = node.isNegated;
    },

    [ast.LibraryPackage.$type](model, node) {
        model.isStandard = node.isStandard;
    },

    [ast.MultiplicityRange.$type](model, node) {
        model["_range"] = node.range?.$meta as OwningMembershipMeta<ExpressionMeta>;
    },

    [ast.Namespace.$type](model, node) {
        model["_prefixes"].length = 0;
        model["_children"].clear();

        model["_prefixes"].push(
            ...node.prefixes.map((m) => m.$meta as OwningMembershipMeta<MetadataFeatureMeta>)
        );
        model["_children"].push(...node.children.map((child) => child.$meta));
    },

    [ast.Dependency.$type](model, node) {
        model["_prefixes"].length = 0;
        model["_children"].clear();

        model["_prefixes"].push(
            ...node.prefixes.map((m) => m.$meta as AnnotationMeta<MetadataFeatureMeta>)
        );
        model["_children"].push(...node.elements.map((child) => child.$meta));
    },

    [ast.Relationship.$type](model, node) {
        model["_visibility"] = getVisibility(node.visibility);

        if (node.target) model["_element"] = node.target.$meta;
        else if (node.targetChain) model["_element"] = node.targetChain.$meta;

        if (node.source) model["_source"] = node.source.$meta;
        else if (node.sourceChain) model["_source"] = node.sourceChain.$meta;
        else if (node.sourceRef) model["_source"] = undefined;

        model["_children"].push(...node.elements.map((e) => e.$meta));
    },

    [ast.TextualAnnotatingElement.$type](model, node) {
        // Body may fail to parse and be left undefined so check here
        if (node.body as string | undefined) model.body = prettyAnnotationBody(node.body);
    },

    [ast.TextualRepresentation.$type](model, node) {
        model.language = node.language.substring(1, node.language.length - 1);
    },

    [ast.Type.$type](model, node) {
        model["_isAbstract"] = Boolean(node.isAbstract);
        model.isSufficient = node.isSufficient;
        model["_multiplicity"] = node.multiplicity
            ?.$meta as OwningMembershipMeta<MultiplicityRangeMeta>;

        model["_heritage"].clear();
        model["_heritage"].push(...node.heritage.map((e) => e.$meta));

        model["_typeRelationships"].clear();
        model["_typeRelationships"].push(...node.typeRelationships.map((e) => e.$meta));
    },

    [ast.RequirementConstraintMembership.$type](model, node) {
        model.kind = node.kind === "assume" ? "assumption" : "requirement";
    },

    [ast.StateSubactionMembership.$type](model, node) {
        model.kind = node.kind;
    },

    [ast.TransitionFeatureMembership.$type](model, node) {
        model["_kind"] = getTransitionFeatureKind(node);
    },

    [ast.AcceptActionUsage.$type](model, node) {
        (model["_payload"] as RelationshipMeta | undefined) = node.payload.$meta;
        (model["_receiver"] as RelationshipMeta | undefined) = node.receiver?.$meta;
    },

    [ast.StateUsage.$type](model, node) {
        model.isParallel = node.isParallel;
    },

    [ast.AssignmentActionUsage.$type](model, node) {
        (model["_targetMember"] as RelationshipMeta) = node.targetMember.$meta;
        (model["_assignedValue"] as RelationshipMeta) = node.assignedValue.$meta;
    },

    [ast.Definition.$type](model, node) {
        model.isIndividual = node.isIndividual;
        model["_isVariation"] = node.isVariation;
    },

    [ast.ForLoopActionUsage.$type](model, node) {
        (model["_variable"] as RelationshipMeta) = node.variable.$meta;
        (model["_sequence"] as RelationshipMeta) = node.sequence.$meta;
        (model["_body"] as RelationshipMeta) = node.body.$meta;
    },

    [ast.IfActionUsage.$type](model, node) {
        model["_condition"] = node.condition.$meta as ParameterMembershipMeta<ExpressionMeta>;
        model["_then"] = node.then.$meta as ParameterMembershipMeta<ActionUsageMeta>;
        model["_else"] = node.else?.$meta as ParameterMembershipMeta<ActionUsageMeta>;
    },

    [ast.SatisfyRequirementUsage.$type](model, node) {
        model["_satisfactionSubject"] = node.satisfactionSubject?.$meta;
    },

    [ast.SendActionUsage.$type](model, node) {
        (model["_payload"] as RelationshipMeta | undefined) = node.payload.$meta;
        (model["_sender"] as RelationshipMeta | undefined) = node.sender?.$meta;
        (model["_receiver"] as RelationshipMeta | undefined) = node.receiver?.$meta;
    },

    [ast.StateDefinition.$type](model, node) {
        model.isParallel = node.isParallel;
    },

    [ast.TerminateActionUsage.$type](model, node) {
        (model["_terminatedOccurrence"] as RelationshipMeta | undefined) =
            node.terminatedOccurrence?.$meta;
    },

    [ast.TransitionUsage.$type](model, node) {
        (model["_source"] as RelationshipMeta | undefined) = node.source?.$meta;
        (model["_accepter"] as RelationshipMeta | undefined) = node.accepter?.$meta;
        (model["_guard"] as RelationshipMeta | undefined) = node.guard?.$meta;
        (model["_effect"] as RelationshipMeta | undefined) = node.effect?.$meta;
        (model["_then"] as RelationshipMeta | undefined) = node.then?.$meta;
        (model["_else"] as RelationshipMeta | undefined) = node.else?.$meta;

        // Only needed so that linking can be resolved...
        if (node.payload) {
            node.payload.$meta = model["_payload"];
            if (node.payload.target)
                node.payload.target.$meta = model["_payload"].element() as ReferenceUsageMeta;
        }

        if (node.transitionLinkSource) {
            node.transitionLinkSource.$meta = model["_transitionLinkSource"];
            if (node.transitionLinkSource.target)
                node.transitionLinkSource.target.$meta = model[
                    "_transitionLinkSource"
                ].element() as ReferenceUsageMeta;
        }
    },

    [ast.Usage.$type](model, node) {
        model.isVariation = node.isVariation;
        model.isIndividual = node.isIndividual;
        model.isReference = node.isReference;
        model.portionKind = node.portionKind;
    },

    [ast.WhileLoopActionUsage.$type](model, node) {
        (model["_condition"] as RelationshipMeta | undefined) = node.condition?.$meta;
        (model["_body"] as RelationshipMeta | undefined) = node.body.$meta;
        (model["_until"] as RelationshipMeta | undefined) = node.until?.$meta;
    },

    [ast.Membership.$type](model, node) {
        model.isAlias = node.isAlias;
    },

    [ast.ItemFlow.$type](model, node) {
        model["_item"] = node.item?.$meta as FeatureMembershipMeta<ItemFeatureMeta>;
    },

    [ast.TriggerInvocationExpression.$type](model, node) {
        model.kind = node.kind;
    },

    [ast.FlowConnectionUsage.$type](model, node) {
        model["_messages"] = node.messages.map(
            (m) => m.$meta as ParameterMembershipMeta<EventOccurrenceUsageMeta>
        );
    },
};

type ClearArtifactsFunction<T extends AstNode = AstNode> = (model: NonNullable<T["$meta"]>) => void;

const ClearArtifacts: { [K in SysMLType]?: ClearArtifactsFunction<SysMLInterface<K>> } & {
    default: ClearArtifactsFunction;
} = {
    default(model) {
        model.setupState = "none";
    },

    [ast.Element.$type](model) {
        model["_comments"] = model["_comments"].filter((e) => e.owner() === model);
        model["_docs"] = model["_docs"].filter((e) => e.owner() === model);
        model["_reps"] = model["_reps"].filter((e) => e.owner() === model);
        model["_metadata"] = model["_metadata"].filter((e) => e.owner() === model);
        model["_metaclass"] = "unset";

        // remove stale lookup members due to reference resolution/heritage
        const garbage: string[] = [];
        for (const [key, value] of model.namedMembers) {
            if (typeof value === "string") {
                garbage.push(key);
            }
        }

        garbage.forEach((key) => model["_memberLookup"].delete(key));
    },

    [ast.Feature.$type](model) {
        // reset effective names
        model["setName"](model.declaredName);
        model["setShortName"](model.declaredShortName);
        model["_impliedIsOrdered"] = false;
        model["typings"] = undefined;
    },

    [ast.ElementReference.$type](model) {
        model.to.reset();
        model.found.fill(undefined);
    },

    [ast.Namespace.$type](model) {
        model["_importResolutionState"] = "none";
    },

    [ast.Dependency.$type](model) {
        model.client.length = 0;
        model.supplier.length = 0;
    },

    [ast.Relationship.$type](model) {
        // remove unowned target element
        if (model.element()?.parent() !== model) model["_element"] = undefined;
        if (model.source() === model.parent() || model.source()?.parent() === model) return;
        model["_source"] = undefined;
    },

    [ast.Type.$type](model) {
        // remove implicit and out-of-line relationships
        const heritage = model.heritage.filter((e) => !e.isImplied && e.parent() === model);
        model["_heritage"].clear();
        model["_heritage"].push(...heritage);

        const typeRelationships = model.typeRelationships.filter(
            (e) => !e.isImplied && e.parent() === model
        );
        model["_typeRelationships"].clear();
        model["_typeRelationships"].push(...typeRelationships);

        model["resetInputParameters"]();
    },

    [ast.Association.$type](model) {
        model["resetEnds"]();
    },

    [ast.Connector.$type](model) {
        model["resetEnds"]();
    },

    [ast.MultiplicityRange.$type](model) {
        model["_bounds"] = "unset";
    },
};

let Ast2ModelChains: Map<string, AstToModelFunction[]> | undefined;

/**
 * Initialize `model` from the parsed AST node `node`
 * @param model
 * @param node
 */
export function astToModel<T extends AstNode>(model: NonNullable<T["$meta"]>, node: T): void {
    if (!Ast2ModelChains) {
        Ast2ModelChains = typeIndex.chain(
            AstToModel as Partial<Record<SysMLType, AstToModelFunction>>,
            "supertype-first"
        );
    }

    Ast2ModelChains.get(node.$type)?.forEach((fn) => fn(model, node));
}

let ClearArtifactsChains: Map<string, ClearArtifactsFunction[]> | undefined;

/**
 * Clear build artifacts from `model` element
 * @param model
 */
export function clearArtifacts(model: BasicMetamodel): void {
    if (!ClearArtifactsChains) {
        ClearArtifactsChains = typeIndex.chain(
            ClearArtifacts as Partial<Record<SysMLType, ClearArtifactsFunction>>,
            // reverse order of the initialization
            "subtype-first"
        );
    }

    ClearArtifactsChains.get(model.nodeType())?.forEach((fn) => fn(model));
}

/**
 * Clear build artifacts from model tree starting at `model` as its root
 * @param model
 */
export function clearTreeArtifacts(model: ElementMeta): void {
    streamModel(model).forEach(clearArtifacts);
}
