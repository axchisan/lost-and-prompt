# 5. Arquitectura

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Lenguaje y UI | **Swift 6 + SwiftUI** (AppKit puntual donde haga falta) | Aspecto y comportamiento nativos: `NavigationSplitView`, barra lateral translúcida, toolbar unificada, `Settings` con ⌘, |
| Mínimo | macOS 15 Sequoia | APIs modernas de SwiftUI; cubre la gran mayoría de Macs activos |
| Persistencia | **GRDB.swift** (SQLite + FTS5) | Búsqueda de texto completo rápida y control fino. SwiftData no ofrece FTS |
| Markdown | `swift-markdown` + vista propia (o MarkdownUI) | Renderizar respuestas y código |
| Observación de archivos | FSEvents (`DispatchSource` / `FSEventStream`) | Actualización en vivo |
| Localización | String Catalogs (`.xcstrings`) | Español e inglés, extensible por la comunidad |
| Actualizaciones | Sparkle 2 | Estándar fuera de la Mac App Store |
| Distribución | DMG firmado y notarizado + cask de Homebrew | Instalación con `brew install --cask` |
| Entorno | Xcode 27.2 (instalado) | — |

Sin sandbox de la App Store en el MVP: la app necesita leer `~/.claude` y lanzar la
terminal. Se evalúa la App Store más adelante (exigiría acceso a la carpeta mediante bookmark
con permiso del usuario).

## Módulos

```
LostAndPrompt/
  App/                 ← punto de entrada, ventanas, comandos de menú, Ajustes
  Features/
    Library/           ← barra lateral, Recientes, Proyectos, Favoritos, Colecciones
    SessionList/       ← lista central, agrupación por fecha, búsqueda
    SessionDetail/     ← cabecera, acciones, vista previa de la conversación, estadísticas
    QuickOpen/         ← paleta ⌘K
    Activity/          ← estadísticas globales (v1)
  Core/
    ClaudeStore/       ← lectura tolerante de ~/.claude (paquete Swift independiente y probado)
    Index/             ← indexador incremental + FTS (GRDB)
    Organization/      ← favoritos, colecciones, etiquetas, notas
    Launcher/          ← reanudar en Warp / Terminal / iTerm2 / Ghostty
    Settings/          ← preferencias + lectura y escritura de cleanupPeriodDays
  Resources/           ← Localizable.xcstrings, Assets (icono, colores)
  Tests/               ← fixtures .jsonl anonimizados
```

`ClaudeStore` va como paquete SwiftPM aparte para poder probarlo sin la UI y, si se quiere,
reutilizarlo en una CLI.

## Flujo de datos

```
~/.claude/projects ──FSEvents──▶ Indexer (actor, segundo plano)
                                   │ parsea en streaming solo los archivos cambiados
                                   ▼
                              library.sqlite (índice + FTS + organización)
                                   │ ValueObservation (GRDB)
                                   ▼
                         ViewModels @Observable ──▶ Vistas SwiftUI
```

- Primer arranque: indexar todo en segundo plano y mostrar resultados según llegan.
- Arranques siguientes: la UI sale de inmediato desde SQLite y el indexador solo revisa
  `mtime` y tamaño.
- La conversación completa se carga bajo demanda y de forma perezosa (`LazyVStack`) al abrir
  el detalle.

## Reanudar en Warp

Validado el 2026-10-30 con Warp estable:

- `warp://action/new_tab?path=<cwd>` abre una pestaña en la carpeta, pero **no** ejecuta comandos.
- Las *launch configurations* (`~/.warp/launch_configurations/*.yaml`, `warp://launch/…`) son
  legado y no respondieron.
- ✅ **Tab Configs**: la app escribe `~/.warp/tab_configs/lost_and_prompt.toml` y abre
  `warp://tab_config/lost_and_prompt`. Warp abre una pestaña en `directory` y ejecuta `commands`:

```toml
name = "Lost & Prompt"
title = "<título de la sesión>"

[[panes]]
id = "main"
type = "terminal"
directory = "<cwd>"
commands = ["claude --resume <id> <args extra>"]
```

Efecto secundario: el archivo aparece en el menú «+» de Warp como «Lost & Prompt». Se reescribe en
cada reanudación (la última sesión reanudada).

Otras terminales: Terminal.app e iTerm2 abren un script `.command` temporal con
`open -a <app>`; Ghostty con `open -na Ghostty --args --working-directory=<cwd> -e <cmd>`.

Si `cwd` ya no existe: diálogo para elegir otra carpeta. Claude Code busca la sesión según el
`cwd`, así que puede ser necesario copiar el `.jsonl` a la carpeta codificada del nuevo `cwd`; se
pide confirmación antes de hacerlo.

## Rendimiento (objetivos)

- Arranque en frío con índice existente: menos de 500 ms hasta ver la lista.
- Indexación inicial de 100 sesiones (~1,5 GB): menos de 15 s, sin bloquear la UI.
- Búsqueda: resultados en menos de 50 ms por pulsación.
- Memoria en reposo: menos de 150 MB.

## Calidad

- Pruebas unitarias de `ClaudeStore` con fixtures reales anonimizados de varias versiones de
  Claude Code.
- Pruebas de interfaz de los flujos clave: buscar → reanudar, marcar favorito, crear colección.
- CI en GitHub Actions: compilar, probar y, en cada etiqueta, firmar, notarizar y publicar el
  release y actualizar el cask.

## Núcleo multiplataforma (Rust)

`core/` (crate `lost-and-prompt-core`, librería `lap_core`) reimplementa `LostAndPrompt/Core` para
Linux y Windows y debe comportarse igual:

| Módulo | Equivale a |
|---|---|
| `store.rs` | `ClaudeStore.swift`: `memchr`/`memmem` sobre archivos mapeados en memoria, en paralelo con `rayon`, caché por tamaño y fecha |
| `search.rs` | `SearchIndex.swift`: SQLite FTS5 (`rusqlite` con SQLite incluido) |
| `organization.rs` | `OrganizationStore.swift` |
| `settings.rs` | `ClaudeSettings.swift`: conserva el orden de las claves |
| `paths.rs` | Rutas por sistema; respeta `CLAUDE_CONFIG_DIR` |

Datos propios: `~/Library/Application Support/LostAndPrompt` (macOS), `%APPDATA%\LostAndPrompt`
(Windows), `~/.local/share/lost-and-prompt` (Linux).

Pruebas: `cargo test -p lost-and-prompt-core` (sesión ficticia con los casos difíciles del formato)
y `cargo run --release -p lost-and-prompt-core --example parity`, que compara con la caché de la app
de Swift. El 2026-10-31: 83 sesiones reales, 0 diferencias; escaneo de 1,17 GB en ~50 ms.
