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
    DefaultLangiumDocumentFactory,
    DefaultLangiumDocuments,
    LangiumDocument,
    Mutable,
    MultiMap,
    ParseResult,
} from "langium";
import { CancellationToken } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { streamAst } from "../../../utils/index.js";
import { SysMLSharedServices } from "../../services.js";
import { MetamodelBuilder } from "./metamodel-builder.js";
import { SysMLConfigurationProvider } from "./configuration-provider.js";
import { ElementMeta } from "../../../model/index.js";
import { ModelDiagnostic } from "../../validation/index.js";
import now from "performance-now";

export const enum BuildProgress {
    Created = 0,
    Building = 1,
    Completed = 2,
    Canceled = 3,
}

declare module "langium" {
    interface LangiumDocument {
        /**
         * Cached `document.uri.toString()` since it is used often and a lot of
         * places as a map key
         */
        uriString: string;

        /**
         * Overall document build progress
         */
        progress: BuildProgress;

        /**
         * Local document exports
         */
        exports: Map<string, ElementMeta>;

        /**
         * Lazy cache of fully qualified element names to element descriptions
         * locally in this document
         */
        namedElements: Map<string, ElementMeta | null>;

        /**
         * Flattened tree of parsed AST nodes in this document
         */
        astNodes: AstNode[];

        /**
         * Model element diagnostics
         */
        modelDiagnostics: MultiMap<ElementMeta, ModelDiagnostic>;

        /**
         * Register additional clean up callbacks to be called on document
         * invalidation
         */
        onInvalidated: MultiMap<ElementMeta, () => void>;

        /**
         * If true, comments have been attached to model elements and should not
         * be attached again.
         */
        commentsAttached: boolean;

        parseDuration: number;

        /**
         * If true this document is part of the standard library
         */
        isStandard?: boolean;
    }
}

export interface TimedParseResult<T> extends ParseResult<T> {
    duration: number;
}

/**
 * Extension of Langium document factory that extends {@link LangiumDocument}
 * with additional properties used by other SysML services.
 */
export class SysMLDocumentFactory extends DefaultLangiumDocumentFactory {
    // The full cycle is:
    //
    //   SysMLDocumentFactory (this)
    //     → reads MetamodelBuilder
    //     → reads IndexManager
    //     → reads LangiumDocuments
    //     → reads LangiumDocumentFactory  (= SysMLDocumentFactory, the root)
    //
    // The IndexManager → LangiumDocuments and LangiumDocuments →
    // LangiumDocumentFactory edges are imposed by Langium itself (eager
    // constructor reads). Anyone wiring a MetamodelBuilder-like service into
    // their DocumentFactory is forced to break the cycle on their own edge.
    // We defer the `MetamodelBuilder` lookup to first access (it's only used
    // inside `onParsed`, which fires after DI is fully constructed); the
    // cycle is closed only *during* injector construction.
    protected readonly services: SysMLSharedServices;
    protected readonly config: SysMLConfigurationProvider;

    protected get metamodelBuilder(): MetamodelBuilder {
        return this.services.workspace.MetamodelBuilder;
    }

    constructor(services: SysMLSharedServices) {
        super(services);

        this.services = services;
        this.config = services.workspace.ConfigurationProvider;
    }

    override async update<T extends AstNode = AstNode>(
        document: Mutable<LangiumDocument<T>>,
        cancellationToken: CancellationToken
    ): Promise<LangiumDocument<T>> {
        const doc = await super.update(document, cancellationToken);
        return this.onCreated(doc);
    }

    protected override createLangiumDocument<T extends AstNode = AstNode>(
        parseResult: TimedParseResult<T>,
        uri: URI,
        textDocument?: TextDocument,
        text?: string
    ): LangiumDocument<T> {
        const doc = super.createLangiumDocument(parseResult, uri, textDocument, text);
        doc.parseDuration = parseResult.duration;
        return this.onCreated(doc);
    }

    protected onCreated<T extends AstNode>(doc: LangiumDocument<T>): LangiumDocument<T> {
        doc.uriString = doc.uri.toString();
        doc.progress = BuildProgress.Created;
        doc.exports = new Map();
        doc.namedElements = new Map();
        doc.astNodes = streamAst(doc.parseResult.value).toArray();
        doc.modelDiagnostics = new MultiMap();
        doc.onInvalidated = new MultiMap();
        doc.commentsAttached = false;

        this.metamodelBuilder.onParsed(doc);
        return doc;
    }

    protected override parse<T extends AstNode>(uri: URI, text: string): TimedParseResult<T> {
        const start = now();
        const result = super.parse<T>(uri, text);
        const duration = now() - start;
        if (this.config.get().logStatistics)
            console.info(
                `Parsed ${uri.toString()} in ${duration.toFixed(2)} ms (${(
                    text.length / duration
                ).toFixed(0)} bytes/ms)`
            );
        return { ...result, duration };
    }
}

export class SysMLDocuments extends DefaultLangiumDocuments {
    override invalidateDocument(uri: URI): LangiumDocument<AstNode> | undefined {
        const doc = super.invalidateDocument(uri);
        if (doc) {
            doc.progress = BuildProgress.Created;
            doc.exports.clear();
            doc.namedElements.clear();
            doc.modelDiagnostics.clear();
            doc.onInvalidated.values().forEach((cb) => cb());
            doc.onInvalidated.clear();
            // no need to invalidate cached AST nodes since the document is not
            // reparsed here
        }

        return doc;
    }

    override deleteDocument(uri: URI): LangiumDocument<AstNode> | undefined {
        const doc = super.deleteDocument(uri);
        doc?.onInvalidated.values().forEach((cb) => cb());

        return doc;
    }

    override deleteDocuments(folder: URI): LangiumDocument<AstNode>[] {
        // 4.x's `DocumentBuilder.update` deletes via `deleteDocuments` (plural)
        // rather than per-URI `deleteDocument`. Mirror the invalidation side
        // effects from `deleteDocument` here so cross-document state is
        // released on bulk deletion as well.
        const docs = super.deleteDocuments(folder);
        for (const doc of docs) {
            doc.onInvalidated.values().forEach((cb) => cb());
        }
        return docs;
    }
}
