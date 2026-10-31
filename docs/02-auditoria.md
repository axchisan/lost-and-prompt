# 2. Auditoría de Claude Code History Viewer

Versión auditada: **1.32.2** (jhlee0409/claude-code-history-viewer, MIT, Tauri + React).
Revisada con datos reales, a 1440×900, en modo claro. Las capturas no se publican porque muestran conversaciones privadas.

## Veredicto general

Funcionalmente es muy completo y la lectura de datos es sólida. El problema es de **jerarquía
y forma**: todo tiene el mismo peso visual, la interfaz expone su complejidad interna (31
proveedores, modos de facturación, IDs de herramientas) y la estética es la de un panel web
genérico, no la de una app de Mac.

Nos quedamos con **qué hace**; rehacemos **cómo se ve y cómo se organiza**.

## Panel por panel

### Inicio y explorador de proyectos

| ✅ Bien | ❌ Mal |
|---|---|
| Agrupa por directorio con conteo | 36 "proyectos" en una lista plana sin jerarquía real; `mac` (~) y `Documents` aparecen como proyectos más |
| Muestra la ruta abreviada | Ruta truncada con `…/` y nombres cortados (`Cont…`, `Spoti…`) en cuanto el panel se estrecha |
| Búsqueda de proyectos | Chips de proveedor (`Claude Code`, `Codex CLI 10`) en cada fila: ruido para quien usa uno solo |
| | Cabecera `EXPLORER` en mayúsculas con 3 iconos de agrupación sin etiqueta |
| | "Global Statistics" mezclado en la misma lista que los proyectos |
| | No hay vista "Recientes" entre todos los proyectos: hay que saber primero la carpeta |

### Lista de sesiones

| ✅ Bien | ❌ Mal |
|---|---|
| Usa el título generado por IA | Metadatos crípticos: `# 38`, `CLI`, icono de llave, triángulo rojo sin explicación |
| Renombrar con doble clic | Fechas en inglés (`Oct 22`, `2 days ago`) |
| Filtros por origen | Filtro `All / CLI / VS Code / Desktop` siempre visible aunque casi nunca se use |
| | Sesiones vacías o sin resumen ("Session summary not found.") se listan igual |
| | La selección es un bloque azul pesado con borde |

### Conversación

| ✅ Bien | ❌ Mal |
|---|---|
| Lectura completa con filtros por tipo | Al abrir una sesión lo primero que se ve es **un JSON crudo** de definición de herramientas: el peor primer impacto posible |
| Navegador de mensajes a la derecha | 7 botones de filtro (`User`, `Assistant`, `Text`, `Thinking`, `Tool Calls`, `Commands`) más `Content / Tool ID`, `Capture Mode`, `Export` encima del contenido |
| Exportar | El navegador muestra mensajes del sistema (`<system-reminder>`, `# Environment…`) como si fueran del usuario |
| | Cuatro columnas a la vez: explorador + sesiones + conversación + navegador |

### Reanudar

| ✅ Bien | ❌ Mal |
|---|---|
| Existe "Copy Resume Command" | **La acción más importante está escondida** en un menú desplegable junto a un ID (`8a11e2a3 ⌄`) en la barra de título |
| | Solo copia: no abre la terminal en el modo web, y en escritorio no deja elegir Warp claramente |

### Analítica y tokens

| ✅ Bien | ❌ Mal |
|---|---|
| Datos reales y útiles (costo, tiempo, herramientas) | Cuatro vistas distintas (`Analytics Dashboard`, `Token Statistics (Existing)`, `Recent Edits`, `Session Board`) para ideas parecidas |
| Heatmap de actividad | Tarjetas iguales con icono en cuadrado pastel + número gigante + etiqueta en mayúsculas: el patrón de dashboard genérico |
| | "Billing breakdown" con conceptos de facturación que el usuario no necesita |
| | El tablero de sesiones es una pared de texto en columnas |

### Búsqueda global (⌘K)

| ✅ Bien | ❌ Mal |
|---|---|
| **Rápida y útil**: una palabra encontró 63 resultados en el proyecto correcto, con resaltado | Resultados por mensaje, no por sesión: 63 filas para lo que es 1 sesión |
| Navegación con teclado | Etiquetas `user` / `assistant` en inglés y de colores |
| | Seleccionar un resultado no ofrece reanudar |

### Ajustes

| ✅ Bien | ❌ Mal |
|---|---|
| Tema del sistema, tamaño de letra, alto contraste | Es un menú desplegable, no una ventana de Ajustes de macOS (⌘,) |
| Idioma configurable | **No hay español** (en, ja, ko, zh-CN, zh-TW) |
| | Mezcla de gestores ("Settings Manager", "Archive Manager") con interruptores |

## Problemas transversales de estilo

1. **Bordes de 1 px gris en todo**: tarjetas, botones, entradas, paneles. Cada elemento está
   encajonado; nada respira.
2. **Tipografía sin jerarquía**: etiquetas en mayúsculas espaciadas (`EXPLORER`, `TOTAL
   TOKENS`), monoespaciada en metadatos, tres o cuatro tamaños parecidos.
3. **Color sin significado**: chips naranja, verde, azul y rojo compiten; el acento azul no
   coincide con el del sistema.
4. **No usa materiales de macOS**: sin barra lateral translúcida, sin barra de herramientas
   unificada; es una página web dentro de una ventana.
5. **Modo oscuro de negro puro con texto blanco**: contraste máximo que cansa la vista.
6. **Densidad uniforme**: la misma cantidad de información en cada fila, sin progresión
   (resumen → detalle).

## Qué conservamos del original

- La lectura de `~/.claude/projects` y el cálculo de costos y tokens (como referencia de
  lógica; lo reimplementamos en Swift).
- Usar el título de IA (`ai-title`) como nombre por defecto.
- Renombrar sesiones.
- Búsqueda de contenido con resaltado.
- Actualización en vivo al cambiar los archivos.
- Lectura de la conversación con filtros, pero ocultando por defecto el ruido técnico.
