# Vídeo de lanzamiento

Vídeo de presentación de Lost & Prompt: la app real en uso, montada al ritmo de la música, con
sonidos de interfaz y rótulos integrados. Vive fuera de las apps: sus dependencias no entran en
ningún build.

## Resultado

`out/final/lost-and-prompt-<idioma>-<formato>.mp4` (75 s, 60 fps, H.264 + AAC 320 kbps, −14 LUFS):

| Formato | Tamaño | Dónde |
|---|---|---|
| `16x9` | 1920×1080 | YouTube, LinkedIn, X, la web |
| `9x16` | 1080×1920 | Reels, TikTok, YouTube Shorts, historias |
| `1x1` | 1080×1080 | feed de Instagram, LinkedIn y X |
| `4x5` | 1080×1350 | feed de Instagram y LinkedIn (el que más pantalla ocupa en el móvil) |

## Cómo se hace (editor: Blender)

```sh
cd promo
npm install
(cd ../desktop && npx vite)                          # la app en :1420 con datos de ejemplo
node capture/record.mjs --lang es --format 9x16      # tomas reales de la app (ventana del formato)
tools/render_all.sh es-9x16 en-16x9 …                # EDL → tomas → capa gráfica → Blender → -14 LUFS
```

Resultado: `out/final/lost-and-prompt-<idioma>-<formato>.mp4`.

1. **Tomas** (`capture/record.mjs`): la interfaz real en un Chrome sin ventana, con datos
   ficticios (`capture/mock.js`). Cada formato se graba con la ventana en su proporción (la app se
   reorganiza sola):

   | Formato | Ventana | Escala de captura |
   |---|---|---|
   | 16:9 | 1440×810 | 4× |
   | 9:16 | 900×1600 | 3× |
   | 4:5 | 1080×1350 | 3× |
   | 1:1 | 1200×1200 | 3× |

   - El ratón se mueve como una mano: arco, frenada suave, pequeña corrección y deriva en reposo.
   - Cada punto del recorrido queda registrado con su hora, junto con los clics, las teclas y las
     zonas de interés (elementos de la interfaz).
   - Chrome sin ventana reserva 87 px de barra: la ventana se abre más alta para que el área útil
     sea exacta, y el grabador se detiene si no lo es.
2. **EDL** (`tools/edl.ts` → `edit/edl-<v>.json`): escenas en compases de la música, cámara por
   fotograma (nunca amplía por encima de 1×; en móvil, acercamiento mínimo que sigue al cursor),
   cursor suavizado y sonidos.
3. **Tomas recortadas** (`tools/prepare_media.py`): cada escena a su tramo y velocidad.
4. **Capa gráfica** (`src/v3/Overlay.tsx`, ProRes 4444 con alfa):
   - cursor con pulsación y onda en cada clic, y rótulos en la esquina libre;
   - gancho inicial, marca, titulares y cierre;
   - transiciones: la marca que se abre hacia la app, la terminal que crece desde el botón
     «Reanudar», el titular que entra empujando y la cortina blanca.
5. **Blender** (`edit/build_blender.py`): monta todo y renderiza. El montaje queda en
   `edit/lanzamiento-<v>.blend`, editable a mano:
   - tomas con la cámara como keyframes;
   - capa gráfica con alfa;
   - música unida en un compás;
   - efectos de sonido;
   - marcadores.
6. **Audio**: −14 LUFS y −1,5 dB de pico (estándar de las redes).

## Material y licencias

- **Remotion** 4.0.540: licencia gratuita (personas y equipos de hasta 3).
- **Música**: «Technology Epic Inspire», Pixabay (Pixabay Content License: uso libre, también
  comercial, sin atribución; sin Content ID). Va en `public/music/track.mp3` (no se guarda en git).
- **Efectos**: Kenney (CC0, `sfx/LICENSE-kenney.txt`) vía soundcn (MIT) y `whoosh`, `whip` y
  `click` de la biblioteca de Remotion (`remotion.media`).
- **Tipografía**: la del sistema (SF Pro en Mac).

Documentación de la investigación y las decisiones: [`docs/video/`](../docs/video/README.md).
