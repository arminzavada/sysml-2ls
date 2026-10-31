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
import { EndFeatureMembership, Feature, Redefinition, Subsetting } from "#generated/ast.js";
import { FeatureMeta, InheritanceMeta, MembershipMeta, TypeMeta } from "../KerML/_internal.js";
import { PositionalFeaturesBase } from "./positional-features.js";

const Filter: (f: MembershipMeta<FeatureMeta>) => boolean = (f) =>
    Boolean(f.element()?.isEnd || f.is(EndFeatureMembership.$type));

function ownedEndsOf(type: TypeMeta): FeatureMeta[] {
    return stream(type.featureMembers())
        .filter(Filter)
        .map((m) => m.element())
        .nonNullable()
        .toArray();
}

// the pilot subsets the bound value's result chain, whose features are not inherited as features
function isBoundValueSubsetting(type: TypeMeta, specialization: InheritanceMeta): boolean {
    return (
        specialization.isImplied &&
        specialization.nodeType() === Subsetting.$type &&
        type.is(Feature.$type) &&
        specialization.element() === type.value?.element()?.returnType()
    );
}

class EndFeatures {
    private readonly computed = new Map<TypeMeta, FeatureMeta[]>();

    of(type: TypeMeta): FeatureMeta[] {
        const cached = this.computed.get(type);
        if (cached) return cached;
        this.computed.set(type, []);

        const owned = ownedEndsOf(type);
        const inherited = new Set<FeatureMeta>();
        for (const general of this.generals(type))
            for (const end of this.of(general)) if (!owned.includes(end)) inherited.add(end);

        const redefined = new Set<FeatureMeta>();
        for (const feature of type.ownedFeatures()) this.collectRedefined(feature, redefined);
        for (const end of inherited) this.collectRedefined(end, redefined);

        const ends = owned.concat(Array.from(inherited).filter((end) => !redefined.has(end)));
        this.computed.set(type, ends);
        return ends;
    }

    private generals(type: TypeMeta): TypeMeta[] {
        return stream(type.specializations())
            .filter((s) => !isBoundValueSubsetting(type, s))
            .map((s) => s.finalElement())
            .nonNullable()
            .distinct()
            .toArray();
    }

    // ends redefine the ends at the same position of every general type, as in the pilot
    private collectRedefined(feature: FeatureMeta, redefined: Set<FeatureMeta>): void {
        const add = (f: FeatureMeta): void => {
            if (redefined.has(f)) return;
            redefined.add(f);
            this.collectRedefined(f, redefined);
        };
        feature.types(Redefinition.$type).forEach((f) => add(f as FeatureMeta));

        const owner = feature.owningType;
        const index = owner ? ownedEndsOf(owner).indexOf(feature) : -1;
        if (!owner || index < 0) return;
        for (const general of this.generals(owner)) {
            const end = this.of(general).at(index);
            if (end && end !== feature) add(end);
        }
    }
}

export class ConnectorMixin {
    private readonly endsCache = new PositionalFeaturesBase();
    /**
     * @returns directly owned end features
     */
    ownedEnds(this: TypeMeta & ConnectorMixin): FeatureMeta[] {
        return this.endsCache.owned(this, Filter);
    }

    /**
     * @returns owned end features followed by inherited end features that are
     * not redefined
     */
    allEnds(this: TypeMeta & ConnectorMixin): FeatureMeta[] {
        return new EndFeatures().of(this);
    }

    protected resetEnds(): void {
        this.endsCache.clearCaches();
    }
}
