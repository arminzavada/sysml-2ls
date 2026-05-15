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

import { NodeFileSystemProvider } from "langium/node";
import { SysMLFileSystemProvider } from "../services/shared/workspace/file-system-provider.js";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";
import { pathToURI, resolvePathURI } from "syside-base";
import { backtrackToDirname } from "../utils/index.js";

// Falls back to `__dirname` because esbuild's CJS bundling leaves
// `import.meta.url` empty but keeps the CJS `__dirname` global populated.
declare const __dirname: string | undefined;
const currentDir = ((): string => {
    try {
        return path.dirname(fileURLToPath(import.meta.url));
    } catch {
        return typeof __dirname === "string" ? __dirname : process.cwd();
    }
})();

export class SysMLNodeFileSystemProvider
    extends NodeFileSystemProvider
    implements SysMLFileSystemProvider
{
    protected stdlib: URI | undefined;
    private _extensionDir: URI | undefined | null;

    get standardLibrary(): URI | undefined {
        return this.stdlib;
    }

    /**
     * Extension root directory
     */
    get extensionDir(): URI | undefined {
        if (this._extensionDir === undefined) {
            const extensionDir = backtrackToDirname(currentDir, /out|src/);
            this._extensionDir = extensionDir ? pathToURI(extensionDir) : null;
        }

        return this._extensionDir ?? undefined;
    }

    updateStandardLibrary(value: string): void {
        this.stdlib = value ? resolvePathURI(value) : undefined;
    }

    override async exists(path: URI): Promise<boolean> {
        return fs.promises.stat(path.fsPath).then(
            /* resolved */ () => true,
            /* rejected */ () => false
        );
    }

    override existsSync(path: URI): boolean {
        return fs.existsSync(path.fsPath);
    }

    async loadScript(path: URI): Promise<object | undefined> {
        return import(path.fsPath);
    }

    async preloadFiles(): Promise<void> {
        // nothing to preload here
        return;
    }
}

export const SysMLNodeFileSystem = {
    fileSystemProvider: (): SysMLFileSystemProvider => new SysMLNodeFileSystemProvider(),
};
