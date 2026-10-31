# Registro de decisiones

| # | Fecha | Decisión | Alternativas descartadas | Motivo |
|---|---|---|---|---|
| D1 | 2026-10-30 | Construir una app propia en lugar de adoptar una existente | Usar Claude Code History Viewer tal cual | Funcionalmente completo, pero la estética, el idioma y la organización no encajan (ver auditoría) |
| D2 | 2026-10-30 | **SwiftUI nativo**, solo macOS | Fork del original (Tauri + React, 611 archivos TS y 95 de Rust); app nueva en Tauri | Que se sienta como una app oficial de Apple; evitar heredar un código enorme |
| D3 | 2026-10-30 | Solo **Claude Code** en el alcance | Claude Code + Codex; multiasistente | Enfoque y simplicidad; la arquitectura deja la puerta abierta |
| D4 | 2026-10-30 | Funciones: encontrar, reanudar en Warp, organizar (favoritos, nombres, colecciones), leer la conversación y estadísticas discretas | — | Elegidas por el usuario |
| D5 | 2026-10-30 | Nunca modificar los `.jsonl` de Claude Code; la organización vive en nuestra base | Escribir `custom-title` en los archivos | Seguridad y compatibilidad con futuras versiones de Claude Code |
| D6 | 2026-10-30 | Español e inglés desde el inicio | Solo español | Utilidad para la comunidad |
| D7 | 2026-10-30 | Diseño **A · Clásica** como base; **B · Lanzador** como integración (⌘K y barra de menús); **C · Biblioteca** como vista alternativa conmutable dentro de la app | Una sola dirección | Elegido por el usuario tras revisar los mockups |
| D8 | 2026-10-30 | Mockups detallados como **previews de SwiftUI en Xcode**; Figma por MCP solo si hace falta (y se desconecta al terminar el proyecto) | Figma como herramienta principal; HTML | Fidelidad total y código reutilizable |
| D10 | 2026-10-30 | Nombre: **Lost & Prompt** (juego con «Lost & Found»). Lema: *Every Claude Code session you ever lost, found.* Bundle `com.axchisan.LostAndPrompt`, cask `lost-and-prompt` | Hilo, Bitácora, Retoma, Faro, Déjà Prompt, Tabula Resume, Pickup Lines | Elegido por el usuario; libre en GitHub y Homebrew |
| D11 | 2026-10-30 | Ícono: **la caja** de objetos perdidos con una tarjeta `>_` asomando, fondo azul (fuente en `docs/diseno/icono/icono-caja.svg`). Glifo de barra de menús: `shippingbox` | El ticket, la lupa | Elegido por el usuario |
| D12 | 2026-10-30 | Proyecto Xcode generado con **XcodeGen** (`project.yml`); idioma de desarrollo español | `.xcodeproj` a mano | Reproducible y limpio en Git |
| D13 | 2026-10-30 | Repositorio **privado** `axchisan/lost-and-prompt`. Antes de hacerlo público: datos de ejemplo ficticios, capturas nuevas y sacar del repositorio la auditoría y los bocetos con datos reales (guardados fuera, en una carpeta privada) | Público desde ya | Los datos de ejemplo y la auditoría contienen información personal |
| D14 | 2026-10-31 | Distribución **sin Apple Developer Program**: firma ad hoc, DMG en GitHub Releases y cask en un tap propio (`axchisan/homebrew-tap`) que quita la cuarentena al instalar. El README explica cómo abrirla la primera vez | Pagar 99 US$/año para firmar y notarizar | Decisión del usuario |
| D15 | 2026-10-31 | Linux y Windows con **Tauri 2 + núcleo en Rust** (un solo código; instaladores .msi/.exe, .deb/.rpm/AppImage). Misma estructura que en Mac con detalles de cada sistema (Fluent/Mica en Windows, estilo GNOME en Linux). Comparación en `docs/diseno/linux-windows.html` | Avalonia, Flutter, WinUI 3 + GTK4 nativas, Qt, Swift multiplataforma | Mayor fidelidad al diseño con un solo código; tecnología web conocida por el autor |
| D16 | 2026-10-31 | Íconos en Windows y Linux: **Lucide** (ISC), equivalentes uno a uno de los SF Symbols de Mac; nada de emojis. El ícono de la caja igual en las tres plataformas | Emojis; Fluent Icons / Adwaita por plataforma | La licencia de SF Symbols prohíbe usarlos fuera de Apple; Lucide tiene el mismo estilo |
| D9 | 2026-10-30 | `cleanupPeriodDays` = **180** (6 meses) en `~/.claude/settings.json` (respaldo en `settings.json.bak-2026-10-30`); la app debe permitir ajustarlo | Dejar 30 días por defecto | Se estaba perdiendo historial |

## Pendientes

| # | Pregunta | Opciones |
|---|---|---|
