#!/bin/zsh
# Configura una vez la clave con la que se firman las actualizaciones de Windows y Linux.
#
# 1. Genera el par de claves de Tauri en ~/.tauri/lost-and-prompt.key (+ .pub).
# 2. Escribe la clave pública en desktop/src-tauri/tauri.conf.json (va en el repositorio).
# 3. Guarda la privada como secretos TAURI_SIGNING_PRIVATE_KEY y TAURI_SIGNING_PRIVATE_KEY_PASSWORD.
#
# IMPORTANTE: guarda ~/.tauri/lost-and-prompt.key y la contraseña que imprime este script en tu
# gestor de contraseñas. Si se pierden, las apps instaladas ya no podrán actualizarse solas.
set -euo pipefail
cd "${0:A:h}/.."

key=~/.tauri/lost-and-prompt.key
if [[ -e $key ]]; then
  echo "Ya existe $key. Bórrala a mano si de verdad quieres otra (las apps instaladas dejarían de actualizarse)."
  exit 1
fi
mkdir -p ~/.tauri
password=$(openssl rand -base64 24)

(cd desktop && ./node_modules/.bin/tauri signer generate --ci -w "$key" -p "$password" >/dev/null)

python3 - "$key.pub" <<'PY'
import json, sys
pub = open(sys.argv[1]).read().strip()
path = "desktop/src-tauri/tauri.conf.json"
config = json.load(open(path))
config["plugins"]["updater"]["pubkey"] = pub
json.dump(config, open(path, "w"), indent=2, ensure_ascii=False)
open(path, "a").write("\n")
PY

gh secret set TAURI_SIGNING_PRIVATE_KEY --repo axchisan/lost-and-prompt < "$key"
printf '%s' "$password" | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo axchisan/lost-and-prompt

echo "✓ Clave pública escrita en desktop/src-tauri/tauri.conf.json"
echo "✓ Secretos TAURI_SIGNING_PRIVATE_KEY y TAURI_SIGNING_PRIVATE_KEY_PASSWORD guardados"
echo
echo "Guarda esto en tu gestor de contraseñas (Bitwarden):"
echo "  Archivo: $key"
echo "  Contraseña: $password"
