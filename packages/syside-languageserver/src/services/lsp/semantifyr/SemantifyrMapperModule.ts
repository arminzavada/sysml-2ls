import { inject, Module } from "langium";
import { StableElementNameProvider } from "./StableNameStore";
import { SemantifyrItemMapper } from "./SemantifyrItemMapper";
import { SemantifyrPartMapper } from "./SemantifyrPartMapper";
import { SemantifyrPortMapper } from "./SemantifyrPortMapper";
import { SemantifyrVerificationCaseMapper } from "./SemantifyrVerificationCaseMapper";
import { SemantifyrRootNamespaceMapper } from "./SemantifyrRootNamespaceMapper";
import { SemantifyrExpressionStringifier } from "./SemantifyrExpressionStringifier";
import { SemantifyrStateMapper } from "./SemantifyrStateMapper";
import { SemantifyrActionMapper } from "./SemantifyrActionMapper";
import { SemantifyrExpressionMapper } from "./SemantifyrExpressionMapper";
import { SemantifyrTransitionMapper } from "./SemantifyrTransitionMapper";

export type SemantifyrMapperServices = {
    elementNameProvider: StableElementNameProvider;
    expressionMapper: SemantifyrExpressionMapper;
    actionMapper: SemantifyrActionMapper;
    partMapper: SemantifyrPartMapper;
    stateMapper: SemantifyrStateMapper;
    transitionMapper: SemantifyrTransitionMapper;
    portMapper: SemantifyrPortMapper;
    itemMapper: SemantifyrItemMapper;
    verificationCaseMapper: SemantifyrVerificationCaseMapper;
    rootNamespaceMapper: SemantifyrRootNamespaceMapper;
    expressionStringifier: SemantifyrExpressionStringifier;
};

export const SemantifyrMapperModule: Module<SemantifyrMapperServices> = {
    elementNameProvider: () => new StableElementNameProvider(),
    expressionMapper: (services) => new SemantifyrExpressionMapper(services),
    actionMapper: (services) => new SemantifyrActionMapper(services),
    partMapper: (services) => new SemantifyrPartMapper(services),
    stateMapper: (services) => new SemantifyrStateMapper(services),
    transitionMapper: (services) => new SemantifyrTransitionMapper(services),
    portMapper: (services) => new SemantifyrPortMapper(services),
    itemMapper: (services) => new SemantifyrItemMapper(services),
    verificationCaseMapper: (services) => new SemantifyrVerificationCaseMapper(services),
    rootNamespaceMapper: (services) => new SemantifyrRootNamespaceMapper(services),
    expressionStringifier: (services) => new SemantifyrExpressionStringifier(services),
};

export function createSemantifyrMapperServices(): SemantifyrMapperServices {
    return inject(SemantifyrMapperModule);
}
