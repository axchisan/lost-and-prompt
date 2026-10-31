#!/bin/zsh
# Genera build/LostAndPrompt-<versión>.dmg: app universal (Apple Silicon + Intel), firma ad hoc.
# Uso: scripts/release.sh
set -euo pipefail
cd "${0:A:h}/.."
VERSION=$(sed -n 's/.*MARKETING_VERSION: "\(.*\)"/\1/p' project.yml | head -1)
APP_NAME="Lost & Prompt"

xcodegen generate >/dev/null
xcodebuild -project LostAndPrompt.xcodeproj -scheme LostAndPrompt -configuration Release \
  -derivedDataPath build/release ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO build | grep -E "error:|BUILD" || true

BUILT=build/release/Build/Products/Release/LostAndPrompt.app
[[ -d $BUILT ]] || { echo "No se generó la app"; exit 1; }

STAGE=build/dmg
rm -rf $STAGE && mkdir -p $STAGE
ditto "$BUILT" "$STAGE/$APP_NAME.app"
codesign --force --deep --options runtime --sign - "$STAGE/$APP_NAME.app"
ln -s /Applications "$STAGE/Applications"

DMG=build/LostAndPrompt-$VERSION.dmg
rm -f $DMG
hdiutil create -volname "$APP_NAME" -srcfolder $STAGE -fs HFS+ -format UDZO -ov $DMG >/dev/null
echo "Listo: $DMG"
lipo -archs "$STAGE/$APP_NAME.app/Contents/MacOS/LostAndPrompt"
shasum -a 256 $DMG
