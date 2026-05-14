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

import { DeepPartial, LangiumServices, LangiumSharedServices } from "langium";
import { AstNodeLocator } from "langium/lib/workspace/ast-node-locator.js";
import { MetamodelBuilder } from "./shared/workspace/metamodel-builder.js";
import { SysMLParser } from "./parser/parser.js";
import { SysMLConfig } from "./config.js";
import { Statistics } from "../utils/common.js";
import { SysMLLanguageServer } from "./lsp/language-server.js";
import { SysMLDocumentFactory, SysMLDocuments } from "./shared/workspace/documents.js";
import { SysMLConfigurationProvider } from "./shared/workspace/configuration-provider.js";
import { SysMLIndexManager } from "./shared/workspace/index-manager.js";
import { SysMLScopeProvider } from "./references/scope-provider.js";
import { SysMLDocumentBuilder } from "./shared/workspace/document-builder.js";
import { KerMLValidator } from "./validation/kerml-validator.js";
import { SysMLValidator } from "./validation/sysml-validator.js";
import { SysMLAstReflection } from "./sysml-ast-reflection.js";
import { SysMLLinker } from "./references/linker.js";
import { SysMLNodeDescriptionProvider } from "./shared/workspace/ast-descriptions.js";
import { SysMLScopeComputation } from "./references/scope-computation.js";
import { SysMLFileSystemProvider } from "./shared/workspace/file-system-provider.js";
import { LanguageEvents, SharedEvents } from "./events.js";
import { ExtensionManager } from "./shared/extension-manager.js";
import { ModelUtil } from "./shared/model-utils.js";
import { SysMLExpressionEvaluator } from "./shared/evaluator.js";
import { BaseValidationRegistry } from "./validation/validation-registry.js";
import { SysMLDocumentValidator } from "./validation/index.js";

export type SysMLAddedSharedServices = {
    workspace: {
        // locator and description provider should definitely be shared since
        // different languages use the same AST
        AstNodeLocator: AstNodeLocator;
        AstNodeDescriptionProvider: SysMLNodeDescriptionProvider;
        MetamodelBuilder: MetamodelBuilder;
        LangiumDocumentFactory: SysMLDocumentFactory;
        ConfigurationProvider: SysMLConfigurationProvider;
        IndexManager: SysMLIndexManager;
        DocumentBuilder: SysMLDocumentBuilder;
        FileSystemProvider: SysMLFileSystemProvider;
        LangiumDocuments: SysMLDocuments;
    };
    lsp: {
        LanguageServer: SysMLLanguageServer;
    };
    config: SysMLConfig;
    Evaluator: SysMLExpressionEvaluator;
    statistics: Statistics;
    AstReflection: SysMLAstReflection;
    ExtensionManager: ExtensionManager;
    Events: SharedEvents;
    Util: ModelUtil;
};
export type SysMLSharedServices = LangiumSharedServices & SysMLAddedSharedServices;

/**
 * Declaration of custom services - add your own service classes here.
 */
export type SysMLDefaultAddedServices = {
    parser: {
        LangiumParser: SysMLParser;
    };
    references: {
        ScopeProvider: SysMLScopeProvider;
        ScopeComputation: SysMLScopeComputation;
        Linker: SysMLLinker;
    };
    workspace: {
        AstNodeDescriptionProvider: SysMLNodeDescriptionProvider;
    };
    validation: {
        ValidationRegistry: BaseValidationRegistry;
        DocumentValidator: SysMLDocumentValidator;
    };
    shared: SysMLSharedServices;
    Events: LanguageEvents;
};
export type KerMLAddedServices = {
    validation: {
        KerMLValidator: KerMLValidator;
    };
};

export type SysMLAddedServices = {
    validation: {
        SysMLValidator: SysMLValidator;
    };
};

/**
 * Union of Langium default services and your custom services - use this as
 * constructor parameter of custom service classes.
 */
export type SysMLDefaultServices = LangiumServices & SysMLDefaultAddedServices;
export type SysMLServices = SysMLDefaultServices & SysMLAddedServices;
export type KerMLServices = SysMLDefaultServices & KerMLAddedServices;

export type PartialSysMLDefaultServices = DeepPartial<SysMLDefaultServices>;
