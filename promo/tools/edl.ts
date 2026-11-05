// Lista de decisiones de edición (EDL) del vídeo v3. Fuente única para:
//   - Blender (edit/build_blender.py): monta las tomas, la cámara como keyframes, música y sonidos.
//   - Remotion (src/v3): la capa transparente con cursor, rótulos y transiciones gráficas.
// Uso: node tools/edl.ts [es|en] [16x9] → edit/edl-<lang>-<formato>.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cursorAt, viewAt, type ClipData } from "../src/v3/camera.ts";

const lang = (process.argv[2] || "es") as "es" | "en";
const format = process.argv[3] || "16x9";
const SIZE: Record<string, [number, number]> = { "16x9": [1920, 1080], "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350] };
const [W, H] = SIZE[format];
const FPS = 60;
// Acercamiento mínimo en formatos de móvil: nunca más de esta fracción del alto de la app a la
// vez, para que el texto de la interfaz se lea en un teléfono (16:9 sin límite).
const MAX_H: Record<string, number | undefined> = { "9x16": 0.9, "4x5": 0.6, "1x1": 0.65 };
// 9:16 dinámico: usa las tomas cuadradas (la app completa). Cada escena empieza en «explicación»
// (la app entera en un bloque a todo el ancho, con el título encima sobre blanco) y pasa con un zoom
// continuo a «enfoque» (pantalla completa, la cámara en la acción).
const VERTICAL = format === "9x16";
const CLIP_FORMAT = VERTICAL ? "1x1" : format;
const D_TOP = 520; // px desde arriba donde empieza el bloque de la app en «explicación»
const D_MAX = 1.9, D_SHARE = 0.38, D_MOVE = 0.75; // duración de la explicación y del zoom (s)

// Compases de la pista en segundos de vídeo (tools/analyze_music.py). La música es continua
// salvo un salto: de 38,29 s de vídeo se pasa a 45,859 s de la pista (se quitan 4 compases de la pausa).
const MUSIC_JUMP = { at: 38.29, to: 45.859 };
const B = (m: number) => +(m - (MUSIC_JUMP.to - MUSIC_JUMP.at)).toFixed(3); // compás de la parte B → vídeo
const T = {
  logo: 8.707, reveal: 10.542, search: 12.399, resume: 19.783, conversation: 27.167, headline: 34.551, organize: 38.29,
  drop2: B(53.476), activity: B(57.168), exportmd: B(60.86), guide: B(64.551), dark: B(68.243), windows: B(70.078),
  free: B(71.935), outro: B(75.627), end: B(82.4),
};

// La toma de «reanudar» dura hasta poco después del clic; luego crece la terminal (capa gráfica).
const RESUME_APP = 2.85;

type Transition = { type: "cut" | "crossfade" | "push-left" | "flash" | "overlay"; frames: number };
type Scene = { name: string; clip: string; from: number; to: number; src: number; rate: number; zoom?: number; in: Transition };

const scenes: Scene[] = [
  { name: "biblioteca", clip: "reveal", from: T.reveal, to: T.search, src: 0.9, rate: 1, in: { type: "overlay", frames: 26 } },
  { name: "búsqueda", clip: "search", from: T.search, to: T.resume, src: 0.15, rate: 1, in: { type: "crossfade", frames: 12 } },
  { name: "reanudar", clip: "resume", from: T.resume, to: T.resume + RESUME_APP, src: 0.15, rate: 1, in: { type: "crossfade", frames: 12 } },
  { name: "conversación", clip: "conversation", from: T.conversation, to: T.headline, src: 0.45, rate: 1.25, in: { type: "overlay", frames: 18 } },
  { name: "organizar", clip: "organize", from: T.organize, to: T.drop2, src: 0.15, rate: 1, in: { type: "overlay", frames: 0 } },
  { name: "tarjetas", clip: "cards", from: T.drop2, to: T.activity, src: 0.2, rate: 1, in: { type: "flash", frames: 0 } },
  { name: "actividad", clip: "activity", from: T.activity, to: T.exportmd, src: 0.35, rate: 1.1, in: { type: "push-left", frames: 14 } },
  { name: "exportar", clip: "exportmd", from: T.exportmd, to: T.guide, src: 0.2, rate: 1, in: { type: "cut", frames: 0 } },
  { name: "guía", clip: "guide", from: T.guide, to: T.dark, src: 0.25, rate: 0.88, in: { type: "push-left", frames: 14 } },
  { name: "oscuro", clip: "dark", from: T.dark, to: T.windows, src: 0.45, rate: 1, in: { type: "cut", frames: 0 } },
  { name: "windows", clip: "windows", from: T.windows, to: T.free, src: 0.4, rate: 1, in: { type: "push-left", frames: 14 } },
];


const f = (s: number) => Math.round(s * FPS);
const out = {
  lang, format, width: W, height: H, fps: FPS, duration: T.end, frames: f(T.end), marks: T, music: { file: "music/track.mp3", jump: MUSIC_JUMP, fadeOut: [T.end - 3.2, T.end] },
  scenes: [] as unknown[],
  sfx: [] as { at: number; src: string; volume: number }[],
};

for (const [i, s] of scenes.entries()) {
  const data = JSON.parse(readFileSync(`public/clips/${lang}/${CLIP_FORMAT}/${s.clip}.json`, "utf8")) as ClipData & { scale: number };
  // Nunca ampliar por encima de 1×: el encuadre no puede tener menos alto que el cuadro de salida.
  const sourceAspect = data.width / data.height;
  // Alto del encuadre (unidades de la toma) por cada unidad de ancho: depende de las dos proporciones.
  const hRatio = (H / W) * sourceAspect;
  const minH = Math.max(H / (data.height * data.scale), (W / (data.width * data.scale)) * hRatio);
  const dEnd = s.from + Math.min(D_MAX, D_SHARE * (s.to - s.from));
  const dView = { x: 0, w: 1, h: hRatio, y: -D_TOP / W };
  // Margen para las transiciones que solapan con la escena anterior.
  const lead = s.in.frames;
  const first = f(s.from) - lead;
  const last = f(s.to) + (scenes[i + 1] && ["crossfade", "push-left"].includes(scenes[i + 1].in.type) ? 0 : 0);
  const camera: { f: number; scale: number; x: number; y: number; layout: number; cursor: { x: number; y: number } | null; click: number | null }[] = [];
  const srcAt = (frame: number) => s.src + ((frame - f(s.from)) / FPS) * s.rate;
  // Cursor en la toma, fotograma a fotograma, suavizado con una gaussiana (σ ≈ 1,6 fotogramas):
  // quita los tirones de la grabación sin mover los clics, que ocurren con el ratón quieto.
  const rawCursor = new Map<number, { x: number; y: number }>();
  for (let fr = first - 6; fr < last + 6; fr++) {
    const t = srcAt(fr);
    if (data.events.some((e) => (e.type === "move" || e.type === "path") && e.t <= t)) rawCursor.set(fr, cursorAt(data.events, t));
  }
  const smooth = (fr: number) => {
    let sx = 0, sy = 0, sw = 0;
    for (let k = -5; k <= 5; k++) {
      const p = rawCursor.get(fr + k);
      if (!p) continue;
      const w = Math.exp(-(k * k) / (2 * 1.6 * 1.6));
      sx += p.x * w; sy += p.y * w; sw += w;
    }
    return sw ? { x: sx / sw, y: sy / sw } : null;
  };
  for (let fr = first; fr < last; fr++) {
    const t = srcAt(fr);
    let v = viewAt(data.events, t, W / H, { zoom: s.zoom ?? 1, minH, maxH: MAX_H[format], sourceAspect });
    let layout = 1;
    if (VERTICAL) {
      const k = Math.min(1, Math.max(0, (fr / FPS - dEnd) / D_MOVE));
      layout = k * k * (3 - 2 * k);
      v = { x: dView.x + (v.x - dView.x) * layout, y: dView.y + (v.y - dView.y) * layout, w: dView.w + (v.w - dView.w) * layout, h: dView.h + (v.h - dView.h) * layout };
    }
    const c = rawCursor.has(fr) ? smooth(fr) : null;
    const lastClick = [...data.events].reverse().find((e) => e.type === "click" && e.t <= t);
    camera.push({
      f: fr,
      // Encuadre v (0–1 de la toma) → escala y centro para el editor (la toma «ajustada» al cuadro = 1).
      scale: +(1 / v.w).toFixed(5),
      layout: +layout.toFixed(3),
      x: +(v.x + v.w / 2).toFixed(5),
      y: +(v.y + v.h / 2).toFixed(5),
      cursor: c && { x: +((c.x - v.x) / v.w).toFixed(4), y: +((c.y - v.y) / v.h).toFixed(4) },
      click: lastClick && lastClick.type === "click" && t - lastClick.t < 0.6 ? +(t - lastClick.t).toFixed(3) : null,
    });
  }
  if (MAX_H[format]) {
    // La cámara sigue al cursor: se suaviza (σ ≈ 5 fotogramas) para que se deslice, no tiemble.
    const raw = camera.map((c) => ({ ...c }));
    for (let i = 0; i < camera.length; i++) {
      let sx = 0, sy = 0, ss = 0, sw = 0;
      for (let k = -15; k <= 15; k++) {
        const c = raw[i + k];
        if (!c) continue;
        const w = Math.exp(-(k * k) / (2 * 5 * 5));
        sx += c.x * w; sy += c.y * w; ss += c.scale * w; sw += w;
      }
      const nc = { x: sx / sw, y: sy / sw, scale: ss / sw };
      // El cursor se recoloca respecto a la cámara suavizada.
      const cur = raw[i].cursor;
      const ov = { w: 1 / raw[i].scale, h: hRatio / raw[i].scale };
      const nv = { w: 1 / nc.scale, h: hRatio / nc.scale };
      if (cur) {
        const sxp = raw[i].x - ov.w / 2 + cur.x * ov.w, syp = raw[i].y - ov.h / 2 + cur.y * ov.h;
        camera[i].cursor = { x: +((sxp - (nc.x - nv.w / 2)) / nv.w).toFixed(4), y: +((syp - (nc.y - nv.h / 2)) / nv.h).toFixed(4) };
      }
      camera[i].x = +nc.x.toFixed(5); camera[i].y = +nc.y.toFixed(5); camera[i].scale = +nc.scale.toFixed(5);
    }
  }
  // Sonidos de interfaz de esta escena, en su segundo del vídeo.
  for (const e of data.events) {
    const at = s.from + (e.t - s.src) / s.rate;
    if (at < s.from - lead / FPS || at >= s.to) continue;
    if (e.type === "click") out.sfx.push({ at, src: "click", volume: 0.5 });
    if (e.type === "key") out.sfx.push({ at, src: "key", volume: 0.18 });
    if (e.type === "shortcut") out.sfx.push({ at, src: "menu", volume: 0.3 });
    if (e.type === "mark" && e.label === "drop") out.sfx.push({ at, src: "drop", volume: 0.45 });
  }
  out.scenes.push({ ...s, first, last, srcIn: srcAt(first), srcOut: srcAt(last), clipFile: `clips/${lang}/${CLIP_FORMAT}/${s.clip}.mp4`, sourceSize: [data.width * data.scale, data.height * data.scale], camera });
}

// Sonidos de montaje.
const sfx = (at: number, src: string, volume: number) => out.sfx.push({ at, src, volume });
sfx(3.181 - 0.05, "whoosh", 0.3); sfx(5.039 - 0.05, "whoosh", 0.3); sfx(6.896 - 0.1, "whip", 0.35);
sfx(T.logo - 0.55, "rise", 0.22); sfx(T.logo, "hit", 0.65); sfx(T.logo + 0.05, "confirm", 0.25);
sfx(T.reveal - 0.08, "whoosh", 0.35);
sfx(T.resume + RESUME_APP + 0.02, "whoosh", 0.35); // la terminal crece desde el botón
sfx(T.conversation - 0.08, "whip", 0.35);
sfx(T.headline - 0.06, "whip", 0.35); sfx(T.organize - 0.1, "whoosh", 0.3);
sfx(T.drop2 - 0.55, "rise", 0.28); sfx(T.drop2, "hit", 0.7);
for (const at of [T.activity, T.guide, T.windows]) sfx(at - 0.05, "whip", 0.28);
sfx(T.free - 0.05, "whoosh", 0.35); sfx(T.free + 0.02, "hit", 0.4); sfx(T.outro, "confirm", 0.35);

mkdirSync("edit", { recursive: true });
const file = `edit/edl-${lang}-${format}.json`;
writeFileSync(file, JSON.stringify(out));
console.log(`${file}: ${out.scenes.length} escenas, ${out.sfx.length} sonidos, ${out.frames} fotogramas (${T.end.toFixed(1)} s)`);
