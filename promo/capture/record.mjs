// Graba tomas de la interfaz real de Lost & Prompt (la app de escritorio en React) con datos de
// ejemplo, en un Chrome sin ventana: no toca el ratón ni el teclado del equipo.
//
// Uso: node capture/record.mjs [toma …] [--lang es|en]   (con `npm run dev` de desktop/ en :1420)
//
// Cada toma deja en public/clips/<lang>/:
//   <toma>.mp4   vídeo a 60 fps de los fotogramas reales (5760×3240, 4× de 1440×810)
//   <toma>.json  lo que pasó y cuándo: movimientos del cursor, clics, teclas y zonas de interés,
//                en segundos desde el inicio y en coordenadas 0–1. Remotion lo usa para el cursor
//                animado, los zooms de cámara y los sonidos.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const W = 1440;
const H = 810;
const SCALE = Number(process.env.LP_SCALE || 4); // 4×: la cámara puede acercarse sin perder nitidez
const FPS = 60;
const args = process.argv.slice(2);
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "es";
const wanted = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--lang");
const L = (es, en) => (lang === "en" ? en : es);

/** Herramientas de una toma: cada acción queda apuntada con su hora. */
function director(page, events, start) {
  const now = () => (Date.now() - start) / 1000;
  const cursor = { x: W * 0.62, y: H * 0.55 };
  const log = (type, extra = {}) => events.push({ t: +now().toFixed(3), type, ...extra });
  const center = async (target) => {
    if (typeof target === "object" && "x" in target) return target;
    const box = await page.locator(target).first().boundingBox();
    if (!box) throw new Error(`No encuentro ${target}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  };
  const norm = (p) => ({ x: +(p.x / W).toFixed(4), y: +(p.y / H).toFixed(4) });
  const api = {
    wait: (ms) => page.waitForTimeout(ms),
    /** Mueve el cursor con una curva suave (el real, para que se vean los estados hover). */
    async move(target, ms = 700) {
      const to = await center(target);
      const from = { ...cursor };
      const steps = Math.max(8, Math.round(ms / 16));
      log("move", { from: norm(from), to: norm(to), duration: ms / 1000 });
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        cursor.x = from.x + (to.x - from.x) * e;
        cursor.y = from.y + (to.y - from.y) * e;
        await page.mouse.move(cursor.x, cursor.y);
        await page.waitForTimeout(ms / steps);
      }
      return to;
    },
    async click(target, { ms = 700, button = "left", pause = 120 } = {}) {
      const to = await api.move(target, ms);
      await page.waitForTimeout(pause);
      log("click", { at: norm(to), button });
      await page.mouse.click(to.x, to.y, { button });
      return to;
    },
    async type(text, delay = 85) {
      for (const ch of text) {
        log("key", { key: ch });
        await page.keyboard.type(ch);
        await page.waitForTimeout(delay * (0.7 + Math.random() * 0.6));
      }
    },
    async press(keys) {
      log("shortcut", { keys });
      await page.keyboard.press(keys);
    },
    async scroll(dy, ms = 900) {
      log("scroll", { dy, duration: ms / 1000 });
      const steps = Math.round(ms / 16);
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy / steps);
        await page.waitForTimeout(16);
      }
    },
    /** Zona de interés para la cámara: un elemento o un rectángulo 0–1. */
    async focus(target, label = "", pad = 0.02) {
      let rect;
      if (typeof target === "string") {
        const b = await page.locator(target).first().boundingBox();
        rect = { x: b.x / W - pad, y: b.y / H - pad, w: b.width / W + pad * 2, h: b.height / H + pad * 2 };
      } else rect = target;
      log("focus", { rect: Object.fromEntries(Object.entries(rect).map(([k, v]) => [k, +v.toFixed(4)])), label });
    },
    mark: (label) => log("mark", { label }),
    page,
  };
  return api;
}

const row = (title) => `.row:has-text("${title}"), .card:has-text("${title}")`;
const stripe = L("Migración del checkout a Stripe", "Checkout migration to Stripe");
const speedrun = L("Bot de speedrun para un juego de plataformas", "Speedrun bot for a platformer");

/** Guion de cada toma. Tiempos pensados para cortarse a ritmo de la música. */
const shots = {
  // Guion v3: cada acción con su zona de interés (la cámara la encuadra) y tiempo para leerla.
  async reveal(d) {
    await d.wait(500);
    await d.focus({ x: 0, y: 0, w: 1, h: 1 }, "app");
    await d.move(row(L("Tema oscuro para el blog", "Dark theme for the blog")), 1100);
    await d.wait(300);
    await d.move(row(speedrun), 900);
    await d.wait(300);
    await d.move(row(L("Lanzamiento de la v2 de mi librería", "Shipping v2 of my library")), 900);
    await d.wait(900);
  },
  async search(d) {
    await d.wait(500);
    await d.focus({ x: 0, y: 0, w: 1, h: 1 }, "app");
    await d.press("Meta+k");
    await d.wait(250);
    await d.focus(".quick", "quick", 0.03);
    await d.wait(300);
    await d.type(L("webhook stripe", "stripe webhook"), 115);
    await d.wait(1300);
    await d.press("ArrowDown");
    await d.wait(550);
    await d.press("ArrowUp");
    await d.wait(650);
    await d.press("Meta+Enter");
    await d.wait(200);
    await d.focus({ x: 0.36, y: 0.02, w: 0.62, h: 0.42 }, "detalle");
    await d.wait(2000);
  },
  async resume(d) {
    await d.wait(400);
    const button = `button:has-text("${L("Reanudar en", "Resume in")}")`;
    await d.focus({ x: 0.36, y: 0.02, w: 0.6, h: 0.32 }, "cabecera");
    await d.move(button, 1200);
    await d.wait(500);
    await d.focus(button, "botón", 0.07);
    await d.wait(400);
    await d.click(button, { ms: 120 });
    await d.wait(900);
  },
  async conversation(d) {
    await d.wait(300);
    await d.focus("main.column", "conversación", 0.01);
    await d.move({ x: W * 0.7, y: H * 0.62 }, 700);
    await d.scroll(1000, 2200);
    await d.wait(700);
    await d.press("Meta+f");
    await d.wait(250);
    await d.focus({ x: 0.36, y: 0.0, w: 0.62, h: 0.62 }, "buscar");
    await d.type("webhook", 115);
    await d.wait(700);
    await d.press("Enter");
    await d.wait(900);
    await d.press("Enter");
    await d.wait(1300);
  },
  async organize(d) {
    await d.wait(300);
    await d.focus({ x: 0.15, y: 0.0, w: 0.85, h: 0.4 }, "favorito");
    await d.move(`[aria-label="${L("Favoritos", "Favorites")}"] >> nth=-1`, 900).catch(() => {});
    await d.wait(300);
    await d.press("Meta+d");
    await d.wait(1100);
    await d.focus({ x: 0.0, y: 0.08, w: 0.42, h: 0.75 }, "colecciones");
    const target = `.sidebar :text("${L("Código abierto", "Open source")}")`;
    await d.move(row(L("Responder issues pendientes", "Triage open issues")), 900);
    await d.wait(250);
    d.mark("drag");
    await d.page.mouse.down();
    await d.move(target, 1400);
    await d.wait(150);
    await d.page.mouse.up();
    d.mark("drop");
    await d.wait(700);
    await d.click(target, { ms: 600 });
    await d.focus({ x: 0.0, y: 0.0, w: 0.6, h: 0.5 }, "colección");
    await d.wait(1600);
  },
  async cards(d) {
    await d.wait(300);
    await d.press("Meta+2");
    await d.focus({ x: 0.15, y: 0.03, w: 0.85, h: 0.9 }, "tarjetas");
    await d.wait(700);
    await d.move(".card >> nth=1", 900);
    await d.wait(300);
    await d.move(".card >> nth=4", 900);
    await d.wait(900);
  },
  async activity(d) {
    await d.wait(300);
    await d.click(`.sidebar :text("${L("Actividad", "Activity")}")`, { ms: 700 });
    await d.wait(300);
    await d.focus({ x: 0.15, y: 0.0, w: 0.85, h: 0.62 }, "actividad");
    await d.move({ x: W * 0.55, y: H * 0.42 }, 1100);
    await d.move({ x: W * 0.82, y: H * 0.38 }, 1100);
    await d.wait(700);
  },
  async exportmd(d) {
    await d.wait(300);
    const more = `[aria-label="${L("Más", "More")}"]`;
    await d.focus({ x: 0.55, y: 0.0, w: 0.45, h: 0.62 }, "menú");
    await d.click(more, { ms: 900 });
    await d.wait(500);
    await d.click(`.menu :text("${L("Copiar como Markdown", "Copy as Markdown")}")`, { ms: 800 });
    await d.focus({ x: 0.3, y: 0.55, w: 0.6, h: 0.45 }, "aviso");
    await d.wait(1300);
  },
  async guide(d) {
    await d.wait(300);
    await d.press("F1");
    await d.wait(200);
    await d.focus(".guide", "guía", 0.01);
    await d.wait(500);
    await d.type("markdown", 105);
    await d.wait(1600);
  },
  async dark(d) {
    await d.wait(300);
    await d.focus({ x: 0, y: 0, w: 1, h: 1 }, "app");
    await d.click(row(L("Lanzamiento de la v2 de mi librería", "Shipping v2 of my library")), { ms: 800 });
    await d.wait(1000);
  },
  async windows(d) {
    await d.wait(300);
    await d.focus({ x: 0, y: 0, w: 1, h: 1 }, "app");
    await d.click(row(stripe), { ms: 800 });
    await d.wait(1000);
  },
};

/** Ajustes de cada toma: tema y plataforma. */
const setup = { dark: { theme: "dark" }, windows: { platform: "windows" } };

async function record(name) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, locale: lang === "en" ? "en-US" : "es-ES", reducedMotion: "no-preference", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const opts = setup[name] || {};
  await page.addInitScript(`window.__LP_LANG=${JSON.stringify(lang)};window.__LP_PLATFORM=${JSON.stringify(opts.platform || "macos")};window.__LP_THEME=${JSON.stringify(opts.theme || "light")};`);
  await page.addInitScript({ content: readFileSync(path.join(ROOT, "capture/mock.js"), "utf8") });
  // Sin cursor del sistema en la imagen: Remotion dibuja uno animado encima.
  await page.addInitScript({ content: "addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*{cursor:none!important}';document.head.appendChild(s)})" });
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const dir = path.join(ROOT, "public/clips", lang);
  const frameDir = path.join(ROOT, "out/frames", lang, name);
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });
  mkdirSync(dir, { recursive: true });

  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = path.join(frameDir, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  const events = [];
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1 });
  await page.waitForTimeout(300);
  const start = Date.now();
  const d = director(page, events, start);
  await shots[name](d);
  const end = Date.now();
  await cdp.send("Page.stopScreencast");
  await browser.close();

  // Fotogramas con su hora real → vídeo a 60 fps exactos: cada tic enlaza la última imagen que
  // había en pantalla en ese instante (la duración del vídeo es la real de la toma).
  const t0 = start / 1000;
  const ticks = path.join(frameDir, "ticks");
  mkdirSync(ticks, { recursive: true });
  const total = Math.round(((end - start) / 1000) * FPS);
  let k = 0;
  for (let i = 0; i < total; i++) {
    const t = t0 + i / FPS;
    while (k + 1 < frames.length && frames[k + 1].t <= t) k++;
    symlinkSync(frames[k].file, path.join(ticks, `${String(i).padStart(6, "0")}.jpg`));
  }
  const out = path.join(dir, `${name}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(ticks, "%06d.jpg"), "-vf", `scale=${W * SCALE}:${H * SCALE}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-movflags", "+faststart", out]);
  writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ name, lang, width: W, height: H, duration: +((end - start) / 1000).toFixed(3), events }, null, 1));
  console.log(`ok ${lang}/${name}: ${((end - start) / 1000).toFixed(1)} s, ${frames.length} fotogramas capturados, ${events.length} eventos`);
}

for (const name of wanted.length ? wanted : Object.keys(shots)) await record(name);
