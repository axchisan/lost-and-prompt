import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const INK = "#0b0b0f";
export const MUTED = "#6e6e73";
export const ACCENT = "#0a6cff";
export const DISPLAY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", Inter, system-ui, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const out = Easing.bezier(0.16, 1, 0.3, 1);

/** Tamaño base de letra según el formato: en vertical se lee en un móvil. */
export function useType() {
  const { width, height } = useVideoConfig();
  const short = Math.min(width, height);
  const vertical = height > width * 1.2;
  return { unit: short / 1080, vertical, width, height };
}

/** Una palabra que sube desde detrás de una máscara, en el fotograma `at`. */
const Word: React.FC<{ text: string; at: number; color?: string; italic?: boolean }> = ({ text, at, color = INK }) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [at, at + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: out });
  return (
    <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.08em", marginBottom: "-0.08em" }}>
      <span style={{ display: "inline-block", translate: `0 ${(1 - k) * 105}%`, color }}>{text}</span>
    </span>
  );
};

/**
 * Titular a pantalla completa sobre blanco. Cada palabra entra en su golpe de música (`beats`, en
 * fotogramas relativos a la escena); las marcadas con * van en azul.
 */
export const Headline: React.FC<{ text: string; beats: number[]; size?: number; sub?: string; subAt?: number; exitAt?: number }> = ({ text, beats, size = 1, sub, subAt = 0, exitAt }) => {
  const frame = useCurrentFrame();
  const { unit, vertical } = useType();
  const words = text.split(" ");
  const exit = exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fontSize = (vertical ? 118 : 132) * unit * size;
  return (
    <AbsoluteFill style={{ background: "#fff", alignItems: "center", justifyContent: "center", padding: `0 ${90 * unit}px`, opacity: 1 - exit, scale: String(1 - exit * 0.04) }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 760, fontSize, letterSpacing: "-0.035em", lineHeight: 1.04, textAlign: "center", maxWidth: vertical ? "100%" : 1500 * unit, textWrap: "balance" }}>
        {words.map((w, i) => (
          <span key={i}>
            <Word text={w.replace(/\*/g, "")} at={beats[Math.min(i, beats.length - 1)] ?? 0} color={w.includes("*") ? ACCENT : INK} />
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
      {sub && (
        <div style={{ marginTop: 34 * unit, fontFamily: DISPLAY, fontSize: (vertical ? 46 : 44) * unit, color: MUTED, fontWeight: 500, opacity: interpolate(frame, [subAt, subAt + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), translate: `0 ${interpolate(frame, [subAt, subAt + 12], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: out }) * unit}px`, textAlign: "center" }}>
          {sub}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Lista de proyectos que cae a ritmo: «decenas de carpetas». */
export const Flurry: React.FC<{ items: string[]; every: number; title: string; titleAt: number }> = ({ items, every, title, titleAt }) => {
  const frame = useCurrentFrame();
  const { unit, vertical } = useType();
  const cols = vertical ? 2 : 4;
  return (
    <AbsoluteFill style={{ background: "#fff", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, auto)`, gap: `${18 * unit}px ${26 * unit}px`, justifyContent: "center", position: "absolute", inset: 0, alignContent: "center", padding: 60 * unit }}>
        {items.map((item, i) => {
          const at = i * every;
          const k = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: out });
          const dim = interpolate(frame, [titleAt, titleAt + 10], [1, 0.16], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={item} style={{ fontFamily: MONO, fontSize: (vertical ? 36 : 34) * unit, color: INK, opacity: k * dim, scale: String(0.9 + k * 0.1), border: `${2 * unit}px solid #e6e6ea`, borderRadius: 14 * unit, padding: `${12 * unit}px ${20 * unit}px`, background: "#fafafa", whiteSpace: "nowrap" }}>
              ~/{item}
            </div>
          );
        })}
      </div>
      <div style={{ position: "relative", fontFamily: DISPLAY, fontWeight: 760, fontSize: (vertical ? 112 : 124) * unit, letterSpacing: "-0.035em", textAlign: "center", padding: `0 ${60 * unit}px` }}>
        {title.split(" ").map((w, i) => (
          <span key={i}>
            <Word text={w} at={titleAt + i * 3} />{" "}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Contador que sube hasta `to` (p. ej. sesiones) con su etiqueta. */
export const Counter: React.FC<{ to: number; label: string; locale: string; question: string; questionAt: number }> = ({ to, label, locale, question, questionAt }) => {
  const frame = useCurrentFrame();
  const { unit, vertical } = useType();
  const value = Math.round(interpolate(frame, [0, 34], [0, to], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
  const swap = interpolate(frame, [questionAt - 6, questionAt], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#fff", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY }}>
      <div style={{ opacity: 1 - swap, textAlign: "center", position: "absolute" }}>
        <div style={{ fontWeight: 800, fontSize: (vertical ? 250 : 260) * unit, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value.toLocaleString(locale)}</div>
        <div style={{ fontSize: (vertical ? 56 : 54) * unit, color: MUTED, fontWeight: 600, marginTop: 10 * unit }}>{label}</div>
      </div>
      <div style={{ opacity: swap, position: "absolute", fontWeight: 780, fontSize: (vertical ? 120 : 136) * unit, letterSpacing: "-0.035em", textAlign: "center", padding: `0 ${70 * unit}px`, lineHeight: 1.05 }}>
        {question.split(" ").map((w, i) => (
          <span key={i}>
            <Word text={w} at={questionAt + i * 4} color={i === question.split(" ").length - 1 ? ACCENT : INK} />{" "}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Rótulo sobre la interfaz: tarjeta blanca limpia, en la esquina que no tapa la acción. Entra con
 * máscara y sale con un fundido corto.
 */
export const Caption: React.FC<{ kicker?: string; text: string; keys?: string; corner?: "bl" | "br" | "tl" | "tr"; inAt?: number; outAt: number }> = ({ kicker, text, keys, corner = "bl", inAt = 4, outAt }) => {
  const frame = useCurrentFrame();
  const { unit, vertical } = useType();
  const k = interpolate(frame, [inAt, inAt + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: out });
  const exit = interpolate(frame, [outAt - 7, outAt], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pad = (vertical ? 56 : 54) * unit;
  const pos: React.CSSProperties = vertical
    ? { left: pad, right: pad, bottom: 150 * unit }
    : { [corner.includes("b") ? "bottom" : "top"]: pad, [corner.includes("l") ? "left" : "right"]: pad };
  return (
    <div style={{ position: "absolute", ...pos, opacity: k * (1 - exit), translate: `0 ${(1 - k) * 30 * unit}px`, display: "flex", justifyContent: vertical ? "center" : "flex-start" }}>
      <div style={{ background: "#fff", borderRadius: 26 * unit, padding: `${26 * unit}px ${36 * unit}px`, boxShadow: "0 18px 50px rgba(0,0,0,.16), 0 0 0 1px rgba(0,0,0,.05)", fontFamily: DISPLAY, maxWidth: vertical ? "100%" : 900 * unit, textAlign: vertical ? "center" : "left" }}>
        {kicker && <div style={{ fontSize: 24 * unit, fontWeight: 700, color: ACCENT, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 * unit }}>{kicker}</div>}
        <div style={{ fontSize: (vertical ? 64 : 58) * unit, fontWeight: 760, color: INK, letterSpacing: "-0.025em", lineHeight: 1.06 }}>{text}</div>
        {keys && (
          <div style={{ marginTop: 14 * unit, display: "inline-block", fontSize: 30 * unit, fontWeight: 650, color: INK, border: `${2 * unit}px solid #e2e2e6`, borderBottomWidth: 4 * unit, borderRadius: 12 * unit, padding: `${4 * unit}px ${14 * unit}px` }}>{keys}</div>
        )}
      </div>
    </div>
  );
};

/** La terminal que se abre al reanudar (ficticia: nunca se reanuda una sesión real). */
export const Terminal: React.FC<{ command: string; lines: string[] }> = ({ command, lines }) => {
  const frame = useCurrentFrame();
  const { unit } = useType();
  const typed = Math.floor(interpolate(frame, [4, 26], [0, command.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const pop = interpolate(frame, [0, 10], [0.94, 1], { extrapolateRight: "clamp", easing: out });
  return (
    <AbsoluteFill style={{ background: "#0e1014", padding: `${70 * unit}px ${80 * unit}px`, fontFamily: MONO, color: "#e8e8ea", fontSize: 38 * unit, lineHeight: 1.55, scale: String(pop) }}>
      <div style={{ display: "flex", gap: 14 * unit, marginBottom: 40 * unit }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 22 * unit, height: 22 * unit, borderRadius: "50%", background: c }} />
        ))}
      </div>
      <div>
        <span style={{ color: "#5ac8fa" }}>~/Developer/acme-store</span> <span style={{ color: "#30d158" }}>❯</span> {command.slice(0, typed)}
        {typed < command.length && <span style={{ background: "#e8e8ea", opacity: frame % 16 < 8 ? 1 : 0 }}>&nbsp;</span>}
      </div>
      {lines.map((line, i) => {
        const at = 30 + i * 5;
        return (
          <div key={i} style={{ opacity: interpolate(frame, [at, at + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), color: i === 0 ? "#a1a1aa" : "#e8e8ea" }}>
            {line}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Marca: el icono y el nombre, sobre blanco. */
export const Logo: React.FC<{ tagline: string }> = ({ tagline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unit, vertical } = useType();
  const k = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
  return (
    <AbsoluteFill style={{ background: "#fff", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 * unit, fontFamily: DISPLAY }}>
      <Img src={staticFile("icon.png")} style={{ width: (vertical ? 300 : 280) * unit, scale: String(0.6 + k * 0.4), rotate: `${(1 - k) * -8}deg` }} />
      <div style={{ fontSize: (vertical ? 120 : 140) * unit, fontWeight: 780, letterSpacing: "-0.04em", color: INK }}>
        <Word text="Lost" at={4} /> <Word text="&" at={6} color={ACCENT} /> <Word text="Prompt" at={8} />
      </div>
      <div style={{ fontSize: (vertical ? 46 : 46) * unit, color: MUTED, fontWeight: 500, textAlign: "center", padding: `0 ${60 * unit}px`, opacity: interpolate(frame, [14, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{tagline}</div>
    </AbsoluteFill>
  );
};

/** Cierre: dónde conseguirla. */
export const Outro: React.FC<{ line: string; cta: string }> = ({ line, cta }) => {
  const frame = useCurrentFrame();
  const { unit, vertical } = useType();
  const a = (s: number) => interpolate(frame, [s, s + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: out });
  return (
    <AbsoluteFill style={{ background: "#fff", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 34 * unit, fontFamily: DISPLAY, textAlign: "center" }}>
      <Img src={staticFile("icon.png")} style={{ width: (vertical ? 230 : 200) * unit, opacity: a(0), scale: String(0.85 + a(0) * 0.15) }} />
      <div style={{ fontSize: (vertical ? 100 : 112) * unit, fontWeight: 780, letterSpacing: "-0.04em", color: INK, opacity: a(4) }}>Lost &amp; Prompt</div>
      <div style={{ fontSize: (vertical ? 44 : 42) * unit, color: MUTED, fontWeight: 550, opacity: a(10), padding: `0 ${50 * unit}px` }}>{line}</div>
      <div style={{ opacity: a(18), translate: `0 ${(1 - a(18)) * 20 * unit}px`, fontSize: (vertical ? 50 : 52) * unit, fontWeight: 720, color: "#fff", background: ACCENT, borderRadius: 22 * unit, padding: `${20 * unit}px ${44 * unit}px` }}>{cta}</div>
      <div style={{ opacity: a(28), fontFamily: MONO, fontSize: (vertical ? 27 : 30) * unit, color: INK, border: `${2 * unit}px solid #e6e6ea`, borderRadius: 14 * unit, padding: `${12 * unit}px ${24 * unit}px` }}>brew install --cask axchisan/tap/lost-and-prompt</div>
      <div style={{ opacity: a(36), fontSize: (vertical ? 36 : 32) * unit, color: MUTED, fontWeight: 600 }}>macOS · Windows · Linux</div>
    </AbsoluteFill>
  );
};
