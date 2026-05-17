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

import { ConjugatedPortTyping, PartDefinition, PortDefinition, PortUsage } from "#generated/ast.js";
import { enumerable } from "../../utils/common.js";
import { metamodelOf } from "../metamodel.js";
import { OccurrenceUsageMeta, OccurrenceUsageOptions } from "./occurrence-usage.js";
import type { PortDefinitionMeta } from "./port-definition.js";

export type PortUsageOptions = OccurrenceUsageOptions;

@metamodelOf(PortUsage.$type, {
    base: "Ports::ports",
    ownedPort: "Parts::Part::ownedPorts",
    subport: "Ports::Port::subports",
})
export class PortUsageMeta extends OccurrenceUsageMeta {
    @enumerable
    override get isComposite(): boolean {
        return this.owningType?.isAny(PortDefinition.$type, PortUsage.$type)
            ? super.isComposite
            : false;
    }
    override set isComposite(value) {
        super.isComposite = value;
    }

    override defaultSupertype(): string {
        if (this.isOwnedPort()) return "ownedPort";
        if (this.isSubport()) return "subport";
        return "base";
    }

    isOwnedPort(): boolean {
        return Boolean(
            this.isComposite && this.owner()?.isAny(PartDefinition.$type, PortUsage.$type)
        );
    }

    isSubport(): boolean {
        return Boolean(
            this.isComposite && this.owner()?.isAny(PortDefinition.$type, PortUsage.$type)
        );
    }

    override ast(): PortUsage | undefined {
        return this._ast as PortUsage;
    }

    /**
     * True when this usage is typed via the `~Foo` conjugation form
     * (a ConjugatedPortTyping appears in heritage).
     */
    isConjugated(): boolean {
        return this.heritage.some((h) => h.is(ConjugatedPortTyping.$type));
    }

    /**
     * Resolved {@link PortDefinitionMeta}. Walks the conjugation if present,
     * otherwise the first matching FeatureTyping. Returns `undefined` when
     * the port is typed by something other than a PortDefinition.
     */
    portDefinition(): PortDefinitionMeta | undefined {
        for (const typing of this.allTypings()) {
            if (typing.is(PortDefinition.$type)) return typing as PortDefinitionMeta;
        }
        return undefined;
    }
}

declare module "#generated/ast.js" {
    interface PortUsage {
        $meta: PortUsageMeta;
    }
}
