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
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Element } from "#generated/ast.js";
import { SubtypeKeys, SysMLInterface, SysMLType } from "../../services/index.js";
import {
    Doc,
    PrintCommentContext,
    TextComment,
    hardline,
    indent,
    inheritLabel,
    join,
    literals,
    newLineCount,
    printComment,
    printIgnored,
    printKerMLNote,
    streamModel,
    surroundWithComments,
    text,
} from "../../utils/index.js";
import { ElementMeta, ElementReferenceMeta } from "../KerML/index.js";
import * as ast from "#generated/ast.js";
import { SemanticTokenTypes } from "vscode-languageserver";
import { FormatOptions, DefaultFormatOptions } from "./format-options.js";
import * as expr from "./expressions.js";
import * as edges from "./edges.js";
import {
    ElementRange,
    KerMLKeywords,
    SysMLKeywords,
    getElementEnd,
    getElementStart,
    hasFormatIgnore,
    throwError,
} from "./utils.js";
import { BasicMetamodel } from "../metamodel.js";
import assert from "assert";
import {
    printDocumentation,
    printCommentElement,
    printTextualRepresentation,
    printMetadataFeature,
} from "./annotating-elements.js";
import * as nss from "./namespaces.js";
import * as connectors from "./connectors.js";
import * as sysml from "./definition-usages.js";
import * as actions from "./actions.js";
import * as successions from "./successions.js";

export interface ModelPrinterContext extends PrintCommentContext {
    /**
     * Printer language mode. Some elements may only be printed in `kerml` mode,
     * others - in `sysml`, and some may use different keywords depending on the
     * mode.
     */
    mode: "sysml" | "kerml";

    /**
     * Set of restricted keywords for the language. This will be used to
     * surround clashing names with quotes.
     */
    keywords: Set<string>;

    /**
     * If true, highlighting information will also be collected. Mainly applies
     * to identifiers and references since modifiers have to be computed for
     * them.
     */
    highlighting?: boolean;

    /**
     * Formatting options.
     */
    format: FormatOptions;

    /**
     * Printer for programmatic references, i.e. those that do not have
     * corresponding AST `ElementReference`. Not used for source text
     * formatting.
     */
    referencePrinter(target: ElementMeta, scope: ElementMeta, context: ModelPrinterContext): Doc;

    /**
     * If true, printer will format elements even they have notes ignoring formatting.
     */
    forceFormatting: boolean;

    /**
     * Cache of already printed notes.
     */
    printed: Set<TextComment>;
}

export function assertSysML(context: ModelPrinterContext, type: string): void {
    assert(context.mode === "sysml", `${type} can only be printed in SysML mode`);
}

export function assertKerML(context: ModelPrinterContext, type: string): void {
    assert(context.mode === "kerml", `${type} can only be printed in KerML mode`);
}

export type ContextOptions = Partial<
    Pick<ModelPrinterContext, "highlighting" | "format" | "forceFormatting">
>;

export function defaultKerMLPrinterContext(options: ContextOptions = {}): ModelPrinterContext {
    return {
        mode: "kerml",
        keywords: KerMLKeywords(),
        format: options.format ?? DefaultFormatOptions,
        referencePrinter: function (): Doc {
            throw new Error("Programmatic reference printing is not implemented.");
        },
        printComment: printKerMLNote,
        printed: new Set(),
        highlighting: Boolean(options.highlighting),
        forceFormatting: Boolean(options.forceFormatting),
    };
}

export function defaultSysMLPrinterContext(options: ContextOptions = {}): ModelPrinterContext {
    return {
        ...defaultKerMLPrinterContext(options),
        keywords: SysMLKeywords(),
        mode: "sysml",
    };
}

type PrintFunction<T extends ElementMeta = ElementMeta> = (
    node: T,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
) => Doc;

/* istanbul ignore next */
const abstractElement = (node: ElementMeta): never =>
    throwError(node, `Cannot print abstract element with type ${node.nodeType()}`);
/* istanbul ignore next */
const typeUnion = (node: ElementMeta): never =>
    throwError(node, `Cannot print type union ${node.nodeType()}`);
/* istanbul ignore next */
const directPrint = (node: ElementMeta): never =>
    throwError(node, `Cannot print element with  type ${node.nodeType()} directly`);

