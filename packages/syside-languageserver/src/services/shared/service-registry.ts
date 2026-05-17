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

import { DefaultServiceRegistry, UriUtils } from "langium";
import { URI } from "vscode-uri";
import { SysMLDefaultServices } from "../services.js";

export class SysMLServiceRegistry extends DefaultServiceRegistry {
    override getServices(uri: URI): SysMLDefaultServices {
        // Langium's default routes by languageId first; that hands us files
        // tagged as `sysml` via `files.associations` or a manual mode switch
        // (e.g. an `.oxsts` sibling of a generated `.sysml`). Route by file
        // extension / fileName instead so we only ever serve `.sysml` /
        // `.kerml`. Buffers without an extension (untitled, pure-language)
        // fall back to languageId, then to the single-language fallback.
        const ext = UriUtils.extname(uri);
        const name = UriUtils.basename(uri);
        const byPath =
            this.fileNameMap.get(name) ?? (ext ? this.fileExtensionMap.get(ext) : undefined);
        if (byPath) return byPath as SysMLDefaultServices;

        if (ext) {
            throw new Error(
                `The service registry contains no services for the extension '${ext}'.`
            );
        }

        const languageId = this.textDocuments?.get(uri)?.languageId;
        const byLanguage = languageId ? this.languageIdMap.get(languageId) : undefined;
        if (byLanguage) return byLanguage as SysMLDefaultServices;

        const fallback = this.all.length === 1 ? this.all[0] : this.fileExtensionMap.get(".sysml");
        if (!fallback) throw new Error("No services registered!");
        return fallback as SysMLDefaultServices;
    }

    override hasServices(uri: URI): boolean {
        const ext = UriUtils.extname(uri);
        const name = UriUtils.basename(uri);
        if (this.fileNameMap.has(name)) return true;
        if (ext) return this.fileExtensionMap.has(ext);
        return this.all.length > 0;
    }
}
