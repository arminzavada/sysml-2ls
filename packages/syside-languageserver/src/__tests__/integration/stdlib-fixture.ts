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

import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import type { LangiumDocument } from "langium";
import { createSysMLServices } from "../../sysml-module.js";
import type { SysMLSharedServices } from "../../services/services.js";
import type { SysMLBuildOptions } from "../../services/shared/workspace/document-builder.js";
import { SysMLNodeFileSystem } from "../../node/node-file-system-provider.js";
import { TEST_SERVER_OPTIONS } from "../../testing/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..", "..", "..", "..", "..");

export const stdlibRoot = path.join(repoRoot, "SysML-v2-Release");
export const stdlibPath = path.join(stdlibRoot, "sysml.library");
export const stdlibExamplesPath = path.join(stdlibRoot, "sysml", "src", "examples");

export async function collectStdlibFiles(dir: string): Promise<URI[]> {
    const collected: URI[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collected.push(...(await collectStdlibFiles(full)));
        } else if (entry.isFile() && (full.endsWith(".kerml") || full.endsWith(".sysml"))) {
            collected.push(URI.file(full));
        }
    }
    return collected;
}

export interface StdlibSetup {
    shared: SysMLSharedServices;
    stdDocs: LangiumDocument[];
}

/**
 * Boot a SysML language server pre-loaded with the entire SysML-v2-Release
 * standard library. By default the stdlib documents are built **without**
 * running validation — pass `validateStdlib: true` if the test needs to inspect
 * diagnostics from the stdlib itself.
 */
export async function setupServicesWithStdlib(
    options: { validateStdlib?: boolean } = {}
): Promise<StdlibSetup> {
    const services = createSysMLServices(SysMLNodeFileSystem, {
        ...TEST_SERVER_OPTIONS,
        standardLibrary: true,
        standardLibraryPath: stdlibPath,
        skipWorkspaceInit: true,
        defaultBuildOptions: {
            standalone: false,
        },
    });
    services.shared.workspace.FileSystemProvider.updateStandardLibrary(stdlibPath);

    const stdlibUris = await collectStdlibFiles(stdlibPath);
    const stdDocs = await Promise.all(
        stdlibUris.map((uri) =>
            services.shared.workspace.LangiumDocuments.getOrCreateDocument(uri)
        )
    );
    for (const d of stdDocs) {
        (d as { isStandard?: boolean }).isStandard = true;
    }
    await services.shared.workspace.DocumentBuilder.build(stdDocs, <SysMLBuildOptions>{
        validationChecks: options.validateStdlib ? "all" : "none",
        standalone: false,
    });

    return { shared: services.shared, stdDocs };
}
