# 9. Pendientes

Estado al 2026-10-31, con la **0.3.0** en preparación. Revisado contra el código, no solo contra los
documentos: lo que aparece aquí no está hecho, o está a medias.

## Funciones que faltan

Requisitos de [`03-requisitos.md`](03-requisitos.md) marcados como v1 que aún no están, ordenados por
lo que más se nota al usarla.

| ID | Qué falta | Mac | Win/Linux | Notas |
|---|---|---|---|---|
| E6 | Filtros: rango de fechas, rama git, solo favoritos | No | No | La rama ya se lee del JSONL |
| O6 | Archivar u ocultar sesiones sin borrarlas | No | No | Campo nuevo en la organización, compatible con el formato actual |
| O4 | Etiquetas de color por sesión, al estilo de Finder | No | No | Las colecciones ya tienen color |
| S1 | Duración de la sesión en el detalle | No | No | Primer y último mensaje ya están en el índice |
| L2 | Mostrar u ocultar razonamiento y mensajes del sistema | Herramientas sí | Herramientas sí | Falta el razonamiento (`thinking`) |
| Q6 | Accesibilidad: etiquetas de VoiceOver/lectores de pantalla en todos los botones, contraste aumentado | A medias | A medias | Revisar con VoiceOver y con Narrador |

Hechos en la **0.3.0**: L4 (buscar en la conversación), L3 (Markdown completo), R7 (nueva sesión en
la carpeta) y R6 (abrir en el editor). Propuesta para la **0.4.0**: E6, O6, O4, S1, L2 y Q6.

## Ideas para después

E9 sesiones en Spotlight · O7 reglas automáticas de colecciones · L5 exportar a Markdown · S3 mapa
de actividad al estilo de GitHub · P3 respaldo propio de las sesiones en una carpeta elegida ·
atajo global configurable desde Ajustes.

## Plataformas

| Pendiente | Detalle |
|---|---|
| **Probar en un Linux real** | La CI la compila e instala en Ubuntu y Arch, pero nadie la ha abierto en un escritorio. Lista en [`QA.md`](QA.md): bandeja (GNOME necesita la extensión AppIndicator), atajo global en Wayland, terminales detectadas |
| Builds arm64 | Windows on ARM y Linux aarch64. Los runners de GitHub ya los tienen (`windows-11-arm`, `ubuntu-24.04-arm`) |
| Nombre del paquete `.deb` | Sale como `lost-prompt` por el `&`; conviene `lost-and-prompt` (y lo mismo en el `.desktop`). Cuidado: cambiarlo rompe `apt upgrade` para quien ya lo instaló, hay que declarar `Replaces`/`Conflicts` |
| Ícono por capas en macOS 26 | Rehacerlo con Icon Composer para que se adapte a los modos claro, oscuro y tintado |
| Notarización y firma | Quitaría los avisos de Gatekeeper y SmartScreen. Requiere cuenta de Apple Developer (99 USD/año) y certificado de Windows (o la Microsoft Store, que firma gratis). Hoy se documenta cómo saltarse el aviso |

## Distribución

| Canal | Estado | Qué hace falta |
|---|---|---|
| GitHub Releases, Homebrew, Scoop | Listos y automáticos | Nada |
| winget | PR [#467137](https://github.com/microsoft/winget-pkgs/pull/467137) en revisión | Esperar al moderador; después, cada versión nueva con `komac update axchisan.LostAndPrompt --version X.Y.Z --urls … --submit` |
| AUR | Paquete listo en `packaging/aur/`, probado en CI | Registro de cuentas cerrado; cuando reabra, registrarse con `~/.ssh/aur.pub` y ejecutar `scripts/publish-aur.sh` |
| Flathub | Sin empezar | Manifiesto con permiso de lectura a `~/.claude`; revisión humana |
| Microsoft Store | Sin empezar | Gratis para cuentas individuales y firma el instalador |

## Difusión

| Pendiente | Detalle |
|---|---|
| Sitio web | `site/`, en Vercel (proyecto `lost-and-prompt`, conectado al repo): <https://lostandprompt.axchisan.com/>. Se publica solo al hacer push si cambian `site/`, las capturas o el ícono (`vercel.json`) |
| Imagen para redes | `site/og.png` (1280×640). **Subirla a mano** en GitHub → Settings → General → Social preview (GitHub no tiene API para esto) |
| Publicaciones | Borradores listos en [`promocion.md`](promocion.md) |
| Vídeo o GIF corto | 15–20 s: buscar algo, reanudar en la terminal. Es lo que más convierte en Reddit y X |
