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

import { DefaultServiceRegistry } from "langium";
import { URI } from "vscode-uri";
import { SysMLDefaultServices } from "../services.js";

export class SysMLServiceRegistry extends DefaultServiceRegistry {
    override getServices(uri: URI): SysMLDefaultServices {
        try {
            return super.getServices(uri) as SysMLDefaultServices;
        } catch {
            // 4.x removed `singleton`; fall back to the only registered language
            // when present (matches the previous behavior) or to the
            // SysML extension when multiple languages are registered.
            const services =
                (this.all.length === 1 ? this.all[0] : undefined) ??
                this.fileExtensionMap?.get(".sysml");
            if (!services) throw new Error("No services registered!");
            return services as SysMLDefaultServices;
        }
    }
}
