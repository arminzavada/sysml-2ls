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

    public mapPartDefinition(part: ast.PartDefinition): Generated {
        const childElements = part.children.map((m) => m.target);

        // Drop the local port that a binding rebinds; mapBindingConnectorAsUsage
        // emits the rebinding declaration in its place.
        for (const element of childElements) {
            if (!isBindingConnectorAsUsage(element)) continue;
            const sourcePort = element.$meta.sourceFeature()?.ast();
            if (sourcePort) childElements.remove(sourcePort);
        }

        return this.expandToBlock(
            `class ${this.stableName(part)} : Part`,
            childElements,
            (e) => this.mapMemberElements(e),
            { appendNewLineIfNotEmpty: true }
        );
    }

    private mapMemberElements(element: ast.Element | undefined): Generated {
        if (element === undefined) {
            return undefined;
        }

        if (isPortUsage(element)) {
            return this.mapPortUsage(element);
        }

        if (isPartUsage(element)) {
            return this.mapPartUsage(element);
        }

        if (isItemFlow(element)) {
            return this.mapItemFlow(element);
        }

        if (isAttributeUsage(element)) {
            return this.mapAttributeUsage(element);
        }

        if (isExhibitStateUsage(element)) {
            return this.stateMapper.mapExhibitStateUsage(element);
        }

        if (isBindingConnectorAsUsage(element)) {
            return this.mapBindingConnectorAsUsage(element);
        }

        return undefined;
    }

    private mapPortUsage(portUsage: ast.PortUsage): Generated {
        const portName = this.stableName(portUsage);
        const portType = this.mapTypeOfPort(portUsage);

        return `contains ${portName}: ${portType} subsets ports`;
    }

    private mapBindingConnectorAsUsage(
        bindingConnectorAsUsage: BindingConnectorAsUsage
    ): Generated {
        const meta = bindingConnectorAsUsage.$meta;
        const sourcePort = meta.sourceFeature()?.ast();
        const targetFeature = meta.targetFeature()?.ast();
        if (!sourcePort) {
            throw new Error("Binding connector source port could not be resolved");
        }
        if (!isPortUsage(sourcePort)) {
            throw new Error("Binding connector source must be a PortUsage");
        }
        if (!targetFeature) {
            throw new Error("Binding connector target could not be resolved");
        }

        const sourcePortUsageName = this.stableName(sourcePort);
        const sourcePortUsageType = this.mapTypeOfPort(sourcePort);
        const targetExpressionString = this.expressionStringifier.stringifyElement(targetFeature);

        return `refers ${sourcePortUsageName}: ${sourcePortUsageType} subsets ports = ${targetExpressionString}`;
    }

    private mapTypeOfPort(portUsage: ast.PortUsage): Generated {
        const meta = portUsage.$meta;
        const definition = meta.portDefinition()?.ast();
        if (!definition) return "UNKNOWN_PORT_TYPE";
        const name = this.stableName(definition);
        return meta.isConjugated() ? `Conjugated${name}` : name;
    }

    private mapPartUsage(partUsage: ast.PartUsage): Generated {
        const partName = this.stableName(partUsage);
        const classifier = this.featureClassifier(partUsage);
        const classifierName = this.stableName(classifier);

        return `contains ${partName}: ${classifierName} subsets parts`;
    }

    private mapItemFlow(itemFlow: ast.ItemFlow): Generated {
        const itemFlowName = this.stableName(itemFlow);
        const fromEnd = itemFlow.ends[0]?.target as ItemFlowEnd | undefined;
        const toEnd = itemFlow.ends[1]?.target as ItemFlowEnd | undefined;
        const fromString = this.stringifyItemFlowEnd(fromEnd);
        const toString = this.stringifyItemFlowEnd(toEnd);

        return expandToNode`
            contains ${itemFlowName}: Flow subsets flows {
                redefine refers inputPort: Port = ${fromString}
                redefine refers outputPort: Port = ${toString}
            }
        `;
    }

    private stringifyItemFlowEnd(itemFlowEnd: ItemFlowEnd | undefined): string {
        const meta = itemFlowEnd?.$meta;
        const primary = this.stableName(meta?.primaryFeature()?.ast());
        const member = this.stableName(meta?.memberFeature()?.ast());
        return `${primary}.${member}`;
    }

    private mapAttributeUsage(attributeUsage: ast.AttributeUsage): Generated {
        const meta = attributeUsage.$meta;
        const dataType = meta.dataType()?.ast();
        if (!dataType) return undefined;
        const classifierName = this.attributeTypeName(dataType);
        const primitiveType = this.attributeTypeToPrimitive(dataType);
        const defaultExpression = meta.defaultExpression()?.ast();
        const attributeName = this.stableName(attributeUsage);

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

    private attributeTypeName(classifier: ast.Classifier): string {
        const name = this.stableName(classifier);
        if (name == "Integer") {
            return "IntegerAttribute";
        }
        if (name == "Boolean") {
            return "BooleanAttribute";
        }
        return "UNKNOWN_ATTRIBUTE_TYPE";
    }

    private attributeTypeToPrimitive(classifier: ast.Classifier): string {
        const name = this.stableName(classifier);
        if (name == "Integer") {
            return "int";
        }
        if (name == "Boolean") {
            return "bool";
        }
        return "UNKNOWN_ATTRIBUTE_TYPE";
    }
}