const ModelPrinter: Omit<
    {
        [K in SysMLType]: SysMLInterface<K> extends Element
            ? PrintFunction<SysMLInterface<K>["$meta"]>
            : never;
    },
    // TS complains about missing `never` properties so omit them
    SubtypeKeys<ast.ElementReference>
> = {
    // Expressions
    [ast.CollectExpression.$type](node, context) {
        return expr.printOperatorExpression(node, context);
    },
    [ast.FeatureChainExpression.$type](node, context) {
        return expr.printOperatorExpression(node, context);
    },
    [ast.FeatureReferenceExpression.$type](node, context) {
        return expr.printFeatureReferenceExpression(node, context);
    },
    [ast.IndexExpression.$type](node, context) {
        return expr.printOperatorExpression(node, context);
    },
    [ast.InvocationExpression.$type](node, context) {
        return expr.printInvocationExpr(node, context);
    },
    [ast.ConstructorExpression.$type](node, context) {
        // TODO(phase-2a+): dedicated printing for `new T(args)`; currently shares InvocationExpression layout
        return expr.printInvocationExpr(node, context);
    },
    [ast.MetadataAccessExpression.$type](node, context) {
        return expr.printMetadataAccessExpression(node, context);
    },
    [ast.OperatorExpression.$type](node, context) {
        return expr.printOperatorExpression(node, context);
    },
    [ast.SelectExpression.$type](node, context) {
        return expr.printOperatorExpression(node, context);
    },
    [ast.TriggerInvocationExpression.$type](node, context) {
        return expr.printTriggerInvocationExpression(node, context);
    },
    [ast.LiteralBoolean.$type](node) {
        return node.literal ? literals.true : literals.false;
    },
    [ast.LiteralInfinity.$type]() {
        return text("*");
    },
    [ast.LiteralNumber.$type](node, context) {
        return expr.printLiteralNumber(node, context);
    },
    [ast.LiteralString.$type](node) {
        // TODO: unescape on assignment and escape here
        return text(JSON.stringify(node.literal), { type: SemanticTokenTypes.string });
    },
    [ast.NullExpression.$type](node, context) {
        return expr.printNullExpression(node, context);
    },

    // Memberships
    [ast.ActorMembership.$type](node, context, previousSibling) {
        return edges.printActorMembership(node, context, previousSibling);
    },
    [ast.ElementFilterMembership.$type](node, context) {
        return edges.printElementFilterMembership(node, context);
    },
    [ast.FeatureMembership.$type](node, context, previousSibling) {
        return edges.printGenericMembership(undefined, node, context, { previousSibling });
    },
    [ast.FramedConcernMembership.$type](node, context, previousSibling) {
        return edges.printFramedConcernMembership(node, context, previousSibling);
    },
    [ast.Membership.$type](node, context, previousSibling) {
        return edges.printMembership(node, context, { previousSibling });
    },
    [ast.ObjectiveMembership.$type](node, context, previousSibling) {
        return edges.printObjectiveMembership(node, context, previousSibling);
    },
    [ast.OwningMembership.$type](node, context, previousSibling) {
        return edges.printOwningMembership(node, context, previousSibling);
    },
    [ast.RequirementConstraintMembership.$type](node, context, previousSibling) {
        return edges.printRequirementConstraintMembership(node, context, previousSibling);
    },
    [ast.RequirementVerificationMembership.$type](node, context, previousSibling) {
        return edges.printRequirementVerificationMembership(node, context, previousSibling);
    },
    [ast.ResultExpressionMembership.$type](node, context, previousSibling) {
        return edges.printGenericMembership(undefined, node, context, { previousSibling });
    },
    [ast.ReturnParameterMembership.$type](node, context, previousSibling) {
        return edges.printGenericMembership("return", node, context, { previousSibling });
    },
    [ast.StakeholderMembership.$type](node, context, previousSibling) {
        return edges.printStakeholderMembership(node, context, previousSibling);
    },
    [ast.StateSubactionMembership.$type](node, context) {
        return actions.printStateSubactionMembership(node, context);
    },
    [ast.SubjectMembership.$type](node, context, previousSibling) {
        return edges.printSubjectMembership(node, context, previousSibling);
    },
    [ast.VariantMembership.$type](node, context, previousSibling) {
        return edges.printVariantMembership(node, context, previousSibling);
    },
    [ast.ViewRenderingMembership.$type](node, context, previousSibling) {
        return edges.printViewRenderingMembership(node, context, previousSibling);
    },

    // Other Relationships
    [ast.Annotation.$type](node, context) {
        const source = node.source();
        if (source?.parent() === node) return printModelElement(source, context);

        /* istanbul ignore next */ // printed directly
        return edges.printTarget(node, context);
    },
    [ast.Conjugation.$type](node, context) {
        return edges.printConjugation(node, context);
    },
    [ast.Dependency.$type](node, context) {
        return edges.printDependency(node, context);
    },
    [ast.Disjoining.$type](node, context) {
        return edges.printDisjoining(node, context);
    },
    [ast.FeatureInverting.$type](node, context) {
        return edges.printFeatureInverting(node, context);
    },
    [ast.FeatureTyping.$type](node, context) {
        return edges.printFeatureTyping(node, context);
    },
    [ast.FeatureValue.$type](node, context) {
        return edges.printFeatureValue(node, context);
    },
    [ast.NamespaceExpose.$type](node, context) {
        assertSysML(context, node.nodeType());
        return edges.printNamespaceImport("expose", node, context);
    },
    [ast.NamespaceImport.$type](node, context) {
        return edges.printNamespaceImport(node.importsAll ? "import all" : "import", node, context);
    },
    [ast.MembershipExpose.$type](node, context) {
        assertSysML(context, node.nodeType());
        return edges.printMembershipImport("expose", node, context);
    },
    [ast.MembershipImport.$type](node, context) {
        return edges.printMembershipImport(
            node.importsAll ? "import all" : "import",
            node,
            context
        );
    },
    [ast.Redefinition.$type](node, context) {
        return edges.printRedefinition(node, context);
    },
    [ast.Specialization.$type](node, context) {
        return edges.printSpecialization(node, context);
    },
    [ast.Subclassification.$type](node, context) {
        return edges.printSubclassification(node, context);
    },
    [ast.Subsetting.$type](node, context) {
        return edges.printSubsetting(node, context);
    },
    [ast.TypeFeaturing.$type](node, context) {
        return edges.printTypeFeaturing(node, context);
    },

    // Annotating Elements
    [ast.Comment.$type]: printCommentElement,
    [ast.Documentation.$type]: printDocumentation,
    [ast.MetadataFeature.$type]: printMetadataFeature,
    [ast.TextualRepresentation.$type]: printTextualRepresentation,

    // Connectors
    [ast.AllocationUsage.$type](node, context) {
        return connectors.printAllocationUsage(node, context);
    },
    [ast.BindingConnector.$type](node, context) {
        return connectors.printBindingConnector(node, context);
    },
    [ast.BindingConnectorAsUsage.$type](node, context) {
        return connectors.printBindingConnectorAsUsage(node, context);
    },
    [ast.ConnectionUsage.$type](node, context) {
        return connectors.printConnectionUsage(node, context);
    },
    [ast.Connector.$type](node, context) {
        return connectors.printConnector(node, context);
    },
    [ast.FlowUsage.$type](node, context) {
        return connectors.printFlowUsage(node, context);
    },
    [ast.ItemFlow.$type](node, context) {
        return connectors.printItemFlow("flow", node, context, {
            sourceFormat: context.format.item_flow_from_keyword,
        });
    },
    [ast.ItemFlowEnd.$type](node, context) {
        return connectors.printItemFlowEnd(node, context);
    },
    [ast.ItemFeature.$type](node, context) {
        return connectors.printItemFeature(node, context);
    },
    [ast.Succession.$type](node, context) {
        return connectors.printSuccession(node, context);
    },
    [ast.SuccessionAsUsage.$type](node, context, previousSibling) {
        return successions.printSuccessionAsUsage(node, context, previousSibling);
    },
    [ast.SuccessionFlowUsage.$type](node, context) {
        return connectors.printGenericFlowUsage("succession flow", node, context, {
            sourceFormat: context.format.succession_flow_connection_usage_from_keyword,
        });
    },
    [ast.SuccessionItemFlow.$type](node, context) {
        return connectors.printItemFlow("succession flow", node, context, {
            sourceFormat: context.format.item_flow_from_keyword,
        });
    },
    [ast.TransitionUsage.$type](node, context, previousSibling) {
        return successions.printTransitionUsage(node, context, previousSibling);
    },
    [ast.InterfaceUsage.$type](node, context) {
        return connectors.printInterfaceUsage(node, context);
    },

    // KerML
    [ast.Association.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "assoc", node, context);
    },
    [ast.AssociationStructure.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "assoc struct", node, context);
    },
    [ast.Behavior.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "behavior", node, context);
    },
    [ast.BooleanExpression.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printKerMLFeature("bool", node, context);
    },
    [ast.Class.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "class", node, context);
    },
    [ast.Classifier.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "classifier", node, context);
    },
    [ast.DataType.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "datatype", node, context);
    },
    [ast.Expression.$type](node, context) {
        return expr.printExpression(node, context);
    },
    [ast.Feature.$type](node, context) {
        return nss.printFeature(node, context);
    },
    [ast.Interaction.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "interaction", node, context);
    },
    [ast.Invariant.$type](node, context) {
        return nss.printInvariant(node, context);
    },
    [ast.LibraryPackage.$type](node, context) {
        return nss.printNonTypeNamespace(
            node.isStandard ? "standard library" : "library",
            "package",
            node,
            context
        );
    },
    [ast.Metaclass.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "metaclass", node, context);
    },
    [ast.Multiplicity.$type](node, context) {
        return nss.printMultiplicity(node, context);
    },
    [ast.MultiplicityRange.$type](node, context) {
        return nss.printMultiplicityRange(node, context);
    },
    [ast.Namespace.$type](node, context) {
        return nss.printNamespace(node, context);
    },
    [ast.Package.$type](node, context) {
        return nss.printNonTypeNamespace(undefined, "package", node, context);
    },
    [ast.Predicate.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "predicate", node, context);
    },
    [ast.Step.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printKerMLFeature("step", node, context);
    },
    [ast.Structure.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "struct", node, context);
    },
    [ast.SysMLFunction.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "function", node, context);
    },
    [ast.Type.$type](node, context) {
        assertKerML(context, node.nodeType());
        return nss.printType("auto", "type", node, context);
    },

    // SysML
    [ast.AcceptActionUsage.$type](node, context) {
        return actions.printAcceptActionUsage(node, context);
    },
    [ast.ActionDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "action def", node, context, {
            join: actions.actionBodyJoiner(),
        });
    },
    [ast.ActionUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "action", node, context, {
            join: actions.actionBodyJoiner(),
        });
    },
    [ast.AllocationDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "allocation def", node, context);
    },
    [ast.AnalysisCaseDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "analysis def", node, context);
    },
    [ast.AnalysisCaseUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "analysis", node, context);
    },
    [ast.AssertConstraintUsage.$type](node, context) {
        return sysml.printAssertConstraint(node, context);
    },
    [ast.AssignmentActionUsage.$type](node, context) {
        return actions.printAssignmentAction(node, context);
    },
    [ast.AttributeDefinition.$type](node, context) {
        return sysml.printGenericDefinition("auto", "attribute def", node, context);
    },
    [ast.AttributeUsage.$type](node, context) {
        return sysml.printAttributeUsage(node, context);
    },
    [ast.CalculationDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "calc def", node, context);
    },
    [ast.CalculationUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "calc", node, context);
    },
    [ast.CaseDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "case def", node, context);
    },
    [ast.CaseUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "case", node, context);
    },
    [ast.ConcernDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "concern def", node, context);
    },
    [ast.ConcernUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "concern", node, context);
    },
    [ast.ConnectionDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "connection def", node, context);
    },
    [ast.ConstraintDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "constraint def", node, context);
    },
    [ast.ConstraintUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "constraint", node, context);
    },
    [ast.Definition.$type](node, context) {
        // assuming extended definition with at least one prefix
        return sysml.printGenericDefinition("auto", "def", node, context);
    },
    [ast.EnumerationDefinition.$type](node, context) {
        return sysml.printGenericDefinition([], "enum def", node, context);
    },
    [ast.EnumerationUsage.$type](node, context) {
        return sysml.printEnumerationUsage(node, context);
    },
    [ast.EventOccurrenceUsage.$type](node, context) {
        return sysml.printEventOccurrence(node, context);
    },
    [ast.ExhibitStateUsage.$type](node, context) {
        return sysml.printExhibitState(node, context);
    },
    [ast.FlowDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "flow def", node, context);
    },
    [ast.IncludeUseCaseUsage.$type](node, context) {
        return sysml.printIncludeUseCase(node, context);
    },
    [ast.InterfaceDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "interface def", node, context);
    },
    [ast.ItemDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "item def", node, context);
    },
    [ast.ItemUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "item", node, context);
    },
    /* istanbul ignore next */ // matches empty string so not parsed as AST
    [ast.LifeClass.$type]() {
        return literals.emptytext;
    },
    [ast.MetadataDefinition.$type](node, context) {
        return sysml.printGenericDefinition("auto", "metadata def", node, context);
    },
    [ast.MetadataUsage.$type]: printMetadataFeature,
    [ast.OccurrenceDefinition.$type](node, context) {
        return sysml.printOccurrenceDefinition(node, context);
    },
    [ast.OccurrenceUsage.$type](node, context) {
        return sysml.printOccurrenceUsage(node, context);
    },
    [ast.PartDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "part def", node, context);
    },
    [ast.PartUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "part", node, context);
    },
    [ast.PerformActionUsage.$type](node, context) {
        return sysml.printPerformAction(node, context);
    },
    [ast.PortDefinition.$type](node, context) {
        return sysml.printGenericDefinition("auto", "port def", node, context);
    },
    [ast.PortUsage.$type](node, context) {
        return sysml.printPortUsage(node, context);
    },
    [ast.ReferenceUsage.$type](node, context) {
        return sysml.printReferenceUsage(node, context);
    },
    [ast.RenderingDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "rendering def", node, context);
    },
    [ast.RenderingUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "rendering", node, context);
    },
    [ast.RequirementDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "requirement def", node, context);
    },
    [ast.RequirementUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "requirement", node, context);
    },
    [ast.SatisfyRequirementUsage.$type](node, context) {
        return sysml.printSatisfyRequirement(node, context);
    },
    [ast.SendActionUsage.$type](node, context) {
        return actions.printSendAction(node, context);
    },
    [ast.StateDefinition.$type](node, context) {
        return actions.printStateDefinition(node, context);
    },
    [ast.StateUsage.$type](node, context) {
        return actions.printStateUsage(node, context);
    },
    [ast.TerminateActionUsage.$type](node, context) {
        return actions.printTerminateAction(node, context);
    },
    [ast.Usage.$type](node, context) {
        // assuming extended usage with at least one prefix
        return sysml.printGenericUsage("auto", undefined, node, context);
    },
    [ast.UseCaseDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "use case def", node, context);
    },
    [ast.UseCaseUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "use case", node, context);
    },
    [ast.VerificationCaseDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "verification def", node, context);
    },
    [ast.VerificationCaseUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "verification", node, context);
    },
    [ast.ViewDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "view def", node, context);
    },
    [ast.ViewUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "view", node, context);
    },
    [ast.ViewpointDefinition.$type](node, context) {
        return sysml.printGenericOccurrenceDefinition("auto", "viewpoint def", node, context);
    },
    [ast.ViewpointUsage.$type](node, context) {
        return sysml.printGenericOccurrenceUsage("auto", "viewpoint", node, context);
    },

    // SysML Control Flow
    [ast.DecisionNode.$type](node, context) {
        return actions.printControlNode("decide", node, context);
    },
    [ast.ForLoopActionUsage.$type](node, context) {
        return actions.printForLoop(node, context);
    },
    [ast.ForkNode.$type](node, context) {
        return actions.printControlNode("fork", node, context);
    },
    [ast.IfActionUsage.$type](node, context) {
        return actions.printIfAction(node, context);
    },
    [ast.JoinNode.$type](node, context) {
        return actions.printControlNode("join", node, context);
    },
    [ast.MergeNode.$type](node, context) {
        return actions.printControlNode("merge", node, context);
    },
    [ast.WhileLoopActionUsage.$type](node, context) {
        return actions.printWhileLoop(node, context);
    },

    [ast.AnnotatingElement.$type]: abstractElement,
    [ast.ConnectorAsUsage.$type]: abstractElement,
    [ast.ControlNode.$type]: abstractElement,
    [ast.Element.$type]: abstractElement,
    [ast.Expose.$type]: abstractElement,
    [ast.Featuring.$type]: abstractElement,
    [ast.Import.$type]: abstractElement,
    [ast.Inheritance.$type]: abstractElement,
    [ast.LiteralExpression.$type]: abstractElement,
    [ast.LoopActionUsage.$type]: abstractElement,
    [ast.Relationship.$type]: abstractElement,
    [ast.TextualAnnotatingElement.$type]: abstractElement,

    [ast.InlineExpression.$type]: typeUnion,
    [ast.FeatureRelationship.$type]: typeUnion,
    [ast.NonOwnerType.$type]: typeUnion,
    [ast.TransparentElement.$type]: typeUnion,
    [ast.TypeRelationship.$type]: typeUnion,

    // these elements can't appear on their own in textual syntax
    [ast.ConjugatedPortDefinition.$type]: directPrint,
    [ast.ConjugatedPortTyping.$type]: directPrint,
    [ast.CrossSubsetting.$type]: directPrint,
    [ast.Differencing.$type]: directPrint,
    [ast.EndFeatureMembership.$type]: directPrint,
    [ast.FeatureChaining.$type]: directPrint,
    [ast.Intersecting.$type]: directPrint,
    [ast.ParameterMembership.$type]: directPrint,
    [ast.PortConjugation.$type]: directPrint,
    [ast.ReferenceSubsetting.$type]: directPrint,
    [ast.TransitionFeatureMembership.$type]: directPrint,
    [ast.Unioning.$type]: directPrint,
};

