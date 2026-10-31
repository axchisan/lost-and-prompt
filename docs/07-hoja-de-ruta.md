# 7. Hoja de ruta

| Fase | Entregable | Estado |
|---|---|---|
| 0. Investigación | Comparativa de alternativas y prueba de History Viewer | ✅ |
| 1. Documentación | Esta carpeta `docs/` | ✅ (versión inicial) |
| 2. Dirección de diseño | 3 direcciones visuales → el usuario elige una | ✅ A + B + C |
| 3. Mockups detallados | Todas las pantallas y estados en la dirección elegida, en claro y oscuro: barra lateral, Recientes, Proyecto, detalle, conversación, ⌘K, Colecciones, Actividad, Ajustes, estados vacíos y de error, primer arranque | ⏳ ronda 1 lista |
| 4. Picos técnicos | (a) Reanudar en Warp con Launch Configuration · (b) indexar 1,5 GB con GRDB + FTS5 · (c) render de Markdown largo | Pendiente |
| 5. MVP | Requisitos marcados MVP en `03-requisitos.md` | Pendiente |
| 6. v1 pública | Colecciones, etiquetas, ⌘K, Actividad, Ajustes completos, firma, notarización, Homebrew y README en inglés y español | Pendiente |
| 6b. Preparar publicación | Datos de ejemplo ficticios ✅, capturas nuevas ✅, material con datos reales fuera del repositorio ✅, historial limpio y repositorio público | ⏳ |
| 8. Linux y Windows | Versiones para Linux y Windows con instaladores propios (decisión de tecnología pendiente: SwiftUI es solo de Apple) | Pendiente, después de pulir macOS |
| 7. Comunidad | Repositorio público, guía de contribución, traducciones | Pendiente |

## Herramienta de mockups

Figma está instalado. Opciones (a decidir en la fase 3):

- **Figma + MCP**: conectar el servidor MCP de Figma para que Claude cree y edite frames
  directamente. Es la mejor opción para iterar contigo y comentar sobre el diseño.
- **Mockups HTML/CSS de alta fidelidad**: rápidos, publicables como página para revisar desde
  cualquier dispositivo. Son los que se usan en la fase 2.
- **Prototipo SwiftUI con previews de Xcode**: lo más fiel al resultado final, ya que usa los
  componentes reales. Ideal para los detalles finos de la fase 3 y directamente reutilizable.

Recomendación: fase 2 en HTML, fase 3 en **SwiftUI previews** (reutilizables y 100 % fieles)
más Figma para lo que necesite discusión visual libre.
