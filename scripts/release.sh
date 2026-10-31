#!/bin/zsh
# Genera build/LostAndPrompt-<versión>.dmg: app universal (Apple Silicon + Intel), firma ad hoc.
# Uso: scripts/release.sh
set -euo pipefail
cd "${0:A:h}/.."
VERSION=$(sed -n 's/.*MARKETING_VERSION: "\(.*\)"/\1/p' project.yml | head -1)
APP_NAME="Lost & Prompt"

xcodegen generate >/dev/null
xcodebuild -project LostAndPrompt.xcodeproj -scheme LostAndPrompt -configuration Release \
  -derivedDataPath build/release.noindex ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO build | grep -E "error:|BUILD" || true

BUILT=build/release.noindex/Build/Products/Release/LostAndPrompt.app
[[ -d $BUILT ]] || { echo "No se generó la app"; exit 1; }

STAGE=build/dmg.noindex
rm -rf $STAGE && mkdir -p $STAGE
ditto "$BUILT" "$STAGE/$APP_NAME.app"
codesign --force --deep --sign - "$STAGE/$APP_NAME.app"
ln -s /Applications "$STAGE/Applications"

DMG=build/LostAndPrompt-$VERSION.dmg
# hdiutil a veces genera un DMG que macOS no puede montar (pasó con la 0.2.1): se comprueba
# montándolo y, si falla, se vuelve a crear. Nunca se publica un DMG sin verificar.
for attempt in 1 2 3; do
  rm -f $DMG
  hdiutil create -volname "$APP_NAME" -srcfolder $STAGE -fs HFS+ -format UDZO -ov $DMG >/dev/null
  if hdiutil verify $DMG >/dev/null 2>&1 && mount=$(hdiutil attach -nobrowse -readonly $DMG 2>/dev/null | tail -1 | cut -f3); then
    [[ -d "$mount/$APP_NAME.app" ]] && ok=1 || ok=0
    hdiutil detach "$mount" -quiet || true
    [[ $ok == 1 ]] && break
  fi
  echo "⚠️  El DMG no se pudo montar (intento $attempt); se vuelve a crear."
  [[ $attempt == 3 ]] && { echo "No se logró un DMG válido"; exit 1; }
done

# Archivo para las actualizaciones de Sparkle: un zip conserva la firma y no depende de hdiutil.
ZIP=build/LostAndPrompt-$VERSION.zip
rm -f $ZIP
ditto -c -k --sequesterRsrc --keepParent "$STAGE/$APP_NAME.app" $ZIP
echo "Listo: $DMG y $ZIP"
lipo -archs "$STAGE/$APP_NAME.app/Contents/MacOS/LostAndPrompt"
shasum -a 256 $DMG $ZIP
