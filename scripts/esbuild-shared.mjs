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

/* eslint-disable @typescript-eslint/explicit-function-return-type */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import stdLibBrowser from "node-stdlib-browser";
import stdLibBrowserPlugin from "node-stdlib-browser/helpers/esbuild/plugin";
import rollupPluginLicense from "rollup-plugin-license";
import { getLicenseText } from "./licencemarkup.mjs";

const require = createRequire(import.meta.url);

/** @type {import("esbuild").Plugin} */
export const BuildWatcher = {
    name: "build-watcher",
    setup(build) {
        build.onStart(() => console.log("Build started"));
        build.onEnd((result) => {
            console.log(
                `Build ended with ${result.warnings.length} warnings and ${result.errors.length} errors`
            );
        });
    },
};

/** Writes a bundled `LICENSE` next to each output, listing third-party licenses. */
/** @type {import("esbuild").Plugin} */
export const LicenseBundler = {
    name: "license-bundler",
    setup(build) {
        build.onEnd(async (result) => {
            const chunk = {
                modules: Object.fromEntries(
                    Object.keys(result.metafile.inputs).map((f) => [f, { renderedLength: 1 }])
                ),
            };
            /** @type {import("rollup-plugin-license").Dependency[]} */
            let deps;
            const plugin = rollupPluginLicense({
                thirdParty: { includePrivate: true, output: (d) => (deps = d) },
            });
            plugin.renderChunk("", chunk);
            plugin.generateBundle();
            const txt = await getLicenseText(deps);
            const outDir = path.dirname(Object.keys(result.metafile.outputs)[0]);
            fs.writeFileSync(path.join(outDir, "LICENSE"), txt);
        });
    },
};

/** Silences the chevrotain LL-star ambiguity logger in release builds. */
/** @type {import("esbuild").Plugin} */
export const SilenceLLStarAmbiguity = {
    name: "silence-llstar-ambiguity",
    setup(build) {
        build.onLoad({ filter: /langium-parser\.js/ }, async (args) => ({
            contents: (await fs.promises.readFile(args.path, "utf-8")).replace(
                "LLStarLookaheadStrategy()",
                "LLStarLookaheadStrategy({ logging: () => {} })"
            ),
            loader: "js",
        }));
    },
};

/** Esbuild plugin: rewrite `node-fetch` to the platform-provided `fetch`. */
/** @type {import("esbuild").Plugin} */
export const FetchShim = {
    name: "fetch-shim",
    setup(build) {
        build.onResolve({ filter: /^node-fetch$/ }, (args) => ({
            path: args.path,
            namespace: "fetch",
        }));
        build.onLoad({ filter: /./, namespace: "fetch" }, () => ({
            contents: "module.exports = fetch",
            loader: "js",
        }));
    },
};

/** Force `vscode-*` packages to resolve to their ESM build, not UMD (browser only). */
/** @type {import("esbuild").Plugin} */
export const VscodeUmdRedirect = {
    name: "vscode-umd-redirect",
    setup(build) {
        build.onResolve(
            {
                filter: /vscode-(languageserver-(types|textdocument)|uri)/,
                namespace: "file",
            },
            async (args) => {
                const result = await build.resolve(args.path, {
                    importer: args.importer,
                    kind: args.kind,
                    namespace: "redirect",
                    pluginData: args.pluginData,
                    resolveDir: args.resolveDir,
                });
                if (result.errors.length > 0) return { errors: result.errors };
                return { ...result, path: result.path.replace("/umd", "/esm") };
            }
        );
    },
};

/** Shared base options for any node-target esbuild build. */
/** @returns {import("esbuild").BuildOptions} */
export function nodeOptions() {
    return {
        bundle: true,
        platform: "node",
        format: "cjs",
        external: ["vscode"],
        outExtension: { ".js": ".cjs" },
        metafile: true,
        plugins: [BuildWatcher, SilenceLLStarAmbiguity, LicenseBundler],
    };
}

/** Shared base options for browser-target esbuild builds (vscode web extensions). */
/** @returns {import("esbuild").BuildOptions} */
export function browserOptions() {
    return {
        bundle: true,
        platform: "browser",
        format: "cjs",
        external: ["vscode"],
        outExtension: { ".js": ".cjs" },
        metafile: true,
        inject: [require.resolve("node-stdlib-browser/helpers/esbuild/shim")],
        define: { global: "global", process: "process", Buffer: "Buffer" },
        plugins: [
            BuildWatcher,
            SilenceLLStarAmbiguity,
            LicenseBundler,
            stdLibBrowserPlugin(stdLibBrowser),
            FetchShim,
            VscodeUmdRedirect,
        ],
    };
}

/** `--watch`, `--minify`, `--sourcemap`, `--shebang` flag parsing for per-package esbuild.mjs files. */
export function parseFlags(argv = process.argv.slice(2)) {
    return {
        watch: argv.includes("--watch"),
        minify: argv.includes("--minify"),
        sourcemap: argv.includes("--sourcemap"),
        shebang: argv.includes("--shebang"),
    };
}
