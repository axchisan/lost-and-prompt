# Siguiente sesión: probar lo nuevo de verdad, pulir y distribuir

Punto de partida para una sesión nueva de Claude Code abierta en la raíz del repo
(`~/Documents/Dev/Apps/LostAndPrompt`). Léelo junto con [`09-pendientes.md`](09-pendientes.md),
[`decisiones.md`](decisiones.md) y `CONTRIBUTING.md` (regla de escritura con salvaguardas, D17).

## Estado al empezar

- Versión publicada: **0.11.0** (cuentas 0.8.0, eliminar 0.9.0, reparar 0.10.0, mover 0.11.0).
- Código de lo nuevo:
  - núcleo: `core/src/accounts.rs`, `cleanup.rs`, `relocate.rs` (con pruebas en carpetas falsas);
  - Mac: `LostAndPrompt/Core/ClaudeAccounts.swift`, `SessionCleanup.swift`, `FolderRepair.swift`;
  - Tauri: comandos en `desktop/src-tauri/src/lib.rs`, diálogos en `desktop/src/components/Dialogs.tsx`.
- Copias de seguridad que deja la app: `~/Library/Application Support/LostAndPrompt/backups/`
  (`history-*.jsonl` al eliminar, `reparar-*/` al reparar o mover). En Tauri, `<datos>/backups`.
- Reglas del usuario: commits sin coautor ni línea de sesión; versión probada = release + cask sin
  preguntar; en pruebas, nunca la sesión de Claude Code en curso ni teclas simuladas con System
  Events; textos en español e inglés; cada función nueva entra en la guía en el mismo commit.

## 1. Probar reparar y mover con carpetas reales (lo primero)

Solo se han probado con carpetas falsas. Plan seguro:

1. Crear una carpeta de prueba (`~/Documents/Dev/prueba-mover`), abrir ahí una sesión corta de
   Claude Code con alguna memoria (`#nota`) y aceptar la confianza de la carpeta. Cerrarla.
2. Desde la app, «Mover o renombrar…» a `~/Documents/Dev/Pruebas/prueba-mover`. Comprobar:
   - `claude --resume` desde la carpeta nueva encuentra la sesión;
   - la memoria y la confianza siguen (no vuelve a preguntar);
   - la flecha ↑ muestra lo escrito;
   - la copia en `backups/reparar-*/`.
3. Moverla de vuelta en el Finder y usar «Reparar carpeta movida…» desde el aviso del detalle.
4. Con una sesión abierta en esa carpeta, comprobar que bloquea.
5. Repetirlo con una carpeta de Migozz (cuenta `~/.claude-migozz`) para ver que repara en las dos
   cuentas.

## 2. Pulir lo que quedó fuera del plan 11

Por orden de utilidad (detalle en `09-pendientes.md`):

1. **Eliminar varias a la vez**: selección múltiple en la lista (⌘/Mayús + clic) y «Eliminar…»
   con todas. `DeleteSheet` ya acepta varias sesiones.
2. **Sugerencias al reparar**: proponer la carpeta nueva por mismo nombre en las recientes, mismo
   `remote` de git (`.git/config`) o Spotlight (`mdfind`) en Mac.
3. **Limpiar copias viejas** de `backups/` (por ejemplo, conservar las de los últimos 30 días).
4. **QA.md**: añadir cuentas, eliminar, reparar y mover a la lista de comprobación.
5. Decidir qué hacer con `lastSessionId` de `.claude.json` al eliminar.

## 3. Distribución y difusión

- **winget**: mirar el PR #467137; si lo aprobaron, `komac update` con la 0.11.0.
- **Scoop**: `scripts/setup-scoop-key.sh` (una vez).
- **awesome-claude-code**: desde el **14 de noviembre**, con su formulario de issue.
- Actualizar `promocion.md` con las funciones nuevas (cuentas, eliminar, mover carpetas).

## Preguntas para el usuario al empezar

- ¿Selección múltiple para eliminar, o basta con «Vaciar archivadas»?
- ¿Cuántos días conservar las copias de `backups/` antes de limpiarlas?
- ¿Qué hacer con `promo/edit/lanzamiento.blend` (guardar o descartar)?
