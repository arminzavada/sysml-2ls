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

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { URI } from "vscode-uri";
import type { Diagnostic } from "vscode-languageserver";
import { CommandOptions } from "commander";
import {
    createSysMLServices,
    ast,
    SysMLLanguageMetaData,
    KerMLLanguageMetaData,
    mapSysMLNamespaceToSemantifyr,
    SysMLBuildOptions,
} from "syside-languageserver";
import { SysMLNodeFileSystem } from "syside-languageserver/node.js";

interface CompileOptions extends CommandOptions {
    output?: string;
}

export const SysMLExtensions: string[] = [...SysMLLanguageMetaData.fileExtensions];

const LibraryExtensions: string[] = [
    ...SysMLLanguageMetaData.fileExtensions,
    ...KerMLLanguageMetaData.fileExtensions,
];

async function collectLibraryFiles(dir: string): Promise<URI[]> {
    const collected: URI[] = [];
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collected.push(...(await collectLibraryFiles(full)));
        } else if (entry.isFile() && LibraryExtensions.some((ext) => full.endsWith(ext))) {
            collected.push(URI.file(full));
        }
    }
    return collected;
}

export const compileAction = async (
    fileName: string,
    stdlibPath: string,
    options: CompileOptions
): Promise<void> => {
    if (!SysMLExtensions.some((ext) => fileName.endsWith(ext))) {
        console.error(
            chalk.yellow(
                `Please choose a file with one of these extensions: ${SysMLExtensions.join(", ")}.`
            )
        );
        process.exit(1);
    }
    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} doesn't exist.`));
        process.exit(1);
    }
    if (!fs.existsSync(stdlibPath)) {
        console.error(chalk.red(`Standard library path ${stdlibPath} doesn't exist.`));
        process.exit(1);
    }

    const services = createSysMLServices(SysMLNodeFileSystem, {
        standardLibraryPath: stdlibPath,
        standardLibrary: true,
        skipWorkspaceInit: true,
        logStatistics: false,
        defaultBuildOptions: {
            standalone: false,
        },
    }).shared;

    services.workspace.FileSystemProvider.updateStandardLibrary(stdlibPath);

    const documents = services.workspace.LangiumDocuments;
    const builder = services.workspace.DocumentBuilder;

    const stdlibUris = await collectLibraryFiles(stdlibPath);
    const stdDocs = await Promise.all(stdlibUris.map((uri) => documents.getOrCreateDocument(uri)));
    for (const doc of stdDocs) {
        doc.isStandard = true;
    }
    await builder.build(stdDocs, <SysMLBuildOptions>{
        validationChecks: "none",
        standalone: false,
    });

    const modelPath = path.resolve(fileName);
    const modelUri = URI.file(modelPath);
    const workspaceUris = (await collectLibraryFiles(path.dirname(modelPath))).filter(
        (uri) => uri.fsPath !== modelPath
    );
    if (workspaceUris.length > 0) {
        const workspaceDocs = await Promise.all(
            workspaceUris.map((uri) => documents.getOrCreateDocument(uri))
        );
        await builder.build(workspaceDocs, {
            validation: false,
            standalone: false,
        } as SysMLBuildOptions);
    }

    const modelDoc = await documents.getOrCreateDocument(modelUri);
    await builder.build([modelDoc], {
        validation: { categories: ["built-in", "fast"] },
        standalone: false,
    } as SysMLBuildOptions);

    const errors = (modelDoc.diagnostics ?? []).filter((d: Diagnostic) => d.severity === 1);
    if (errors.length > 0) {
        console.error(chalk.red(`Validation failed for ${fileName}:`));
        for (const e of errors) {
            const snippet = modelDoc.textDocument.getText(e.range);
            console.error(chalk.red(`  line ${e.range.start.line + 1}: ${e.message} [${snippet}]`));
        }
        process.exit(1);
    }

    const rootNode = modelDoc.parseResult.value as ast.Namespace;
    const oxstsCode = mapSysMLNamespaceToSemantifyr(rootNode);

    const outputFile =
        options.output ??
        path.join(
            path.dirname(fileName),
            path.basename(fileName, path.extname(fileName)) + ".oxsts"
        );

    await fsp.mkdir(path.dirname(outputFile), { recursive: true });
    await fsp.writeFile(outputFile, oxstsCode);
    console.log(chalk.green(`Compiled ${fileName} -> ${outputFile}`));
};
