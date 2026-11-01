# Changelog

All notable changes to Lost & Prompt. Format based on [Keep a Changelog](https://keepachangelog.com),
versions follow [Semantic Versioning](https://semver.org).

Todos los cambios importantes de Lost & Prompt. Cada versión trae las notas en inglés y en español.

## [Unreleased]

### Changed
- Accessibility: every icon-only button and menu has a name for VoiceOver, Narrator and Orca;
  menus announce which options are on (filters, thinking, collections); the session list can be
  reached with Tab and announces the selected session; the Ctrl+F counter is read aloud.
- Higher contrast for secondary text in light and dark themes (at least 4.5:1 on Windows and Linux).
- The Mac app passes Xcode's accessibility audit and the Windows/Linux app passes axe-core, both
  checked automatically.

### Fixed
- Windows and Linux: the icon in the welcome and About windows showed a grey square around it (the
  system icon's built-in shadow). The website icon had the same problem.

### Cambiado
- Accesibilidad: todos los botones de solo icono y los menús tienen nombre para VoiceOver, Narrador
  y Orca; los menús dicen qué opciones están activas (filtros, razonamiento, colecciones); la lista
  de sesiones se alcanza con Tab y anuncia la sesión elegida; el contador de Ctrl+F se lee en voz alta.
- Más contraste en los textos secundarios, en tema claro y oscuro (al menos 4,5:1 en Windows y Linux).
- La app de Mac pasa la auditoría de accesibilidad de Xcode y la de Windows/Linux pasa axe-core,
  las dos comprobadas automáticamente.

### Corregido
- Windows y Linux: el icono de la bienvenida y de «Acerca de» tenía un cuadrado gris alrededor (la
  sombra incrustada del icono del sistema). Al icono de la web le pasaba lo mismo.

## [0.4.1] - 2026-10-31

### Fixed
- macOS: the update alert now really shows up. Sparkle found new versions but postponed the alert
  until it considered it a good moment, which in practice never came. The app now shows it right
  away, or as soon as you switch back to it. If you're on 0.3.0 or 0.4.0, use "Check for Updates…"
  once; from 0.4.1 on, new versions are offered when the app opens.

### Corregido
- macOS: el aviso de versión nueva por fin aparece. Sparkle encontraba la versión pero aplazaba el
  aviso hasta un momento que, en la práctica, no llegaba. Ahora la app lo muestra al momento, o en
  cuanto vuelves a ella. Si tienes la 0.3.0 o la 0.4.0, usa «Buscar actualizaciones…» una vez; desde
  la 0.4.1 las versiones nuevas se ofrecen al abrir la app.

## [0.4.0] - 2026-10-31

### Added
- Archive sessions (⌃⌘A on the Mac, Ctrl+Shift+A on Windows and Linux, or from the menus): they
  leave Recents, folders, collections and search, and stay under "Archived" in the sidebar.
- Filters in the session list: a date range, favorites only and git branch.
- Session duration in the details, from the first to the last message.
- "Show → Thinking" displays Claude's reasoning when the session saved it.

### Changed
- macOS: the app also checks for updates when it opens. Before, Sparkle checked at most once a day,
  so a new version could take up to 24 hours to show up.

### Añadido
- Archivar sesiones (⌃⌘A en Mac, Ctrl+Mayús+A en Windows y Linux, o desde los menús): salen de
  Recientes, carpetas, colecciones y búsquedas, y quedan en «Archivadas» en la barra lateral.
- Filtros en la lista de sesiones: periodo, solo favoritos y rama de git.
- Duración de la sesión en el detalle, del primer al último mensaje.
- «Mostrar → Razonamiento» enseña el razonamiento de Claude cuando la sesión lo guardó.

### Cambiado
- macOS: la app también busca actualizaciones al abrirse. Antes Sparkle miraba como mucho una vez
  al día y una versión nueva podía tardar hasta 24 horas en aparecer.

## [0.3.0] - 2026-10-31

### Added
- Find in conversation: ⌘F on the Mac, Ctrl+F on Windows and Linux. A match counter, next and
  previous (⌘G / ⇧⌘G, F3 / Shift+F3) and the current match highlighted and scrolled into view.
- Full Markdown in conversations: code blocks with a copy button, headings, nested lists, quotes,
  tables, links and rules.
- "New session in this folder" (⌘N / Ctrl+N) starts Claude Code in a session's folder, also from the
  context menu of sessions and of sidebar folders. Works with WSL folders.
- "Open in VS Code" (or Cursor, Windsurf, Zed, Sublime Text, Nova, Xcode, JetBrains IDEs), with the
  editor chosen in Settings. WSL folders open with the remote mode of VS Code, Cursor and Windsurf.

### Fixed
- macOS: some update settings were shown in Spanish when the app was in English.

### Añadido
- Buscar en la conversación: ⌘F en Mac, Ctrl+F en Windows y Linux. Con contador, siguiente y
  anterior (⌘G / ⇧⌘G, F3 / Mayús+F3) y la coincidencia actual resaltada y a la vista.
- Markdown completo en las conversaciones: bloques de código con botón de copiar, títulos, listas
  anidadas, citas, tablas, enlaces y separadores.
- «Nueva sesión en esta carpeta» (⌘N / Ctrl+N) abre Claude Code en la carpeta de una sesión, también
  desde el menú contextual de las sesiones y de las carpetas de la barra lateral. Funciona con WSL.
- «Abrir en VS Code» (o Cursor, Windsurf, Zed, Sublime Text, Nova, Xcode o los IDE de JetBrains),
  con el editor elegible en Ajustes. Las carpetas de WSL se abren con el modo remoto de VS Code,
  Cursor y Windsurf.

### Corregido
- macOS: algunos ajustes de actualizaciones salían en español con la app en inglés.

## [0.2.3] - 2026-10-31

### Fixed
- macOS: a session you were viewing stayed on "Reading the conversation…" when Claude Code wrote to
  it in the terminal, until you selected another session and came back. It now refreshes in place.
- Windows and Linux: the conversation no longer flashes a loading state each time the session
  changes; the previous content stays until the new one is read.

### Corregido
- macOS: la sesión que estabas viendo se quedaba en «Leyendo la conversación…» cuando Claude Code
  escribía en ella desde la terminal, hasta elegir otra y volver. Ahora se actualiza en el sitio.
- Windows y Linux: la conversación ya no parpadea con el aviso de carga cada vez que cambia la
  sesión; se ve la anterior hasta que se lee la nueva.

## [0.2.2] - 2026-10-31

### Fixed
- macOS: updating from 0.2.0 failed with "An error occurred while extracting the archive" because
  the 0.2.1 disk image couldn't be opened. Updates now download a zip, the release checks that every
  disk image mounts before publishing, and the update notes are formatted properly.

---

- macOS: actualizar desde la 0.2.0 fallaba con «Ocurrió un error al extraer el archivo» porque la
  imagen de disco de la 0.2.1 no se podía abrir. Las actualizaciones ahora descargan un zip, la
  publicación comprueba que cada imagen de disco se monte antes de subirla y las notas del aviso se
  ven con formato.

## [0.2.1] - 2026-10-31

### Fixed
- Windows and Linux: the window title bar now follows the theme chosen in Settings (it stayed light
  in dark mode).
- Windows: when installed with Scoop, the update notice tells you to run `scoop update` instead of
  installing a second copy.

### Added
- Install with Scoop: `scoop bucket add axchisan https://github.com/axchisan/scoop-bucket` and
  `scoop install axchisan/lost-and-prompt`.

---

- Windows y Linux: la barra de título de la ventana sigue el tema elegido en Ajustes (se quedaba
  clara en modo oscuro).
- Windows: si la instalaste con Scoop, el aviso de actualización indica `scoop update` en vez de
  instalar una segunda copia.
- Instalación con Scoop: `scoop bucket add axchisan https://github.com/axchisan/scoop-bucket` y
  `scoop install axchisan/lost-and-prompt`.

## [0.2.0] - 2026-10-31

First release for Windows and Linux, and automatic updates on all three platforms.

Primera versión para Windows y Linux, y actualizaciones automáticas en las tres plataformas.

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

[Unreleased]: https://github.com/axchisan/lost-and-prompt/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/axchisan/lost-and-prompt/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/axchisan/lost-and-prompt/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/axchisan/lost-and-prompt/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/axchisan/lost-and-prompt/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/axchisan/lost-and-prompt/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/axchisan/lost-and-prompt/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/axchisan/lost-and-prompt/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/axchisan/lost-and-prompt/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/axchisan/lost-and-prompt/releases/tag/v0.1.0
