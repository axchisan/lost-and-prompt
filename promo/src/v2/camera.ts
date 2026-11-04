// Cámara virtual sobre una toma grabada: decide qué parte de la toma se ve en cada instante.
// Las coordenadas son 0–1 sobre la toma (1440×810 CSS). El encuadre siempre tiene la proporción
// del formato de salida, así que el mismo guion sirve para 16:9, 9:16, 1:1 y 4:5.

export type ClipEvent =
  | { t: number; type: "move"; from: Pt; to: Pt; duration: number }
  | { t: number; type: "click"; at: Pt }
  | { t: number; type: "key"; key: string }
  | { t: number; type: "shortcut"; keys: string }
  | { t: number; type: "scroll"; dy: number; duration: number }
  | { t: number; type: "focus"; rect: Rect; label: string }
  | { t: number; type: "mark"; label: string };
export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type View = { x: number; y: number; w: number; h: number };
export type ClipData = { name: string; width: number; height: number; duration: number; events: ClipEvent[] };

const SOURCE = 1440 / 810;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Dónde estaba el cursor en el segundo `t` de la toma (misma curva que al grabar). */
export function cursorAt(events: ClipEvent[], t: number): Pt {
  let p: Pt = { x: 0.62, y: 0.55 };
  for (const e of events) {
    if (e.type !== "move" || e.t > t) continue;
    const k = clamp((t - e.t) / Math.max(0.001, e.duration), 0, 1);
    const q = ease(k);
    p = { x: e.from.x + (e.to.x - e.from.x) * q, y: e.from.y + (e.to.y - e.from.y) * q };
  }
  return p;
}

/** Encuadre que muestra `rect` con margen, con la proporción `aspect` (ancho/alto de salida). */
function frameFor(rect: Rect, aspect: number, minH: number): View {
  const ratio = aspect / SOURCE; // ancho del encuadre = alto × ratio (en unidades 0–1)
  const maxH = Math.min(1, 1 / ratio);
  let h = Math.max(rect.h * 1.18, (rect.w * 1.18) / ratio, minH);
  h = Math.min(h, maxH);
  const w = h * ratio;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  return { w, h, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h) };
}

/**
 * Encuadre en el segundo `t`: pasa suavemente de una zona de interés a la siguiente (0,7 s) y, en
 * formatos estrechos, sigue al cursor en horizontal para que la acción nunca quede fuera.
 */
export function viewAt(events: ClipEvent[], t: number, aspect: number, opts: { lead?: number; zoom?: number; minH?: number } = {}): View {
  const lead = opts.lead ?? 0.15;
  let zoom = opts.zoom ?? 1;
  const minH = Math.max(opts.minH ?? 0, aspect < 1 ? 0.62 : 0.42);
  const focuses = events.filter((e): e is Extract<ClipEvent, { type: "focus" }> => e.type === "focus");
  const full: Rect = { x: 0, y: 0, w: 1, h: 1 };
  let from = frameFor(full, aspect, minH);
  let to = from;
  let k = 1;
  for (const f of focuses) {
    const start = f.t - lead;
    if (t < start) break;
    from = lerpView(from, to, k);
    to = frameFor(f.rect, aspect, minH);
    k = ease(clamp((t - start) / 0.7, 0, 1));
  }
  let v = lerpView(from, to, k);
  if (zoom !== 1) {
    const h = Math.max(v.h / zoom, opts.minH ?? 0);
    zoom = v.h / h;
    const w = v.w / zoom;
    v = { w, h, x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2 };
  }
  if (v.w < 0.75) {
    // Formatos estrechos: el cursor manda en horizontal (con suavidad), sin salir de la toma.
    const c = cursorAt(events, t - 0.12);
    const cx = v.x + v.w / 2 + (c.x - (v.x + v.w / 2)) * 0.75;
    v = { ...v, x: clamp(cx - v.w / 2, 0, 1 - v.w) };
  }
  return v;
}

function lerpView(a: View, b: View, k: number): View {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k };
}
