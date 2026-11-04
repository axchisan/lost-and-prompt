# Siguiente sesión: fallo del aviso en Windows, guía «Aprende a usarla», historial de versiones y vídeo

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

## 0. Primero: fallo del aviso de actualización en Windows

> **Hecho en la 0.6.1** (puntos 1–4): comprobación al mostrar/enfocar la ventana (si pasó más de 1 h)
> y cada 4 h, botón fijo «Versión x.y.z disponible» en la barra lateral, aviso automático una vez por
> versión sin tapar otros diálogos y cada comprobación en el registro. Falta el punto 5 (preguntar al
> amigo) y probarlo en Windows real con la 0.6.2.

Un amigo del usuario abrió la app en Windows y **no le salió el aviso** de la versión nueva.

**Causa probable (revisada en el código, sin reproducir aún):**

- `desktop/src/App.tsx` (efecto «Actualizaciones») solo comprueba **5 s después de arrancar** y luego
  **cada 24 h**.
- En Windows la app casi nunca se cierra. La X la esconde en la bandeja (`keep_in_tray` en
  `on_window_event`, `desktop/src-tauri/src/lib.rs`), y con «abrir al iniciar sesión» arranca oculta
  (`--hidden`). Abrirla desde el acceso directo solo vuelve a mostrar la ventana que ya existía
  (`tauri_plugin_single_instance` → `tray::show_main`), **sin comprobar nada**.
- Resultado: una versión publicada después de esa primera comprobación tarda hasta 24 h en
  avisarse, o más si el PC se suspende. Es el mismo problema que tuvo Sparkle en Mac (resuelto en la 0.4.1).
- Agravantes:
  - Si la comprobación automática falla (red, antivirus, proxy), se calla y no deja rastro en el
    registro: solo la manual muestra el error.
  - El aviso es un diálogo más (`setDialog({ kind: "update" })`): si se abre otro diálogo encima, el
    aviso desaparece y no vuelve hasta la siguiente comprobación.

**Arreglo propuesto:**

1. Comprobar también al mostrar o enfocar la ventana (evento `focus` de la ventana o un evento
   emitido desde `tray::show_main`), si la última comprobación fue hace más de ~1 h. Guardar la hora
   de la última comprobación.
2. Bajar el intervalo de 24 h a unas 4–6 h mientras la app sigue abierta.
3. Recordar la actualización encontrada aparte del diálogo (estado `pendingUpdate`) y mostrar un
   indicador fijo, por ejemplo «Actualización disponible» en la barra lateral o en el menú de ajustes,
   que vuelva a abrir el aviso si se cerró o se tapó.
4. Escribir en el registro (`log::info!`/`warn!`, vía un comando o `plugin-log`) el resultado de cada
   comprobación automática, también los fallos, para poder pedir el registro con «Abrir registros».
5. Preguntar al amigo qué versión tenía y cómo la instaló (instalador, Scoop o winget), por si es otra
   cosa. Las anteriores a la 0.3.0 tenían otros fallos del aviso.

**Cómo probarlo:**

- En el navegador con Tauri simulado (Vite en el puerto 1420, `window.__TAURI_INTERNALS__` con
  `plugin:updater|check`): que el aviso salga al enfocar la ventana y que el indicador persista.
- En Windows real: con la app en la bandeja, publicar una versión y volver a abrir la app desde el acceso directo.

## 1. Apartado «Aprende a usarla» (guía de funciones + atajos)

> **Hecho (sale en la 0.7.0)** junto con el punto 2: una ventana con pestañas Guía · Atajos ·
> Novedades. Fuente única `docs/guia/guia.json` (+ `CHANGELOG.md`), empaquetada en Mac
> (`project.yml`, `Features/Guide/GuideView.swift`), importada en Tauri (`components/Guide.tsx`) y
> convertida en `/aprende` y `/novedades` por `scripts/build_guide.py` en el build de Vercel.
> Se abre con ⌘? / F1, desde Ayuda o el engranaje y desde la bienvenida. Capturas de Mac:
> `-LPGuide guide|shortcuts|news`.

