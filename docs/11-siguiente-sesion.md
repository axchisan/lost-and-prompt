> **Terminado** (6–10 de noviembre de 2026). Las tres funciones están publicadas: varias cuentas
> (0.8.0), eliminar sesiones (0.9.0), reparar carpetas movidas (0.10.0) y mover o renombrar desde la
> app (0.11.0). Decisiones D17–D21 en [`decisiones.md`](decisiones.md). Lo que quedó fuera y lo
> siguiente está en [`12-siguiente-sesion.md`](12-siguiente-sesion.md).

# Siguiente sesión: eliminar sesiones, mover carpetas sin romperlas y varias cuentas de Claude Code

Punto de partida para una sesión nueva de Claude Code abierta en la raíz del repo
(`~/Documents/Dev/Apps/LostAndPrompt`). Léelo junto con [`04-datos.md`](04-datos.md),
[`05-arquitectura.md`](05-arquitectura.md), [`decisiones.md`](decisiones.md) y `CONTRIBUTING.md`.

Análisis hecho el 6 de noviembre de 2026 en la máquina del usuario (Claude Code 2.1.319, macOS 27).
Todo lo que sigue sale de mirar el código y las carpetas reales; lo que falta verificar está marcado
como **verificar**.

## Estado al empezar

- Versión publicada: **0.7.0** (guía «Aprende a usarla», historial de versiones, aviso de
  actualización arreglado en la 0.6.1).
- Vídeo de lanzamiento terminado (`promo/`, ver su README) y publicado como Reel en Instagram en
  español e inglés. Para los estados de WhatsApp: `promo/out/whatsapp/` (dos partes de menos de 60 s).
- Reglas del usuario de siempre:
  - commits **sin** co-autor ni línea de sesión;
  - versión probada = release + cask sin volver a preguntar;
  - en pruebas, **no** reanudar la sesión actual de Claude Code ni simular teclas con System Events;
  - textos en español (y su traducción al inglés);
  - cada función nueva entra en la guía (`docs/guia/guia.json`) en el mismo commit.

## Las tres funciones

1. **Eliminar sesiones**: de verdad, limpiando todo lo que Claude Code guarda de ellas.
2. **Mover o renombrar carpetas sin perder sus sesiones**: hoy, mover una carpeta en el Finder deja
   sus sesiones huérfanas. El usuario no se atreve a ordenar `~/Documents/Dev` por eso.
3. **Varias cuentas de Claude Code**: las sesiones de Migozz (cuenta del equipo) no aparecen.

Las tres tocan los archivos de Claude Code, algo que hasta ahora la app solo hacía con
`cleanupPeriodDays`. **Hay que cambiar la regla de CONTRIBUTING** («Nunca escribir en los archivos de
Claude Code…») por una regla con salvaguardas (sección «Reglas de seguridad») y apuntar la decisión
en `decisiones.md`.

---

## Cómo guarda Claude Code cada sesión (inventario real)

Carpeta de configuración: `$CLAUDE_CONFIG_DIR` o `~/.claude` (`%USERPROFILE%\.claude` en Windows).
Dentro, `<enc>` es la ruta de la carpeta de trabajo con todo lo que no sea letra o número cambiado por
`-` (`/Users/mac/Documents/Dev/Migozz` → `-Users-mac-Documents-Dev-Migozz`; igual que
`encode_project_dir` en `core/src/store.rs`).

