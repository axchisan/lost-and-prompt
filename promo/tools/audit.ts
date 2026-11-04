// Auditoría objetiva del montaje: por escena y formato, cuánto se amplía la grabación (más de 1×
// pierde nitidez), qué parte de la zona de interés, el cursor y los clics queda fuera del encuadre
// y cuánto tiempo hay para leer cada acción. Uso: node tools/audit.ts
import { readFileSync } from "node:fs";
import { cursorAt, viewAt, type ClipData } from "../src/v2/camera.ts";

const SCALE = 2; // la grabación es 2× de 1440×810
const formats = { "16x9": [1920, 1080], "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350] } as const;
// Escenas de src/v2/Launch.tsx: [nombre, toma, desde, hasta, inicio en la toma, velocidad, zoom]
const scenes: [string, string, number, number, number, number, number][] = [
  ["biblioteca", "reveal", 10.542, 14.234, 0.7, 1.2, 1.12],
  ["búsqueda", "search", 14.234, 19.783, 0.4, 1, 1],
  ["reanudar", "resume", 19.783, 21.618, 0.9, 1.3, 1],
  ["conversación", "conversation", 23.475, 27.167, 1.9, 1.8, 1],
  ["organizar", "organize", 27.167, 31.092, 0.9, 1.25, 1],
  ["tarjetas", "cards", 31.092, 32.926, 0.3, 1.2, 1.3],
  ["actividad", "activity", 32.926, 34.784, 1.0, 1.4, 1],
  ["exportar", "exportmd", 34.784, 36.618, 1.0, 1.4, 1.25],
  ["guía", "guide", 36.618, 38.476, 0.4, 1.9, 1.2],
  ["oscuro", "dark", 38.476, 40.31, 0.3, 1, 1.3],
  ["windows", "windows", 40.31, 42.167, 0.3, 1, 1.3],
];

const inside = (p: { x: number; y: number }, v: { x: number; y: number; w: number; h: number }) => p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h;
const coverage = (r: { x: number; y: number; w: number; h: number }, v: { x: number; y: number; w: number; h: number }) => {
  const w = Math.max(0, Math.min(r.x + r.w, v.x + v.w) - Math.max(r.x, v.x));
  const h = Math.max(0, Math.min(r.y + r.h, v.y + v.h) - Math.max(r.y, v.y));
  return (w * h) / (r.w * r.h);
};

for (const [fmt, [W, H]] of Object.entries(formats)) {
  console.log(`\n=== ${fmt} (${W}×${H})`);
  console.log("escena          dur   ampliación máx  zona visible mín  cursor fuera  clics fuera  acciones");
  for (const [name, clip, from, to, start, rate, zoom] of scenes) {
    const data = JSON.parse(readFileSync(`public/clips/es/${clip}.json`, "utf8")) as ClipData;
    let maxUp = 0, minCov = 1, cursorOut = 0, samples = 0;
    const dur = to - from;
    for (let s = 0; s < dur; s += 1 / 30) {
      const t = start + s * rate;
      const v = viewAt(data.events, t, W / H, { zoom });
      const up = H / (v.h * 810 * SCALE);
      maxUp = Math.max(maxUp, up);
      const focus = [...data.events].reverse().find((e) => e.type === "focus" && e.t <= t + 0.15);
      if (focus && focus.type === "focus" && t - focus.t > 0.7) minCov = Math.min(minCov, coverage(focus.rect, v));
      if (data.events.some((e) => e.type === "move" && e.t <= t) && !inside(cursorAt(data.events, t), v)) cursorOut++;
      samples++;
    }
    const clicks = data.events.filter((e) => e.type === "click" && e.t >= start && e.t <= start + dur * rate);
    const clicksOut = clicks.filter((e) => e.type === "click" && !inside(e.at, viewAt(data.events, e.t, W / H, { zoom }))).length;
    const actions = data.events.filter((e) => ["click", "shortcut"].includes(e.type) && e.t >= start && e.t <= start + dur * rate).length;
    const flag = (ok: boolean) => (ok ? "  " : "⚠ ");
    console.log(
      `${name.padEnd(14)} ${dur.toFixed(1).padStart(4)}s  ${flag(maxUp <= 1.05)}${maxUp.toFixed(2)}×          ${flag(minCov >= 0.9)}${(minCov * 100).toFixed(0).padStart(3)} %          ${flag(cursorOut === 0)}${((cursorOut / samples) * 100).toFixed(0).padStart(3)} %        ${flag(clicksOut === 0)}${clicksOut}/${clicks.length}         ${actions} en ${(dur).toFixed(1)} s${rate > 1.3 ? ` (a ${rate}×)` : ""}`,
    );
  }
}
