# Vídeo de lanzamiento

Vídeo de presentación de Lost & Prompt: la app real en uso, montada al ritmo de la música, con
sonidos de interfaz y rótulos integrados. Vive fuera de las apps: sus dependencias no entran en
ningún build.

## Resultado

`out/launch-<idioma>-<formato>.mp4` (52 s, 60 fps, H.264 + AAC 320 kbps, −14 LUFS):

| Formato | Tamaño | Dónde |
|---|---|---|
| `16x9` | 1920×1080 | YouTube, LinkedIn, X, la web |
| `9x16` | 1080×1920 | Reels, TikTok, YouTube Shorts, historias |
| `1x1` | 1080×1080 | feed de Instagram, LinkedIn y X |
| `4x5` | 1080×1350 | feed de Instagram y LinkedIn (el que más pantalla ocupa en el móvil) |

## Flujo v3 (editor: Blender)

```sh
cd promo
(cd ../desktop && npx vite)                       # la app en :1420 con datos de ejemplo
node capture/record.mjs                           # tomas a 4× (5760×3240), --lang en para inglés
node tools/edl.ts es 16x9                         # EDL: escenas, cámara por fotograma, sonidos
python3 tools/prepare_media.py edit/edl-es-16x9.json   # recorta cada toma a su tramo y velocidad
npx remotion bundle src/index.tsx --out-dir out/bundle
npx remotion render out/bundle overlay-es-16x9 edit/media/overlay-es-16x9.mov \
  --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png
# En Blender (MCP o consola de Python), con edit/lanzamiento.blend abierto:
#   exec(open("…/promo/edit/build_blender.py").read())
/Applications/Blender.app/Contents/MacOS/Blender -b edit/lanzamiento.blend -a   # render
ffmpeg -i out/v3-es-16x9-raw.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 320k out/v3-es-16x9.mp4
node tools/audit.ts                               # comprobar ampliación y encuadres
```

- **EDL** (`tools/edl.ts` → `edit/edl-*.json`): fuente única de tiempos. Blender monta las tomas y
  la cámara (keyframes de escala y desplazamiento, editables) y Remotion dibuja la capa gráfica
  con el mismo reloj.
- **Blender** (`edit/build_blender.py`):
  - canales 2–12: tomas de la app;
  - canal 20: capa gráfica con alfa;
  - canales 21–22: música, unida en un compás;
  - canales 23 en adelante: efectos de sonido;
  - marcadores en cada escena.
- **Capa gráfica** (`src/v3/Overlay.tsx`):
  - cursor con pulsación y onda en cada clic, y rótulos en la esquina libre;
  - gancho inicial, marca, titulares y cierre;
  - transiciones: la marca que se abre hacia la app, la terminal que crece desde el botón
    «Reanudar», el titular que entra empujando y la cortina blanca.
- **Reglas**: ninguna ampliación por encima de 1× (la toma es 4×); velocidad ≤ 1,25×; mínimo
  2 compases por función con interacción.

## Cómo se hace

```sh
cd promo
npm install
(cd ../desktop && npx vite)          # la app en :1420, con datos de ejemplo inyectados
npm run record                       # graba las tomas (español); -- --lang en para inglés
npm run assets                       # copia icono y capturas a public/
cp sfx/*.wav public/sfx/             # efectos de sonido
npm run studio                       # editar viendo la línea de tiempo
npm run render                       # las 8 versiones en out/
```

1. **Grabación real** (`capture/record.mjs`): la interfaz de escritorio (React) corre en un Chrome
   sin ventana con datos ficticios (`capture/mock.js`, nunca sesiones reales). Cada toma es un guion
   de acciones —mover, clic, escribir, atajos, arrastrar—, se captura fotograma a fotograma a 2×
   (2880×1620) y se rehace a 60 fps exactos. El cursor del sistema se oculta.
2. **Registro de eventos**: cada toma deja un JSON con cuándo y dónde pasó cada cosa. Con él,
   Remotion dibuja un cursor animado con pulsación y onda al hacer clic, mueve la cámara a la zona
   de interés (`src/v2/camera.ts`) y pone un sonido en el fotograma exacto de cada clic y tecla.
3. **Cámara por formato**: el encuadre siempre tiene la proporción de salida; en vertical y
   cuadrado sigue al cursor, así que un solo guion sirve para los cuatro formatos.
4. **Música** (`tools/analyze_music.py`, con librosa): tempo, golpes, compases, energía y drops.
   El montaje une dos trozos de la pista en un compás y cada escena empieza en un compás
   (`src/v2/Launch.tsx`), con los drops en la aparición de la marca y en el clímax.
5. **Audio final**: `render.mjs` normaliza a −14 LUFS y −1,5 dB de pico (estándar de las redes).

## Guion (segundos)

| | Escena | Música |
|---|---|---|
| 0–8,7 | «Cada día abres Claude Code.» → «Decenas de proyectos.» → contador 1.284 sesiones → «¿Dónde quedó esa sesión?» | intro |
| 8,7 | Marca | **drop 1** |
| 10,5–23,5 | Biblioteca → búsqueda ⌘K → reanudar → terminal | sección A |
| 23,5–31,1 | Conversación y ⌘F → favoritos y colecciones | subida |
| 31,1–42,2 | Tarjetas · actividad · Markdown · guía · oscuro · Windows (un compás cada una) | **drop 2** |
| 42,2–52 | «Gratis. Y de código abierto.» → cierre con web, `brew install` y plataformas | final |

## Material y licencias

- **Remotion** 4.0.540: licencia gratuita (personas y equipos de hasta 3).
- **Música**: «Technology Epic Inspire», Pixabay (Pixabay Content License: uso libre, también
  comercial, sin atribución; sin Content ID). Alternativas descargadas en `music-candidates/`
  (con Content ID: pueden recibir reclamaciones en YouTube).
- **Efectos**: Kenney (CC0, `sfx/LICENSE-kenney.txt`) vía soundcn (MIT) y `whoosh`, `whip` y
  `click` de la biblioteca de Remotion (`remotion.media`).
- **Tipografía**: la del sistema (SF Pro en Mac).

Documentación de la investigación y las decisiones: [`docs/video/`](../docs/video/README.md).
