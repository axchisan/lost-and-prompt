# Documentación — Lost & Prompt

> *Every Claude Code session you ever lost, found.*

App para **encontrar, organizar y reanudar** todas las sesiones de Claude Code de la máquina, sin
importar en qué directorio se abrieron. Nativa en SwiftUI en macOS; Tauri 2 + Rust en Windows y Linux.

## Índice

| # | Documento | Qué responde |
|---|---|---|
| 1 | [Visión](01-vision.md) | Qué problema resolvemos, para quién y qué **no** vamos a hacer |
| 2 | [Auditoría del original](02-auditoria.md) | Qué funciona y qué no en Claude Code History Viewer, panel por panel |
| 3 | [Requisitos](03-requisitos.md) | Funciones, priorizadas en MVP / v1 / después |
| 4 | [Datos](04-datos.md) | Cómo guarda Claude Code las sesiones y qué guardamos nosotros |
| 5 | [Arquitectura](05-arquitectura.md) | Stack, módulos, reanudar en Warp, rendimiento |
| 6 | [Diseño](06-diseno.md) | Principios visuales y las direcciones propuestas |
| 7 | [Hoja de ruta](07-hoja-de-ruta.md) | Fases: documentación → diseño → mockups → construcción → publicación |
| 8 | [Distribución](08-distribucion.md) | Versiones, publicación automática, actualizaciones y canales en las tres plataformas |
| 9 | [Pendientes](09-pendientes.md) | Qué falta: funciones, plataformas, canales y difusión |
| — | [Promoción](promocion.md) | Textos listos para Reddit, Hacker News, X, Product Hunt… |
| — | [QA](QA.md) | Lista de comprobación manual antes de cada versión |
| — | [Decisiones](decisiones.md) | Registro de decisiones tomadas (y pendientes) |

Las capturas de la app, con datos de ejemplo ficticios, están en [`screenshots/`](screenshots/) (`es` y `en`); se regeneran con `scripts/screenshots.sh`.

Para regenerar el proyecto de Xcode: `xcodegen generate` en la raíz. La app acepta `-LPScreen cards|quickopen|activity|empty|search|missing|settings` y `-LPDark YES|NO` para capturas.

## Estado

- [x] Investigación de alternativas en la comunidad
- [x] Prueba del candidato principal (Claude Code History Viewer 1.32.2)
- [x] Decisiones base: SwiftUI nativo, solo Claude Code
- [x] Auditoría del original con capturas
- [x] Dirección de diseño: A + lanzador B + vista de tarjetas C
- [x] Retención de Claude Code ajustada a 180 días
- [x] Nombre e ícono: Lost & Prompt, la caja
- [x] Mockups en SwiftUI y construcción de la app
- [x] Lectura real, búsqueda, reanudar, organización y traducción al inglés
- [x] Publicada la 0.1.0: [release](https://github.com/axchisan/lost-and-prompt/releases/tag/v0.1.0) y `brew install --cask axchisan/tap/lost-and-prompt`
- [x] Versiones para Windows y Linux (Tauri 2 + núcleo Rust compartido), probada en Windows
- [x] Publicación automática, actualizaciones firmadas (Sparkle y Tauri), Homebrew y Scoop — 0.2.2
- [x] Sitio web, README en español e inglés, guía de contribución y plantillas
- [ ] winget (en revisión) y AUR (registro cerrado)
- [ ] **0.3.0**: buscar en la conversación, Markdown completo, nueva sesión, abrir en el editor ← siguiente

Detalle en [Pendientes](09-pendientes.md).
