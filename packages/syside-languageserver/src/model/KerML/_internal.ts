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

// internal module for circular dependencies with fixed import order

export * from "./element.js";
export * from "./references/element-reference.js";
export * from "./relationship.js";
export * from "./relationships/membership.js";

export * from "./relationships/annotation.js";
export * from "./annotating-element.js";
export * from "./textual-annotating-element.js";
export * from "./comment.js";
export * from "./documentation.js";
export * from "./textual-representation.js";

export * from "./namespace.js";
export * from "./references/namespace-reference.js";
export * from "./package.js";
export * from "./library-package.js";
export * from "./type.js";
export * from "./references/type-reference.js";
export * from "./classifier.js";
export * from "./references/classifier-reference.js";
export * from "./class.js";
export * from "./data-type.js";
export * from "./association.js";
export * from "./behavior.js";
export * from "./interaction.js";
export * from "./structure.js";
export * from "./association-structure.js";
export * from "./metaclass.js";
export * from "./references/metaclass-reference.js";

export * from "./feature.js";
export * from "./references/feature-reference.js";
export * from "./multiplicity.js";
export * from "./multiplicity-range.js";
export * from "./step.js";
export * from "./connector.js";
export * from "./binding-connector.js";
export * from "./function.js";
export * from "./item-feature.js";
export * from "./item-flow.js";
export * from "./item-flow-end.js";
export * from "./metadata-feature.js";
export * from "./succession.js";
export * from "./succession-item-flow.js";
export * from "./expression.js";
export * from "./predicate.js";
export * from "./boolean-expression.js";
export * from "./invariant.js";

export * from "./relationships/inheritance.js";
export * from "./relationships/specialization.js";
export * from "./relationships/subsetting.js";
export * from "./relationships/redefinition.js";
export * from "./relationships/reference-subsetting.js";
export * from "./relationships/subclassification.js";
export * from "./relationships/feature-typing.js";
export * from "./relationships/conjugation.js";

export * from "./expressions/invocation-expression.js";
export * from "./expressions/constructor-expression.js";
export * from "./expressions/operator-expression.js";
export * from "./expressions/collect-expression.js";
export * from "./expressions/select-expression.js";
export * from "./expressions/feature-chain-expression.js";
export * from "./expressions/feature-reference-expression.js";
export * from "./expressions/literal-expression.js";
export * from "./expressions/literal-boolean.js";
export * from "./expressions/literal-infinity.js";
export * from "./expressions/literal-number.js";
export * from "./expressions/literal-string.js";
export * from "./expressions/metadata-access-expression.js";
export * from "./expressions/null-expression.js";

export * from "./relationships/dependency.js";

export * from "./relationships/featuring.js";
export * from "./relationships/type-featuring.js";

export * from "./references/membership-reference.js";
export * from "./relationships/owning-membership.js";
export * from "./relationships/feature-value.js";
export * from "./relationships/element-filter-membership.js";
export * from "./relationships/feature-membership.js";
export * from "./relationships/parameter-membership.js";
export * from "./relationships/result-expression-membership.js";
export * from "./relationships/end-feature-membership.js";
export * from "./relationships/return-parameter-membership.js";

export * from "./relationships/import.js";
export * from "./relationships/membership-import.js";
export * from "./relationships/namespace-import.js";

export * from "./relationships/differencing.js";
export * from "./relationships/disjoining.js";
export * from "./relationships/feature-chaining.js";
export * from "./relationships/feature-inverting.js";
export * from "./relationships/intersecting.js";
export * from "./relationships/unioning.js";
