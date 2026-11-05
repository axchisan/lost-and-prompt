import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from "remotion";
import { ACCENT, DISPLAY, INK, MONO, MUTED } from "./Text";

// Títulos del formato vertical (9:16) en la fase «explicación»: la app completa en un bloque y,
// en las franjas blancas de arriba (0–520 px) y abajo (1600–1920 px), un título con un tratamiento
// propio de cada escena. Se retiran cuando la app crece a pantalla completa (layout → 1).
const out = Easing.bezier(0.16, 1, 0.3, 1);
const TOP = 520;
const BOTTOM = 1600;

type Cam = { f: number; layout: number };
type Scene = { name: string; first: number; last: number; camera: Cam[] };
export type VCopy = Record<string, { kicker: string; title: string; accent?: string; extra?: string[] }>;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const appear = (frame: number, at: number, len = 14) => interpolate(frame, [at, at + len], [0, 1], { ...clamp, easing: out });

/** Palabras que suben desde una máscara; las de `accent` van en azul. */
const Words: React.FC<{ text: string; at: number; size: number; accent?: string; color?: string; weight?: number }> = ({ text, at, size, accent, color = INK, weight = 780 }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: DISPLAY, fontWeight: weight, fontSize: size, letterSpacing: "-0.035em", lineHeight: 1.04, textAlign: "center", textWrap: "balance" }}>
      {words.map((w, i) => {
        const k = appear(frame, at + i * 3);
        const isAccent = accent && accent.split(" ").includes(w.replace(/[.,]/g, ""));
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.1em", marginBottom: "-0.1em" }}>
            <span style={{ display: "inline-block", translate: `0 ${(1 - k) * 105}%`, color: isAccent ? ACCENT : color }}>{w}&nbsp;</span>
          </span>
        );
      })}
    </div>
  );
};

const Kicker: React.FC<{ text: string; at: number; color?: string }> = ({ text, at, color = ACCENT }) => {
  const frame = useCurrentFrame();
  const k = appear(frame, at, 12);
  return <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: ".14em", textTransform: "uppercase", color, opacity: k, translate: `0 ${(1 - k) * 14}px`, marginBottom: 18 }}>{text}</div>;
};

const Key: React.FC<{ k: string; at: number }> = ({ k, at }) => {
  const frame = useCurrentFrame();
  const p = appear(frame, at, 10);
  const press = interpolate(frame, [at + 14, at + 17, at + 22], [0, 4, 0], clamp);
  return (
    <span style={{ display: "inline-block", fontFamily: DISPLAY, fontWeight: 650, fontSize: 44, color: INK, minWidth: 74, textAlign: "center", padding: "10px 20px", borderRadius: 16, border: "2px solid #dedee3", borderBottomWidth: 7 - press, translate: `0 ${press + (1 - p) * 20}px`, opacity: p, background: "#fff", margin: "0 8px" }}>
      {k}
    </span>
  );
};

const Chip: React.FC<{ text: string; at: number; dot?: string; mono?: boolean }> = ({ text, at, dot, mono }) => {
  const frame = useCurrentFrame();
  const p = appear(frame, at, 12);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: mono ? MONO : DISPLAY, fontSize: 34, fontWeight: mono ? 500 : 600, color: INK, padding: "12px 22px", borderRadius: 99, background: "#f4f4f6", border: "2px solid #e6e6ea", opacity: p, scale: String(0.85 + p * 0.15), margin: 8 }}>
      {dot && <span style={{ width: 18, height: 18, borderRadius: 99, background: dot }} />}
      {text}
    </span>
  );
};

