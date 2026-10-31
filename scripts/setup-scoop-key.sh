#!/bin/zsh
# Configura una vez la clave de despliegue con la que release.yml actualiza el manifiesto de Scoop.
#
# Crea una clave SSH nueva, registra la parte pública como «deploy key» con escritura SOLO en
# axchisan/scoop-bucket, guarda la privada como secreto SCOOP_BUCKET_DEPLOY_KEY del repositorio
# principal y la borra de este equipo. Volver a ejecutarlo crea otra clave (se puede borrar la
# vieja en GitHub → scoop-bucket → Settings → Deploy keys).
set -euo pipefail

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
ssh-keygen -t ed25519 -N "" -C "lost-and-prompt release -> scoop-bucket" -f "$tmp/key" -q

gh api repos/axchisan/scoop-bucket/keys \
  -f title="Publicación automática de lost-and-prompt" \
  -f key="$(<"$tmp/key.pub")" \
  -F read_only=false --jq '"✓ Clave de despliegue creada en scoop-bucket (id \(.id))"'

gh secret set SCOOP_BUCKET_DEPLOY_KEY --repo axchisan/lost-and-prompt < "$tmp/key"
echo "✓ Secreto SCOOP_BUCKET_DEPLOY_KEY guardado; la clave privada se borró de este equipo."
