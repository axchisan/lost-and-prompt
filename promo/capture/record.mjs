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
const args0 = process.argv.slice(2);
const format = args0.includes("--format") ? args0[args0.indexOf("--format") + 1] : "16x9";
// Ventana de la app con la proporción de cada formato (la interfaz se reorganiza sola) y escala de
// captura suficiente para que la cámara pueda acercarse sin perder nitidez.
const LAYOUT = { "16x9": [1440, 810, 4], "9x16": [900, 1600, 3], "4x5": [1080, 1350, 3], "1x1": [1200, 1200, 3] };
const [W, H, SCALE] = LAYOUT[format];
const FPS = 60;
const args = process.argv.slice(2);
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "es";
const wanted = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--lang" && args[i - 1] !== "--format");
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
    /** Espera; si es larga y el cursor ya se vio, deriva unos píxeles (una mano nunca está quieta). */
    async wait(ms) {
      if (ms < 900 || !events.some((e) => e.type === "path")) return page.waitForTimeout(ms);
      const base = { ...cursor };
      const a = Math.sin(base.x + base.y) * Math.PI;
      const drift = { x: base.x + Math.cos(a) * 5, y: base.y + Math.sin(a) * 3 };
      await api.move(drift, Math.min(ms - 100, 900));
      await page.waitForTimeout(Math.max(0, ms - 1000));
    },
    /**
     * Mueve el ratón como una mano: arco ligero (no línea recta), arranque rápido y frenada suave
     * (perfil de mínimo tirón) y, en trayectos largos, un pequeño pase del objetivo con corrección.
     * El ratón real sigue ese camino y cada punto queda registrado con su hora, así el cursor
     * dibujado coincide al fotograma con los estados hover y los clics de la interfaz.
     */
    async move(target, ms = 700) {
      const to = await center(target);
      const from = { ...cursor };
      const dx = to.x - from.x, dy = to.y - from.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return to;
      const seed = Math.sin(from.x * 12.9898 + to.y * 78.233) * 43758.5453;
      const rnd = seed - Math.floor(seed); // determinista: la misma toma sale igual
      const bend = (rnd < 0.5 ? -1 : 1) * Math.min(60, dist * (0.08 + rnd * 0.08));
      const nx = -dy / dist, ny = dx / dist;
      const ctrl = { x: from.x + dx * 0.45 + nx * bend, y: from.y + dy * 0.45 + ny * bend };
      const over = dist > 220 ? Math.min(9, dist * 0.02) : 0;
      const end = { x: to.x + (dx / dist) * over, y: to.y + (dy / dist) * over };
      const minJerk = (k) => k * k * k * (10 - 15 * k + 6 * k * k);
      const points = [];
      const t0 = Date.now();
      const steps = Math.max(10, Math.round(ms / 16));
      const go = async (a, c, b, dur) => {
        const n = Math.max(4, Math.round((dur / ms) * steps));
        const start = Date.now();
        for (let i = 1; i <= n; i++) {
          const k = minJerk(Math.min(1, (Date.now() - start + 16) / dur));
          const u = 1 - k;
          cursor.x = u * u * a.x + 2 * u * k * c.x + k * k * b.x;
          cursor.y = u * u * a.y + 2 * u * k * c.y + k * k * b.y;
          await page.mouse.move(cursor.x, cursor.y);
          points.push([+now().toFixed(3), +(cursor.x / W).toFixed(4), +(cursor.y / H).toFixed(4)]);
          if (k >= 1) break;
          await page.waitForTimeout(Math.max(1, start + (i * dur) / n - Date.now()));
        }
      };
      await go(from, ctrl, end, over ? ms * 0.86 : ms);
      if (over) await go(end, { x: (end.x + to.x) / 2, y: (end.y + to.y) / 2 }, to, Math.max(110, ms * 0.18));
      cursor.x = to.x;
      cursor.y = to.y;
      // Hora del primer punto (no la del final): el cursor dibujado empieza a moverse cuando el real.
      events.push({ t: points[0][0], type: "path", points, duration: +((Date.now() - t0) / 1000).toFixed(3) });
      events.sort((x, y) => x.t - y.t);
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
        const x0 = Math.max(0, b.x / W - pad), y0 = Math.max(0, b.y / H - pad);
        const x1 = Math.min(1, (b.x + b.width) / W + pad), y1 = Math.min(1, (b.y + b.height) / H + pad);
        rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
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
    await d.focus(".detail .head", "detalle", 0.015);
    await d.wait(2000);
  },
  async resume(d) {
    await d.wait(400);
    const button = `button:has-text("${L("Reanudar en", "Resume in")}")`;
    await d.focus(".detail .head", "cabecera", 0.015);
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
    await d.focus(".detail", "buscar", 0.0);
    await d.type("webhook", 115);
    await d.wait(700);
    await d.press("Enter");
    await d.wait(900);
    await d.press("Enter");
    await d.wait(1300);
  },
  async organize(d) {
    await d.wait(300);
    await d.focus(".detail .head", "favorito", 0.015);
    await d.move(`[aria-label="${L("Favoritos", "Favorites")}"] >> nth=-1`, 900).catch(() => {});
    await d.wait(300);
    await d.press("Meta+d");
    await d.wait(1100);
    await d.focus(".sidebar", "colecciones", 0.0);
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
    await d.focus(".list", "colección", 0.0);
    await d.wait(1600);
  },
  async cards(d) {
    await d.wait(300);
    await d.press("Meta+2");
    await d.focus(".cards", "tarjetas", 0.0);
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
    await d.focus(".activity-inner", "actividad", 0.0);
    await d.move({ x: W * 0.55, y: H * 0.42 }, 1100);
    await d.move({ x: W * 0.82, y: H * 0.38 }, 1100);
    await d.wait(700);
  },
  async exportmd(d) {
    await d.wait(300);
    const more = `[aria-label="${L("Más", "More")}"]`;
    await d.focus(".detail .head", "menú", 0.015);
    await d.click(more, { ms: 900 });
    await d.wait(500);
    await d.click(`.menu :text("${L("Copiar como Markdown", "Copy as Markdown")}")`, { ms: 800 });
    await d.wait(150);
    await d.focus(".toast", "aviso", 0.03).catch(() => {});
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
  // Chrome sin ventana reserva 87 px de barra: la ventana es más alta para que el área útil sea
  // exactamente W×H, y la escala va por parámetro (con viewport de Playwright la captura sale a 1×).
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: [`--force-device-scale-factor=${SCALE}`, `--window-size=${W},${H + 87}`] });
  const context = await browser.newContext({ viewport: null, locale: lang === "en" ? "en-US" : "es-ES", reducedMotion: "no-preference", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const opts = setup[name] || {};
  await page.addInitScript(`window.__LP_LANG=${JSON.stringify(lang)};window.__LP_PLATFORM=${JSON.stringify(opts.platform || "macos")};window.__LP_THEME=${JSON.stringify(opts.theme || "light")};`);
  await page.addInitScript({ content: readFileSync(path.join(ROOT, "capture/mock.js"), "utf8") });
  // Sin cursor del sistema en la imagen: Remotion dibuja uno animado encima.
  await page.addInitScript({ content: "addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='*{cursor:none!important}';document.head.appendChild(s)})" });
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const dir = path.join(ROOT, "public/clips", lang, format);
  const frameDir = path.join(ROOT, "out/frames", lang, format, name);
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
  const size = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
  if (size[0] !== W || size[1] !== H || size[2] !== SCALE) throw new Error(`Área útil ${size} en vez de ${W}×${H} a ${SCALE}×`);
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
  writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ name, lang, format, width: W, height: H, scale: SCALE, duration: +((end - start) / 1000).toFixed(3), events }, null, 1));
  console.log(`ok ${lang}/${format}/${name}: ${((end - start) / 1000).toFixed(1)} s, ${frames.length} fotogramas capturados, ${events.length} eventos`);
}

for (const name of wanted.length ? wanted : Object.keys(shots)) await record(name);
