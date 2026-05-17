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

// @ts-check
import * as esbuild from "esbuild";
import fs from "node:fs";
import { nodeOptions, parseFlags } from "../../scripts/esbuild-shared.mjs";

const { watch, minify, sourcemap } = parseFlags();

/** @type {import("esbuild").BuildOptions} */
const options = {
    ...nodeOptions(),
    entryPoints: ["src/index.ts"],
    outfile: "dist/cli.cjs",
    banner: { js: "#!/usr/bin/env node" },
    minify,
    sourcemap,
};

if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log("watching...");
} else {
    await esbuild.build(options);
    fs.chmodSync("dist/cli.cjs", 0o755);
}
