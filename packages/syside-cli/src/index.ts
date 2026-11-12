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

import { Command, Option } from "commander";
import { Extensions, evalAction } from "./sysml-util.js";
import { Version } from "./version.js";
import {
    SysMLExtensions,
    compileAction,
    compileBatchAction,
    constructsAction,
    traceAction,
    validateAction,
} from "./semantifyr-util";

const program = new Command();

program.version(Version);

program
    .command("dump")
    .argument("<file>", `possible file extensions: ${Extensions.join(", ")}`)
    .option("-v, --validate", "Enable validation checks", false)
    .addOption(
        new Option("-l, --stdlib <standardLibrary>", "Set standard library type")
            .choices(["none", "standard", "local"])
            .default("standard")
    )
    .description("Dump AST as JSON to console")
    .action(evalAction);

program
    .command("compile")
    .argument(
        "<model file>",
        `The file to be compiled. possible file extensions: ${SysMLExtensions.join(", ")}`
    )
    .argument("<standard library path>", `The path to the standard library root directory`)
    .addOption(
        new Option("-l, --stdlib <standardLibrary>", "Set standard library type")
            .choices(["none", "standard", "local"])
            .default("standard")
    )
    .option(
        "-o, --output <file>",
        "Output file path (default: input file with .oxsts extension); the name map is written beside it with the .names.json extension"
    )
    .description("Compile SysML model to Semantifyr (OXSTS) format")
    .action(compileAction);

program
    .command("compile-batch")
    .argument("<standard library path>", `The path to the standard library root directory`)
    .argument(
        "<model files...>",
        `The files to be compiled, each in the workspace of its own directory. possible file extensions: ${SysMLExtensions.join(", ")}`
    )
    .option(
        "-d, --output-directory <directory>",
        "Output directory, each output named after its input (default: next to each input)"
    )
    .description(
        "Compile SysML models to Semantifyr (OXSTS) format, loading the standard library once"
    )
    .action(compileBatchAction);

program
    .command("trace")
    .argument(
        "<model file>",
        `The model the trace was verified on. possible file extensions: ${SysMLExtensions.join(", ")}`
    )
    .argument("<standard library path>", `The path to the standard library root directory`)
    .argument("<witness file>", "The witness.json Semantifyr emitted for the verification case")
    .argument("<trace file>", "The trace.json Semantifyr emitted for the verification case")
    .argument("<name map file>", "The names.json the compile command wrote beside the OXSTS")
    .argument("<case name>", "The verification case the trace belongs to")
    .option("-o, --output <file>", "Output file path (default: trace file with .sysml extension)")
    .description("Generate the SysML trace model of a Semantifyr (OXSTS) trace")
    .action(traceAction);

program
    .command("constructs")
    .option("-o, --output <file>", "Output file path (default: standard output)")
    .description(
        "Print the SysML constructs the translation supports, warns about or refuses, as a table"
    )
    .action(constructsAction);

program
    .command("validate")
    .argument(
        "<file>",
        `The file to validate in the workspace of its directory. possible file extensions: ${SysMLExtensions.join(", ")}`
    )
    .argument("<standard library path>", `The path to the standard library root directory`)
    .description("Validate a SysML file without translating it")
    .action(validateAction);

program.parseAsync(process.argv).catch((err) => {
    console.error(err);
    process.exit(1);
});
