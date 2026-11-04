// Lista de decisiones de edición (EDL) del vídeo v3. Fuente única para:
//   - Blender (edit/build_blender.py): monta las tomas, la cámara como keyframes, música y sonidos.
//   - Remotion (src/v3): la capa transparente con cursor, rótulos y transiciones gráficas.
// Uso: node tools/edl.ts [es|en] [16x9] → edit/edl-<lang>-<formato>.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cursorAt, viewAt, type ClipData } from "../src/v2/camera.ts";

const lang = (process.argv[2] || "es") as "es" | "en";
const format = process.argv[3] || "16x9";
const SIZE: Record<string, [number, number]> = { "16x9": [1920, 1080], "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350] };
const [W, H] = SIZE[format];
const FPS = 60;
const SOURCE_H = 810 * 4; // píxeles reales de alto de la toma (grabada a 4×)

// Compases de la pista en segundos de vídeo (tools/analyze_music.py). La música es continua
// salvo un salto: de 38,29 s de vídeo se pasa a 45,859 s de la pista (se quitan 4 compases de la pausa).
const MUSIC_JUMP = { at: 38.29, to: 45.859 };
const B = (m: number) => +(m - (MUSIC_JUMP.to - MUSIC_JUMP.at)).toFixed(3); // compás de la parte B → vídeo
const T = {
  logo: 8.707, reveal: 10.542, search: 12.399, resume: 19.783, conversation: 27.167, headline: 34.551, organize: 38.29,
  drop2: B(53.476), activity: B(57.168), exportmd: B(60.86), guide: B(64.551), dark: B(68.243), windows: B(70.078),
  free: B(71.935), outro: B(75.627), end: B(82.4),
};

type Transition = { type: "cut" | "crossfade" | "push-left" | "flash" | "overlay"; frames: number };
type Scene = { name: string; clip: string; from: number; to: number; src: number; rate: number; zoom?: number; in: Transition };

const scenes: Scene[] = [
  { name: "biblioteca", clip: "reveal", from: T.reveal, to: T.search, src: 0.9, rate: 1, in: { type: "overlay", frames: 26 } },
  { name: "búsqueda", clip: "search", from: T.search, to: T.resume, src: 0.3, rate: 1, in: { type: "crossfade", frames: 12 } },
  { name: "reanudar", clip: "resume", from: T.resume, to: T.resume + 3.0, src: 0.3, rate: 1, in: { type: "crossfade", frames: 12 } },
  { name: "conversación", clip: "conversation", from: T.conversation, to: T.headline, src: 0.45, rate: 1.25, in: { type: "overlay", frames: 18 } },
  { name: "organizar", clip: "organize", from: T.organize, to: T.drop2, src: 0.2, rate: 1.15, in: { type: "overlay", frames: 0 } },
  { name: "tarjetas", clip: "cards", from: T.drop2, to: T.activity, src: 0.2, rate: 1.1, in: { type: "flash", frames: 0 } },
  { name: "actividad", clip: "activity", from: T.activity, to: T.exportmd, src: 0.35, rate: 1.2, in: { type: "push-left", frames: 14 } },
  { name: "exportar", clip: "exportmd", from: T.exportmd, to: T.guide, src: 0.2, rate: 1.15, in: { type: "cut", frames: 0 } },
  { name: "guía", clip: "guide", from: T.guide, to: T.dark, src: 0.25, rate: 0.95, in: { type: "push-left", frames: 14 } },
  { name: "oscuro", clip: "dark", from: T.dark, to: T.windows, src: 0.45, rate: 1, in: { type: "cut", frames: 0 } },
  { name: "windows", clip: "windows", from: T.windows, to: T.free, src: 0.6, rate: 1, in: { type: "push-left", frames: 14 } },
];

// Nunca ampliar por encima de 1×: el encuadre no puede tener menos alto que el cuadro de salida.
const minH = H / SOURCE_H;
const f = (s: number) => Math.round(s * FPS);
const out = {
  lang, format, width: W, height: H, fps: FPS, duration: T.end, frames: f(T.end), marks: T, music: { file: "music/track.mp3", jump: MUSIC_JUMP, fadeOut: [T.end - 3.2, T.end] },
  scenes: [] as unknown[],
  sfx: [] as { at: number; src: string; volume: number }[],
};

for (const [i, s] of scenes.entries()) {
  const data = JSON.parse(readFileSync(`public/clips/${lang}/${s.clip}.json`, "utf8")) as ClipData;
  // Margen para las transiciones que solapan con la escena anterior.
  const lead = s.in.frames;
  const first = f(s.from) - lead;
  const last = f(s.to) + (scenes[i + 1] && ["crossfade", "push-left"].includes(scenes[i + 1].in.type) ? 0 : 0);
  const camera: { f: number; scale: number; x: number; y: number; cursor: { x: number; y: number } | null; click: number | null }[] = [];
  const srcAt = (frame: number) => s.src + ((frame - f(s.from)) / FPS) * s.rate;
  for (let fr = first; fr < last; fr++) {
    const t = srcAt(fr);
    const v = viewAt(data.events, t, W / H, { zoom: s.zoom ?? 1, minH });
    const c = data.events.some((e) => e.type === "move" && e.t <= t) ? cursorAt(data.events, t) : null;
    const lastClick = [...data.events].reverse().find((e) => e.type === "click" && e.t <= t);
    camera.push({
      f: fr,
      // Encuadre v (0–1 de la toma) → escala y centro para el editor (la toma «ajustada» al cuadro = 1).
      scale: +(1 / v.h).toFixed(5),
      x: +(v.x + v.w / 2).toFixed(5),
      y: +(v.y + v.h / 2).toFixed(5),
      cursor: c && { x: +((c.x - v.x) / v.w).toFixed(4), y: +((c.y - v.y) / v.h).toFixed(4) },
      click: lastClick && lastClick.type === "click" && t - lastClick.t < 0.6 ? +(t - lastClick.t).toFixed(3) : null,
    });
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
  out.scenes.push({ ...s, first, last, srcIn: srcAt(first), srcOut: srcAt(last), clipFile: `clips/${lang}/${s.clip}.mp4`, sourceSize: [1440 * 4, 810 * 4], camera });
}

// Sonidos de montaje.
const sfx = (at: number, src: string, volume: number) => out.sfx.push({ at, src, volume });
sfx(3.181 - 0.05, "whoosh", 0.3); sfx(5.039 - 0.05, "whoosh", 0.3); sfx(6.896 - 0.1, "whip", 0.35);
sfx(T.logo - 0.55, "rise", 0.22); sfx(T.logo, "hit", 0.65); sfx(T.logo + 0.05, "confirm", 0.25);
sfx(T.reveal - 0.08, "whoosh", 0.35);
sfx(T.resume + 2.8 + 0.02, "whoosh", 0.35); // la terminal crece desde el botón
sfx(T.conversation - 0.08, "whip", 0.35);
sfx(T.headline - 0.06, "whip", 0.35); sfx(T.organize - 0.1, "whoosh", 0.3);
sfx(T.drop2 - 0.55, "rise", 0.28); sfx(T.drop2, "hit", 0.7);
for (const at of [T.activity, T.guide, T.windows]) sfx(at - 0.05, "whip", 0.28);
sfx(T.free - 0.05, "whoosh", 0.35); sfx(T.free + 0.02, "hit", 0.4); sfx(T.outro, "confirm", 0.35);

mkdirSync("edit", { recursive: true });
const file = `edit/edl-${lang}-${format}.json`;
writeFileSync(file, JSON.stringify(out));
console.log(`${file}: ${out.scenes.length} escenas, ${out.sfx.length} sonidos, ${out.frames} fotogramas (${T.end.toFixed(1)} s); zoom máx. ${(1 / minH).toFixed(2)}× sobre el cuadro completo`);
