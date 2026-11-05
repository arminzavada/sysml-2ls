#!/bin/sh
set -eu

if [ $# -ne 2 ]; then
    echo "usage: release.sh <version> <output directory>" >&2
    exit 2
fi

version="$1"
mkdir -p "$2"
output="$(cd "$2" && pwd)"
cd "$(dirname "$0")/.."

for package in syside-cli syside-vscode; do
    package_version="$(node -p "require('./packages/$package/package.json').version")"
    if [ "$package_version" != "$version" ]; then
        echo "release.sh: packages/$package is at version $package_version, not $version" >&2
        exit 1
    fi
done

pnpm install --frozen-lockfile
pnpm run cli
rm -f packages/syside-vscode/*.vsix
pnpm run vscode:package

staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
cp packages/syside-cli/dist/cli.cjs packages/syside-cli/dist/LICENSE "$staging/"
cp -R SysML-v2-Release/sysml.library "$staging/"
find "$staging/sysml.library" -type f ! -name '*.sysml' ! -name '*.kerml' -delete
find "$staging/sysml.library" -type d -empty -delete
cp SysML-v2-Release/LICENSE "$staging/sysml.library/LICENSE.EPLv2"

tar --sort=name --owner=0 --group=0 --numeric-owner --mode=go-w --mtime="@$(git log -1 --format=%ct)" \
    -C "$staging" -cf - cli.cjs LICENSE sysml.library | gzip -n > "$output/syside-cli-$version.tar.gz"
cp packages/syside-vscode/*.vsix "$output/syside-vscode-$version.vsix"

cd "$output"
sha256sum "syside-cli-$version.tar.gz" "syside-vscode-$version.vsix" > SHA256SUMS
cat SHA256SUMS
