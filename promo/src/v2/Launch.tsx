import { Audio } from "@remotion/media";
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Clip } from "./Clip";
import { Caption, Counter, Flurry, Headline, Logo, Outro, Terminal } from "./Text";

// Montaje sobre «Technology Epic Inspire» (Pixabay, 129 BPM, un compás = 1,857 s). Se usan dos
// trozos de la pista unidos en un compás: A = 0–23,475 s (arranque y primer drop en 8,707 s) y
// B = 45,859 s en adelante (subida y drop principal en 53,476 s, que cae en el segundo 31,092 del
// vídeo). Cada escena empieza en un compás: los cortes caen con la música.
export const FPS = 60;
const A_END = 23.475;
const B_START = 45.859;
export const DURATION_S = 52.2;

// Compases en segundos de vídeo (de src/music.json, tools/analyze_music.py).
const BAR = {
  intro2: 3.181, intro3: 5.039, intro4: 6.896, drop1: 8.707, reveal: 10.542, search: 14.234, resume: 19.783, terminal: 21.618,
  conversation: 23.475, organize: 27.167, drop2: 31.092, activity: 32.926, exportmd: 34.784, guide: 36.618, dark: 38.476,
  windows: 40.31, free: 42.167, outro: 45.859, end: 51.386,
};
const BEAT = 60 / 129.2;

type Lang = "es" | "en";
const COPY = {
  es: {
    intro: "Cada día abres *Claude Code.",
    projects: "Decenas de proyectos.",
    folders: ["acme-store", "blog", "platformer-bot", "dotfiles", "tiny-date", "ml-lab", "portfolio", "weather-ios", "scripts", "acme-api", "Documents", "trip-2026"],
    sessions: "sesiones",
    question: "¿Dónde quedó esa sesión?",
    tagline: "Todas tus sesiones de Claude Code, en un solo lugar.",
    reveal: ["Biblioteca", "Todas tus sesiones, de todas tus carpetas"],
    search: ["Búsqueda", "Encuentra cualquier conversación"],
    resume: ["Reanudar", "Vuelve justo donde lo dejaste"],
    terminal: ["✓ Sesión reanudada · Migración del checkout a Stripe", "› ¿Y los pedidos que ya estaban pagados con PayPal?", "  Siguen intactos: comprobé los 1.284 pedidos."],
    conversation: ["Conversaciones", "Lee y busca dentro de cada sesión"],
    organize: ["Organiza", "Favoritos y colecciones, a tu manera"],
    cards: "Filas o tarjetas",
    activity: "Tu actividad y lo que cuesta",
    exportmd: "Compártela en Markdown",
    guide: "Una guía de todo lo que hace",
    dark: "Claro u oscuro",
    windows: "También en Windows y Linux",
    free: "Gratis. Y de código *abierto.",
    private: "Todo se queda en tu equipo.",
    outro: "Todas tus sesiones de Claude Code, en un solo lugar.",
    locale: "es-ES",
  },
  en: {
    intro: "Every day you open *Claude Code.",
    projects: "Dozens of projects.",
    folders: ["acme-store", "blog", "platformer-bot", "dotfiles", "tiny-date", "ml-lab", "portfolio", "weather-ios", "scripts", "acme-api", "Documents", "trip-2026"],
    sessions: "sessions",
    question: "Where did that session go?",
    tagline: "Every Claude Code session you ever lost, found.",
    reveal: ["Library", "Every session, from every folder"],
    search: ["Search", "Find any conversation"],
    resume: ["Resume", "Pick up right where you left off"],
    terminal: ["✓ Session resumed · Checkout migration to Stripe", "› What about orders already paid with PayPal?", "  They're untouched: I checked all 1,284 orders."],
    conversation: ["Conversations", "Read and search inside every session"],
    organize: ["Organize", "Favorites and collections, your way"],
    cards: "Rows or cards",
    activity: "Your activity and what it costs",
    exportmd: "Share it as Markdown",
    guide: "A guide to everything it does",
    dark: "Light or dark",
    windows: "On Windows and Linux too",
    free: "Free. And *open source.",
    private: "Everything stays on your computer.",
    outro: "Every Claude Code session you ever lost, found.",
    locale: "en-US",
  },
} as const;

export type LaunchProps = { lang: Lang };

/** Escena que empieza en el compás `from` y dura hasta `to` (segundos de vídeo). */
const Scene: React.FC<{ from: number; to: number; name: string; children: React.ReactNode; punch?: boolean }> = ({ from, to, name, children, punch = true }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence name={name} from={Math.round(from * fps)} durationInFrames={Math.round((to - from) * fps)}>
      {punch ? <Punch>{children}</Punch> : children}
    </Sequence>
  );
};