const UnprintedWarnings: Partial<Record<SysMLType, boolean>> = {
    // The only way for namespace notes to not be printed is if the root node
    // had no children, only some notes. This is safe to ignore since such notes
    // have no way of interfering with any other elements.
    Namespace: true,
};

function printMissedInnerNotes<T extends Doc>(
    doc: T,
    notes: readonly TextComment[],
    context: ModelPrinterContext,
    debugType: SysMLType
): Doc[] | T {
    const unprintedTrailingNotes = notes.filter(
        (note) => note.localPlacement === "inner" && !context.printed.has(note)
    );
    if (unprintedTrailingNotes.length === 0) return doc;

    // print all remaining inner comments as a catch all in case specific
    // printers have missed them
    if (unprintedTrailingNotes.some((note) => note.$cstNode) && !UnprintedWarnings[debugType]) {
        // there are no limits what can be attached programmatically so only
        // report if notes in the source file have not been printed yet
        console.warn(`${debugType} printer did not print some inner comments, please FIX ME.`);
        // only emit warnings once per type
        UnprintedWarnings[debugType] = true;
    }

    return inheritLabel(doc, (contents) => [
        join(
            hardline,
            // already filtered so don't have to use `printInnerComments`
            unprintedTrailingNotes.map((note) => printComment(note, context)),
            true
        ),
        contents,
    ]);
}

