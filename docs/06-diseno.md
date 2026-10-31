# 6. Diseño

## Principios visuales

1. **Parecer de Apple, no imitarla con CSS.** Componentes nativos de SwiftUI, sin bordes
   dibujados a mano. Las separaciones se hacen con espacio, materiales y tonos de fondo, no con
   líneas de 1 px.
2. **Una sola acción protagonista por pantalla.** En el detalle de una sesión es *Reanudar*.
3. **Jerarquía tipográfica clara** con SF Pro y los estilos del sistema (`largeTitle`,
   `headline`, `body`, `subheadline`, `caption`). Nada de mayúsculas espaciadas; monoespaciada
   solo para rutas y comandos.
4. **Color con significado.** El acento es el del sistema (el que elija el usuario en
   Ajustes). Los colores extra solo para etiquetas del usuario, como en Finder.
5. **Oscuro suave.** Fondos en grises del sistema (`windowBackgroundColor`, materiales), nunca
   negro puro; texto principal sin llegar al blanco puro. Cumple WCAG AA sin el contraste
   máximo que cansa.
6. **Progresión de detalle.** La fila muestra lo justo (título, proyecto, cuándo); el detalle
   muestra el resto.
7. **SF Symbols** para todos los iconos, con peso y escala coherentes.
8. **Español natural**: "hace 2 días", "Hoy", "Reanudar", "Colecciones".

## Direcciones propuestas (fase 2)

Las tres comparten principios y funciones; cambia la **forma de organizar la pantalla**.
Las capturas de la dirección elegida están en `screenshots/`.

### A · Clásica (como Mail o Notas)

Tres columnas: barra lateral translúcida (Recientes, Favoritos, Colecciones, Proyectos) → lista
de sesiones agrupada por día → detalle con la cabecera, el botón **Reanudar en Warp** y la vista
previa de la conversación.

- ✅ La más familiar y "oficial"; escala bien a cientos de sesiones; todo a un clic.
- ⚠️ Es la más convencional; ocupa una ventana grande.

### B · Lanzador (como Spotlight o Raycast)

Una ventana compacta centrada en un buscador grande. Escribes y aparecen las sesiones (no los
mensajes) con ↩ para reanudar; → abre una vista previa lateral. Acceso por atajo global y por
icono en la barra de menús. La organización (favoritos, colecciones) vive en filtros como chips
bajo el buscador.

- ✅ La más rápida en el uso diario: atajo, dos letras, ↩. Mínima.
- ⚠️ Menos cómoda para explorar, organizar en lote o leer conversaciones largas.

### C · Biblioteca (como Fotos o Música)

Barra lateral + área principal con **tarjetas** grandes: una sección por proyecto o colección,
con una línea de tiempo ("Hoy", "Esta semana"…). Tarjetas con título, primer mensaje, carpeta y
etiquetas de color. El detalle se abre en un panel o una hoja.

- ✅ La más visual y espaciosa; reconoces sesiones de un vistazo; organizar arrastrando es
  natural.
- ⚠️ Menos densidad: se ven menos sesiones a la vez.

### Recomendación

**A como base + la paleta ⌘K de B** (y, más adelante, el icono de barra de menús). Explorar y
organizar en la ventana principal; reanudar al instante desde cualquier sitio con el atajo.