| Qué | Dónde | Por sesión | Notas |
|---|---|---|---|
| Conversación | `projects/<enc>/<id>.jsonl` | sí | Cada línea lleva `cwd`, `sessionId`, `gitBranch`… |
| Subagentes y resultados de herramientas | `projects/<enc>/<id>/` (`subagents/*.jsonl`, `tool-results/…`) | sí | Puede pesar mucho (capturas de Playwright, etc.) |
| Copias de archivos editados (para rebobinar) | `file-history/<id>/` | sí | Ej.: 125 archivos en una sesión |
| Entorno de la sesión | `session-env/<id>/` | sí | |
| Tareas | `tasks/session-<prefijo>/` | sí (**verificar** la relación exacta con el id) | |
| Todos (versiones antiguas) | `todos/<id>-agent-*.json` | sí | En esta máquina la carpeta ya no existe |
| Depuración | `debug/<id>.txt` | sí, si se usó `--debug` | No existe en esta máquina |
| Historial de lo escrito (flecha ↑) | `history.jsonl`, una línea por mensaje con `sessionId` y `project` | líneas | 1.742 líneas de una sola sesión larga |
| Sesiones abiertas ahora | `sessions/<pid>.json` (`sessionId`, `cwd`, `pid`…) | mientras corre | **Sirve para saber si una sesión está en uso** |
| Memoria del proyecto | `projects/<enc>/memory/` (`MEMORY.md` y notas) | **por carpeta** | 33 carpetas con memoria en la cuenta personal |
| Ajustes por carpeta | `~/.claude.json` → `projects["/ruta/absoluta"]` (confianza, `allowedTools`, `mcpServers`, `lastSessionId`, métricas) | por carpeta | Con `CLAUDE_CONFIG_DIR`, es `<dir>/.claude.json` |
| Compartidos, sin id | `shell-snapshots/`, `paste-cache/`, `uploads/`, `cache/`, `state/` | no | No se tocan al borrar una sesión |

**Verificar** al empezar: qué borra exactamente la limpieza automática de Claude Code
(`cleanupPeriodDays`) y si `claude` 2.1.x ya trae algún comando para borrar o mover sesiones
(`claude --help` no muestra ninguno, pero puede estar en el selector de `/resume`). Lo ideal es
imitar lo que hace Claude Code.

---

## 1. Eliminar sesiones

### Qué quiere el usuario

Poder borrar sesiones y que quede todo limpio «a nivel Claude», bien ajustado.

### Propuesta

- **Dónde**: menú contextual, menú «Más» del detalle y menú Sesión (Mac). También con varias
  seleccionadas a la vez, y «Vaciar archivadas» en la vista «Archivadas».
- **Diálogo de confirmación** con lo que se va a quitar y cuánto ocupa:
  - la conversación (`.jsonl`) y su carpeta de subagentes;
  - las copias de archivos editados (`file-history`);
  - el entorno y las tareas;
  - sus líneas del historial de lo escrito (`history.jsonl`);
  - en Lost & Prompt: nombre propio, nota, favorito y colecciones.
- **A la papelera, no borrado definitivo**: macOS (`FileManager.trashItem`), Windows (papelera de
  reciclaje) y Linux (`gio trash` o la especificación freedesktop).
  - En Rust, el crate `trash`.
  - El usuario puede recuperar desde la papelera del sistema.
  - Además, «Deshacer» durante unos segundos en el aviso.
- **`history.jsonl`**: no se puede mandar a la papelera por líneas.
  - Se reescribe sin las líneas de esa sesión, de forma atómica (archivo temporal + `rename`).
  - Antes se guarda una copia en `~/Library/Application Support/LostAndPrompt/backups/` (o su
    equivalente).
- **`~/.claude.json`**:
  - Solo si `lastSessionId` apunta a la sesión borrada, se quita ese campo (o se deja; **decidir**).
  - Nunca se toca nada más de ese archivo, que guarda la cuenta y los ajustes.
- **Bloqueos**:
  - Si la sesión está abierta ahora mismo (aparece en `sessions/*.json` con un `pid` vivo), no se
    borra: aviso «Cierra la sesión en la terminal primero».
  - Las sesiones de WSL siguen las mismas reglas por la ruta `\\wsl.localhost\…`, o se dejan para
    después (**decidir**).
- **Opción «Borrar sin dejar rastro»** (la del usuario): igual, pero vaciando además esos elementos
  de la papelera. Puede ser simplemente una casilla en el diálogo, desmarcada por defecto.

### Dónde va el código

- **Núcleo** `core/src/` (nuevo módulo `cleanup.rs`):
  - `plan_delete(config_dir, ids) -> Plan`: lista de rutas, tamaños, líneas de `history.jsonl` y
    sesiones en uso;
  - `execute(plan, mode)`.
  - Pruebas con una carpeta de configuración falsa en `tempdir`.