/**
 * Default handler for all remaining owned unprinted notes. Leading notes will
 * be printed leading to the element, while any missed inner and trailing notes
 * -- trailing the element. Labels will be propagated.
 */
export function defaultPrintNotes<T extends Doc>(
    doc: T | Doc[],
    element: BasicMetamodel,
    context: ModelPrinterContext
): T | Doc[] {
    doc = printMissedInnerNotes(doc, element.notes, context, element.nodeType());
    doc = surroundWithComments(doc, element.notes, context);
    return doc;
}

export type ElementPrinter<T = ElementMeta, R extends Doc = Doc> = (
    node: T,
    context: ModelPrinterContext,
    previousSibling?: ElementMeta
) => R;

/**
 * Default element printer for all valid element types. Note that some elements
 * cannot be printed directly, others assume that special variants, such as
 * relationships inside declarations, are printed directly so may not result in
 * expected behavior in all cases.
 */
export const DefaultElementPrinter: ElementPrinter = (node, context, previousSibling?) => {
    const type = node.nodeType();
    return (ModelPrinter as unknown as Record<SysMLType, PrintFunction>)[type].call(
        ModelPrinter,
        node,
        context,
        previousSibling
    );
};

export interface PrintModelElementOptions<T = ElementMeta, R extends Doc = Doc> {
    /**
     * Previous sibling in the current scope used to preserve empty lines
     * between siblings.
     */
    previousSibling?: ElementMeta;

