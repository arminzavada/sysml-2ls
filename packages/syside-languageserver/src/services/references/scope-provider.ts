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

import {
    CstUtils,
    DefaultScopeProvider,
    isLeafCstNode,
    LangiumDocument,
    ReferenceInfo,
} from "langium";
import {
    Conjugation,
    CrossSubsetting,
    Element,
    ElementReference,
    EndFeatureMembership,
    Expression,
    FeatureChainExpression,
    FeatureChaining,
    FeatureInverting,
    FeatureReferenceExpression,
    InlineExpression,
    InvocationExpression,
    Membership,
    Namespace,
    ParameterMembership,
    Redefinition,
    Specialization,
    Subsetting,
    SysMLFunction,
    Type,
} from "#generated/ast.js";
import {
    CHILD_CONTENTS_OPTIONS,
    DEFAULT_ALIAS_RESOLVER,
    fillContentOptions,
    PARENT_CONTENTS_OPTIONS,
    ScopeOptions,
    Visibility,
} from "../../utils/scope-util.js";
import {
    SysMLScope,
    makeScope,
    makeLinkingScope,
    FilteredScope,
    InheritedTypeScope,
    ScopeStream,
} from "../../utils/scopes.js";
import { SysMLDefaultServices } from "../services.js";
import { SysMLIndexManager } from "../shared/workspace/index-manager.js";
import { MetamodelBuilder } from "../shared/workspace/metamodel-builder.js";
import { CancellationToken } from "vscode-languageserver";
import { getPreviousNode } from "../../utils/cst-util.js";
import {
    ElementMeta,
    ElementReferenceMeta,
    ExpressionMeta,
    FeatureChainExpressionMeta,
    FeatureMeta,
    Metamodel,
    TypeMeta,
} from "../../model/index.js";
import { SysMLType } from "../sysml-ast-reflection.js";

export class SysMLScopeProvider extends DefaultScopeProvider {
    protected override indexManager: SysMLIndexManager;
    protected metamodelBuilder: MetamodelBuilder;

    constructor(services: SysMLDefaultServices) {
        super(services);
        this.indexManager = services.shared.workspace.IndexManager;
        this.metamodelBuilder = services.shared.workspace.MetamodelBuilder;
    }

    override getScope(context: ReferenceInfo): SysMLScope {
        const unfiltered = this.getScopeUnfiltered(context);
        const referenceType = this.reflection.getReferenceType(context);
        return new FilteredScope(
            unfiltered,
            (desc) => !!desc.element()?.is(referenceType as SysMLType)
        );
    }

    /**
     * Get a scope with all named elements so that aliases are not filtered out
     * @param context
     * @returns Scope with all named elements
     */
    getScopeUnfiltered(context: ReferenceInfo): ScopeStream {
        return makeLinkingScope(context.container.$meta, {}, this.indexManager.getGlobalScope());
    }

    /**
     * Get the scope for reference resolution
     * @param container reference owning container
     * @param index index of the reference
     * @param aliasResolver alias resolution function, a linker may use a
     * function that also links the alias to be resolved, while other services
     * may simply follow to the alias target
     * @returns scope that can be used to resolve the reference at {@link index}
     */
    getElementReferenceScope(
        container: ElementReferenceMeta,
        index: number,
        aliasResolver = DEFAULT_ALIAS_RESOLVER
    ): SysMLScope | ScopeStream | undefined {
        let parent: ReturnType<typeof this.getContext>;
        if (index === 0) {
            // either not a reference or start of qualified type chain only the
            // first part in the chain can use its parent scope, every other
            // part has to use the resolved element scope skipping the reference
            // scope itself since it doesn't contain anything anyway
            const context = this.getContext(container);
            if (context === "error") return;
            if (context) {
                parent = context;
            } else {
                return this.initialScope(container.owner(), container.document, { aliasResolver });
            }
        } else {
            // even if the reference was discarded due to the wrong type,
            // construct the reference resolution scope for completion provider
            parent = container.found.at(index - 1);
        }

        if (!parent) return;

        // not a start of the reference so it has to be resolved in the scope of
        // `parent`
        return this.localScope(parent, container.document, aliasResolver);
    }

