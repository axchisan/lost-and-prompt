# 4. Datos

## Lo que lee la app (solo lectura)

### Ubicación

```
~/.claude/projects/
  -Users-mac-Documents-Dev/              ← ruta del cwd con "/" (y espacios, puntos…) cambiados por "-"
    8a11e2a3-3841-4963-a177-f90d876dbbf8.jsonl   ← una sesión
    8a11e2a3-…/tool-results/             ← adjuntos de herramientas (ignorar)
    memory/                              ← memoria del proyecto (ignorar)
```

**La ruta codificada no se puede decodificar de forma fiable** (`My Web` y `My-Web` dan lo
mismo). La ruta real se toma del campo `cwd` de los registros.

### Formato

JSON Lines: un objeto por línea. Tipos observados en las 20 sesiones más recientes (Claude Code
2.1.314):

| `type` | Uso para nosotros |
|---|---|
| `user` | Mensajes del usuario. Campos clave: `cwd`, `gitBranch`, `timestamp`, `sessionId`, `entrypoint` (`cli`…), `message.content`, `origin.kind` (`human`) |
| `assistant` | Respuestas. `message.content[]` con bloques `text`, `thinking` y `tool_use`; `message.model`; `message.usage` (tokens) |
| `ai-title` | **Título de la sesión** (`aiTitle`). Puede aparecer varias veces: vale el último |
| `cost-state` | Costo acumulado (`totalCostUSD`), duración y `modelUsage` por modelo |
| `system` | Eventos del sistema (hooks, etc.): ocultos por defecto |
| `attachment` | Adjuntos y contexto inyectado: ocultos |
| `last-prompt`, `mode`, `permission-mode`, `file-history-*`, `api-request*`, `bridge-session`, `queue-operation`, `tools-used`, `frame-link`… | Internos: ignorar, salvo `tools-used` para estadísticas |

Observaciones:

- El `cwd` **puede cambiar dentro de una sesión** (por ejemplo, si se hace `cd` a una
  subcarpeta). Para reanudar se usa el `cwd` del **primer** mensaje `user`, que es el que usa
  Claude Code para ubicar el archivo.
- Hay sesiones con 0 mensajes `user` (se abrió y se cerró): se ocultan por defecto.
- Los mensajes `user` que empiezan por `<system-reminder>`, `<command-…>` o que son
  resultados de herramientas (`tool_result`) **no** son del usuario humano.
- El formato es interno y cambia entre versiones: el lector debe ser **tolerante** (campos
  opcionales, tipos desconocidos ignorados) y tener pruebas con archivos reales anonimizados.
- Tamaños: entre 0,2 MB y más de 200 MB por sesión. **Nunca** cargar un archivo entero en
  memoria para listar: leer en streaming y cachear.

### Retención

Claude Code borra las sesiones de más de `cleanupPeriodDays` días (30 por defecto) de
`~/.claude/settings.json`. Si no está configurado, se pierde historial al cumplirse el plazo.

## Lo que guarda la app (nuestro)

Base de datos local en
`~/Library/Application Support/<App>/library.sqlite` (SwiftData o GRDB; ver arquitectura).

### Índice (reconstruible, caché)

| Entidad | Campos |
|---|---|
| `SessionIndex` | `id` (UUID de la sesión), `filePath`, `fileSize`, `fileMtime`, `cwd`, `gitBranch`, `aiTitle`, `firstPrompt` (recorte), `startedAt`, `lastActivityAt`, `userMessageCount`, `assistantMessageCount`, `costUSD`, `models[]`, `claudeVersion`, `isEmpty` |
| `MessageFTS` | Tabla FTS5: `sessionId`, `role`, `timestamp`, `text` (solo texto de usuario y asistente) |

Se reindexa un archivo solo si cambian `fileSize` o `fileMtime`. Si una sesión desaparece del
disco (por la limpieza de Claude Code), su índice se marca `missing` y se conserva la
organización del usuario.

### Organización (del usuario, nunca se borra sola)

| Entidad | Campos |
|---|---|
| `SessionMeta` | `sessionId`, `customTitle?`, `isFavorite`, `isArchived`, `note?`, `colorTag?` |
| `Collection` | `id`, `name`, `symbol` (SF Symbol), `color`, `order` |
| `CollectionItem` | `collectionId`, `sessionId`, `order` |
| `Tag` / `SessionTag` | Etiquetas libres (v1) |

Exportable a JSON para respaldo y migración.
