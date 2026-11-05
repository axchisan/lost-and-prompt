#!/bin/zsh
# Renderiza versiones del vídeo de lanzamiento de principio a fin con el mismo montaje.
# Uso (desde promo/, con las tomas ya grabadas en public/clips/<idioma>/<formato>/):
#   tools/render_all.sh es-9x16 en-16x9 …
# Por cada versión: EDL → tomas recortadas → capa gráfica (Remotion, ProRes 4444) → montaje y
# render en Blender (en segundo plano) → volumen a -14 LUFS → out/final/lost-and-prompt-<v>.mp4
set -euo pipefail
cd "${0:A:h}/.."
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
mkdir -p out/final

for v in "$@"; do
  lang=${v%-*}; fmt=${v#*-}
  node tools/edl.ts $lang $fmt 2>/dev/null
  python3 tools/prepare_media.py edit/edl-$v.json > /dev/null
done
node tools/edls.mjs
rm -rf out/bundle
npx remotion bundle src/index.tsx --out-dir out/bundle --log=error > /dev/null

for v in "$@"; do
  lang=${v%-*}; fmt=${v#*-}
  echo "== $v"
  npx remotion render out/bundle overlay-$v edit/media/overlay-$v.mov \
    --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png --log=error
  rm -f out/v3-$v-raw.mp4
  $BLENDER -b edit/lanzamiento.blend --python-expr "LP_LANG='$lang';LP_FORMAT='$fmt';exec(open('edit/build_blender.py').read())" -a > out/blender-$v.log 2>&1
  ffmpeg -v error -y -i out/v3-$v-raw.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 320k \
    -movflags +faststart out/final/lost-and-prompt-$v.mp4
  rm -f out/v3-$v-raw.mp4
  echo "ok out/final/lost-and-prompt-$v.mp4 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 out/final/lost-and-prompt-$v.mp4) s)"
done