    /**
     * Get the scope for reference resolution of the first reference in the
     * qualified chain
     * @param owner owner of the {@link ElementReference} that the reference is
     * a part of
     * @param document document that contains {@link owner}
     * @param aliasResolver alias resolution function
     * @see {@link getElementReferenceScope} (`index === 0`)
     * @returns scope that can be used to resolve the first reference in
     * {@link ElementReference}
     */
    initialScope(
        owner: Metamodel | undefined,
        document?: LangiumDocument,
        options?: ScopeOptions
    ): SysMLScope | undefined {
        options ??= { aliasResolver: DEFAULT_ALIAS_RESOLVER };

        // For `a.b`, the reference for `b` is owned directly by the
        // FeatureChainExpression: scope it in the local scope of `a`.
        if (owner?.is(FeatureChainExpression.$type)) {
            const previous = (owner as FeatureChainExpressionMeta).operands.at(0);
            const resolvedPrevious = this.resolveChainPrevious(previous);
            if (resolvedPrevious) {
                return this.localScope(resolvedPrevious, document, options.aliasResolver);
            }
            return;
        }

        while (owner?.is(InlineExpression.$type)) {
            // unwrap all the expressions to get the real parent
            owner = owner.owner();
        }

        // FeatureChaining covers two cases:
        //   * `f chains a.b.c` declarations
        //   * `a.b.c` expressions, where `b.c` is parsed as an OwnedFeatureChain
        // The first chaining looks up in the enclosing scope (or the FCE's
        // left operand when nested in an expression); subsequent chainings
        // look up in the scope of the previously-resolved chaining target.
        if (owner?.is(FeatureChaining.$type)) {
            const chaining = owner;
            const parentFeature = chaining.parent();
            const chainings = (parentFeature as FeatureMeta | undefined)?.chainings;
            const index = chainings
                ? chainings.indexOf(chaining as FeatureMeta["chainings"][number])
                : -1;
            if (index > 0 && chainings) {
                const previous = chainings[index - 1].element();
                if (previous) {
                    return this.localScope(previous, document, options.aliasResolver);
                }
                return;
            }
            const chainOwner = parentFeature?.owner();
            if (chainOwner?.is(FeatureChainExpression.$type)) {
                const previous = (chainOwner as FeatureChainExpressionMeta).operands.at(0);
                const resolvedPrevious = this.resolveChainPrevious(previous);
                if (resolvedPrevious) {
                    return this.localScope(resolvedPrevious, document, options.aliasResolver);
                }
                return;
            }
            owner = chaining.owner()?.owner();
        }

        // Pilot conformance (`KerMLScope.xtend:213`): when resolving the first
        // segment of a redefinition target (`:>> a::b`), look up `a` through
        // the owning type's inherited members rather than its owned members,
        // so a self-collision in the owning type doesn't shadow the inherited
        // element. The remaining segments are resolved via the regular
        // per-context scope walk in `getElementReferenceScope`.
        let redefinitionOwningType: ElementMeta | undefined;
        if (owner?.is(Redefinition.$type)) {
            const redefiningFeature = owner.source();
            const owningType = (redefiningFeature as FeatureMeta | undefined)?.owningType;
            if (owningType?.is(Type.$type)) {
                redefinitionOwningType = owningType;
            }
        }

        // also skip the first scoping node as references are always a part
        // of its declaration. However SysML adds more references that are
        // not used for scope resolution therefore we only skip if the
        // reference declares a specialization
        if (owner?.isAny(Specialization.$type, Conjugation.$type)) {
            // TODO: not sure if this is right and specializations are
            // allowed to reference the declaring element but this fixes a
            // linking error in
            // SysML-v2-Release/sysml/src/examples/Individuals%20Examples/JohnIndividualExample.sysml
            if (
                owner.nodeType() !== Subsetting.$type &&
                owner.nodeType() !== CrossSubsetting.$type &&
                owner.nodeType() !== FeatureInverting.$type
            ) {
                options.skip = owner.source();
            }

            const parent = owner.parent();
            if (parent?.parent()?.is(ParameterMembership.$type)) {
                const outer = parent.owner();
                if (outer?.is(InvocationExpression.$type) && (parent as FeatureMeta).value)
                    // resolution of type relationships in an invocation
                    // argument should be done in the invoked function scope
                    return this.localScope(
                        outer.invokes() ?? outer,
                        undefined,
                        options.aliasResolver
                    );
            }

            // source == parent if this relationship is a part of declaration,
            // in that case skip the owner since specialization itself makes no
            // sense
            owner = owner.source() === parent ? parent?.owner() : parent;

            if (options.skip?.parent()?.is(EndFeatureMembership.$type)) {
                // connector ends cannot reference connector scope
                owner = owner?.owner();
            }
        } else if (owner?.parent()?.is(ParameterMembership.$type)) {
            if (owner.owner()?.is(InvocationExpression.$type)) {
                // invocation argument
                return this.initialScope(owner.owner(), document, options);
            }
        } else if (owner?.is(Membership.$type)) {
            // skip the alias scope since resolution tries to follow aliases to
            // their final destination
            owner = owner.owner();
        }

        if (!owner) return;

        // skipping the the owning node to avoid name resolution bugs if the
        // node has the same name as the reference
        document ??= owner.document;

        const parent = owner.is(Element.$type)
            ? owner
            : (owner.parent() as ElementMeta | undefined);
        if (parent) this.initializeParents(parent, document);

        const linkingScope = makeLinkingScope(
            owner,
            options,
            this.indexManager.getGlobalScope(document as LangiumDocument<Namespace> | undefined)
        );

        if (redefinitionOwningType) {
            const inheritedOpts = fillContentOptions({
                ...PARENT_CONTENTS_OPTIONS,
                aliasResolver: options.aliasResolver,
                inherited: { visibility: Visibility.private, depth: 1 },
                imported: { visibility: Visibility.private, depth: 1 },
            });
            this.preLinkInheritedClosure(redefinitionOwningType as TypeMeta);
            const inheritedScope = new InheritedTypeScope(
                redefinitionOwningType as TypeMeta,
                inheritedOpts
            );
            return new ScopeStream(
                (function* (): Generator<typeof inheritedScope | typeof linkingScope> {
                    yield inheritedScope;
                    yield linkingScope;
                })()
            );
        }

        return linkingScope;
    }