Una sección para que cualquiera sepa **cada cosa** que hace la app y cómo se usa, con los atajos y
comandos dentro. Sustituye la idea de una lista de atajos suelta.

**Regla permanente:** cada función nueva que se añada a la app entra también en esta guía (en ES y
EN, Mac y Windows/Linux) **en el mismo commit**, y la versión no se publica sin ella. Apuntar la
regla en `CONTRIBUTING.md` (ya hecho) y en `docs/QA.md` (ya hecho).

**Plantear bien antes de construir** (acordarlo con el usuario al empezar):

- **Dónde vive:**
  - En la app: Mac en el menú Ayuda («Aprende a usar Lost & Prompt», ⌘?) y en la ventana de
    bienvenida; Windows/Linux en el menú de ajustes de la barra lateral (donde hoy está «Ayuda», que
    abre el repo) y en la bienvenida (`Welcome` en `desktop/src/components/Dialogs.tsx`).
  - En la web: página `/aprende`, generada desde la misma fuente.
- **Una sola fuente de contenido:** un archivo de datos (p. ej. `docs/guia/guia.json` o Markdown con
  secciones) que lean las dos apps y la web. Así añadir una función es tocar un solo sitio.
  - Mac: empaquetarlo como recurso.
  - Tauri: importarlo en el build.
  - Web: generarla en el build de Vercel.

  Cada entrada lleva: id, título, para qué sirve, pasos, atajo por plataforma, captura opcional
  (con datos de ejemplo, `-LPMock YES` / mock de Tauri) y versión en que llegó, para marcar «Nuevo».
- **Estructura propuesta por temas:**
  1. Empezar: qué es, dónde lee las sesiones, retención de Claude Code.
  2. Encontrar: búsqueda, buscador rápido (⌘K/Ctrl+K), filtros, buscar en la conversación.
  3. Reanudar: terminal, copiar comando, reanudar en otra carpeta, sesión nueva.
  4. Organizar: favoritos, colecciones, carpetas en colecciones, arrastrar, archivar, renombrar, notas.
  5. Compartir: Markdown, compartir en Mac, exportar e importar para continuar en Claude Code.
  6. Actividad y costes.
  7. Ajustes: terminal, editor, bandeja, atajo global, actualizaciones.
  8. Atajos: tabla completa por plataforma.
- **Interacción:** buscador dentro de la guía, enlaces «Probar ahora» que abren la función
  correspondiente, y marca «Nuevo en x.y» para lo reciente. Plantearlo con mockups antes (al usuario
  le gusta ver el diseño primero) y pasar la auditoría de accesibilidad (ver CONTRIBUTING).
- **Fuentes de verdad para el inventario inicial** (sacarlo del código, no de memoria):
  - Mac: `LostAndPrompt/App/LostAndPromptApp.swift` (`AppCommands`, `.keyboardShortcut`), menús en
    `Features/SessionDetail/SessionDetailView.swift`, `Features/SessionList/SessionListView.swift`,
    `Features/Library/SidebarView.swift`, atajo global en `Core/GlobalHotKey.swift`.
  - Windows/Linux: atajos en `desktop/src/App.tsx` (manejador de teclado), menús en
    `desktop/src/components/` (`Detail.tsx`, `Dialogs.tsx`, `Sidebar.tsx`), textos en `desktop/src/i18n.ts`.
  - El `CHANGELOG.md` completo, para no dejarse ninguna función.
- **Traducciones:**
  - Mac: `rm -rf build/loc && xcodebuild -exportLocalizations ...` y añadir las frases nuevas arriba
    del diccionario `EN` de `scripts/translate_en.py`.
  - Tauri: `i18n.ts`.
  - Si la guía es un archivo de datos, este trae los dos idiomas.

## 2. Apartado «Historial de versiones»

> **Hecho:** pestaña «Novedades» de la guía y página `/novedades` (ver punto 1).

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
- Puede ir dentro de la guía (pestaña «Novedades») o aparte.
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
