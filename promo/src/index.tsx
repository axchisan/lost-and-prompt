import { Composition, registerRoot } from "remotion";
import { Overlay, EDL } from "./v3/Overlay";

// Capa gráfica del vídeo de lanzamiento (transparente), una por idioma y formato. El montaje final
// se hace en Blender (edit/build_blender.py) con la misma EDL.
//   16x9  1920×1080  YouTube, LinkedIn, X, web
//   9x16  1080×1920  Reels, TikTok, YouTube Shorts, historias
//   1x1   1080×1080  feed de Instagram, LinkedIn y X
//   4x5   1080×1350  feed de Instagram y LinkedIn
const Root: React.FC = () => (
  <>
    {Object.entries(EDL).map(([key, edl]) => (
      <Composition
        key={key}
        id={`overlay-${key}`}
        component={Overlay}
        defaultProps={{ edlKey: key }}
        durationInFrames={edl.frames}
        fps={edl.fps}
        width={edl.width}
        height={edl.height}
      />
    ))}
  </>
);

registerRoot(Root);
