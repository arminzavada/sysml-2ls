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
import { browserOptions, nodeOptions, parseFlags } from "../../scripts/esbuild-shared.mjs";

const { watch, minify, sourcemap } = parseFlags();

const builds = [
    {
        ...nodeOptions(),
        entryPoints: ["src/node/extension.ts", "src/node/language-server/main.ts"],
        outdir: "dist/node",
        minify,
        sourcemap,
    },
    {
        ...browserOptions(),
        entryPoints: ["src/browser/extension.ts", "src/browser/language-server/main.ts"],
        outdir: "dist/browser",
        minify,
        // inline sourcemaps for browser so vscode dev tools resolve them
        sourcemap: sourcemap ? "inline" : false,
    },
];

if (watch) {
    const ctxs = await Promise.all(builds.map((b) => esbuild.context(b)));
    await Promise.all(ctxs.map((c) => c.watch()));
    console.log("watching...");
} else {
    await Promise.all(builds.map((b) => esbuild.build(b)));
}
