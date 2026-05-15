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

import child_process from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "node:fs/promises"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, "..", "..", "..");
const dir = path.join(root, "SysML-v2-Release");

const commit = "de44b238c60e63ad57d33529a6bca07d6e630fe9";
const patchesDir = path.join(__dirname, "patches");
// const tag = "2024-12";

function run(args, { cwd, allowFailure = false } = {}) {
    return new Promise((resolve, reject) => {
        const child = child_process.spawn("git", args, { cwd, stdio: "inherit" });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0 || allowFailure) {
                resolve(code);
            } else {
                reject(new Error(`git ${args.join(" ")} exited with code ${code}`));
            }
        });
    });
}

await fs.mkdir(dir, { recursive: true });
await run(["init"], { cwd: dir });
await run(["remote", "add", "origin", "https://github.com/Systems-Modeling/SysML-v2-Release.git"], { cwd: dir, allowFailure: true });
await run(["fetch", "--progress", "--depth=1", "origin", commit], { cwd: dir });
await run(["checkout", "FETCH_HEAD"], { cwd: dir });

const patchEntries = (await fs.readdir(patchesDir).catch(() => []))
    .filter((name) => name.endsWith(".patch"))
    .sort();
for (const name of patchEntries) {
    await run(["apply", "--whitespace=nowarn", path.join(patchesDir, name)], { cwd: dir });
}

export const SYSMLRELEASE = dir
;
