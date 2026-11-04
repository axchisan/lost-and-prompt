import { Audio } from "@remotion/media";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { cursorAt, viewAt, type ClipData } from "./camera";
import { CLIPS } from "./clips";

type Props = {
  name: keyof typeof CLIPS["es"];
  lang: "es" | "en";
  /** Segundo de la toma donde empieza la escena. */
  start: number;
  /** Velocidad de reproducción (1 = tiempo real). */
  rate?: number;
  /** Acercamiento extra sobre el encuadre automático. */
  zoom?: number;
  /** Escala de volumen de los sonidos de interfaz. */
  sfx?: number;
};

/** Una toma grabada de la app, a pantalla completa, con cámara, cursor y sonidos sincronizados. */
export const Clip: React.FC<Props> = ({ name, lang, start, rate = 1, zoom = 1, sfx = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const data = CLIPS[lang][name] as ClipData;
  const t = start + (frame / fps) * rate;
  const aspect = width / height;
  const v = viewAt(data.events, t, aspect, { zoom });

  // La toma ocupa todo el cuadro: se escala para que el encuadre `v` llene la salida.
  const videoW = width / v.w;
  const videoH = height / v.h;
  const toScreen = (p: { x: number; y: number }) => ({ x: (p.x - v.x) * videoW, y: (p.y - v.y) * videoH });

  const cursor = toScreen(cursorAt(data.events, t));
  const lastClick = [...data.events].reverse().find((e) => e.type === "click" && e.t <= t);
  const sinceClick = lastClick ? t - lastClick.t : 99;
  const press = interpolate(sinceClick, [0, 0.08, 0.22], [0.82, 0.82, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ring = interpolate(sinceClick, [0, 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorSize = 26 * (videoH / 810) * 0.9;
  const showCursor = data.events.some((e) => e.type === "move" && e.t <= t + 0.3);

  // Sonidos: cada evento de la toma que cae dentro de la escena, en su fotograma exacto.
  const sounds = data.events.flatMap((e, i) => {
    const at = Math.round(((e.t - start) / rate) * fps);
    if (at < 0 || at >= durationInFrames) return [];
    const kind = e.type === "click" ? "click" : e.type === "key" ? "key" : e.type === "shortcut" ? "menu" : null;
    if (!kind) return [];
    const vol = { click: 0.55, key: 0.22, menu: 0.35 }[kind] * sfx;
    return [
      <Sequence key={i} from={at} durationInFrames={Math.round(fps * 0.6)} layout="none">
        <Audio src={staticFile(`sfx/${kind}.wav`)} volume={vol} />
      </Sequence>,
    ];
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#fff" }}>
      <OffthreadVideo
        src={staticFile(`clips/${lang}/${name}.mp4`)}
        startFrom={Math.round(start * 60)}
        playbackRate={rate}
        muted
        style={{ position: "absolute", width: videoW, height: videoH, left: -v.x * videoW, top: -v.y * videoH, maxWidth: "none" }}
      />
      {lastClick && ring < 1 && (
        <div
          style={{
            position: "absolute",
            left: toScreen(lastClick.type === "click" ? lastClick.at : { x: 0, y: 0 }).x,
            top: toScreen(lastClick.type === "click" ? lastClick.at : { x: 0, y: 0 }).y,
            width: cursorSize * 3.2,
            height: cursorSize * 3.2,
            marginLeft: (-cursorSize * 3.2) / 2,
            marginTop: (-cursorSize * 3.2) / 2,
            borderRadius: "50%",
            border: `${Math.max(2, cursorSize * 0.12)}px solid rgba(10,108,255,${0.55 * (1 - ring)})`,
            background: `rgba(10,108,255,${0.12 * (1 - ring)})`,
            scale: String(0.3 + ring * 0.9),
          }}
        />
      )}
      {showCursor && (
        <svg
          width={cursorSize}
          height={cursorSize * 1.45}
          viewBox="0 0 20 29"
          style={{ position: "absolute", left: cursor.x - cursorSize * 0.12, top: cursor.y - cursorSize * 0.08, scale: String(press), transformOrigin: "10% 5%", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.35))" }}
        >
          <path d="M1.5 1.5 L1.5 23 L7 18 L10.6 26.5 L14.3 24.9 L10.8 16.7 L18 16.7 Z" fill="#111" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )}
      {sounds}
    </AbsoluteFill>
  );
};
