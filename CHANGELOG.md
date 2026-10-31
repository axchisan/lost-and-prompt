# Changelog

All notable changes to Lost & Prompt. Format based on [Keep a Changelog](https://keepachangelog.com),
versions follow [Semantic Versioning](https://semver.org).

Todos los cambios importantes de Lost & Prompt. Cada versión trae las notas en inglés y en español.

## [Unreleased]

### Added
- Windows and Linux: pick any terminal — Warp, Windows Terminal, PowerShell 7, cmd, Git Bash,
  WezTerm, Alacritty, GNOME Terminal, Konsole, Kitty, Ghostty… — or set a custom command.
- macOS: WezTerm, Kitty, Alacritty and custom terminals; only installed terminals are listed.
- macOS: automatic updates with Sparkle (Lost & Prompt → Check for Updates…, and in Settings).
- Windows and Linux: settings button with About, Check for Updates and Report a Problem.
- Windows and Linux: the app opens a single window and remembers its size and position.
- Windows and Linux: automatic updates — the app tells you when there's a new version and installs
  it with one click (installer on Windows, AppImage on Linux).
- Windows and Linux: system tray icon with recent sessions, global shortcut (Ctrl+Alt+K) and open
  at login.
- Windows: sessions from Claude Code inside WSL (running distributions), resumed in WSL.
- Windows and Linux: "Choose Folder…" to resume a session whose folder no longer exists.
- Windows and Linux: error log, available from the settings button.

### Fixed
- macOS: the menu bar showed "LostAndPrompt" instead of "Lost & Prompt".
- Windows and Linux: thin scrollbars, card spacing, compact buttons in narrow panels, and no
  "$0.00" when a session has no cost yet.

---

- Windows y Linux: elige cualquier terminal (Warp, Windows Terminal, PowerShell 7, cmd, Git Bash,
  WezTerm, Alacritty, GNOME Terminal, Konsole, Kitty, Ghostty…) o un comando personalizado.
- macOS: WezTerm, Kitty, Alacritty y terminal personalizada; solo se listan las instaladas.
- macOS: actualizaciones automáticas con Sparkle (Lost & Prompt → Buscar actualizaciones…, y en Ajustes).
- Windows y Linux: botón de Ajustes con Acerca de, Buscar actualizaciones e Informar de un problema.
- Windows y Linux: una sola ventana de la app, que recuerda su tamaño y posición.
- Windows y Linux: actualizaciones automáticas; la app avisa de la versión nueva y la instala con un
  clic (instalador en Windows, AppImage en Linux).
- Windows y Linux: ícono en la bandeja con las sesiones recientes, atajo global (Ctrl+Alt+K) y
  abrir al iniciar sesión.
- Windows: sesiones de Claude Code dentro de WSL (distribuciones en marcha), reanudadas en WSL.
- Windows y Linux: «Elegir carpeta…» para reanudar una sesión cuya carpeta ya no existe.
- Windows y Linux: registro de errores, accesible desde el botón de Ajustes.
- macOS: la barra de menús mostraba «LostAndPrompt» en lugar de «Lost & Prompt».
- Windows y Linux: barras de desplazamiento finas, espacio entre grupos de tarjetas, botones
  compactos en paneles estrechos y sin «0,00 US$» cuando una sesión aún no tiene costo.

## [0.1.1] - 2026-10-31

### Added
- macOS: choose the theme (System, Light, Dark) and the language (System, Español, English) in
  Settings → Appearance.

### Removed
- A setting that had no effect ("Show cost in the list").

---

- macOS: elige el tema y el idioma en Ajustes → Apariencia.
- Se quitó un ajuste que no hacía nada.

## [0.1.0] - 2026-10-31

First public release for macOS: every Claude Code session from every folder in one window,
full-text search, resume in Warp/Terminal/iTerm2/Ghostty, favorites, collections, notes,
activity and history retention.

Primera versión pública para macOS.

[Unreleased]: https://github.com/axchisan/lost-and-prompt/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/axchisan/lost-and-prompt/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/axchisan/lost-and-prompt/releases/tag/v0.1.0
