#!/bin/zsh
# Genera las capturas de docs/screenshots/<idioma>/ con los datos de ejemplo ficticios.
# Uso: scripts/screenshots.sh   (después de compilar en Debug con -derivedDataPath build)
set -e
cd "${0:A:h}/.."
APP=build/Build/Products/Debug/LostAndPrompt.app
swiftc -O scripts/window-id.swift -o build/window-id 2>/dev/null

shot() {
  local lang=$1 name=$2 title=$3; shift 3
  pkill -x LostAndPrompt 2>/dev/null || true; sleep 1
  open -n "$APP" --args -LPMock YES -AppleLanguages "($lang)" -AppleLocale "${lang}_US" "$@"
  sleep 3
  osascript -e 'tell application id "com.axchisan.LostAndPrompt" to activate' >/dev/null 2>&1; sleep 2
  local id
  if [[ -n $title ]]; then id=$(build/window-id "Lost & Prompt" "$title"); else id=$(build/window-id "Lost & Prompt"); fi
  mkdir -p docs/screenshots/$lang
  screencapture -x -o -l$id docs/screenshots/$lang/$name.png && echo "ok $lang/$name"
}

for lang in es en; do
  shot $lang recents-light "" -LPDark NO
  shot $lang recents-dark "" -LPDark YES
  shot $lang cards-light "" -LPDark NO -LPScreen cards
  shot $lang cards-dark "" -LPDark YES -LPScreen cards
  shot $lang quickopen-light "" -LPDark NO -LPScreen quickopen
  shot $lang quickopen-dark "" -LPDark YES -LPScreen quickopen
  shot $lang activity-light "" -LPDark NO -LPScreen activity
  shot $lang search-light "" -LPDark NO -LPScreen search
  shot $lang missing-folder "" -LPDark NO -LPScreen missing
done
shot es settings-history "Historial" -LPDark NO -LPScreen settings -LPSettingsPane history
shot en settings-history "History" -LPDark NO -LPScreen settings -LPSettingsPane history
pkill -x LostAndPrompt 2>/dev/null || true