- **Windows/Linux**: comando Tauri `delete_sessions` + diálogo en `Dialogs.tsx`.
- **Mac**: lo mismo en Swift (`Core/`), con paridad. Hoy Mac no usa el núcleo de Rust: revisar
  `ClaudeStore.swift` y el ejemplo de paridad (`cargo run --release -p lost-and-prompt-core --example parity`).

---

## 2. Mover o renombrar carpetas sin romper sus sesiones

### El problema

Las sesiones cuelgan de la ruta exacta de la carpeta:

- Su carpeta de proyecto es `projects/<enc>/`.
- Cada línea del `.jsonl` guarda el `cwd`.
- `history.jsonl` guarda `project`.
- `~/.claude.json` guarda los ajustes por ruta.
- La memoria del proyecto (`projects/<enc>/memory/`) también va por ruta.

Si se mueve o renombra la carpeta en el Finder:

- `claude --resume` desde la carpeta nueva **no encuentra** las sesiones, porque busca en
  `projects/<enc-nuevo>/`;
- se pierden la memoria del proyecto, la confianza y los servidores MCP de esa carpeta;
- en Lost & Prompt las sesiones salen con «La carpeta ya no existe».

Mover una carpeta **padre** (por ejemplo, reordenar `~/Documents/Dev`) afecta a todos los
proyectos que cuelgan de ella.

### Lo que ya existe

«Elegir carpeta…» / relocate (`desktop/src-tauri/src/lib.rs` → `relocate`, y
`organization.relocations` en Mac):

- copia el `.jsonl` de **una** sesión a `projects/<enc-nuevo>/`;
- apunta la nueva ruta en la organización de la app.

Es un parche por sesión. No mueve la carpeta de subagentes, ni la memoria, ni los ajustes, ni el resto.

### Propuesta: «Mover o renombrar carpeta…» y «Reparar carpetas movidas»

**A. Mover desde la app** (recomendado; menú contextual de una carpeta en la barra lateral):

1. Elegir el destino o el nombre nuevo.
2. **Vista previa** antes de tocar nada:
   - cuántas carpetas de proyecto y sesiones se ven afectadas (incluidas las subcarpetas);
   - qué cuentas de Claude Code (ver 3);
   - si hay memoria y ajustes;
   - si alguna sesión está abierta, lo que bloquea la operación.
3. Copia de seguridad de todo lo que se va a reescribir: `.jsonl`, `history.jsonl` y `.claude.json`.
4. Mover la carpeta real en el disco (`rename`, o copiar y borrar si cambia de volumen).
5. Para **cada** carpeta de proyecto cuyo `cwd` empiece por la ruta vieja, y en **cada** cuenta:
   - renombrar `projects/<enc-viejo>` → `projects/<enc-nuevo>`, fusionando si ya existe;
   - reescribir el `cwd` de las líneas de sus `.jsonl` (y de los subagentes) que empiecen por la
     ruta vieja, línea a línea y de forma atómica;
   - reescribir el campo `project` en `history.jsonl`;
   - mover la clave en `.claude.json` → `projects` (confianza, MCP, herramientas permitidas);
   - en Lost & Prompt: carpetas de colecciones, `relocations` y carpetas recientes.
6. Registro de la operación con opción de **deshacer** (todo al revés con la copia).

**B. Reparar lo que ya se movió a mano** (el caso «lo moví en el Finder»):

- Las sesiones con «La carpeta ya no existe» se agrupan por carpeta.
- La app sugiere dónde está ahora la carpeta. Candidatas:
  - mismo nombre de carpeta en las carpetas recientes;
  - mismo `remote` de git (`.git/config`);
  - mismo primer commit;
  - Spotlight (`mdfind`) en Mac.
- Con «Es esta» se aplica el paso 5 sin mover nada en el disco.

**C. Organizar `Dev` con calma**: una vista que lista las carpetas de proyecto con sus sesiones, su
tamaño y su última actividad, para planear la reorganización. Opcional; ver si cabe.

