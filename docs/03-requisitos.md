# 3. Requisitos

Prioridades: **MVP** (primera versión usable a diario) · **v1** (primera versión pública) ·
**Después** (ideas sin compromiso).

## Encontrar

| ID | Requisito | Prioridad |
|---|---|---|
| E1 | Vista **Recientes** con todas las sesiones de todos los directorios, agrupadas por día (Hoy, Ayer, Esta semana, Este mes…) | MVP |
| E2 | Búsqueda instantánea por título, ruta y proyecto mientras se escribe | MVP |
| E3 | Búsqueda en el **contenido** de los mensajes, con resultados agrupados por sesión y fragmento resaltado | MVP |
| E4 | Vista por **proyecto**, con las carpetas reales en jerarquía (`Documents › Dev › Apps`) | MVP |
| E5 | Paleta rápida (⌘K) que busca y reanuda sin tocar el ratón | v1 |
| E10 | Alternar la lista entre **filas** (A) y **tarjetas** (C) | v1 |
| E6 | Filtros: rango de fechas, proyecto, rama git, con o sin favoritos | v1 |
| E7 | Ocultar sesiones vacías y de un solo mensaje sin respuesta (configurable) | MVP |
| E8 | Icono en la barra de menús con las últimas sesiones y búsqueda (dirección B) | v1 |
| E9 | Integración con Spotlight (las sesiones aparecen al buscar en macOS) | Después |

## Reanudar

| ID | Requisito | Prioridad |
|---|---|---|
| R1 | Botón principal **Reanudar** (y ↩) que abre la sesión en **Warp**, en el `cwd` original, con `claude --resume <id>` | MVP |
| R2 | Terminal configurable: Warp, Terminal.app, iTerm2, Ghostty | v1 |
| R3 | Copiar comando de reanudar (`cd '<cwd>' && claude --resume <id>`) | MVP |
| R4 | Argumentos extra configurables (por ejemplo, `--model`) | v1 |
| R5 | Avisar si el directorio original ya no existe y ofrecer elegir otro | MVP |
| R6 | Abrir la carpeta del proyecto en Finder o en el editor | v1 |
| R7 | Iniciar una sesión **nueva** en el directorio de una sesión o proyecto | v1 |

## Organizar

| ID | Requisito | Prioridad |
|---|---|---|
| O1 | **Favoritos** (⌘D) con sección propia en la barra lateral | MVP |
| O2 | **Renombrar** una sesión sin tocar los archivos de Claude Code | MVP |
| O3 | **Colecciones** creadas por el usuario (por ejemplo, "Cliente Acme" o "Trámites personales") que agrupan sesiones de cualquier directorio | v1 |
| O4 | **Etiquetas** de color (al estilo de Finder) | v1 |
| O5 | Notas cortas por sesión ("aquí quedó pendiente X") | v1 |
| O6 | Archivar u ocultar sesiones de la vista principal sin borrarlas | v1 |
| O7 | Reglas automáticas (por ejemplo, todo lo de `~/Developer/acme` va a la colección Cliente Acme) | Después |

## Leer

| ID | Requisito | Prioridad |
|---|---|---|
| L1 | Vista previa de la conversación: solo mensajes del usuario y respuestas de Claude, sin ruido técnico | MVP |
| L2 | Mostrar u ocultar herramientas, razonamiento y mensajes del sistema | v1 |
| L3 | Markdown y bloques de código renderizados | MVP |
| L4 | Buscar dentro de la conversación (⌘F) | v1 |
| L5 | Exportar a Markdown | Después |

## Estadísticas

| ID | Requisito | Prioridad |
|---|---|---|
| S1 | En el detalle de cada sesión: fecha de inicio y fin, duración, mensajes, costo estimado, modelo | MVP |
| S2 | Vista **Actividad** global: costo y uso por semana y mes, y proyectos más usados, en una sola pantalla tranquila | v1 |
| S3 | Mapa de actividad (al estilo de GitHub) | Después |

## Preservar el historial

| ID | Requisito | Prioridad |
|---|---|---|
| P1 | Detectar si `cleanupPeriodDays` no está configurado y avisar de que Claude Code borra las sesiones de más de 30 días | MVP |
| P2 | Ajustar `cleanupPeriodDays` desde Ajustes de la app (selector: 1, 3, 6, 12 meses o personalizado), con confirmación y respaldo del archivo | MVP |
| P3 | Respaldo opcional propio de las sesiones a una carpeta elegida | Después |

## Plataforma y calidad

| ID | Requisito | Prioridad |
|---|---|---|
| Q1 | macOS 15 o superior, Apple Silicon e Intel | MVP |
| Q2 | Español e inglés desde el inicio (String Catalogs); fechas y números según el sistema | MVP |
| Q3 | Modo claro y oscuro siguiendo al sistema, con un oscuro suave (gris, no negro) | MVP |
| Q4 | Actualización en vivo al cambiar `~/.claude/projects` | MVP |
| Q5 | Arranque en menos de 1 s con cientos de sesiones; indexación incremental en segundo plano | MVP |
| Q6 | Accesibilidad: VoiceOver, tamaño de texto dinámico, contraste aumentado | v1 |
| Q7 | Distribución: DMG firmado y notarizado, cask de Homebrew y actualizaciones con Sparkle | v1 |
