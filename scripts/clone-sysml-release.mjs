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

import child_process from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, "..");
const dir = path.join(root, "SysML-v2-Release");

const commit = "cd99f7ca70b96abb38f09dfd25725e3cf259baa3";
const patchesDir = path.join(__dirname, "patches");

function run(args, { cwd, allowFailure = false, capture = false } = {}) {
    return new Promise((resolve, reject) => {
        const child = child_process.spawn("git", args, {
            cwd,
            stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
        });
        let stdout = "";
        if (capture && child.stdout) {
            child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
        }
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0 || allowFailure) {
                resolve(capture ? stdout.trim() : code);
            } else {
                reject(new Error(`git ${args.join(" ")} exited with code ${code}`));
            }
        });
    });
}

async function checkoutPinnedCommit() {
    const hasGit = await fs
        .stat(path.join(dir, ".git"))
        .then(() => true)
        .catch(() => false);
    if (hasGit) {
        const head = await run(["rev-parse", "HEAD"], {
            cwd: dir,
            capture: true,
            allowFailure: true,
        });
        if (head === commit) return false;
    }

    await fs.mkdir(dir, { recursive: true });
    await run(["init"], { cwd: dir });
    await run(
        ["remote", "add", "origin", "https://github.com/Systems-Modeling/SysML-v2-Release.git"],
        { cwd: dir, allowFailure: true }
    );
    await run(["fetch", "--progress", "--depth=1", "origin", commit], { cwd: dir });
    await run(["checkout", "FETCH_HEAD"], { cwd: dir });
    return true;
}

const cloned = await checkoutPinnedCommit();
if (cloned) {
    const patchEntries = (await fs.readdir(patchesDir).catch(() => []))
        .filter((name) => name.endsWith(".patch"))
        .sort();
    for (const name of patchEntries) {
        await run(["apply", "--whitespace=nowarn", path.join(patchesDir, name)], { cwd: dir });
    }
} else {
    console.log(`SysML-v2-Release already at pinned commit ${commit}.`);
}

export const SYSMLRELEASE = dir;
