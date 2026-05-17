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

import { stream } from "langium";
import { Mixin } from "ts-mixer";
import {
    ActionDefinition,
    ActionUsage,
    Connector,
    Feature,
    FeatureMembership,
    ItemFlow,
    SuccessionAsUsage,
    TransitionFeatureMembership,
    TransitionUsage,
    Type,
} from "#generated/ast.js";
import { FeatureMembershipMeta, FeatureMeta, MembershipMeta } from "../KerML/index.js";
import { SuccessionMeta, SuccessionOptions } from "../KerML/succession.js";
import { metamodelOf, BasicMetamodel } from "../metamodel.js";
import { ConnectorAsUsageMeta, ConnectorAsUsageOptions } from "./connector-as-usage.js";

export interface SuccessionAsUsageOptions extends SuccessionOptions, ConnectorAsUsageOptions {}

@metamodelOf(SuccessionAsUsage.$type, {
    base: "Occurrences::happensBeforeLinks",
    binary: "Occurrences::happensBeforeLinks",
})
export class SuccessionAsUsageMeta extends Mixin(SuccessionMeta, ConnectorAsUsageMeta) {
    override ast(): SuccessionAsUsage | undefined {
        return this._ast as SuccessionAsUsage;
    }

    override defaultSupertype(): string {
        return SuccessionMeta.prototype.defaultSupertype.call(this);
    }

    targetFeature(): FeatureMembershipMeta | undefined {
        const owner = this.owner();
        if (!owner?.is(Type.$type)) return;

        const parent = this.parent();

        const features = owner.featureMembers();
        const index = features.findIndex((m) => m === parent);
        if (index >= features.length) return;
        return stream(features.slice(index + 1))
            .filter((m) => m.is(FeatureMembership.$type))
            .head() as FeatureMembershipMeta | undefined;
    }

    private static findPreviousFeature(
        feature: FeatureMeta,
        linker?: (model: BasicMetamodel) => void
    ): MembershipMeta<FeatureMeta> | undefined {
        const owner = feature.owner();
        if (!owner?.is(Type.$type)) return;

        const parent = feature.parent();
        const features = owner.featureMembers();
        let index = features.findIndex((m) => m === parent);
        while (--index >= 0) {
            const membership = features[index];
            if (membership.is(TransitionFeatureMembership.$type)) continue;

            linker?.call(undefined, membership);
            const element = membership.element();
            if (!element) continue;
            if (
                !element.isParameter &&
                !element.is(TransitionUsage.$type) &&
                (!element.is(Connector.$type) ||
                    (!owner.isAny(ActionDefinition.$type, ActionUsage.$type) &&
                        element.is(ItemFlow.$type)))
            )
                return membership;
        }

        return owner.is(Feature.$type)
            ? SuccessionAsUsageMeta.findPreviousFeature(owner, linker)
            : undefined;
    }

    previousFeature(
        linker?: (model: BasicMetamodel) => void
    ): MembershipMeta<FeatureMeta> | undefined {
        return SuccessionAsUsageMeta.findPreviousFeature(this, linker);
    }
}

declare module "#generated/ast.js" {
    interface SuccessionAsUsage {
        $meta: SuccessionAsUsageMeta;
    }
}