/** Decoración de la franja de abajo, distinta en cada escena. */
const Bottom: React.FC<{ name: string; extra: string[]; at: number }> = ({ name, extra, at }) => {
  const frame = useCurrentFrame();
  if (name === "búsqueda" || name === "conversación" || name === "guía")
    return <div>{extra.map((k, i) => <Key key={k} k={k} at={at + i * 6} />)}</div>;
  if (name === "actividad") {
    const bars = [0.35, 0.6, 0.45, 0.9, 0.55, 1, 0.7, 0.8];
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 150 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 40, borderRadius: 8, background: ACCENT, opacity: 0.35 + h * 0.65, height: 150 * h * appear(frame, at + i * 3, 16) }} />
        ))}
      </div>
    );
  }
  return <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 1000 }}>{extra.map((t, i) => <Chip key={t} text={t} at={at + i * 4} mono={name === "biblioteca"} dot={name === "organizar" ? ["#5856d6", "#30b0c7", "#ff9500", "#34c759"][i % 4] : undefined} />)}</div>;
};

/** Cabecera de cada escena: el título con su tratamiento. */
const Head: React.FC<{ name: string; kicker: string; title: string; accent?: string }> = ({ name, kicker, title, accent }) => {
  const frame = useCurrentFrame();
  if (name === "búsqueda") {
    // El título se escribe dentro de un campo de búsqueda.
    const shown = Math.floor(interpolate(frame, [8, 8 + title.length * 1.6], [0, title.length], clamp));
    return (
      <>
        <Kicker text={kicker} at={0} />
        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "26px 34px", borderRadius: 30, border: "3px solid #e3e3e8", boxShadow: "0 18px 40px rgba(0,0,0,.08)", width: 960, opacity: appear(frame, 2), scale: String(0.94 + appear(frame, 2) * 0.06) }}>
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 56, color: INK, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden" }}>{title.slice(0, shown)}</span>
          <span style={{ width: 4, height: 60, background: ACCENT, opacity: frame % 30 < 16 ? 1 : 0, marginLeft: -14 }} />
        </div>
      </>
    );
  }
  if (name === "reanudar")
    return (
      <>
        <div style={{ fontFamily: MONO, fontSize: 38, color: MUTED, marginBottom: 22, opacity: appear(frame, 0) }}>
          <span style={{ color: "#30d158" }}>❯</span> claude --resume <span style={{ color: ACCENT }}>3c1d2b7a</span>
        </div>
        <Words text={title} at={8} size={104} accent={accent} />
      </>
    );
  if (name === "conversación") {
    const p = appear(frame, 4, 16);
    return (
      <>
        <Kicker text={kicker} at={0} />
        <div style={{ background: ACCENT, color: "#fff", fontFamily: DISPLAY, fontWeight: 760, fontSize: 82, letterSpacing: "-0.03em", lineHeight: 1.05, padding: "30px 46px", borderRadius: "48px 48px 12px 48px", maxWidth: 960, textAlign: "center", scale: String(0.7 + p * 0.3), opacity: p, transformOrigin: "100% 100%" }}>{title}</div>
      </>
    );
  }
  if (name === "exportar")
    return (
      <>
        <div style={{ fontFamily: MONO, fontSize: 40, color: MUTED, marginBottom: 14, opacity: appear(frame, 0) }}>sesion.md</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 780, fontSize: 104, letterSpacing: "-0.035em", lineHeight: 1.04, textAlign: "center" }}>
          <span style={{ fontFamily: MONO, color: ACCENT, opacity: appear(frame, 4) }}># </span>
          {title.split(" ").map((w, i) => (
            <span key={i} style={{ opacity: appear(frame, 8 + i * 3), display: "inline-block", translate: `0 ${(1 - appear(frame, 8 + i * 3)) * 30}px` }}>
              {accent && w.replace(/[.,]/g, "") === accent ? <><span style={{ fontFamily: MONO, color: MUTED, fontSize: 70 }}>**</span>{w}<span style={{ fontFamily: MONO, color: MUTED, fontSize: 70 }}>**</span></> : w}&nbsp;
            </span>
          ))}
        </div>
      </>
    );
  if (name === "oscuro") {
    // El título cambia de claro a oscuro con una cortina que lo cruza.
    const k = interpolate(frame, [18, 48], [0, 100], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    const text = <Words text={title} at={2} size={112} />;
    return (
      <div style={{ position: "relative" }}>
        <Kicker text={kicker} at={0} />
        {text}
        <div style={{ position: "absolute", inset: "-30px -60px", background: "#111114", clipPath: `inset(0 ${100 - k}% 0 0)`, display: "grid", placeItems: "center", borderRadius: 30 }}>
          <div>
            <Kicker text={kicker} at={0} color="#4cc2ff" />
            <Words text={title} at={-60} size={112} color="#f2f2f4" />
          </div>
        </div>
      </div>
    );
  }
  if (name === "organizar") {
    const sweep = interpolate(frame, [26, 44], [0, 100], { ...clamp, easing: out });
    const [before, after] = accent ? title.split(accent) : [title, ""];
    return (
      <>
        <Kicker text={kicker} at={0} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 780, fontSize: 100, letterSpacing: "-0.035em", lineHeight: 1.06, textAlign: "center", opacity: appear(frame, 2) }}>
          {before}
          {accent && (
            <span style={{ position: "relative", whiteSpace: "nowrap" }}>
              <span style={{ position: "absolute", left: -8, right: -8, bottom: 6, height: "42%", background: "#ffd60a", opacity: 0.75, borderRadius: 8, clipPath: `inset(0 ${100 - sweep}% 0 0)`, zIndex: -1 }} />
              {accent}
            </span>
          )}
          {after}
        </div>
      </>
    );
  }
  if (name === "actividad") {
    const value = interpolate(frame, [4, 40], [0, 225.19], { ...clamp, easing: Easing.out(Easing.cubic) });
    return (
      <>
        <Kicker text={kicker} at={0} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 150, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: INK }}>{value.toFixed(2).replace(".", ",")} US$</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 44, color: MUTED, fontWeight: 600, marginTop: 12, opacity: appear(frame, 18) }}>{title}</div>
      </>
    );
  }
  if (name === "tarjetas") {
    // Icono de vista: filas que se convierten en tarjetas.
    const k = interpolate(frame, [10, 30], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, width: 120, marginBottom: 26 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 22 + k * 30, gridColumn: k < 0.5 ? "span 2" : "auto", borderRadius: 8, background: i === 0 ? ACCENT : "#d9d9de" }} />
          ))}
        </div>
        <Words text={title} at={6} size={108} accent={accent} />
      </>
    );
  }
  return (
    <>
      <Kicker text={kicker} at={0} />
      <Words text={title} at={4} size={104} accent={accent} />
    </>
  );
};

export const VerticalTitles: React.FC<{ scenes: Scene[]; copy: VCopy }> = ({ scenes, copy }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {scenes.map((s) => {
        const c = copy[s.name];
        if (!c) return null;
        // Visible mientras la app está en «explicación»; se va con el zoom a pantalla completa.
        const leave = s.camera.findIndex((cam) => cam.layout > 0.02);
        const end = s.first + (leave < 0 ? s.camera.length : leave) + 26;
        const local = frame - s.first;
        const cam = s.camera[Math.max(0, Math.min(s.camera.length - 1, local))];
        const gone = cam ? Math.min(1, cam.layout * 2.2) : 1;
        return (
          <Sequence key={s.name} from={s.first} durationInFrames={Math.max(1, end - s.first)} name={`título ${s.name}`}>
            <AbsoluteFill style={{ opacity: 1 - gone, translate: `0 ${-gone * 60}px` }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: TOP, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 60px 30px" }}>
                <Head name={s.name} kicker={c.kicker} title={c.title} accent={c.accent} />
              </div>
              <div style={{ position: "absolute", top: BOTTOM, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bottom name={s.name} extra={c.extra ?? []} at={16} />
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};
