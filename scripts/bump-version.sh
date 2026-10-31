#!/bin/zsh
# Cambia la versión de las tres apps a la vez desde el archivo VERSION.
# Uso: scripts/bump-version.sh 0.2.0
#
# Actualiza VERSION, project.yml (macOS; también sube el número de compilación),
# Cargo.toml (núcleo y app de escritorio) y desktop/package.json (Tauri lee de ahí),
# y comprueba que CHANGELOG.md tenga una sección para la versión nueva.
set -euo pipefail
cd "${0:A:h}/.."

new=${1:?"Uso: scripts/bump-version.sh X.Y.Z"}
[[ $new =~ '^[0-9]+\.[0-9]+\.[0-9]+$' ]] || { echo "Versión no válida: $new (usa X.Y.Z)"; exit 1; }
old=$(<VERSION)

build=$(sed -n 's/.*CURRENT_PROJECT_VERSION: "\([0-9]*\)"/\1/p' project.yml | head -1)
sed -i '' "s/MARKETING_VERSION: \"$old\"/MARKETING_VERSION: \"$new\"/; s/CURRENT_PROJECT_VERSION: \"$build\"/CURRENT_PROJECT_VERSION: \"$((build + 1))\"/" project.yml
sed -i '' "/^\[workspace.package\]/,/^\[/ s/^version = \"$old\"/version = \"$new\"/" Cargo.toml
sed -i '' "s/\"version\": \"$old\"/\"version\": \"$new\"/" desktop/package.json
echo $new > VERSION

grep -q "^## \[$new\]" CHANGELOG.md || echo "⚠️  Falta la sección «## [$new]» en CHANGELOG.md"
echo "Versión $old → $new (compilación de macOS $((build + 1)))"
grep -n "MARKETING_VERSION\|CURRENT_PROJECT_VERSION" project.yml
grep -n "^version" Cargo.toml
grep -n '"version"' desktop/package.json
