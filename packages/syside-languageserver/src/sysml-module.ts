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

import { DeepPartial, inject, Module } from "langium";
import {
    createDefaultModule,
    createDefaultSharedModule,
    DefaultSharedModuleContext,
    PartialLangiumSharedServices,
} from "langium/lsp";
import {
    SysMLGeneratedSharedModule,
    KerMLGeneratedModule,
    SysMLGeneratedModule,
} from "#generated/module.js";
import { SysMLValidationRegistry } from "./services/validation/sysml-validation-registry.js";
import { SysMLScopeComputation } from "./services/references/scope-computation.js";
import { SysMLNameProvider } from "./services/references/name-provider.js";
import { SysMLDocumentBuilder } from "./services/shared/workspace/document-builder.js";
import { SysMLLinker } from "./services/references/linker.js";
import { SysMLIndexManager } from "./services/shared/workspace/index-manager.js";
import { SysMLScopeProvider } from "./services/references/scope-provider.js";
import { SysMLCompletionProvider } from "./services/lsp/completion-provider.js";
import { SysMLDocumentValidator } from "./services/validation/document-validator.js";
import { SysMLAstReflection } from "./services/sysml-ast-reflection.js";
import { SysMLMetamodelBuilder } from "./services/shared/workspace/metamodel-builder.js";
import {
    SysMLServices,
    SysMLAddedServices,
    KerMLServices,
    KerMLAddedServices,
    SysMLSharedServices,
    SysMLAddedSharedServices,
    PartialSysMLDefaultServices,
    SysMLDefaultServices,
} from "./services/services.js";
import { createSysMLParser } from "./services/parser/parser.js";
import { DefaultAstNodeLocator } from "langium";
import { SysMLNodeDescriptionProvider } from "./services/shared/workspace/ast-descriptions.js";
import { SysMLExecuteCommandHandler } from "./services/lsp/execute-command-handler.js";
import { SysMLWorkspaceManager } from "./services/shared/workspace/workspace-manager.js";
import { SysMLDocumentFactory, SysMLDocuments } from "./services/shared/workspace/documents.js";
import { DefaultSysMLConfig, SysMLConfig } from "./services/config.js";
import { mergeWithPartial, PartialKeys, Statistics } from "./utils/common.js";
import { SysMLSemanticTokenProvider } from "./services/lsp/semantic-token-provider.js";
import { SysMLLanguageServer } from "./services/lsp/language-server.js";
import { SysMLConfigurationProvider } from "./services/shared/workspace/configuration-provider.js";
import { SysMLHoverProvider } from "./services/lsp/hover-provider.js";
import { SysMLFormatter } from "./services/lsp/formatter.js";
import { createSysMLGrammarConfig } from "./services/parser/grammar-config.js";
import { KerMLValidationRegistry } from "./services/validation/kerml-validation-registry.js";
import { KerMLValidator } from "./services/validation/kerml-validator.js";
import { SysMLValidator } from "./services/validation/sysml-validator.js";
import { SysMLFileSystemProvider } from "./services/shared/workspace/file-system-provider.js";
import { LanguageEvents, SharedEvents } from "./services/events.js";
import { ExtensionManager } from "./services/shared/extension-manager.js";
import { ModelUtil } from "./services/shared/model-utils.js";
import { SysMLExpressionEvaluator } from "./services/shared/evaluator.js";
import { SysMLServiceRegistry } from "./services/index.js";

export const SysMLDefaultModule: Module<SysMLDefaultServices, PartialSysMLDefaultServices> = {
    parser: {
        LangiumParser: (services) => createSysMLParser(services),
        GrammarConfig: (services) => createSysMLGrammarConfig(services),
    },
    references: {
        ScopeComputation: (services) => new SysMLScopeComputation(services),
        ScopeProvider: (services) => new SysMLScopeProvider(services),
        NameProvider: () => new SysMLNameProvider(),
        Linker: (services) => new SysMLLinker(services),
    },
    validation: {
        DocumentValidator: (services) => new SysMLDocumentValidator(services),
    },
    lsp: {
        Formatter: (services) => new SysMLFormatter(services),
        CompletionProvider: (services) => new SysMLCompletionProvider(services),
        SemanticTokenProvider: (services) => new SysMLSemanticTokenProvider(services),
        HoverProvider: (services) => new SysMLHoverProvider(services),
    },
    workspace: {
        AstNodeDescriptionProvider: (services) => new SysMLNodeDescriptionProvider(services.shared),
    },
    Events: () => new LanguageEvents(),
};

