import { expandToNode, Generated } from "langium/generate";
import { ast } from "../../..";
import { SemantifyrBaseMapper } from "./SemantifyrBaseMapper";
import { SemantifyrMapperServices } from "./SemantifyrMapperModule";
import {
    isPortUsage,
    isPartUsage,
    isItemFlow,
    isAttributeUsage,
    isExhibitStateUsage,
    ItemFlowEnd,
    isBindingConnectorAsUsage,
    BindingConnectorAsUsage,
} from "#generated/ast";
import { SemantifyrExpressionStringifier } from "./SemantifyrExpressionStringifier";
import { SemantifyrStateMapper } from "./SemantifyrStateMapper";

export class SemantifyrPartMapper extends SemantifyrBaseMapper {
    private readonly expressionStringifier: SemantifyrExpressionStringifier;
    private readonly stateMapper: SemantifyrStateMapper;

    constructor(services: SemantifyrMapperServices) {
        super(services);

        this.expressionStringifier = services.expressionStringifier;
        this.stateMapper = services.stateMapper;
    }

    public mapPartDefinition(scope: ast.Namespace, part: ast.PartDefinition): Generated {
        this.unsupportedHeritage(part);
        const childElements = part.children.map((m) => m.target);
        for (const extraState of childElements.filter(isExhibitStateUsage).slice(1)) {
            this.unsupported(extraState, "Semantifyr supports one exhibit state per part");
        }

        // Drop the local port that a binding rebinds; mapBindingConnectorAsUsage
        // emits the rebinding declaration in its place.
        for (const element of childElements) {
            if (!isBindingConnectorAsUsage(element)) continue;
            const sourcePort = element.$meta.sourceFeature()?.ast();
            if (sourcePort) childElements.remove(sourcePort);
        }

        return this.expandToBlock(
            `class ${this.declare(scope, part)} : Part`,
            childElements,
            (e) => this.mapMemberElements(part, e),
            { appendNewLineIfNotEmpty: true }
        );
    }

    private mapMemberElements(
        part: ast.PartDefinition,
        element: ast.Element | undefined
    ): Generated {
        if (element === undefined) {
            return undefined;
        }

        if (isPortUsage(element)) {
            return this.mapPortUsage(part, element);
        }

        if (isPartUsage(element)) {
            return this.mapPartUsage(part, element);
        }

        if (isItemFlow(element)) {
            return this.mapItemFlow(part, element);
        }

        if (isAttributeUsage(element)) {
            return this.mapAttributeUsage(part, element);
        }

        if (isExhibitStateUsage(element)) {
            return this.stateMapper.mapExhibitStateUsage(part, element);
        }

        if (isBindingConnectorAsUsage(element)) {
            return this.mapBindingConnectorAsUsage(part, element);
        }

        if (this.isAnnotation(element)) {
            return undefined;
        }

        return this.unsupported(
            element,
            `Semantifyr does not support a ${element.$type} in a part definition`
        );
    }

    private mapPortUsage(part: ast.PartDefinition, portUsage: ast.PortUsage): Generated {
        const portName = this.declare(part, portUsage);
        const portType = this.mapTypeOfPort(portUsage);

        return `contains ${portName}: ${portType} subsets ports`;
    }

    private mapBindingConnectorAsUsage(
        part: ast.PartDefinition,
        bindingConnectorAsUsage: BindingConnectorAsUsage
    ): Generated {
        const meta = bindingConnectorAsUsage.$meta;
        const sourcePort = meta.sourceFeature()?.ast();
        const targetFeature = meta.targetFeature()?.ast();
        if (!sourcePort) {
            return this.unsupported(
                bindingConnectorAsUsage,
                "Binding connector source port could not be resolved"
            );
        }
        if (!isPortUsage(sourcePort)) {
            return this.unsupported(
                bindingConnectorAsUsage,
                "Binding connector source must be a port"
            );
        }
        if (!targetFeature) {
            return this.unsupported(
                bindingConnectorAsUsage,
                "Binding connector target could not be resolved"
            );
        }

        const sourcePortUsageName = this.declare(part, sourcePort);
        const sourcePortUsageType = this.mapTypeOfPort(sourcePort);
        const targetExpressionString = this.expressionStringifier.stringifyElement(targetFeature);

        return `refers ${sourcePortUsageName}: ${sourcePortUsageType} subsets ports = ${targetExpressionString}`;
    }