    /**
     * Override for default element printer. The printer can skip printing
     * leading and trailing notes.
     */
    printer?: ElementPrinter<T, R>;
}

/**
 * Prints a model element to document, handles leading and trailing notes and
 * inserts an empty line if the current `element` is separated by more than one
 * empty line to the `previousSibling`.
 */
export function printModelReference<T extends ElementReferenceMeta>(
    element: T,
    context: ModelPrinterContext,
    options: Required<Omit<PrintModelElementOptions<T>, "previousSibling">>
): Doc {
    const cst = element.cst();
    let doc =
        !context.forceFormatting && hasFormatIgnore(element) && cst
            ? printIgnored(
                  element.document.textDocument.getText(),
                  cst,
                  element.notes,
                  context.printed
              )
            : undefined;
    doc ??= options.printer(element, context);
    return defaultPrintNotes(doc, element, context);
}

export function printModelElement(
    element: ElementMeta,
    context: ModelPrinterContext,
    options?: Omit<PrintModelElementOptions<ElementMeta, Doc>, "printer">
): Doc;
export function printModelElement<T extends ElementMeta, R extends Doc>(
    element: T,
    context: ModelPrinterContext,
    options: PrintModelElementOptions<T, R> &
        Required<Pick<PrintModelElementOptions<T, R>, "printer">>
): R | Doc[];
export function printModelElement<T extends ElementMeta, R extends Doc>(
    element: T,
    context: ModelPrinterContext,
    options?: PrintModelElementOptions<T, R>
): R | Doc[] | Doc;

