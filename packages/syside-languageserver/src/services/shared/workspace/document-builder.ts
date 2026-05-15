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
    BuildOptions,
    DefaultDocumentBuilder,
    DocumentState,
    LangiumDocument,
} from "langium";
import { CancellationToken } from "vscode-languageserver";
import { SysMLSharedServices } from "../../services.js";
import { mergeWithPartial, Statistics, Timer } from "../../../utils/common.js";
import { URI } from "vscode-uri";
import now from "performance-now";
import { BuildProgress } from "./documents.js";
import { SysMLConfigurationProvider } from "./configuration-provider.js";
import { SysMLIndexManager } from "./index-manager.js";

export type StandardLibrary = "none" | "standard" | "local";

/**
 * Legacy Langium 1.x-style validation toggle, preserved here for backwards
 * compatibility with existing tests and call sites. Maps to Langium 2.x's
 * `BuildOptions.validation` field at build time. Defined as a `string`-typed
 * alias (rather than `"all" | "none"`) so that call sites can pass these as
 * untyped string literals — matches the Langium 1.x signature.
 */
export type ValidationChecks = string;

export interface SysMLBuildOptions extends BuildOptions {
    /**
     * Set type of standard library:
     *  'none' - skip setting up relationships to the standard library elements
     *  'standard' - use default standard library
     *  'local' - use standard library elements from the document locally, useful for testing
     */
    standardLibrary?: StandardLibrary;

    /**
     * If set, ignore all metamodel errors
     */
    ignoreMetamodelErrors?: boolean;

    /**
     * If true, the document will be built isolated from all the other
     * documents, i.e. no indexing, no global scope. It's main use is for
     * testing so that each new built file doesn't pollute the global scope and
     * influence other test results.
     */
    standalone?: boolean;

    /**
     * Langium 1.x-style validation toggle. `"all"` runs every check, `"none"`
     * disables validation entirely. Translates to `BuildOptions.validation`
     * (`true`/`false`) when the build runs. Kept for backwards compatibility.
     */
    validationChecks?: ValidationChecks;
}

declare module "langium" {
    interface LangiumDocument {
        /**
         * Options used to build this document
         */
        buildOptions?: SysMLBuildOptions;
    }
}

export class SysMLDocumentBuilder extends DefaultDocumentBuilder {
    protected readonly statistics: Statistics;
    protected readonly config: SysMLConfigurationProvider;
    protected override readonly indexManager: SysMLIndexManager;
    /**
     * Map of document URIs to times they were opened in ms
     */
    protected readonly openDocuments = new Map<string, number>();

    constructor(services: SysMLSharedServices) {
        super(services);
        this.statistics = services.statistics;
        this.config = services.workspace.ConfigurationProvider;
        this.indexManager = services.workspace.IndexManager;

        const builder = services.workspace.MetamodelBuilder;

        // make sure that metamodels are in a clean state on changed documents
        // before rebuilding them
        this.onBuildPhase(DocumentState.Parsed, async (docs) => {
            docs.forEach((d) => builder.onChanged(d));
        });

        // tracking of open documents to skip document unnecessary updates
        services.workspace.TextDocuments.onDidOpen((e) => {
            this.openDocuments.set(e.document.uri, now());
        });
        services.workspace.TextDocuments.onDidClose((e) => {
            this.openDocuments.delete(e.document.uri);
        });
    }

    protected override async buildDocuments(
        documents: LangiumDocument<AstNode>[],
        options: SysMLBuildOptions,
        cancelToken: CancellationToken
    ): Promise<void> {
        if (documents.length === 0) return;
        try {
            documents.forEach((doc) => (doc.progress = BuildProgress.Building));
            await this.buildDocumentsImpl(documents, options, cancelToken);
            documents.forEach((doc) => (doc.progress = BuildProgress.Completed));
        } catch (e) {
            documents.forEach((doc) => (doc.progress = BuildProgress.Canceled));
            throw e;
        }
    }