### Casos difíciles (probar todos)

- **Colisiones de nombre**: `a_b` y `a-b` dan el mismo `<enc>`. Al fusionar, comprobar el `cwd` real
  de las líneas, no solo el nombre de la carpeta.
- **Rutas muy largas**: **verificar** si Claude Code acorta `<enc>` con un hash a partir de cierta
  longitud. Hoy la más larga mide 80 caracteres.
- Mayúsculas y minúsculas (APFS no distingue por defecto), tildes, espacios y emojis en el nombre.
- Mover a otro disco; carpetas que son repositorios git o *worktrees*.
- Sesiones abiertas: bloquear. Claude Code reescribe el `.jsonl` mientras corre.
- Windows (`C:\…` → `C--…`) y WSL. Puede dejarse para una segunda fase en Windows.
- Varias cuentas (punto 3): mover también en `~/.claude-migozz`.

---

## 3. Varias cuentas de Claude Code (el caso Migozz)

### Qué pasa en esta máquina

En `~/.zshrc` hay una función `claude` que, dentro de `~/Documents/Dev/Migozz`, ejecuta Claude Code
con `CLAUDE_CONFIG_DIR="$HOME/.claude-migozz"` (cuenta del equipo, Claude Team). También le pasa un
token de GitHub sacado del llavero. Fuera de esa carpeta usa la cuenta personal (`~/.claude`).

| Cuenta | Carpeta | Sesiones de Migozz |
|---|---|---|
| Personal | `~/.claude/projects/-Users-mac-Documents-Dev-Migozz` | **2** (las que sí muestra la app; de octubre, con la cuenta personal) |
| Migozz (equipo) | `~/.claude-migozz/projects/-Users-mac-Documents-Dev-Migozz` | **25** (las que muestra Warp en `/resume`: «1 of 25») |

`~/.claude-migozz` tiene la misma estructura que `~/.claude`, con su propio `.claude.json`,
`settings.json`, `history.jsonl`, `file-history`, etc. Hay además carpetas de proyecto vacías para
`MigozzApp`, `migos-ms` y `migozz-functions`.

### Por qué no aparecen

- Windows/Linux: `core/src/paths.rs` respeta `CLAUDE_CONFIG_DIR`, pero solo **una** carpeta, y la
  app no se abre con esa variable.
- Mac: `ClaudeStore.projectsURL` está fijo en `~/.claude/projects`. Ni siquiera respeta
  `CLAUDE_CONFIG_DIR`.
- La base ya existe: `scan_many` en el núcleo y `roots.rs` en Tauri, que hoy se usa para WSL, leen
  varias carpetas `projects` a la vez.

### Propuesta: «Cuentas de Claude Code»

- **Detección automática** (Ajustes › Historial o una pestaña «Cuentas»):
  - `~/.claude` y `$CLAUDE_CONFIG_DIR` si la app lo hereda;
  - carpetas `~/.claude-*` con `projects/` dentro, como `~/.claude-migozz`;
  - valores de `CLAUDE_CONFIG_DIR=` que aparezcan en `~/.zshrc`, `~/.zprofile`, `~/.bashrc` y
    `~/.config/fish/config.fish`. Leer solo esa variable, nunca tokens.
  - Además, «Añadir carpeta…» a mano.
- **Cada cuenta** tiene nombre y color (Personal, Migozz), se puede activar o desactivar y tiene su
  propia retención (`cleanupPeriodDays` en **su** `settings.json`).
- **En la lista**:
  - distintivo de la cuenta, como el de WSL hoy;
  - filtro por cuenta;
  - las carpetas de la barra lateral fusionan las sesiones de todas las cuentas;
  - en el detalle se ve a qué cuenta pertenece cada sesión.
