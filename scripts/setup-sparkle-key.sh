#!/bin/zsh
# Configura una vez la clave EdDSA con la que se firman las actualizaciones de la app de Mac (Sparkle).
#
# 1. Genera la clave con las herramientas de Sparkle (queda en tu llavero de macOS).
# 2. Escribe la clave pública en project.yml (SPARKLE_PUBLIC_KEY; va en el repositorio).
# 3. Guarda la privada como secreto SPARKLE_PRIVATE_KEY y la copia al portapapeles para que la
#    guardes en Bitwarden. Si se pierde, las apps de Mac instaladas no podrán actualizarse solas.
set -euo pipefail
cd "${0:A:h}/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -sL -o "$tmp/sparkle.tar.xz" https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz
tar xf "$tmp/sparkle.tar.xz" -C "$tmp"
tools="$tmp/bin"

"$tools/generate_keys" --account lost-and-prompt >/dev/null
public=$("$tools/generate_keys" --account lost-and-prompt -p)
"$tools/generate_keys" --account lost-and-prompt -x "$tmp/private.key" >/dev/null

sed -i '' "s|^        SPARKLE_PUBLIC_KEY: .*|        SPARKLE_PUBLIC_KEY: \"$public\"|" project.yml
gh secret set SPARKLE_PRIVATE_KEY --repo axchisan/lost-and-prompt < "$tmp/private.key"
pbcopy < "$tmp/private.key"

echo "✓ Clave pública escrita en project.yml"
echo "✓ Secreto SPARKLE_PRIVATE_KEY guardado"
echo "✓ Clave privada copiada al portapapeles: pégala en Bitwarden (Nota segura «Lost & Prompt · clave Sparkle»)"
echo "  y luego vacía el portapapeles con: pbcopy < /dev/null"
