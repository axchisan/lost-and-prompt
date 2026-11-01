# 9. Pendientes

Estado al 2026-10-31, con la **0.4.0** publicada. Revisado contra el código, no solo contra los
documentos: lo que aparece aquí no está hecho, o está a medias.

## Funciones que faltan

Requisitos de [`03-requisitos.md`](03-requisitos.md) marcados como v1 que aún no están, ordenados por
lo que más se nota al usarla.

| ID | Qué falta | Mac | Win/Linux | Notas |
|---|---|---|---|---|
| O4 | Etiquetas de color por sesión, al estilo de Finder | No | No | Las colecciones ya tienen color |
| Q6 | Accesibilidad: etiquetas de VoiceOver/lectores de pantalla en todos los botones, contraste aumentado | A medias | A medias | Revisar con VoiceOver y con Narrador |

Hechos en la **0.3.0**: L4 (buscar en la conversación), L3 (Markdown completo), R7 (nueva sesión en
la carpeta) y R6 (abrir en el editor). Hechos en la **0.4.0**: E6 (filtros), O6 (archivar), S1 (duración) y L2 (razonamiento; solo ~14 % de los bloques guardan texto). O4 queda en espera: las colecciones ya tienen color y se solaparían.

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
| GitHub Releases, Homebrew | Listos y automáticos | Nada |
| Scoop | Listo | El Excavator del bucket depende del programador de GitHub, que no llegó a ejecutarse solo (la 0.3.0 hubo que lanzarla a mano). `release.yml` ya actualiza el manifiesto al publicar: falta ejecutar una vez `scripts/setup-scoop-key.sh` |
| winget | PR [#467137](https://github.com/microsoft/winget-pkgs/pull/467137) en revisión | Esperar al moderador; después, cada versión nueva con `komac update axchisan.LostAndPrompt --version X.Y.Z --urls … --submit` |
| AUR | Paquete listo en `packaging/aur/`, probado en CI | Registro de cuentas cerrado; cuando reabra, registrarse con `~/.ssh/aur.pub` y ejecutar `scripts/publish-aur.sh` |
| Flathub | Sin empezar | Manifiesto con permiso de lectura a `~/.claude`; revisión humana |
| Microsoft Store | Sin empezar | Gratis para cuentas individuales y firma el instalador |

## Difusión

| Pendiente | Detalle |
|---|---|
| Sitio web | `site/`, en Vercel (proyecto `lost-and-prompt`, conectado al repo): <https://lostandprompt.axchisan.com/>. Se publica solo al hacer push si cambian `site/`, las capturas o el ícono (`vercel.json`) |
| Imagen para redes | Hecho: `site/og.png` (1200×630, centrada para el recorte cuadrado de WhatsApp), también como vista previa del repo en GitHub |
| Publicaciones | Borradores listos en [`promocion.md`](promocion.md) |
| Vídeo o GIF corto | 15–20 s: buscar algo, reanudar en la terminal. Es lo que más convierte en Reddit y X. Grabarlo con datos de ejemplo (`-LPMock YES`) |
| awesome-claude-code | Solo con su formulario de issue y desde el **2026-11-14** (14 días desde el primer commit) |