/** Entrada con un pequeño empujón de cámara: da golpe al corte sin efectos raros. */
const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 14], [1.045, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return <AbsoluteFill style={{ scale: String(s) }}>{children}</AbsoluteFill>;
};

/** Destello blanco en los drops. */
const Flash: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = at * fps;
  const o = interpolate(frame, [f - 2, f, f + 10], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return o > 0 ? <AbsoluteFill style={{ background: "#fff", opacity: o, pointerEvents: "none" }} /> : null;
};

/** Un efecto de sonido en el segundo `at` del vídeo. */
const Sfx: React.FC<{ at: number; src: string; volume?: number }> = ({ at, src, volume = 0.6 }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={Math.max(0, Math.round(at * fps))} durationInFrames={Math.round(1.5 * fps)} layout="none" name={`sfx ${src}`}>
      <Audio src={staticFile(`sfx/${src}.wav`)} volume={volume} />
    </Sequence>
  );
};

export const Launch: React.FC<LaunchProps> = ({ lang }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const c = COPY[lang];
  const f = (s: number) => Math.round(s * fps);
  const beats = (start: number, n: number, every = BEAT) => Array.from({ length: n }, (_, i) => f(start + i * every));
  const len = (a: number, b: number) => f(b - a);

  // Música: los dos trozos, con un fundido de 3 fotogramas en la unión y el final apagándose.
  const musicB = interpolate(frame, [f(BAR.end) - f(0.4), f(DURATION_S)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {/* 1. Arranque: el problema, a ritmo. */}
      <Scene name="intro" from={0} to={BAR.intro2} punch={false}>
        <Headline text={c.intro} beats={beats(0.55, 5)} exitAt={len(0, BAR.intro2) - 8} />
      </Scene>
      <Scene name="proyectos" from={BAR.intro2} to={BAR.intro3}>
        <Flurry items={[...c.folders]} every={Math.round(BEAT * fps * 0.5)} title={c.projects} titleAt={f(BEAT * 2)} />
      </Scene>
      <Scene name="sesiones" from={BAR.intro3} to={BAR.drop1}>
        <Counter to={1284} label={c.sessions} locale={c.locale} question={c.question} questionAt={len(BAR.intro3, BAR.intro4)} />
      </Scene>

      {/* 2. Primer drop: la marca. */}
      <Scene name="marca" from={BAR.drop1} to={BAR.reveal}>
        <Logo tagline={c.tagline} />
      </Scene>

      {/* 3. La app, de verdad. */}
      <Scene name="biblioteca" from={BAR.reveal} to={BAR.search}>
        <Clip name="reveal" lang={lang} start={0.7} rate={1.2} zoom={1.12} />
        <Caption kicker={c.reveal[0]} text={c.reveal[1]} corner="br" outAt={len(BAR.reveal, BAR.search)} />
      </Scene>
      <Scene name="búsqueda" from={BAR.search} to={BAR.resume}>
        <Clip name="search" lang={lang} start={0.4} />
        <Caption kicker={c.search[0]} text={c.search[1]} keys="⌘K · Ctrl+K" corner="bl" inAt={f(0.5)} outAt={len(BAR.search, BAR.resume)} />
      </Scene>
      <Scene name="reanudar" from={BAR.resume} to={BAR.terminal}>
        <Clip name="resume" lang={lang} start={0.9} rate={1.3} />
        <Caption kicker={c.resume[0]} text={c.resume[1]} corner="bl" outAt={len(BAR.resume, BAR.terminal) + 30} />
      </Scene>
      <Scene name="terminal" from={BAR.terminal} to={BAR.conversation}>
        <Terminal command="claude --resume 3c1d2b7a-5e44-4f0a" lines={c.terminal as unknown as string[]} />
      </Scene>

      {/* 4. Segunda parte (subida): leer, buscar, organizar. */}
      <Scene name="conversación" from={BAR.conversation} to={BAR.organize}>
        <Clip name="conversation" lang={lang} start={1.9} rate={1.8} />
        <Caption kicker={c.conversation[0]} text={c.conversation[1]} keys="⌘F · Ctrl+F" corner="tl" outAt={len(BAR.conversation, BAR.organize)} />
      </Scene>
      <Scene name="organizar" from={BAR.organize} to={BAR.drop2}>
        <Clip name="organize" lang={lang} start={0.9} rate={1.25} />
        <Caption kicker={c.organize[0]} text={c.organize[1]} corner="br" outAt={len(BAR.organize, BAR.drop2)} />
      </Scene>

      {/* 5. Drop principal: una función por compás. */}
      <Scene name="tarjetas" from={BAR.drop2} to={BAR.activity}>
        <Clip name="cards" lang={lang} start={0.3} rate={1.2} zoom={1.3} />
        <Caption text={c.cards} corner="bl" inAt={2} outAt={len(BAR.drop2, BAR.activity)} />
      </Scene>
      <Scene name="actividad" from={BAR.activity} to={BAR.exportmd}>
        <Clip name="activity" lang={lang} start={1.0} rate={1.4} />
        <Caption text={c.activity} corner="bl" inAt={2} outAt={len(BAR.activity, BAR.exportmd)} />
      </Scene>
      <Scene name="exportar" from={BAR.exportmd} to={BAR.guide}>
        <Clip name="exportmd" lang={lang} start={1.0} rate={1.4} zoom={1.25} />
        <Caption text={c.exportmd} corner="bl" inAt={2} outAt={len(BAR.exportmd, BAR.guide)} />
      </Scene>
      <Scene name="guía" from={BAR.guide} to={BAR.dark}>
        <Clip name="guide" lang={lang} start={0.4} rate={1.9} zoom={1.2} />
        <Caption text={c.guide} corner="br" inAt={2} outAt={len(BAR.guide, BAR.dark)} />
      </Scene>
      <Scene name="oscuro" from={BAR.dark} to={BAR.windows}>
        <Clip name="dark" lang={lang} start={0.3} zoom={1.3} />
        <Caption text={c.dark} corner="bl" inAt={2} outAt={len(BAR.dark, BAR.windows)} />
      </Scene>
      <Scene name="windows" from={BAR.windows} to={BAR.free}>
        <Clip name="windows" lang={lang} start={0.3} zoom={1.3} />
        <Caption text={c.windows} corner="bl" inAt={2} outAt={len(BAR.windows, BAR.free)} />
      </Scene>

      {/* 6. Cierre. */}
      <Scene name="gratis" from={BAR.free} to={BAR.outro}>
        <Headline text={c.free} beats={[0, ...beats(BEAT * 2, 4, BEAT)]} sub={c.private} subAt={f(BEAT * 5)} />
      </Scene>
      <Scene name="final" from={BAR.outro} to={DURATION_S} punch={false}>
        <Outro line={c.outro} cta="lostandprompt.axchisan.com" />
      </Scene>

      <Flash at={BAR.drop1} />
      <Flash at={BAR.drop2} />

      {/* Música. */}
      <Sequence name="música A" durationInFrames={f(A_END)} layout="none">
        <Audio src={staticFile("music/track.mp3")} volume={(fr) => interpolate(fr, [f(A_END) - 3, f(A_END)], [0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      </Sequence>
      <Sequence name="música B" from={f(A_END)} layout="none">
        <Audio src={staticFile("music/track.mp3")} trimBefore={f(B_START)} volume={(fr) => interpolate(fr, [0, 3], [0, 0.9], { extrapolateRight: "clamp" }) * musicB} />
      </Sequence>

      {/* Sonidos de montaje: golpes en los drops, aire en las transiciones. */}
      <Sfx at={BAR.intro2 - 0.05} src="whoosh" volume={0.35} />
      <Sfx at={BAR.intro3 - 0.05} src="whoosh" volume={0.35} />
      <Sfx at={BAR.intro4 - 0.1} src="whip" volume={0.4} />
      <Sfx at={BAR.drop1 - 0.55} src="rise" volume={0.25} />
      <Sfx at={BAR.drop1} src="hit" volume={0.7} />
      <Sfx at={BAR.drop1 + 0.05} src="confirm" volume={0.3} />
      <Sfx at={BAR.reveal - 0.05} src="whoosh" volume={0.4} />
      <Sfx at={BAR.terminal - 0.04} src="whip" volume={0.45} />
      <Sfx at={BAR.terminal + 0.45} src="key" volume={0.3} />
      <Sfx at={BAR.conversation - 0.05} src="whoosh" volume={0.4} />
      <Sfx at={BAR.organize + (3.95 - 0.9) / 1.25} src="drop" volume={0.5} />
      <Sfx at={BAR.drop2 - 0.55} src="rise" volume={0.3} />
      <Sfx at={BAR.drop2} src="hit" volume={0.75} />
      {[BAR.activity, BAR.exportmd, BAR.guide, BAR.dark, BAR.windows].map((b) => (
        <Sfx key={b} at={b - 0.04} src="whip" volume={0.3} />
      ))}
      <Sfx at={BAR.free} src="hit" volume={0.45} />
      <Sfx at={BAR.outro} src="confirm" volume={0.4} />
    </AbsoluteFill>
  );
};