    protected async buildDocumentsImpl(
        documents: LangiumDocument<AstNode>[],
        options: SysMLBuildOptions,
        cancelToken: CancellationToken
    ): Promise<void> {
        this.statistics.reset();
        options = mergeWithPartial(this.config.get().defaultBuildOptions, options);

        // make sure the additional members exist before any other service tries
        // to access them
        documents.forEach((doc) => {
            doc.buildOptions = options;
            // clear diagnostics so that services can add own diagnostics
            doc.modelDiagnostics.clear();
        });

        if (this.config.get().logStatistics) {
            console.log(
                `Building documents:${documents
                    .map((d) => `\n\t${d.uri.toString()} [${DocumentState[d.state]}]`)
                    .join()}`
            );
        }

        // Bridge legacy `validationChecks` (Langium 1.x) to Langium 2.x's
        // `validation` field. The base `buildDocuments` won't accept extra
        // SysML-specific keys.
        const { validationChecks, ...baseOptions } = options;
        if (validationChecks !== undefined && baseOptions.validation === undefined) {
            // Anything except `"none"` maps to "run all validations" (true);
            // `"none"` disables (false). Matches the Langium 1.x behavior.
            baseOptions.validation = validationChecks !== "none";
        }

        await super.buildDocuments(documents, baseOptions as BuildOptions, cancelToken);

        this.reportStats();
    }

    /**
     * Print build time statistics to console
     */
    protected reportStats(): void {
        if (!this.config.get().logStatistics || this.statistics.isEmpty()) return;
        const entries = Object.entries(this.statistics.dump());
        const stats = entries.map(
            ([name, [elapsed, hits]]) =>
                `\n\t${name}: ${elapsed.toFixed(3)} ms in ${hits} hits (avg: ${(
                    elapsed / hits
                ).toFixed(3)} ms)`
        );
        const total = entries.reduce((total, [_, [elapsed, __]]) => total + elapsed, 0);
        console.log(`Build statistics ${total.toFixed(3)} ms:${stats}`);
    }

    protected override async runCancelable(
        documents: LangiumDocument<AstNode>[],
        targetState: DocumentState,
        cancelToken: CancellationToken,
        callback: (document: LangiumDocument<AstNode>) => unknown
    ): Promise<void> {
        const timer = new Timer();

        await super.runCancelable(documents, targetState, cancelToken, callback);

        if (!this.config.get().logStatistics) return;

        console.log(
            `${cancelToken.isCancellationRequested ? "Canceled" : "Completed"} ${
                DocumentState[targetState]
            } in ${timer.elapsed().toFixed(3)} ms`
        );

        if (targetState === DocumentState.Parsed) {
            const docs = documents.filter((doc) => doc.state === DocumentState.Parsed);
            const bytes = docs.reduce((total, doc) => total + doc.textDocument.getText().length, 0);
            const duration = docs.reduce((total, doc) => total + doc.parseDuration, 0);
            console.log("   Average parse speed:", (bytes / duration).toFixed(0), "bytes/ms");
        }
    }

    override async update(
        changed: URI[],
        deleted: URI[],
        cancelToken?: CancellationToken | undefined
    ): Promise<void> {
        // TODO: add a frequency (period) limiter between specific doc updates
        // to prevent this from being called too often on one document, will
        // save CPU power and discard duplicate updates like content update and
        // document savings

        // While following references, if the referenced symbol is in a closed
        // document, VS Code will quickly open and close the document also
        // firing `TextDocuments.onDidChangeContent` event. Detect such event by
        // skipping update on changed documents that have been already built but
        // haven't been opened for long
        changed = changed.filter((uri) => {
            // update if the document doesn't exist yet
            if (!this.langiumDocuments.hasDocument(uri)) return true;
            const openingTime = this.openDocuments.get(uri.toString());
            // update if the document is still closed
            if (!openingTime) return true;
            // update if the document has been open for a while
            if (now() - openingTime > 10) return true;
            const document = this.langiumDocuments.getDocument(uri);
            // update if the document hasn't been fully built yet
            return !document || document.state < DocumentState.Validated;
        });

        if (changed.length === 0 && deleted.length === 0) return;

        this.indexManager.invalidate(changed.concat(deleted));
        return super.update(changed, deleted, cancelToken);
    }
}
