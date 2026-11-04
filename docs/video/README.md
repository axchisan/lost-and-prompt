# Vídeo de lanzamiento: investigación, herramientas y decisiones

Noviembre de 2026. El proyecto y cómo regenerarlo están en [`promo/README.md`](../../promo/README.md).

## Qué se pidió

Un vídeo de presentación profesional, que enganche desde el primer segundo:

- La app usándose de verdad (clics, búsquedas, interacciones), no capturas fijas.
- La música elegida para que encaje, y los cortes, zooms y textos sincronizados con sus golpes y
  cambios de energía.
- Sonidos de clic y de transición.
- Vídeo a pantalla completa, textos integrados y fondos blancos, sin degradados ni desenfoques
  «de IA».
- Un formato por red y dispositivo.

La primera versión (pase de capturas sobre fondo oscuro) se descartó por estática.

## Herramientas evaluadas

| Herramienta | Para qué | Decisión |
|---|---|---|
| **Remotion** 4.0.540 | Edición de vídeo en código (React): línea de tiempo, audio, transiciones, render a MP4 | **Elegida** como editor. Repetible, versionable, y permite sincronizar todo con datos (golpes de la música, clics de la grabación). Licencia gratuita para personas. |
| Skills oficiales de Remotion (`remotion-dev/skills`) | Buenas prácticas para agentes: audio, sfx, transiciones, timing | Leídas desde GitHub (la instalación automática la bloqueó el sistema de permisos). El plugin para Claude Code (`claude plugin install remotion@remotion`) requiere reiniciar la sesión. |
| **Playwright** (`playwright-core` + Chrome) | Manejar la app y grabarla | **Elegida**. Chrome sin ventana: no toca el ratón ni el teclado del equipo. Captura por CDP (`Page.startScreencast`) a 60 fps y 2×. |
| **librosa** (Python) | Análisis musical: tempo, golpes, compases, energía, drops | **Elegida** (`promo/tools/analyze_music.py`). |
| **ffmpeg** | Reconstruir las tomas a 60 fps exactos, normalizar el audio (EBU R128) | **Elegida**. |
| DaVinci Resolve | Editor profesional | Descartada: la versión gratuita no admite scripts externos, se descarga con registro y no aporta sincronía automática con los datos. Si se quiere retocar a mano, los MP4 finales y las tomas sueltas se pueden importar. |
| Screen Studio / grabación de pantalla | Zooms automáticos sobre grabaciones | Descartada: de pago y graba la pantalla real (requiere no tocar el equipo). Su efecto (cursor suave, zoom al clic) se reproduce en Remotion con los eventos registrados. |
| XCUITest + `screencapture` | Grabar la app nativa de Mac | Pendiente: toma el control del ratón. Se usó la interfaz de escritorio (misma app, en React) con aspecto de Mac. |
| Blender (MCP conectado) | Intro 3D del icono | Posible mejora: la caja abriéndose en 3D para la marca. |

## Música

| Fuente | Licencia | Descarga | Resultado |
|---|---|---|---|
| **Pixabay Music** | Pixabay Content License: gratis, también comercial, sin atribución | La web bloquea curl; Playwright captura la URL del MP3 al pulsar «play» y la CDN sí descarga | **Usada** |
| FreePD | Dominio público | Cerró | — |
| Incompetech | CC BY 4.0 (requiere crédito) | Lista en JavaScript | No usada |
| YouTube Audio Library, Uppbeat | Requieren cuenta | — | No usadas |

**Content ID**: varias pistas de Pixabay están registradas y pueden provocar reclamaciones en
YouTube. Elegida **«Technology Epic Inspire»** (sin Content ID): 129,2 BPM, compás de 1,857 s,
intro hasta 8,7 s, sección enérgica, pausa entre 38 y 52 s y drop principal en 53,5 s. Las demás
candidatas, con su análisis, están en `promo/music-candidates/`.

## Efectos de sonido

- Kenney (CC0), servido por [soundcn](https://github.com/kapishdima/soundcn) (MIT): clic, tecla,
  menú, interruptor, soltar, confirmación, golpe suave y subida.
- Biblioteca de Remotion (`remotion.media`): `mouse-click`, `whoosh` y `whip`.
- Freesound pide cuenta y mezcla licencias (algunas no comerciales): no usado.

## Formatos por red

| Red | Formato | Notas |
|---|---|---|
| YouTube, LinkedIn (vídeo nativo), X, web | 16:9 · 1920×1080 | |
| Instagram Reels, TikTok, YouTube Shorts, historias | 9:16 · 1080×1920 | Los textos van en la mitad inferior, fuera de las barras de la app de cada red |
| Feed de Instagram, LinkedIn y X | 4:5 · 1080×1350 | El que más pantalla ocupa en el móvil |
| Feed cuadrado | 1:1 · 1080×1080 | |

Todos a 60 fps, H.264 y AAC a 320 kbps, normalizados a −14 LUFS (lo que aplican YouTube,
Instagram y TikTok), sin subtítulos aparte porque el texto ya va en la imagen.

## Decisiones de diseño

- **La app es la protagonista**: la interfaz ocupa todo el cuadro. Las escenas con texto solo
  usan fondo blanco y tipografía del sistema, en negro con un acento azul (el de la marca).
- **Ritmo**: cada escena empieza en un compás. En el drop final cambia de función en cada compás.
  Algunas tomas se aceleran (1,2–1,9×) para caber en su compás.
- **Cámara**: zoom suave (0,7 s) a la zona de interés de cada toma. En vertical y cuadrado sigue
  al cursor. Pequeño empujón al empezar cada corte y destello blanco en los drops.
- **Sonido**: clic en cada clic, tecla en cada letra escrita, menú en cada atajo; golpes en los
  drops y aire (whoosh/whip) en las transiciones de texto.
