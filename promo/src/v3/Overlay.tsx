import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, Counter, Flurry, Headline, Logo, Outro, Terminal } from "../v2/Text";
import esEdl from "../../edit/edl-es-16x9.json";

// Capa gráfica del vídeo v3, transparente salvo en las escenas de texto. Se renderiza aparte
// (ProRes 4444 con alfa) y el editor (Blender) la pone encima de las tomas de la app. Todo su
// tiempo sale de la misma EDL que usa Blender, así que cursor, rótulos y cortes coinciden al fotograma.
type Edl = typeof esEdl;
type Cam = { f: number; scale: number; x: number; y: number; cursor: { x: number; y: number } | null; click: number | null };
const EDL: Record<string, Edl> = { "es-16x9": esEdl };
const out = Easing.bezier(0.16, 1, 0.3, 1);

const COPY = {
  es: {
    intro: "Cada día abres *Claude Code.", projects: "Decenas de proyectos.", sessions: "sesiones", question: "¿Dónde quedó esa sesión?",
    tagline: "Todas tus sesiones de Claude Code, en un solo lugar.", locale: "es-ES",
    folders: ["acme-store", "blog", "platformer-bot", "dotfiles", "tiny-date", "ml-lab", "portfolio", "weather-ios", "scripts", "acme-api", "Documents", "trip-2026"],
    captions: {
      biblioteca: ["Biblioteca", "Todas tus sesiones, de todas tus carpetas"],
      búsqueda: ["Búsqueda", "Encuentra cualquier conversación", "⌘K · Ctrl+K"],
      reanudar: ["Reanudar", "Vuelve justo donde lo dejaste"],
      conversación: ["Conversaciones", "Lee y busca dentro de cada sesión", "⌘F · Ctrl+F"],
      organizar: ["Organiza", "Favoritos y colecciones, a tu manera"],
      tarjetas: ["Vista", "Filas o tarjetas"],
      actividad: ["Actividad", "Lo que usas y lo que cuesta"],
      exportar: ["Compartir", "Cópiala en Markdown"],
      guía: ["Guía", "Aprende todo lo que hace"],
      oscuro: ["Apariencia", "Claro u oscuro"],
      windows: ["Multiplataforma", "También en Windows y Linux"],
    } as Record<string, string[]>,
    terminal: ["✓ Sesión reanudada · Migración del checkout a Stripe", "› ¿Y los pedidos que ya estaban pagados con PayPal?", "  Siguen intactos: comprobé los 1.284 pedidos."],
    headline: "Y todo, *a tu manera.", free: "Gratis. Y de código *abierto.", private: "Todo se queda en tu equipo.",
  },
};

export type OverlayProps = { lang: "es"; format: "16x9" };

/** Cámara de la escena activa en el fotograma `fr` (la que entra manda durante una transición). */
function active(edl: Edl, fr: number) {
  let found: { scene: Edl["scenes"][number]; cam: Cam } | null = null;
  for (const scene of edl.scenes) {
    if (fr >= scene.first && fr < scene.last) found = { scene, cam: scene.camera[fr - scene.first] as Cam };
  }
  return found;
}

