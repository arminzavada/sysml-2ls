/* eslint-disable no-undef */
// Custom Jest resolver that honors the "import" export condition for the
// small set of ESM-only packages we depend on (Langium 2.x and its parser
// transitives). Anything else falls through to Jest's default resolver, so
// packages like `synckit`/`@pkgr/core` — whose own `exports` map lists
// `import` *before* `require` — continue to resolve through their CJS
// entries.
//
// `@swc/jest` then transforms the resolved files from ESM to CJS at load
// time (see transformIgnorePatterns in jest.config.base.js).

const path = require("path");
const fs = require("fs");
const { resolve: resolveExports } = require("resolve.exports");

// Recognise the ESM-only packages we need to bridge.
const ESM_ONLY_PACKAGES = [
    "langium",
    "chevrotain",
    "chevrotain-allstar",
    "@chevrotain/cst-dts-gen",
    "@chevrotain/gast",
    "@chevrotain/regexp-to-ast",
    "@chevrotain/types",
    "@chevrotain/utils",
    "lodash-es",
];

function splitBareSpecifier(request) {
    if (request.startsWith("@")) {
        const segments = request.split("/");
        if (segments.length < 2) return null;
        const pkg = segments.slice(0, 2).join("/");
        const subpath = segments.length > 2 ? "./" + segments.slice(2).join("/") : ".";
        return { pkg, subpath };
    }
    const slash = request.indexOf("/");
    if (slash === -1) return { pkg: request, subpath: "." };
    return {
        pkg: request.slice(0, slash),
        subpath: "./" + request.slice(slash + 1),
    };
}

function findPackageJson(packageName, basedir) {
    // Resolve symlinks so we walk up the real pnpm-store path; otherwise a
    // basedir like
    //   packages/syside-languageserver/node_modules/chevrotain/lib/src
    // (which is a symlink target) can't find sibling pnpm packages.
    let dir;
    try {
        dir = fs.realpathSync(basedir);
    } catch {
        dir = basedir;
    }
    while (true) {
        // Walk up looking for both `<dir>/node_modules/<pkg>` (the usual case)
        // and `<dir>/<pkg>` (handles being called from inside a sibling under
        // a pnpm `.pnpm/<pkg>@<ver>/node_modules/` directory).
        const inNodeModules = path.join(dir, "node_modules", packageName, "package.json");
        if (fs.existsSync(inNodeModules)) return inNodeModules;
        if (path.basename(dir) === "node_modules") {
            const sibling = path.join(dir, packageName, "package.json");
            if (fs.existsSync(sibling)) return sibling;
        }
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

module.exports = function customResolver(request, options) {
    const split = splitBareSpecifier(request);
    if (split && ESM_ONLY_PACKAGES.includes(split.pkg)) {
        const basedir = options.basedir || (options.rootDir ?? process.cwd());
        const pkgJsonPath = findPackageJson(split.pkg, basedir);
        if (pkgJsonPath) {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
            const resolved = resolveExports(pkg, split.subpath, {
                conditions: ["node", "import", "default"],
                unsafe: true,
            });
            let target = null;
            if (resolved && resolved.length > 0) {
                target = path.resolve(path.dirname(pkgJsonPath), resolved[0]);
            } else if (split.subpath === "." && pkg.main) {
                // Only use the package's `main` when the request is the bare
                // package name (no subpath). Otherwise we'd map
                // `lodash-es/map.js` back to `lodash-es/lodash.js`.
                target = path.resolve(path.dirname(pkgJsonPath), pkg.main);
            } else if (split.subpath !== ".") {
                // For an explicit subpath without an `exports` map, resolve
                // relative to the package directory. Try the literal path
                // and `.js` extension.
                const candidates = [
                    path.resolve(path.dirname(pkgJsonPath), split.subpath),
                    path.resolve(path.dirname(pkgJsonPath), split.subpath + ".js"),
                ];
                target = candidates.find((c) => fs.existsSync(c)) || null;
            }
            if (target) {
                // Normalise via realpath so every consumer of an ESM-only
                // package agrees on a single canonical path. Without this,
                // Jest's module cache treats requests resolved through pnpm
                // symlinks (e.g. `packages/.../node_modules/chevrotain/...`)
                // as separate modules from the same file reached via the
                // `.pnpm` store path, which breaks `instanceof` checks
                // between chevrotain-allstar and chevrotain.
                try {
                    return fs.realpathSync(target);
                } catch {
                    return target;
                }
            }
        }
    }
    // Anything else: delegate to Jest's default resolver, but normalise the
    // result via realpath so symlinked paths collapse to the canonical
    // pnpm-store location.
    const resolved = options.defaultResolver(request, options);
    try {
        return fs.realpathSync(resolved);
    } catch {
        return resolved;
    }
};
