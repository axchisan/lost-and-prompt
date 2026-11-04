import { Composition, registerRoot } from "remotion";
import { DURATION_S, FPS, Launch } from "./v2/Launch";

// Un formato por red y dispositivo, en español e inglés:
//   16x9  1920×1080  YouTube, LinkedIn, X, web
//   9x16  1080×1920  Reels, TikTok, YouTube Shorts, historias
//   1x1   1080×1080  feed de Instagram, LinkedIn y X
//   4x5   1080×1350  feed de Instagram y LinkedIn (el que más ocupa en el móvil)
export const FORMATS = { "16x9": [1920, 1080], "9x16": [1080, 1920], "1x1": [1080, 1080], "4x5": [1080, 1350] } as const;

const Root: React.FC = () => (
  <>
    {(["es", "en"] as const).flatMap((lang) =>
      Object.entries(FORMATS).map(([format, [width, height]]) => (
        <Composition
          key={`${lang}-${format}`}
          id={`launch-${lang}-${format}`}
          component={Launch}
          defaultProps={{ lang }}
          durationInFrames={Math.round(DURATION_S * FPS)}
          fps={FPS}
          width={width}
          height={height}
        />
      )),
    )}
  </>
);

registerRoot(Root);