    private mapTypeOfPort(portUsage: ast.PortUsage): Generated {
        const meta = portUsage.$meta;
        const definition = meta.portDefinition()?.ast();
        if (!definition) {
            return this.unsupported(
                portUsage,
                "Semantifyr requires a port to be typed by a port definition"
            );
        }
        const name = this.stableName(definition);
        return meta.isConjugated() ? `Conjugated${name}` : name;
    }

    private mapPartUsage(part: ast.PartDefinition, partUsage: ast.PartUsage): Generated {
        const classifier = this.featureClassifier(partUsage);
        if (!classifier) {
            return this.unsupported(
                partUsage,
                "Semantifyr requires a part to be typed by a part definition"
            );
        }
        if (partUsage.multiplicity) {
            this.unsupported(
                partUsage.multiplicity,
                "Semantifyr does not support part multiplicity"
            );
        }
        const partName = this.declareTyped(part, partUsage, classifier);
        const classifierName = this.stableName(classifier);

        return `contains ${partName}: ${classifierName} subsets parts`;
    }

    private mapItemFlow(part: ast.PartDefinition, itemFlow: ast.ItemFlow): Generated {
        const itemFlowName = this.declare(part, itemFlow);
        const fromEnd = itemFlow.ends[0]?.target as ItemFlowEnd | undefined;
        const toEnd = itemFlow.ends[1]?.target as ItemFlowEnd | undefined;
        const fromString = this.stringifyItemFlowEnd(itemFlow, fromEnd);
        const toString = this.stringifyItemFlowEnd(itemFlow, toEnd);

        return expandToNode`
            contains ${itemFlowName}: Flow subsets flows {
                redefine refers inputPort: Port = ${fromString}
                redefine refers outputPort: Port = ${toString}
            }
        `;
    }

    private stringifyItemFlowEnd(
        itemFlow: ast.ItemFlow,
        itemFlowEnd: ItemFlowEnd | undefined
    ): string {
        const meta = itemFlowEnd?.$meta;
        const primary = meta?.primaryFeature()?.ast();
        const member = meta?.memberFeature()?.ast();
        if (!primary || !member) {
            return this.unsupported(
                itemFlow,
                "Semantifyr requires a flow end to name a part and its port"
            );
        }
        return `${this.stableName(primary)}.${this.stableName(member)}`;
    }

    private mapAttributeUsage(
        part: ast.PartDefinition,
        attributeUsage: ast.AttributeUsage
    ): Generated {
        const meta = attributeUsage.$meta;
        const dataType = meta.dataType()?.ast();
        if (!dataType) {
            return this.unsupported(
                attributeUsage,
                "Semantifyr requires an attribute to be typed by Integer or Boolean"
            );
        }
        const classifierName = this.attributeTypeName(attributeUsage, dataType);
        const primitiveType = this.attributeTypeToPrimitive(attributeUsage, dataType);
        const defaultExpression = meta.defaultExpression()?.ast();
        const attributeName = this.declare(part, attributeUsage);

        if (!defaultExpression) {
            return `contains ${attributeName}: ${classifierName} subsets attributes`;
        }

        const expression = this.expressionStringifier.stringifyElement(defaultExpression);

        return expandToNode`
            contains ${attributeName}: ${classifierName} subsets attributes {
                redefine refers defaultValue: ${primitiveType} = ${expression}
            }
        `;
    }

    private attributeTypeName(
        attributeUsage: ast.AttributeUsage,
        classifier: ast.Classifier
    ): string {
        const name = this.stableName(classifier);
        if (name == "Integer") {
            return "IntegerAttribute";
        }
        if (name == "Boolean") {
            return "BooleanAttribute";
        }
        return this.unsupported(
            attributeUsage,
            `Semantifyr does not support attributes of type ${name}`
        );
    }

    private attributeTypeToPrimitive(
        attributeUsage: ast.AttributeUsage,
        classifier: ast.Classifier
    ): string {
        const name = this.stableName(classifier);
        if (name == "Integer") {
            return "int";
        }
        if (name == "Boolean") {
            return "bool";
        }
        return this.unsupported(
            attributeUsage,
            `Semantifyr does not support attributes of type ${name}`
        );
    }
}
