import { AbsoluteFill, Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { copy, focus, shots, type Lang } from "./copy";

// Paleta y tipos de la web (site/index.html), sobre fondo oscuro para que resalten las capturas.
const C = {
  bg: "#0b0d12",
  bg2: "#141a2b",
  fg: "#f2f2f4",
  muted: "#a1a1a8",
  accent: "#4c94ff",
  line: "rgba(255,255,255,.1)",
};
const display = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", Inter, system-ui, sans-serif';
const mono = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const FPS = 30;
export const HOOK = 90;
export const BRAND = 90;
export const SCENE = 120;
export const CTA = 165;
export const DURATION = HOOK + BRAND + SCENE * 6 + CTA;

export type PromoProps = { lang: Lang; vertical: boolean };

export const Promo: React.FC<PromoProps> = ({ lang, vertical }) => {
  const t = copy[lang];
  const pictures = shots(lang);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, ${C.bg2} 0%, ${C.bg} 60%)`, color: C.fg, fontFamily: display }}>
      <Sequence durationInFrames={HOOK}>
        <Hook title={t.hook} sub={t.hookSub} vertical={vertical} />
      </Sequence>
      <Sequence from={HOOK} durationInFrames={BRAND}>
        <Brand tagline={t.tagline} vertical={vertical} />
      </Sequence>
      {t.scenes.map((scene, i) => (
        <Sequence key={i} from={HOOK + BRAND + i * SCENE} durationInFrames={SCENE}>
          <Feature
            index={i}
            title={scene.title}
            detail={scene.detail}
            keys={"keys" in scene ? scene.keys : undefined}
            picture={pictures[i]}
            vertical={vertical}
          />
        </Sequence>
      ))}
      <Sequence from={HOOK + BRAND + SCENE * 6}>
        <Cta free={t.free} privacy={t.private} vertical={vertical} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Entrada y salida suaves de una escena: opacidad y un poco de desplazamiento. */
function useFade(duration: number) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { frame, opacity };
}

const folders = ["~/proyectos/tienda", "~/trabajo/api-pagos", "~/blog", "~/scripts", "~/clientes/acme", "~/juegos/plataformas", "~/dotfiles", "~/tmp/prueba"];

const Hook: React.FC<{ title: string; sub: string; vertical: boolean }> = ({ title, sub, vertical }) => {
  const { frame, opacity } = useFade(HOOK);
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center" }}>
      {folders.map((folder, i) => {
        const angle = (i / folders.length) * Math.PI * 2;
        const radius = (vertical ? 0.36 : 0.4) * Math.min(width, height) + (i % 2) * 60;
        const drift = frame * 0.6;
        const x = Math.cos(angle) * (radius + drift) * (vertical ? 0.9 : 1.6);
        const y = Math.sin(angle) * (radius + drift) * (vertical ? 1.5 : 0.8);
        const show = interpolate(frame, [i * 3, i * 3 + 15], [0, 0.55], { extrapolateRight: "clamp" });
        return (
          <div key={folder} style={{ position: "absolute", transform: `translate(${x}px, ${y}px)`, opacity: show, fontFamily: mono, fontSize: vertical ? 30 : 28, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 14px", background: "rgba(255,255,255,.03)" }}>
            {folder}
          </div>
        );
      })}
      <div style={{ textAlign: "center", padding: "0 80px", maxWidth: vertical ? 900 : 1400 }}>
        <div style={{ fontSize: vertical ? 84 : 92, fontWeight: 750, letterSpacing: "-0.03em", lineHeight: 1.05, transform: `scale(${interpolate(frame, [0, HOOK], [0.96, 1.02])})` }}>{title}</div>
        <div style={{ marginTop: 28, fontSize: vertical ? 40 : 38, color: C.muted, opacity: interpolate(frame, [25, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{sub}</div>
      </div>
    </AbsoluteFill>
  );
};

const Brand: React.FC<{ tagline: string; vertical: boolean }> = ({ tagline, vertical }) => {
  const { frame, opacity } = useFade(BRAND);
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center", gap: 36, flexDirection: "column", textAlign: "center", padding: "0 80px" }}>
      <Img src={staticFile("icon.png")} style={{ width: vertical ? 300 : 260, transform: `scale(${pop})`, filter: "drop-shadow(0 30px 60px rgba(30,90,220,.45))" }} />
      <div style={{ fontSize: vertical ? 110 : 120, fontWeight: 750, letterSpacing: "-0.03em" }}>Lost &amp; Prompt</div>
      <div style={{ fontSize: vertical ? 44 : 44, color: C.muted, maxWidth: 1200, opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{tagline}</div>
    </AbsoluteFill>
  );
};

const Feature: React.FC<{ index: number; title: string; detail: string; keys?: string; picture: string; vertical: boolean }> = ({ index, title, detail, keys, picture, vertical }) => {
  const { frame, opacity } = useFade(SCENE);
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const f = focus[index];
  // Acercamiento lento hacia la parte que importa de la captura.
  const zoom = interpolate(frame, [10, SCENE], [1, f.zoom], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const shotWidth = vertical ? 1000 : 1320;
  const text = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: vertical ? 940 : 470, textAlign: vertical ? "center" : "left", alignItems: vertical ? "center" : "flex-start", transform: `translateY(${(1 - enter) * 30}px)` }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.accent, letterSpacing: ".12em" }}>{String(index + 1).padStart(2, "0")}</div>
      <div style={{ fontSize: vertical ? 76 : 64, fontWeight: 750, lineHeight: 1.08, letterSpacing: "-0.025em" }}>{title}</div>
      <div style={{ fontSize: vertical ? 40 : 32, color: C.muted, lineHeight: 1.35 }}>{detail}</div>
      {keys && (
        <div style={{ marginTop: 8, fontSize: vertical ? 38 : 30, fontWeight: 650, fontFamily: display, padding: "8px 18px", borderRadius: 12, border: `1px solid ${C.line}`, borderBottomWidth: 3, background: "rgba(255,255,255,.06)" }}>{keys}</div>
      )}
    </div>
  );
  const shot = (
    <div style={{ width: shotWidth, aspectRatio: vertical ? "1000 / 1080" : index === 5 ? "1800 / 1125" : "2812 / 1636", borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08)", transform: `scale(${0.94 + enter * 0.06})` }}>
      <Img src={staticFile(picture)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${f.x * 100}% ${f.y * 100}%`, transform: `scale(${zoom})`, transformOrigin: `${f.x * 100}% ${f.y * 100}%` }} />
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center", flexDirection: vertical ? "column" : "row", gap: vertical ? 80 : 70, padding: vertical ? "120px 40px" : "0 70px" }}>
      {text}
      {shot}
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ free: string; privacy: string; vertical: boolean }> = ({ free, privacy, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14 } });
  const appear = (start: number) => interpolate(frame, [start, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: appear(0), alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30, textAlign: "center", padding: "0 60px" }}>
      <Img src={staticFile("icon.png")} style={{ width: vertical ? 240 : 200, transform: `scale(${pop})`, filter: "drop-shadow(0 30px 60px rgba(30,90,220,.45))" }} />
      <div style={{ fontSize: vertical ? 96 : 100, fontWeight: 750, letterSpacing: "-0.03em" }}>Lost &amp; Prompt</div>
      <div style={{ fontSize: vertical ? 44 : 42, color: C.muted, opacity: appear(10) }}>
        {free} · {privacy}
      </div>
      <div style={{ opacity: appear(25), fontSize: vertical ? 54 : 56, fontWeight: 700, color: "#fff", background: "#0a6cff", padding: "18px 40px", borderRadius: 20, boxShadow: "0 14px 40px rgba(10,108,255,.4)" }}>
        lostandprompt.axchisan.com
      </div>
      <div style={{ opacity: appear(40), fontFamily: mono, fontSize: vertical ? 30 : 30, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 22px", background: "rgba(255,255,255,.04)" }}>
        brew install --cask axchisan/tap/lost-and-prompt
      </div>
      <div style={{ opacity: appear(50), fontSize: vertical ? 34 : 30, color: C.muted }}>macOS · Windows · Linux</div>
    </AbsoluteFill>
  );
};
