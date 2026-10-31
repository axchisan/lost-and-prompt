# 1. Visión

## El problema

Claude Code guarda cada sesión ligada al directorio donde se abrió
(`~/.claude/projects/<ruta-codificada>/<id>.jsonl`). `/resume` solo muestra por defecto las del
directorio actual; `Ctrl+A` las muestra todas, pero en una lista de terminal sin organización.

Con uso intensivo esto se vuelve inmanejable. En la máquina del autor, en octubre de 2026:

- **80 sesiones** en **28 directorios**.
- Casi un tercio se abrieron en `~` (inicio), para temas que no tienen nada que ver con una
  carpeta: trámites, preguntas sueltas, configuración del Mac.
- Un mismo proyecto vive repartido en varios directorios (la carpeta padre y la del
  repositorio).
- Hay sesiones vacías (0 mensajes) que solo hacen ruido.
- **Se está perdiendo historial**: la sesión más antigua es del 2-oct-2026. Claude Code borra
  las sesiones de más de 30 días (`cleanupPeriodDays` no está configurado).

Recordar "¿en qué carpeta hablé de X?" no debería ser necesario.

## La propuesta

Una app de Mac que se sienta **hecha por Apple**: abres, escribes dos letras, ves la sesión,
pulsas ↩ y se reanuda en Warp en su directorio correcto.

Tres verbos, en este orden de importancia:

1. **Encontrar** — búsqueda instantánea por título, contenido, proyecto o fecha.
2. **Reanudar** — un clic (o ↩) abre la sesión en la terminal, en su `cwd`.
3. **Organizar** — favoritos, nombres propios, colecciones y etiquetas, independientes de la
   carpeta.

Y dos complementos discretos: **leer** la conversación antes de reanudar y **ver estadísticas**
(costo, tokens, tiempo) sin que dominen la interfaz.

## Para quién

1. **Primero, para el autor**: uso intensivo de Claude Code en muchos directorios, en español,
   en macOS, con Warp como terminal.
2. **Después, para la comunidad**: código abierto en GitHub, interfaz traducible (español e
   inglés desde el inicio), distribuible por Homebrew.

## Principios

- **Calma visual.** Menos es más: cada pantalla tiene un propósito. Nada de paneles de
  métricas compitiendo con la lista.
- **Nativo de verdad.** Componentes del sistema, SF Symbols, materiales translúcidos, modo
  oscuro y acento del sistema, atajos de teclado estándar.
- **Teclado primero.** Todo se puede hacer sin ratón.
- **Solo lectura sobre Claude Code.** Nunca modificamos los `.jsonl`; la organización propia
  vive en nuestra base de datos.
- **Privado.** Nada sale de la máquina. Sin telemetría.

## Fuera de alcance (por ahora)

- Otros asistentes (Codex, Cursor, Gemini…). La arquitectura deja la puerta abierta.
- Windows y Linux.
- Ejecutar Claude Code dentro de la app (para eso está la terminal).
- Sincronización entre equipos.
- Editar o borrar archivos de Claude Code (salvo, quizá más adelante, archivar sesiones
  explícitamente y con confirmación).
