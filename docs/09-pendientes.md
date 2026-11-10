# 9. Pendientes

Estado al 2026-11-10, con la **0.11.0** publicada. Revisado contra el código, no solo contra los
documentos: lo que aparece aquí no está hecho, o está a medias. Plan de la próxima sesión en
[`12-siguiente-sesion.md`](12-siguiente-sesion.md).

## Hecho desde la 0.4.0

| Versión | Qué |
|---|---|
| 0.5.0–0.6.1 | Accesibilidad (Q6), exportar a Markdown (L5), exportar e importar sesiones para continuarlas, arreglo del aviso de actualización en Windows |
| 0.7.0 | Guía «Aprende a usarla», pestañas «Atajos» y «Novedades», y la misma guía en la web (`/aprende`, `/novedades`) |
| 0.8.0 | Varias cuentas de Claude Code (`CLAUDE_CONFIG_DIR`): detección, selector «Cuenta», reanudar con su cuenta, retención por cuenta |
| 0.9.0 | Eliminar sesiones: todo lo que guarda Claude Code, a la papelera o sin dejar rastro, y «Vaciar archivadas» |
| 0.10.0 | Reparar carpeta movida: sesiones, memoria, ajustes de `.claude.json` e historial pasan a la ruta nueva |
| 0.11.0 | Mover o renombrar una carpeta desde la app (mueve en el disco y repara a la vez) |

Probado con datos reales: cuentas (Mac y Tauri en macOS) y eliminar, en los dos modos (18 sesiones
borradas por el usuario y revisadas una a una). Reparar y mover solo con carpetas falsas en las
pruebas: **falta probarlos con una carpeta de verdad**.

## Funciones que faltan

| Qué | Detalle |
|---|---|
| Eliminar varias a la vez | Hoy se borra de una en una o con «Vaciar archivadas». Falta selección múltiple en la lista |
| «Deshacer» tras eliminar | El plan lo proponía en el aviso; hoy la vuelta atrás es la papelera del sistema |
| WSL | Eliminar, reparar y mover no funcionan con sesiones de WSL: desde Windows no se sabe si están abiertas (D18) |
| `lastSessionId` en `.claude.json` | Al eliminar no se toca; queda apuntando a una sesión borrada. Inofensivo, pero sin decidir |
| Sugerencias al reparar | Proponer dónde está ahora la carpeta (mismo nombre en carpetas recientes, mismo `remote` de git, Spotlight) en lugar de elegirla a mano |
| Vista «Organizar Dev» | Carpetas de proyecto con sesiones, tamaño y última actividad, para planear una reorganización (punto C del plan 11) |
| Cuentas: detalles | Color por cuenta; ocultar una cuenta del buscador rápido y de la bandeja; preguntar con qué cuenta abrir una sesión nueva en una carpeta sin sesiones |
| Mac: token de GitHub de Migozz | Terminal, iTerm, Ghostty… abren `zsh -l` sin `.zshrc`, así que la función `claude` del usuario (que pone el token del MCP) solo corre en Warp. La cuenta sí va bien porque se antepone `CLAUDE_CONFIG_DIR` |
| O4 | Etiquetas de color por sesión, al estilo de Finder. En espera: se solapa con las colecciones |

## Ideas para después

E9 sesiones en Spotlight · O7 reglas automáticas de colecciones · S3 mapa de actividad al estilo de
GitHub · P3 respaldo propio de las sesiones en una carpeta elegida · atajo global configurable desde
Ajustes · limpiar copias viejas de `backups/` (las de `history.jsonl` y las de reparar).

## Plataformas

| Pendiente | Detalle |
|---|---|
| Probar en Windows las funciones nuevas | Cuentas, eliminar (papelera de reciclaje), reparar y mover compilan y pasan las pruebas en la CI, pero nadie las ha abierto en un Windows real |
| Probar en un Linux real | La CI la abre en Ubuntu (Xvfb) y en Windows 11 con sesiones de prueba. Falta lo que solo se ve en un escritorio: bandeja (GNOME necesita AppIndicator), atajo global en Wayland, terminales detectadas y la papelera (`gio trash`). Lista en [`QA.md`](QA.md) |
| Builds arm64 | Windows on ARM y Linux aarch64 (`windows-11-arm`, `ubuntu-24.04-arm`) |
| Nombre del paquete `.deb` | Sale como `lost-prompt` por el `&`; conviene `lost-and-prompt`. Cambiarlo rompe `apt upgrade`: declarar `Replaces`/`Conflicts` |
| Ícono por capas en macOS 26 | Rehacerlo con Icon Composer para los modos claro, oscuro y tintado |
| Notarización y firma | Requiere Apple Developer (99 USD/año) y certificado de Windows (o la Microsoft Store). Hoy se documenta cómo saltarse el aviso |

## Distribución

| Canal | Estado | Qué hace falta |
|---|---|---|
| GitHub Releases, Homebrew | Listos y automáticos | Nada |
| Scoop | Listo | Ejecutar una vez `scripts/setup-scoop-key.sh` para que `release.yml` actualice el manifiesto solo |
| winget | PR [#467137](https://github.com/microsoft/winget-pkgs/pull/467137) (0.2.0) abierto desde el 31 de octubre | Esperar al moderador; después `komac update axchisan.LostAndPrompt --version 0.11.0 --urls … --submit` |
| AUR | Paquete listo en `packaging/aur/`, probado en CI | Registro de cuentas cerrado; cuando reabra, `scripts/publish-aur.sh` |
| Flathub | Sin empezar | Manifiesto con permiso de lectura y escritura a `~/.claude` (ahora la app borra y repara); revisión humana |
| Microsoft Store | Sin empezar | Gratis para cuentas individuales y firma el instalador |

## Difusión

| Pendiente | Detalle |
|---|---|
| awesome-claude-code | Solo con su formulario de issue y desde el **2026-11-14** (14 días desde el primer commit) |
| Publicaciones | Borradores en [`promocion.md`](promocion.md). Conviene actualizarlos con cuentas, eliminar y mover carpetas |
| Vídeo | Hecho el de lanzamiento (`promo/`). Uno corto de «mover una carpeta sin perder las sesiones» encaja bien |
| Sitio web | <https://lostandprompt.axchisan.com/>; la guía y las novedades se regeneran solas en cada push |

## Repositorio

- `promo/edit/lanzamiento.blend` lleva días modificado sin commit: decidir si se guarda o se descarta.
- [`QA.md`](QA.md) no recoge todavía cuentas, eliminar, reparar ni mover.