    /**
     * Get the scope that can be used for reference resolution in the context of
     * {@link node}
     * @param node AST node to get scope for
     * @param document document that contains {@link node}
     * @param aliasResolver alias resolution function
     * @see {@link getElementReferenceScope} (`index > 0`)
     * @returns scope of publicly visible elements from {@link node} scope
     */
    localScope(
        node: Metamodel,
        document?: LangiumDocument,
        aliasResolver = DEFAULT_ALIAS_RESOLVER
    ): SysMLScope {
        const ast = node.ast();
        if (ast && document) this.metamodelBuilder.preLink(ast, document, CancellationToken.None);
        if (node.is(Type.$type)) this.preLinkInheritedClosure(node as TypeMeta);
        return makeScope(node, {
            ...CHILD_CONTENTS_OPTIONS,
            aliasResolver: aliasResolver,
        });
    }

    /**
     * Resolve the left-hand operand of a `.`-style FeatureChainExpression to
     * the element whose scope should be used for the right-hand reference.
     * Handles bare FeatureReferenceExpression, nested FeatureChainExpression,
     * and other InlineExpressions (e.g. `(x as T).foo`) by following the
     * expression's returnType to its type.
     */
    protected resolveChainPrevious(previous: Metamodel | undefined): Metamodel | undefined {
        if (!previous) return;
        if (previous.is(FeatureReferenceExpression.$type)) {
            return previous.expression?.element();
        }
        if (previous.is(FeatureChainExpression.$type)) {
            return (previous as FeatureChainExpressionMeta).targetFeature();
        }
        if (previous.isAny(InlineExpression.$type, Expression.$type)) {
            const target = (previous as ExpressionMeta).returnType();
            const resolved = this.indexManager.findType(target);
            if (resolved) return resolved;
        }
        return previous;
    }

    /**
     * Force-preLinks the inherited heritage closure of {@link root}. Reference
     * resolution of `redefines`/`subsets` etc. happens as a side-effect of
     * preLinking the owning type, so a scope walk through `A -> B -> C` would
     * stall on the intermediate `B` until `B` itself is preLinked.
     */
    protected preLinkInheritedClosure(root: TypeMeta): void {
        const visited = new Set<TypeMeta>();
        const stack: TypeMeta[] = [root];
        while (stack.length > 0) {
            const t = stack.pop() as TypeMeta;
            if (visited.has(t)) continue;
            visited.add(t);
            const doc = t.document;
            if (doc) this.metamodelBuilder.buildElement(t, doc);
            for (const s of t.specializations()) {
                const next = s.finalElement();
                if (next && next.is(Type.$type) && !visited.has(next as TypeMeta)) {
                    stack.push(next as TypeMeta);
                }
            }
        }
    }

    /**
     * Get node final reference target
     * @param node
     * @returns Element referenced by `node` if linked, `"error"` if failed to link
     * and `undefined` for no reference
     */
    protected getElementTarget(node: Metamodel): ElementMeta | undefined | "error" {
        if (node.is(ElementReference.$type)) {
            return node.to.target ?? "error";
        } else if (node.isAny(InlineExpression.$type, Expression.$type, SysMLFunction.$type)) {
            const target = node.returnType();
            return this.indexManager.findType(target) ?? "error";
        }

        return undefined;
    }

    /**
     * Get context for scope resolution
     * @param ref Reference to resolve context for
     * @returns `undefined` if implicit parent context, `"error"` if context failed to
     * be linked and {@link Element} for existing context
     */
    protected getContext(ref: ElementReferenceMeta): ElementMeta | undefined | "error" {
        const ast = ref.ast();
        if (!ast) return;
        const cst = ast.$cstNode;
        if (!cst) return;

        // check if the previous CST node is a scope token (`::` or `.`)
        let previous = getPreviousNode(cst, false);
        if (previous && !isLeafCstNode(previous)) {
            previous = CstUtils.findLeafNodeAtOffset(previous, previous.end);
        }
        if (!previous || ![".", "::"].includes(previous.text)) {
            return;
        }

        // if it is, traverse one CST node backward again and find the reference node
        let contextCst = getPreviousNode(previous, false);
        if (!contextCst) return;
        // need to use leaf in case the found node is composite and only
        // contains the single reference node inside
        if (!isLeafCstNode(contextCst)) {
            contextCst = CstUtils.findLeafNodeAtOffset(contextCst, contextCst.end);
        }
        const element = contextCst?.astNode;
        if (!element?.$meta) return;
        return this.getElementTarget(element.$meta);
    }

    /**
     * Construct parent nodes of {@link node}, including itself, for scope
     * resolution
     * @param node AST node that scope is being constructed for
     * @param document document that contains {@link node}
     */
    protected initializeParents(node: ElementMeta | undefined, document: LangiumDocument): void {
        while (node) {
            this.metamodelBuilder.buildElement(node, document);
            node = node.parent();
        }
    }
}
