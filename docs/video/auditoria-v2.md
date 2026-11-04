# Auditoría del vídeo v2 y plan de la v3

4 de noviembre de 2026. Vídeo revisado: `promo/out/launch-es-16x9.mp4` (52 s, 60 fps) y sus
formatos 9:16, 1:1 y 4:5. Datos de `node tools/audit.ts` (en `promo/`).

## Lo que dijo el usuario

1. Desenfoque notorio y áreas importantes cortadas.
2. Transiciones toscas y poco fluidas, demasiado cortantes; quiere más variedad, bien usada.
3. Clips sin la duración necesaria para entenderlos.
4. Llevarlo a un editor de vídeo profesional (instalarlo y conectarlo primero).
5. No renderizar todas las versiones de golpe: revisar una y confirmar.

## Diagnóstico medido

### 1. Desenfoque: la grabación se amplía más de lo que aguanta

La toma está grabada a 2× (2880×1620). Si el encuadre pide más píxeles de los que hay, se
interpola y se ve borroso.

| Formato | Escenas ampliadas por encima de 1× | Peor caso |
|---|---|---|
| 16:9 | reanudar, conversación, organizar, exportar | **1,59×** (reanudar, organizar) |
| 9:16 | **todas** | 1,54× (tarjetas, oscuro, Windows) |
| 1:1 y 4:5 | reanudar, organizar, exportar y otras | 1,45× |

**Causa**: el zoom automático a la zona de interés y, en vertical, el recorte de una toma
apaisada. **Arreglo**: grabar a 4× (5760×3240) y limitar el zoom para que nunca pase de 1×.

### 2. Cortes de zonas importantes

| Formato | Zona de interés visible (mínimo) | Cursor fuera de cuadro |
|---|---|---|
| 16:9 | 70–87 % en biblioteca, organizar, tarjetas, exportar | exportar **46 %**, organizar 20 %, conversación 14 % |
| 9:16 | **20–62 %** en 7 de 11 escenas | exportar 46 % |
| 1:1 y 4:5 | 28–86 % | exportar 46 % |

**Causa**: la cámara encuadra una sola zona por escena. Si la acción ocurre en otra parte (el menú
«Más» está en la esquina superior derecha), queda fuera. En vertical, una toma apaisada no cabe.
**Arreglo**: zonas de interés por cada acción (no por escena), la cámara siempre con el cursor
dentro, y tomas propias para vertical (la app en una ventana estrecha y alta, que la interfaz
reorganiza sola), en vez de recortar las apaisadas.

### 3. Duraciones insuficientes

| Escena | Duración | Acciones | Velocidad |
|---|---|---|---|
| reanudar | 1,8 s | clic | 1,3× |
| tarjetas, oscuro, Windows | 1,8–1,9 s | cambio de vista | 1–1,2× |
| actividad, exportar | 1,8–1,9 s | 2 acciones | 1,4× |
| guía | 1,9 s | atajo + escritura + 2 clics | **1,9×** |

Regla nueva: **mínimo 2 compases (3,7 s) por función con interacción** y nunca más de 1,25× de
velocidad. Las escenas de un compás, solo para planos sin acción (un vistazo). Eso lleva el vídeo a
unos 70–80 s, que la pista (86 s) cubre casi entera sin cortes de música.

### 4. Transiciones

Ahora todo son cortes secos con un empujón de escala y dos destellos blancos. Falta variedad y
continuidad. Para la v3, cada tipo con un propósito:

| Transición | Cuándo |
|---|---|
| Corte en el golpe | Dentro del drop, entre planos muy distintos (da energía) |
| Fundido cruzado corto (8–12 fotogramas) | Entre escenas tranquilas de la misma pantalla |
| Zoom continuo («match cut») | De un elemento a la pantalla que abre (clic en «Reanudar» → la terminal crece desde el botón) |
| Deslizamiento con desenfoque de movimiento | Cambio de función en el mismo ritmo (izquierda → derecha) |
| Texto que tapa y destapa | Del titular sobre blanco a la app (el blanco del texto se abre como cortina) |
| Corte a blanco con golpe | Solo en los dos drops |

## Editores profesionales: investigación

| Editor | Coste | Control desde Claude Code | Qué queda manual | Veredicto |
|---|---|---|---|---|
| **DaVinci Resolve Studio** 21 | 236 US$ (pago único) | **API en vivo** (Python) y servidor MCP de la comunidad ([davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp), MIT): proyectos, importar medios, montar en pistas, marcadores, títulos Fusion, cola de render | Curvas de keyframes y transiciones (la API no las cubre con certeza): se hacen en la app o llegan ya hechas en el material | **El estándar profesional con control real** |
| DaVinci Resolve gratis 21 | 0 | Sin scripts externos: Blackmagic los limita a Studio y la 21.1 movió Python a Studio. Solo **importación de líneas de tiempo** (FCPXML, XML, EDL, AAF) | Abrir el archivo y renderizar a mano | **Muy profesional sin pagar**, con la línea de tiempo generada por mí |
| Final Cut Pro | 299,99 US$ o suscripción (prueba de 30 días) | Sin API; importa FCPXML | Igual que Resolve gratis | Bueno, pero de pago y sin ventaja sobre Resolve |
| Premiere / After Effects | Suscripción | Complementos UXP dentro de la app | Casi todo | Descartado |
| Kdenlive (MLT) | 0 | Archivos de proyecto y render por consola | Mucho; menos pulido en Mac | Descartado |
| Blender (editor de vídeo) | 0, **ya instalado y conectado** por MCP | **API en vivo completa**: pistas, keyframes de transformación, transiciones, textos, audio, render | Nada | Plan B totalmente automático; menos estándar como editor |

