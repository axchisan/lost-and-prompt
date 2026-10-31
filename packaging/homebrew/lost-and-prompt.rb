# Cask para el tap axchisan/homebrew-tap (Casks/lost-and-prompt.rb).
# scripts/release.sh imprime el sha256 del DMG; actualizar version y sha256 en cada versión.
cask "lost-and-prompt" do
  version "0.1.0"
  sha256 "REEMPLAZAR_CON_EL_SHA256_DEL_DMG"

  url "https://github.com/axchisan/lost-and-prompt/releases/download/v#{version}/LostAndPrompt-#{version}.dmg"
  name "Lost & Prompt"
  desc "Find, organize and resume all your Claude Code sessions"
  homepage "https://github.com/axchisan/lost-and-prompt"

  depends_on macos: ">= :sequoia"

  app "Lost & Prompt.app"

  # La app no está notarizada (sin cuenta de Apple Developer): se quita la cuarentena para
  # que macOS no la bloquee al abrirla por primera vez.
  postflight do
    system_command "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", "#{appdir}/Lost & Prompt.app"]
  end

  zap trash: [
    "~/Library/Application Support/LostAndPrompt",
    "~/Library/Preferences/com.axchisan.LostAndPrompt.plist",
    "~/.warp/tab_configs/lost_and_prompt.toml",
  ]
end
