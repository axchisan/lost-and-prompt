# Documentación — Lost & Prompt

> *Every Claude Code session you ever lost, found.*

App nativa de macOS (SwiftUI) para **encontrar, organizar y reanudar** todas las sesiones de
Claude Code de la máquina, sin importar en qué directorio se abrieron.

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
- [ ] **Instalador y publicación** ← siguiente paso