const Cursor: React.FC<{ edl: Edl }> = ({ edl }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const a = active(edl, frame);
  if (!a || !a.cam.cursor) return null;
  // En la terminal (tras el clic de reanudar) el cursor desaparece con ella.
  const size = 30 * (width / 1920) * Math.min(1.6, Math.max(1, a.cam.scale * 0.8));
  const press = a.cam.click === null ? 1 : interpolate(a.cam.click, [0, 0.06, 0.16], [0.86, 0.86, 1], { extrapolateRight: "clamp" });
  const ring = a.cam.click === null ? 1 : interpolate(a.cam.click, [0, 0.38], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const x = a.cam.cursor.x * width;
  const y = a.cam.cursor.y * height;
  return (
    <>
      {ring < 1 && (
        <div style={{ position: "absolute", left: x, top: y, width: size * 2.2, height: size * 2.2, marginLeft: -size * 1.1, marginTop: -size * 1.1, borderRadius: "50%", border: `${size * 0.08}px solid rgba(10,108,255,${0.5 * (1 - ring)})`, background: `rgba(10,108,255,${0.08 * (1 - ring)})`, scale: String(0.35 + ring * 0.75) }} />
      )}
      <svg width={size} height={size * 1.45} viewBox="0 0 20 29" style={{ position: "absolute", left: x - size * 0.1, top: y - size * 0.07, scale: String(press), transformOrigin: "10% 5%", filter: "drop-shadow(0 3px 4px rgba(0,0,0,.3))" }}>
        <path d="M1.5 1.5 L1.5 23 L7 18 L10.6 26.5 L14.3 24.9 L10.8 16.7 L18 16.7 Z" fill="#111" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** Rótulo de cada escena en la esquina contraria al cursor (no tapa la acción). */
const Captions: React.FC<{ edl: Edl; captions: Record<string, string[]> }> = ({ edl, captions }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {edl.scenes.map((s) => {
        const c = captions[s.name];
        if (!c) return null;
        const from = Math.round(s.from * fps);
        const until = s.name === "reanudar" ? Math.round((s.to - 0.25) * fps) : Math.round(s.to * fps);
        const cams = s.camera as Cam[];
        const mid = cams[Math.floor(cams.length / 2)];
        const cursorRight = (mid.cursor?.x ?? 0.5) > 0.55;
        const corner = cursorRight ? "bl" : "br";
        return (
          <Sequence key={s.name} from={from} durationInFrames={until - from} name={`rótulo ${s.name}`}>
            <Caption kicker={c[0]} text={c[1]} keys={c[2]} corner={corner} inAt={8} outAt={until - from} />
          </Sequence>
        );
      })}
    </>
  );
};

/** La marca se abre: el icono crece hacia la cámara y deja ver la app (zoom a través). */
const LogoThrough: React.FC<{ tagline: string; len: number }> = ({ tagline, len }) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [len - 22, len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill style={{ opacity: 1 - interpolate(k, [0.55, 1], [0, 1], { extrapolateLeft: "clamp" }), scale: String(1 + k * 5) }}>
      <Logo tagline={tagline} />
    </AbsoluteFill>
  );
};

/** La terminal crece desde el botón «Reanudar» y al final sube para dejar ver la conversación. */
const TerminalMatch: React.FC<{ origin: { x: number; y: number }; len: number; lines: string[] }> = ({ origin, len, lines }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const grow = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp", easing: out });
  const leave = interpolate(frame, [len - 16, len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const ox = origin.x * width;
  const oy = origin.y * height;
  const clip = `inset(${oy * (1 - grow)}px ${(width - ox) * (1 - grow)}px ${(height - oy) * (1 - grow)}px ${ox * (1 - grow)}px round ${24 * (1 - grow)}px)`;
  return (
    <AbsoluteFill style={{ clipPath: clip, translate: `0 ${-leave * 100}%` }}>
      <Sequence from={6}>
        <Terminal command="claude --resume 3c1d2b7a-5e44-4f0a" lines={lines} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Titular que entra empujando desde la derecha y sale fundiéndose. */
const PushHeadline: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [0, 16], [100, 0], { extrapolateRight: "clamp", easing: out });
  const fade = interpolate(frame, [len - 20, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const beat = Math.round((60 / 129.2) * fps);
  return (
    <AbsoluteFill style={{ translate: `${enter}% 0`, opacity: fade }}>
      <Headline text={text} beats={[10, 10 + beat, 10 + beat * 2, 10 + beat * 3]} />
    </AbsoluteFill>
  );
};

/** Cortina blanca que sube desde abajo y tapa la app (antes de los textos finales). */
const Curtain: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [0, 14], [100, 0], { extrapolateRight: "clamp", easing: out });
  return <AbsoluteFill style={{ clipPath: `inset(${k}% 0 0 0)` }}>{children}</AbsoluteFill>;
};

const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 2, 14], [0.9, 0.9, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#fff", opacity: o }} />;
};

export const Overlay: React.FC<OverlayProps> = ({ lang, format }) => {
  const { fps } = useVideoConfig();
  const edl = EDL[`${lang}-${format}`];
  const c = COPY[lang];
  const m = edl.marks;
  const f = (s: number) => Math.round(s * fps);
  const BEAT = 60 / 129.2;
  const beats = (start: number, n: number) => Array.from({ length: n }, (_, i) => f(start + i * BEAT));
  const resume = edl.scenes.find((s) => s.name === "reanudar")!;
  const resumeCams = resume.camera as Cam[];
  const clickCam = resumeCams.find((cam) => cam.click !== null) ?? resumeCams[resumeCams.length - 1];
  const terminalFrom = f(resume.to);
  return (
    <AbsoluteFill>
      <Cursor edl={edl} />
      <Captions edl={edl} captions={c.captions} />

      <Sequence name="gancho 1" durationInFrames={f(3.181)}>
        <Headline text={c.intro} beats={beats(0.55, 5)} exitAt={f(3.181) - 8} />
      </Sequence>
      <Sequence name="gancho 2" from={f(3.181)} durationInFrames={f(5.039 - 3.181)}>
        <Flurry items={c.folders} every={Math.round(BEAT * fps * 0.5)} title={c.projects} titleAt={f(BEAT * 2)} />
      </Sequence>
      <Sequence name="gancho 3" from={f(5.039)} durationInFrames={f(m.logo - 5.039)}>
        <Counter to={1284} label={c.sessions} locale={c.locale} question={c.question} questionAt={f(6.896 - 5.039)} />
      </Sequence>
      <Sequence name="marca" from={f(m.logo)} durationInFrames={f(m.reveal - m.logo) + 1}>
        <LogoThrough tagline={c.tagline} len={f(m.reveal - m.logo)} />
      </Sequence>
      <Sequence name="flash 1" from={f(m.logo)} durationInFrames={16}>
        <Flash />
      </Sequence>
      <Sequence name="terminal" from={terminalFrom} durationInFrames={f(m.conversation) - terminalFrom}>
        <TerminalMatch origin={clickCam.cursor ?? { x: 0.5, y: 0.5 }} len={f(m.conversation) - terminalFrom} lines={c.terminal} />
      </Sequence>
      <Sequence name="titular" from={f(m.headline)} durationInFrames={f(m.organize - m.headline) + 20}>
        <PushHeadline text={c.headline} len={f(m.organize - m.headline) + 20} />
      </Sequence>
      <Sequence name="flash 2" from={f(m.drop2)} durationInFrames={16}>
        <Flash />
      </Sequence>
      <Sequence name="gratis" from={f(m.free)} durationInFrames={f(m.outro - m.free)}>
        <Curtain>
          <Headline text={c.free} beats={[16, ...beats(BEAT * 2, 4).map((b) => b + 4)]} sub={c.private} subAt={f(BEAT * 5)} />
        </Curtain>
      </Sequence>
      <Sequence name="cierre" from={f(m.outro)}>
        <Outro line={c.tagline} cta="lostandprompt.axchisan.com" />
      </Sequence>
    </AbsoluteFill>
  );
};