- **Reanudar con la cuenta correcta**: `claude --resume <id>` tiene que correr con el
  `CLAUDE_CONFIG_DIR` de la sesión, o no la encuentra.
  - Si la terminal abre un shell interactivo con `.zshrc` (Warp, Terminal, iTerm2), la función del
    usuario ya lo pone al hacer `cd` a Migozz.
  - Aun así, para no depender de eso, anteponer la variable: `CLAUDE_CONFIG_DIR=~/.claude-migozz claude --resume <id>`.
    Es compatible con la función del usuario, que la vuelve a fijar al mismo valor.
  - **Ojo**: el token de GitHub del MCP solo lo pone la función. Por eso hay que invocar `claude`
    desde un shell interactivo (como hoy) y no con `command claude`.
  - Lo mismo para «Copiar comando» y «Sesión nueva en esta carpeta». Una sesión nueva en Migozz
    debe abrirse con la cuenta de Migozz: la que corresponda a la carpeta, o preguntar.
- **Privacidad**: son sesiones de trabajo de la empresa. Todo sigue siendo local; solo se leen.
  - Opción para **ocultar** una cuenta, o excluirla del buscador rápido y de la bandeja.
  - Exportar a Markdown o «Exportar para continuar» de esas sesiones avisa de que son de otra cuenta.
- **Eliminar y mover** (1 y 2) trabajan en la cuenta de cada sesión y, al mover carpetas, en todas
  las cuentas.

### Dónde va el código

- **Núcleo**:
  - `paths.rs` pasa de una carpeta a una lista de cuentas: `Account { id, name, config_dir }`;
  - detección en un módulo nuevo `accounts.rs`, con pruebas;
  - `SessionSummary` gana `account`.
- **Tauri**: `roots.rs` construye las raíces con las cuentas y la distribución de WSL; `launcher.rs`
  antepone la variable.
- **Mac**: `ClaudeStore` lee varias carpetas, `TerminalLauncher` antepone la variable y la
  organización guarda las cuentas.
- **Guía**: entrada nueva «Varias cuentas de Claude Code» en `docs/guia/guia.json` (ES/EN), además de
  las de eliminar y mover.

---

## Reglas de seguridad (sustituyen a «nunca escribir en los archivos de Claude Code»)

1. Toda operación que toque archivos de Claude Code muestra antes una **vista previa** exacta y pide
   confirmación.
2. **Copia de seguridad** previa de cada archivo que se reescribe y **registro** de la operación con
   «Deshacer».
3. Reescrituras **atómicas**: archivo temporal en la misma carpeta + `rename`. Nunca dejar un `.jsonl`
   a medias.
4. **Nunca** con una sesión abierta (`sessions/*.json` con `pid` vivo) en las carpetas afectadas.
5. Borrar = papelera del sistema por defecto; el borrado definitivo es una opción explícita.
6. De `~/.claude.json` solo se tocan `projects[ruta]` y `lastSessionId`. Nada de la cuenta ni los tokens.
7. Pruebas del núcleo con carpetas de configuración falsas; nunca contra la carpeta real del usuario.
   En pruebas manuales, usar copias (`CLAUDE_CONFIG_DIR` apuntando a una copia) y **nunca** la
   sesión de Claude Code en curso.

## Orden propuesto

1. **Cuentas** (3): es lo que más se nota (25 sesiones invisibles), es solo lectura y prepara el
   terreno para las otras dos.
2. **Eliminar** (1): acotado y con papelera.
3. **Mover y reparar** (2): el más delicado. Primero «Reparar carpetas movidas» (B), que no mueve
   nada del disco; luego «Mover desde la app» (A).

Cada una: núcleo con pruebas → Windows/Linux → Mac → guía → CHANGELOG → versión (0.8.0, 0.9.0…).

## Preguntas para el usuario al empezar

- Al eliminar: ¿a la papelera por defecto y «sin dejar rastro» como opción, o al revés?
- ¿Borrar también sus líneas en `history.jsonl` (el historial de la flecha ↑ de Claude Code)?
- ¿Las sesiones de Migozz deben verse mezcladas con las personales o separadas por defecto?
  ¿Se pueden exportar o compartir?
- Al mover una carpeta, ¿la app mueve también la carpeta real en el disco, o el usuario prefiere
  moverla en el Finder y luego «reparar»?
- ¿Windows y WSL en la misma versión o en una segunda fase?