/**
 * Prints a model element to document, handles leading and trailing notes and
 * inserts an empty line if the current `element` is separated by more than one
 * empty line to the `previousSibling`.
 */
export function printModelElement<T extends ElementMeta>(
    element: T,
    context: ModelPrinterContext,
    options: PrintModelElementOptions<T> = {}
): Doc {
    let doc =
        !context.forceFormatting && hasFormatIgnore(element)
            ? printElementIgnored(element, context)
            : undefined;
    doc ??= (options.printer ?? DefaultElementPrinter)(element, context, options.previousSibling);
    doc = defaultPrintNotes(doc, element, context);

    const { previousSibling } = options;
    // don't need to duplicate work as owning memberships will forward their
    // previous siblings here
    if (!previousSibling || element.parent()?.is(ast.OwningMembership.$type)) return doc;

    const start = getElementStart(element);
    const end = getElementEnd(previousSibling);

    doc = newLineCount(end, start) > 1 ? inheritLabel(doc, (doc) => [hardline, doc]) : doc;
    return doc;
}

/**
 * Prints an array of elements to document, assuming `elements` is an array of
 * siblings in that specific order without any other siblings skipped.
 */
export function printModelElements<T extends ElementMeta>(
    elements: readonly T[],
    context: ModelPrinterContext,
    options: PrintModelElementOptions<T> = {}
): Doc[] {
    return elements.map((e, i) =>
        printModelElement(e, context, {
            ...options,
            previousSibling: i > 0 ? elements[i - 1] : options.previousSibling,
        })
    );
}

/**
 * Collects all unprinted notes from `root` subtree, useful for debugging in
 * case some notes have not been printed, i.e. when printing some elements
 * directly.
 */
export function collectUnprintedNotes(root: ElementMeta, printed: Set<TextComment>): TextComment[] {
    return streamModel(root)
        .flatMap((e) => e.notes)
        .filter((note) => !printed.has(note))
        .toArray();
}

export function printElementIgnored(
    node: ElementMeta,
    context: ModelPrinterContext
): Doc | undefined {
    const cst = node.cst();
    /* istanbul ignore next */
    if (!cst) return;
    return printIgnored(
        node.document.textDocument.getText(),
        cst,
        streamModel(node).flatMap((e) => e.notes),
        context.printed
    );
}

/**
 * Prints a model range to `Doc`
 *
 * @see {@link collectPrintRange}
 */
export function printModelRange(range: ElementRange, context: ModelPrinterContext): Doc {
    const printed = printModelElements(range.elements, context, range.options);
    let doc: Doc;
    if (context.mode === "kerml") doc = join(hardline, printed);
    else {
        doc = actions.actionBodyJoiner()(range.elements, printed, range.leading);
    }
    for (let i = 0; i < range.level; ++i) doc = indent(doc);

    return doc;
}
