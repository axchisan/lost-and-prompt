#!/bin/zsh
# Publica o actualiza lost-and-prompt-bin en AUR con packaging/aur/PKGBUILD y .SRCINFO.
# Requiere cuenta en aur.archlinux.org con la clave ~/.ssh/aur (ver packaging/aur/README.md).
set -euo pipefail
cd "${0:A:h}/.."

version=$(sed -n 's/^pkgver=//p' packaging/aur/PKGBUILD)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

ssh-keyscan -t ed25519 aur.archlinux.org >> ~/.ssh/known_hosts 2>/dev/null
git clone -q ssh://aur@aur.archlinux.org/lost-and-prompt-bin.git "$tmp/aur"
cp packaging/aur/PKGBUILD packaging/aur/.SRCINFO "$tmp/aur/"
cd "$tmp/aur"
# Identidad pública de AUR: sin tu correo real.
git config user.name "axchisan"
git config user.email "axchisan@users.noreply.github.com"
git add PKGBUILD .SRCINFO
if git diff --cached --quiet; then
  echo "AUR ya tiene la versión $version."
  exit 0
fi
git commit -q -m "lost-and-prompt-bin $version"
git push -q origin HEAD:master
echo "✓ Publicado lost-and-prompt-bin $version: https://aur.archlinux.org/packages/lost-and-prompt-bin"
