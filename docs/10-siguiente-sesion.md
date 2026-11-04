# Siguiente sesión: ayuda de atajos, historial de versiones y vídeo promocional

Punto de partida para una sesión nueva de Claude Code abierta en la raíz del repo
(`~/Documents/Dev/Apps/LostAndPrompt`). Léelo junto con [`09-pendientes.md`](09-pendientes.md) y
[`decisiones.md`](decisiones.md).

## Estado al empezar (2026-11-04)

- Versión publicada: **0.6.0** (exportar conversaciones a Markdown, compartir en Mac, exportar e
  importar sesiones para continuarlas en Claude Code). Canales: Sparkle (Mac), `latest.json`
  (Windows/Linux), Homebrew, Scoop. winget sigue esperando moderación (PR #467137).
- Código: Mac en `LostAndPrompt/` (SwiftUI, XcodeGen `project.yml`); Windows y Linux en `desktop/`
  (Tauri 2 + React) con el núcleo en Rust en `core/`.
- Web: `site/index.html`, en Vercel (proyecto `lost-and-prompt`) → https://lostandprompt.axchisan.com.
- Publicar una versión: `scripts/bump-version.sh X.Y.Z`, pasar `[Unreleased]` del CHANGELOG a la
  versión (inglés + español, con enlaces de comparación), `cargo update --workspace`, commit,
  `git tag -a vX.Y.Z`, push de la etiqueta. `release.yml` hace el resto.
- Reglas del usuario: commits **sin** co-autor ni línea de sesión; versión probada = release + cask
  sin volver a preguntar; en pruebas, **no** reanudar la sesión actual de Claude Code ni simular
  teclas con System Events; textos en español (y su traducción al inglés).

## 1. Apartado «Atajos y comandos»

Una pantalla de ayuda con todo lo que se puede hacer y cómo.

- **Dónde:** decidir con el usuario si va en la app (Mac: ventana o hoja desde el menú Ayuda;
  Windows/Linux: entrada en el menú de ajustes de la barra lateral, junto a «Ayuda»), en la web
  (`site/`, sección o página `/atajos`) o en ambas. Recomendación: en la app **y** en la web, con
  la misma lista.
- **Contenido:** atajos de teclado por plataforma (⌘ en Mac, Ctrl en Windows/Linux), acciones de los
  menús y cómo se usan las funciones menos obvias: buscador rápido, filtros, colecciones con
  carpetas, arrastrar, archivar, buscar en la conversación, exportar/importar sesiones, reanudar en
  otra carpeta, retención de Claude Code.
- **Fuentes de verdad** (sacar los atajos de aquí, no de memoria):
  - Mac: `LostAndPrompt/App/LostAndPromptApp.swift` (`AppCommands`, `.keyboardShortcut`), menús en
    `Features/SessionDetail/SessionDetailView.swift`, `Features/SessionList/SessionListView.swift`,
    `Features/Library/SidebarView.swift`, atajo global en `Core/GlobalHotKey.swift`.
  - Windows/Linux: atajos en `desktop/src/App.tsx` (manejador de teclado), menús en
    `desktop/src/components/` (`Detail.tsx`, `Dialogs.tsx`, `Sidebar.tsx`), textos en `desktop/src/i18n.ts`.
- Mantener ES y EN: en Mac, `rm -rf build/loc && xcodebuild -exportLocalizations ...` y añadir las
  frases nuevas arriba del diccionario `EN` de `scripts/translate_en.py`; en Tauri, `i18n.ts`.

## 2. Apartado «Historial de versiones»

Ver el trayecto completo del proyecto: qué trajo cada versión, desde la 0.1.0.

- **Fuente:** `CHANGELOG.md` (cada versión trae inglés y español). Ya existe el código para
  separar idiomas y filtrar versiones:
  - Mac: `LostAndPrompt/Core/ReleaseNotes.swift` (`parse`, `inLanguage`).
  - Windows/Linux: `desktop/src/releaseNotes.ts` (`inLanguage`, `isNewer`).
  - CI: `.github/scripts/changelog_history.py` genera `history` (últimas 10) para `latest.json` y el appcast.
- **Opciones:** (a) en la app, una ventana «Novedades» que lea el CHANGELOG empaquetado o el
  historial publicado; (b) en la web, una página `/novedades` generada desde el CHANGELOG en el
  build de Vercel; (c) ambas. Para la app, empaquetar el CHANGELOG evita depender de la red; quitar
  el límite de 10 versiones si se reutiliza `changelog_history.py`.
- Reutilizar el estilo del aviso de actualización (`Update.tsx` en Tauri, `ReleaseNotes.text` en Mac).

## 3. Vídeo promocional para redes

- **Lo que ya hay:** `docs/screenshots/{es,en}/demo.mp4` y `.gif` (14 s, 1200×670, grabados con
  los datos de ejemplo `-LPMock YES`), usados en los README y en la web. Capturas con
  `scripts/screenshots.sh`. `ffmpeg` instalado en `/opt/homebrew/bin/ffmpeg`.
- **Herramienta a investigar al empezar:** Remotion (vídeo hecho con React y renderizado a MP4) tiene
  *agent skills* oficiales para Claude Code: plugin descrito en
  https://remotion.dev/docs/ai/claude-code-plugin, o `npx skills add remotion-dev/skills`.
  Comprobar en remotion.dev los nombres actuales de las skills y la licencia (Remotion es gratis para
  personas y equipos pequeños; confirmarlo). No está instalado todavía.
- **Plan propuesto:**
  1. Guion de 20–40 s: problema («¿dónde estaba esa sesión?») → buscar → reanudar → colecciones →
     exportar/compartir → llamada a la acción (web + `brew install`).
  2. Material: grabaciones reales de la app con datos de ejemplo (nunca sesiones reales del usuario).
  3. Montaje en Remotion: textos animados, zoom a las partes clave, el icono de la caja y la paleta de
     la web.
  4. Formatos: 16:9 (YouTube, LinkedIn, X) y 9:16 vertical (Reels, TikTok, Shorts), versiones ES y
     EN, subtítulos quemados porque muchas redes reproducen sin sonido.
  5. Guardar el proyecto del vídeo fuera de la app (p. ej. `promo/` con su propio `package.json`, o
     un repo aparte) para no meter dependencias de Node en el build.
- Textos para publicar: ampliar [`promocion.md`](promocion.md). LinkedIn lo maneja Claude con el
  navegador del usuario; Reddit está descartado.
