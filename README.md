<p align="center">
  <img src="docs/diseno/icono/icono-caja-1024.png" width="128" alt="Lost & Prompt icon: a cardboard box with a terminal card sticking out">
</p>

<h1 align="center">Lost & Prompt</h1>

<p align="center"><em>Every Claude Code session you ever lost, found.</em></p>

<p align="center"><a href="README.es.md">Leer en español</a></p>

Lost & Prompt is a native macOS app to **find, organize and resume** all your Claude Code
sessions, no matter which folder you started them in.

Claude Code ties every session to the directory it was opened in, and `/resume` only lists the
current folder by default. Once you work across many folders, remembering where you talked about
something gets hard. Lost & Prompt puts every session in one window.

![Lost & Prompt main window](docs/screenshots/en/recents-light.png)

## Features

- **Find**: every session from every folder, grouped by day. Search titles, folders and the
  conversations themselves, with the matching snippet highlighted.
- **Resume**: one click (or ↩) opens the session in Warp, Terminal, iTerm2 or Ghostty, in its
  original folder.
- **Quick search from anywhere**: press ⌥⌘K in any app, type two letters, hit ↩.
- **Organize**: favorites, custom names, collections and notes, without touching Claude Code's
  files.
- **Read**: the conversation without the technical noise, before you resume it.
- **Activity**: cost, sessions and most used folders.
- **Keep your history**: Claude Code deletes sessions older than 30 days by default. Choose how
  long to keep them from Settings.
- Rows or cards, light and dark mode, English and Spanish. Updates live while you use Claude Code.

| Cards | Quick search | Dark mode |
|---|---|---|
| ![Cards view](docs/screenshots/en/cards-light.png) | ![Quick search](docs/screenshots/en/quickopen-light.png) | ![Dark mode](docs/screenshots/en/recents-dark.png) |

## Install

Requires macOS 15 Sequoia or later (Apple Silicon or Intel).

**Homebrew**

```bash
brew install --cask axchisan/tap/lost-and-prompt
```

**Download**: get the `.dmg` from [Releases](https://github.com/axchisan/lost-and-prompt/releases)
and drag Lost & Prompt to Applications.

### Opening it the first time

Lost & Prompt is free and open source, and it isn't notarized by Apple (that requires a paid
developer account). macOS will say it can't verify the developer the first time you open it.
To allow it:

1. Open Lost & Prompt once and close the warning.
2. Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.

Or run this once in Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/Lost & Prompt.app"
```

The Homebrew cask does this for you.

## Privacy

Lost & Prompt runs entirely on your Mac. It reads `~/.claude/projects` without modifying it and
never sends anything anywhere. The only Claude Code file it can change is
`~/.claude/settings.json`, and only when you change the history setting yourself; it backs the
file up first.

## Build from source

Requirements: macOS 15+, Xcode 16+ and [XcodeGen](https://github.com/yonaskolb/XcodeGen).

```bash
brew install xcodegen
xcodegen generate
open LostAndPrompt.xcodeproj
```

`scripts/release.sh` builds the universal `.dmg`. The design notes and decisions (in Spanish) are
in [`docs/`](docs/README.md).

## License

[MIT](LICENSE). Lost & Prompt is an independent project, not affiliated with Anthropic. Claude is
a trademark of Anthropic, PBC.
