#!/bin/zsh
# Configura una vez la clave de despliegue con la que release.yml actualiza el cask de Homebrew.
#
# Crea una clave SSH nueva, registra la parte pública como «deploy key» con escritura SOLO en
# axchisan/homebrew-tap, guarda la privada como secreto HOMEBREW_TAP_DEPLOY_KEY del repositorio
# principal y la borra de este equipo. Volver a ejecutarlo crea otra clave (se puede borrar la
# vieja en GitHub → homebrew-tap → Settings → Deploy keys).
set -euo pipefail

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
ssh-keygen -t ed25519 -N "" -C "lost-and-prompt release -> homebrew-tap" -f "$tmp/key" -q

gh api repos/axchisan/homebrew-tap/keys \
  -f title="Publicación automática de lost-and-prompt" \
  -f key="$(<"$tmp/key.pub")" \
  -F read_only=false --jq '"✓ Clave de despliegue creada en homebrew-tap (id \(.id))"'

gh secret set HOMEBREW_TAP_DEPLOY_KEY --repo axchisan/lost-and-prompt < "$tmp/key"
echo "✓ Secreto HOMEBREW_TAP_DEPLOY_KEY guardado; la clave privada se borró de este equipo."
