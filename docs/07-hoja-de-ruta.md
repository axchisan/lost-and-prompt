# 7. Hoja de ruta

| Fase | Entregable | Estado |
|---|---|---|
| 0. Investigación | Comparativa de alternativas y prueba de History Viewer | ✅ |
| 1. Documentación | Esta carpeta `docs/` | ✅ (versión inicial) |
| 2. Dirección de diseño | 3 direcciones visuales → el usuario elige una | ✅ A + B + C |
| 3. Mockups detallados | Todas las pantallas y estados en la dirección elegida, en claro y oscuro: barra lateral, Recientes, Proyecto, detalle, conversación, ⌘K, Colecciones, Actividad, Ajustes, estados vacíos y de error, primer arranque | ⏳ ronda 1 lista |
| 4. Picos técnicos | (a) Reanudar en Warp con Launch Configuration · (b) indexar 1,5 GB con GRDB + FTS5 · (c) render de Markdown largo | Pendiente |
| 5. MVP | Requisitos marcados MVP en `03-requisitos.md` | ✅ |
| 6. v1 pública | Colecciones, etiquetas, ⌘K, Actividad, Ajustes completos, firma, notarización, Homebrew y README en inglés y español | Pendiente |
| 6b. Preparar publicación | Datos de ejemplo ficticios ✅, capturas nuevas ✅, material con datos reales fuera del repositorio ✅, historial limpio y repositorio público ✅ | ✅ 2026-10-31 |
| 8. Linux y Windows | Tauri 2 + Rust con instaladores propios | ⏳ en curso |
| 8a. Núcleo Rust (`core/`) | Lector, búsqueda FTS5, organización y retención; pruebas en macOS, Linux y Windows (CI); paridad 0 diferencias con Swift en 83 sesiones reales | ✅ |
| 8b. App Tauri (`desktop/`) | Ventana principal con el diseño A, íconos Lucide, lanzador, Actividad, Ajustes, diálogos; CI que compila .exe (NSIS) en Windows y .deb/.rpm/AppImage en Linux | ✅ probada en Windows; falta un Linux real |
| 8c. Integración por plataforma | Reanudar (Windows Terminal, PowerShell, WSL, terminales de Linux), bandeja, atajo global | ✅ 0.2.0 |
| 8d. Instaladores | .exe (NSIS), .deb/.rpm/AppImage en GitHub Actions; Homebrew y Scoop ✅, winget en revisión, AUR en espera, Flathub pendiente | ⏳ |
| 7. Comunidad | Repositorio público ✅, guía de contribución y plantillas ✅, sitio web ✅, difusión ([promocion.md](promocion.md)) | ⏳ |
| 9. Siguientes versiones | Ver [09-pendientes.md](09-pendientes.md) | Pendiente |

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
