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
    isConjugatedPortTyping,
    ConjugatedPortTyping,
    OwningMembership,
    EndFeatureMembership,
    ItemFlowEnd,
    ReferenceSubsetting,
    FeatureMembership,
    ReferenceUsage,
    Redefinition,
    isBindingConnectorAsUsage,
    BindingConnectorAsUsage,
    isReferenceSubsetting,
    Feature,
    PortUsage,
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

        const bindings = childElements.filter((e) =>
            isBindingConnectorAsUsage(e)
        ) as BindingConnectorAsUsage[];

        for (const binding of bindings) {
            const source = binding.ends[0];
            const sourcePortRefeference = source.target as ReferenceUsage;
            const sourceReferenceSubsetting = sourcePortRefeference.heritage.find((h) =>
                isReferenceSubsetting(h)
            ) as ReferenceSubsetting;
            const sourcePort = sourceReferenceSubsetting.targetRef?.parts[0].ref;
            childElements.remove(sourcePort);
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
        const source = bindingConnectorAsUsage.ends[0];
        const sourcePortRefeference = source.target as ReferenceUsage;
        const sourceReferenceSubsetting = sourcePortRefeference.heritage.find((h) =>
            isReferenceSubsetting(h)
        ) as ReferenceSubsetting;
        const sourcePortUsage = sourceReferenceSubsetting.targetRef?.parts[0].ref as PortUsage;
        const sourcePortUsageName = this.stableName(sourcePortUsage);
        const sourcePortUsageType = this.mapTypeOfPort(sourcePortUsage);

        const target = bindingConnectorAsUsage.ends[1];
        const targetPortRefeference = target.target as ReferenceUsage;
        const targetReferenceSubsetting = targetPortRefeference.heritage.find((h) =>
            isReferenceSubsetting(h)
        ) as ReferenceSubsetting;
        const targetFeature = targetReferenceSubsetting.targetChain as Feature;
        const targetExpressionString = this.expressionStringifier.stringifyElement(targetFeature);

        return `refers ${sourcePortUsageName}: ${sourcePortUsageType} subsets ports = ${targetExpressionString}`;
    }

    private mapTypeOfPort(portUsage: ast.PortUsage): Generated {
        const conjugatedPortTyping = portUsage.heritage.find((h) => isConjugatedPortTyping(h)) as
            | ast.ConjugatedPortTyping
            | undefined;

        if (conjugatedPortTyping) {
            return this.mapConjugatedPortTyping(conjugatedPortTyping);
        }

        const classifier = this.featureClassifier(portUsage);

        if (classifier !== undefined) {
            return this.stableName(classifier);
        }

        return "UNKNOWN_PORT_TYPE";
    }

    private mapConjugatedPortTyping(conjugatedPortTyping: ConjugatedPortTyping): string {
        const portReference = conjugatedPortTyping.targetRef;
        const parts = portReference?.parts;
        if (parts?.length !== 1) {
            return "UNEXPECTED_PARTS";
        }
        const part = parts[0];
        const portDefinitionMembership = part.ref as OwningMembership | undefined;
        if (!portDefinitionMembership) {
            return "UNRESOLVED_PORT_DEFINITION";
        }
        const portDefinition = portDefinitionMembership.target;
        if (!portDefinition) {
            return "UNRESOLVED_PORT_DEFINITION";
        }
        const portDefinitionName = this.stableName(portDefinition);

        return `Conjugated${portDefinitionName}`;
    }

    private mapPartUsage(partUsage: ast.PartUsage): Generated {
        const partName = this.stableName(partUsage);
        const classifier = this.featureClassifier(partUsage);
        const classifierName = this.stableName(classifier);

        return `contains ${partName}: ${classifierName} subsets parts`;
    }

    private mapItemFlow(itemFlow: ast.ItemFlow): Generated {
        const itemFlowName = this.stableName(itemFlow);
        const fromEndMembership = itemFlow.ends[0] as EndFeatureMembership;
        const fromEnd = fromEndMembership.target as ItemFlowEnd;
        const toEndMembership = itemFlow.ends[1] as EndFeatureMembership;
        const toEnd = toEndMembership.target as ItemFlowEnd;
        const fromString = this.stringifyItemFlowEnd(fromEnd);
        const toString = this.stringifyItemFlowEnd(toEnd);

        return expandToNode`
            contains ${itemFlowName}: Flow subsets flows {
                redefine refers inputPort: Port = ${fromString}
                redefine refers outputPort: Port = ${toString}
            }
        `;
    }

    private stringifyItemFlowEnd(itemFlowEnd: ItemFlowEnd): string {
        const primaryReferenceSubsetting = itemFlowEnd.heritage[0] as ReferenceSubsetting;
        const primaryClassifier = primaryReferenceSubsetting?.targetRef?.parts[0].ref;
        const primaryClassifierName = this.stableName(primaryClassifier);

        const memberMembership = itemFlowEnd.children[0] as FeatureMembership;
        const memberTarget = memberMembership.target as ReferenceUsage;
        const memberRedefinition = memberTarget.heritage[0] as Redefinition;
        const memberClassifier = memberRedefinition?.targetRef?.parts[0].ref;
        const memberClassifierName = this.stableName(memberClassifier);

        return `${primaryClassifierName}.${memberClassifierName}`;
    }

    private mapAttributeUsage(attributeUsage: ast.AttributeUsage): Generated {
        const attributeName = this.stableName(attributeUsage);
        const classifier = this.featureClassifier(attributeUsage);
        if (classifier === undefined) {
            return undefined;
        }
        const classifierName = this.attributeTypeName(classifier);
        const primitiveType = this.attributeTypeToPrimitive(classifier);

        if (attributeUsage.value?.target === undefined) {
            return `contains ${attributeName}: ${classifierName} subsets attributes`;
        }

        const expression = this.expressionStringifier.stringifyElement(
            attributeUsage.value?.target
        );

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