Notas del equipo: Mac con M5, 16 GB de RAM, 48 GB libres (Resolve ocupa ~3–5 GB). Resolve también
está en la Mac App Store (gratis, 2,5 GB), pero no hay confirmación de que esa versión admita scripts.

## Decisión: editor gratuito

El usuario descartó los de pago. Segunda investigación, solo gratuitos:

| Editor | Control desde Claude Code | Veredicto |
|---|---|---|
| **Blender 5.2 LTS, editor de vídeo** | **En vivo** por MCP (`localhost:9876`): pistas, keyframes de transformación con curvas, fundidos y barridos, textos, audio, marcadores, render FFmpeg; capturas de la ventana para comprobar | **Elegido** |
| Kdenlive 26.08 / Shotcut 26.9 (MLT) | Generar el XML del proyecto y renderizar con `melt` (Homebrew) | Alternativa: más transiciones prediseñadas, sin control en vivo |
| DaVinci Resolve gratis 21 | La 21.1 quitó Python de la versión gratis; solo importar FCPXML/XML | Descartado |
| OpenShot 4.1 | CLI experimental; sin versión nativa para Apple Silicon | Descartado |
| CapCut | Borradores no oficiales, render solo en la nube | Descartado |

**Conexión comprobada** (4 nov 2026): Blender 5.2.0 abierto con el puente en `127.0.0.1:9876`.
Prueba real en el editor de vídeo:

- toma de 2880×1620 a 60 fps y música;
- texto con caja, sombra y fuente;
- fundido `GAMMA_CROSS`;
- keyframes de `transform.scale_x/y` (también `offset_x/y`, `rotation`, `origin`);
- `blend_type`, `crop` y modificadores de color;
- marcadores.

Proyecto: `promo/edit/lanzamiento.blend` (plantilla «Editar vídeo»).

Reparto de trabajo:

- **Blender** monta y renderiza: tomas, cámara (keyframes), transiciones, música, efectos y marcadores.
- **Remotion** solo genera los gráficos (titulares, rótulos, terminal) como clips con
  transparencia, porque su tipografía animada es mejor que los textos del editor de Blender.
- Las transiciones que Blender no trae (deslizamientos, zoom continuo, cortina blanca) se hacen
  con keyframes de transformación y opacidad, que dan más control que un efecto prediseñado.

## Guion v3 (≈ 76 s, música casi entera)

Pista natural: intro hasta 8,7 s, sección A hasta 38,3 s, pausa 38,3–53,5 s, drop 53,5 s, final
hacia 84 s. Se quitan solo 4 compases de la pausa (38,3 → 45,9 s).

| Vídeo (s) | Compases | Escena | Transición de entrada |
|---|---|---|---|
| 0–8,7 | 4,7 | Gancho sobre blanco: «Cada día abres Claude Code» → proyectos → 1.284 sesiones → «¿Dónde quedó esa sesión?» | — |
| 8,7–12,4 | 2 | Marca y aparición de la app (el icono se abre y la cámara entra en la interfaz) | Corte a blanco con golpe (drop 1) |
| 12,4–19,8 | 4 | Búsqueda ⌘K: escribir, resultados, abrir | Cortina blanca que destapa la app |
| 19,8–27,2 | 4 | Reanudar: clic → la terminal crece desde el botón y retoma la sesión | Zoom continuo desde el botón |
| 27,2–34,6 | 4 | Leer la conversación y buscar dentro (⌘F) | Fundido corto |
| 34,6–38,3 | 2 | Titular «Y todo, a tu manera.» | Deslizamiento |
| 38,3–45,9 | 4 | Favoritos y arrastrar a una colección (pausa musical, ritmo tranquilo) | Fundido largo |
| 45,9–64,4 | 5 × 2 | Drop 2: tarjetas y filtros · actividad · Markdown · guía · oscuro y Windows | Golpe y blanco; luego cortes y deslizamientos alternos en cada golpe |
| 64,4–71,7 | 4 | «Gratis. De código abierto. Todo en tu equipo.» → cierre con web y `brew install` | Cortina blanca |
| 71,7–76 | — | Final y música apagándose | Fundido |

Reglas: ninguna toma por encima de 1,25× de velocidad; ninguna ampliación por encima de 1×
(grabación a 4×); el cursor y la zona de interés siempre dentro del encuadre; tomas propias para
el formato vertical.

## Flujo propuesto para la v3

1. **Material de alta calidad**: regrabar las tomas a 4× con zonas de interés por acción, más
   largas y sin acelerar; tomas propias para vertical.
2. **Gráficos en Remotion**: titulares, rótulos y la terminal se renderizan como clips con
   transparencia (ProRes 4444), para que el editor solo los coloque.
3. **Montaje en el editor**: línea de tiempo con pistas de vídeo, gráficos, música y efectos,
   marcadores en cada compás y transiciones variadas.
   - Con Resolve Studio la arma Claude en vivo.
   - Con Resolve gratis la genera Claude como archivo e importas con un clic.
4. **Revisión**: un solo render (español 16:9) → tú lo revisas → ajustes → cuando confirmes,
   las 8 versiones.