export const SysMLModule: Module<SysMLServices, PartialSysMLDefaultServices & SysMLAddedServices> =
    {
        validation: {
            ValidationRegistry: (services) => new SysMLValidationRegistry(services),
            SysMLValidator: (services) => new SysMLValidator(services.shared),
        },
    };

export const KerMLModule: Module<KerMLServices, PartialSysMLDefaultServices & KerMLAddedServices> =
    {
        validation: {
            ValidationRegistry: (services) => new KerMLValidationRegistry(services),
            KerMLValidator: (services) => new KerMLValidator(services.shared),
        },
    };

export const SysMLSharedModule: Module<
    SysMLSharedServices,
    PartialLangiumSharedServices &
        Omit<SysMLAddedSharedServices, "workspace"> & {
            // provider is set-up from the context parameter
            workspace: PartialKeys<SysMLAddedSharedServices["workspace"], "FileSystemProvider">;
        }
> = {
    ServiceRegistry: () => new SysMLServiceRegistry(),
    AstReflection: () => new SysMLAstReflection(),
    workspace: {
        DocumentBuilder: (services) => new SysMLDocumentBuilder(services),
        IndexManager: (services) => new SysMLIndexManager(services),
        MetamodelBuilder: (services) => new SysMLMetamodelBuilder(services),
        AstNodeLocator: () => new DefaultAstNodeLocator(),
        AstNodeDescriptionProvider: (services) => new SysMLNodeDescriptionProvider(services),
        WorkspaceManager: (services) => new SysMLWorkspaceManager(services),
        LangiumDocumentFactory: (services) => new SysMLDocumentFactory(services),
        ConfigurationProvider: (services) => new SysMLConfigurationProvider(services),
        LangiumDocuments: (services) => new SysMLDocuments(services),
    },
    lsp: {
        ExecuteCommandHandler: (services) => new SysMLExecuteCommandHandler(services),
        LanguageServer: (services) => new SysMLLanguageServer(services),
    },
    config: () => DefaultSysMLConfig as SysMLConfig,
    Evaluator: (services) => new SysMLExpressionEvaluator(services),
    statistics: () => new Statistics(),
    ExtensionManager: (services) => new ExtensionManager(services),
    Events: () => new SharedEvents(),
    Util: () => new ModelUtil(),
};

export interface SharedModuleContext extends DefaultSharedModuleContext {
    fileSystemProvider: () => SysMLFileSystemProvider;
}

export function createSysMLServices(
    context: SharedModuleContext,
    config?: DeepPartial<SysMLConfig>
): {
    shared: SysMLSharedServices;
    SysML: SysMLServices;
    KerML: KerMLServices;
} {
    const sharedModule = {
        ...SysMLSharedModule,
        config: (): SysMLConfig => mergeWithPartial(DefaultSysMLConfig as SysMLConfig, config),
    };

    const shared = inject(
        createDefaultSharedModule(context),
        SysMLGeneratedSharedModule,
        sharedModule
    );
    const SysML = inject(
        createDefaultModule({ shared }),
        SysMLGeneratedModule,
        SysMLDefaultModule,
        SysMLModule
    );
    const KerML = inject(
        createDefaultModule({ shared }),
        KerMLGeneratedModule,
        SysMLDefaultModule,
        KerMLModule
    );
    shared.ServiceRegistry.register(SysML);
    shared.ServiceRegistry.register(KerML);
    return { shared, SysML, KerML };
}
