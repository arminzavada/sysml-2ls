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
    mapSemantifyrTraceToSysML,
    SemantifyrTrace,
    SysMLBuildOptions,
    SysMLSharedServices,
} from "syside-languageserver";
import { SysMLNodeFileSystem } from "syside-languageserver/node.js";

interface OutputOptions extends CommandOptions {
    output?: string;
}

interface BatchOptions extends CommandOptions {
    outputDirectory?: string;
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

function checkInputs(fileNames: string[], stdlibPath: string): void {
    for (const fileName of fileNames) {
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
    }
    if (!fs.existsSync(stdlibPath)) {
        console.error(chalk.red(`Standard library path ${stdlibPath} doesn't exist.`));
        process.exit(1);
    }
}

async function loadStandardLibrary(stdlibPath: string): Promise<SysMLSharedServices> {
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
    const stdlibUris = await collectLibraryFiles(stdlibPath);
    const stdDocs = await Promise.all(stdlibUris.map((uri) => documents.getOrCreateDocument(uri)));
    for (const doc of stdDocs) {
        doc.isStandard = true;
    }
    await services.workspace.DocumentBuilder.build(stdDocs, <SysMLBuildOptions>{
        validationChecks: "none",
        standalone: false,
    });
    return services;
}

async function buildWorkspace(
    services: SysMLSharedServices,
    directory: string,
    fileNames: string[]
): Promise<(ast.Namespace | undefined)[]> {
    const documents = services.workspace.LangiumDocuments;
    const builder = services.workspace.DocumentBuilder;
    const index = services.workspace.IndexManager;

    // the previous directory's documents must not take part in this one's name resolution
    const previous = documents.all
        .filter((doc) => !doc.isStandard)
        .map((doc) => doc.uri)
        .toArray();
    for (const uri of previous) {
        documents.deleteDocument(uri);
        index.remove(uri);
    }
    index.invalidate(previous);

    const modelPaths = fileNames.map((fileName) => path.resolve(fileName));
    const workspaceUris = (await collectLibraryFiles(directory)).filter(
        (uri) => !modelPaths.includes(uri.fsPath)
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

    // models are built once and validated in that build, since a rebuild drops the diagnostics of their linking
    const modelDocs = await Promise.all(
        modelPaths.map((modelPath) => documents.getOrCreateDocument(URI.file(modelPath)))
    );
    await builder.build(modelDocs, {
        validation: { categories: ["built-in", "fast"] },
        standalone: false,
    } as SysMLBuildOptions);

    return modelDocs.map((modelDoc, modelIndex) => {
        const errors = (modelDoc.diagnostics ?? []).filter((d: Diagnostic) => d.severity === 1);
        if (errors.length > 0) {
            console.error(chalk.red(`Validation failed for ${fileNames[modelIndex]}:`));
            for (const e of errors) {
                const snippet = modelDoc.textDocument.getText(e.range);
                console.error(
                    chalk.red(`  line ${e.range.start.line + 1}: ${e.message} [${snippet}]`)
                );
            }
            return undefined;
        }
        return modelDoc.parseResult.value as ast.Namespace;
    });
}

async function loadModel(fileName: string, stdlibArgument: string): Promise<ast.Namespace> {
    const stdlibPath = path.resolve(stdlibArgument);
    checkInputs([fileName], stdlibPath);
    const services = await loadStandardLibrary(stdlibPath);
    const [rootNode] = await buildWorkspace(services, path.dirname(path.resolve(fileName)), [
        fileName,
    ]);
    if (!rootNode) process.exit(1);
    return rootNode;
}

async function writeOutput(outputFile: string, content: string): Promise<void> {
    await fsp.mkdir(path.dirname(outputFile), { recursive: true });
    await fsp.writeFile(outputFile, content);
}

function defaultOutput(fileName: string): string {
    return path.join(
        path.dirname(fileName),
        path.basename(fileName, path.extname(fileName)) + ".oxsts"
    );
}

async function compileModels(stdlibArgument: string, models: [string, string][]): Promise<void> {
    const stdlibPath = path.resolve(stdlibArgument);
    checkInputs(
        models.map(([fileName]) => fileName),
        stdlibPath
    );
    const services = await loadStandardLibrary(stdlibPath);

    const workspaces = new Map<string, [string, string][]>();
    for (const model of models) {
        const directory = path.dirname(path.resolve(model[0]));
        workspaces.set(directory, [...(workspaces.get(directory) ?? []), model]);
    }

    let failed = false;
    for (const [directory, members] of workspaces) {
        const rootNodes = await buildWorkspace(
            services,
            directory,
            members.map(([fileName]) => fileName)
        );
        for (const [modelIndex, [fileName, outputFile]] of members.entries()) {
            const rootNode = rootNodes[modelIndex];
            if (!rootNode) {
                failed = true;
                continue;
            }
            await writeOutput(outputFile, mapSysMLNamespaceToSemantifyr(rootNode));
            console.log(chalk.green(`Compiled ${fileName} -> ${outputFile}`));
        }
    }
    if (failed) process.exit(1);
}

export const compileAction = async (
    fileName: string,
    stdlibPath: string,
    options: OutputOptions
): Promise<void> => {
    await compileModels(stdlibPath, [[fileName, options.output ?? defaultOutput(fileName)]]);
};

export const compileBatchAction = async (
    stdlibPath: string,
    fileNames: string[],
    options: BatchOptions
): Promise<void> => {
    const models = fileNames.map((fileName): [string, string] => [
        fileName,
        options.outputDirectory
            ? path.join(options.outputDirectory, path.basename(defaultOutput(fileName)))
            : defaultOutput(fileName),
    ]);
    const outputs = new Set(models.map(([, outputFile]) => path.resolve(outputFile)));
    if (outputs.size < models.length) {
        console.error(chalk.red("Two inputs would be compiled into the same output file."));
        process.exit(1);
    }
    await compileModels(stdlibPath, models);
};

export const traceAction = async (
    fileName: string,
    stdlibPath: string,
    traceFile: string,
    caseName: string,
    options: OutputOptions
): Promise<void> => {
    if (!fs.existsSync(traceFile)) {
        console.error(chalk.red(`Trace file ${traceFile} doesn't exist.`));
        process.exit(1);
    }
    const trace = JSON.parse(await fsp.readFile(traceFile, "utf-8")) as SemantifyrTrace;
    const rootNode = await loadModel(fileName, stdlibPath);
    const sysmlTrace = mapSemantifyrTraceToSysML(rootNode, trace, caseName);

    const outputFile =
        options.output ??
        path.join(path.dirname(traceFile), path.basename(traceFile, ".json") + ".sysml");

    await writeOutput(outputFile, sysmlTrace);
    console.log(chalk.green(`Generated ${traceFile} -> ${outputFile}`));
};
