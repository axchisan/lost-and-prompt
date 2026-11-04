import { Composition, registerRoot } from "remotion";
import { DURATION, FPS, Promo, type PromoProps } from "./Promo";

// Cuatro versiones: 16:9 (YouTube, LinkedIn, X) y 9:16 (Reels, TikTok, Shorts), en español e inglés.
const versions: { id: string; props: PromoProps; width: number; height: number }[] = [
  { id: "promo-es-16x9", props: { lang: "es", vertical: false }, width: 1920, height: 1080 },
  { id: "promo-en-16x9", props: { lang: "en", vertical: false }, width: 1920, height: 1080 },
  { id: "promo-es-9x16", props: { lang: "es", vertical: true }, width: 1080, height: 1920 },
  { id: "promo-en-9x16", props: { lang: "en", vertical: true }, width: 1080, height: 1920 },
];

const Root: React.FC = () => (
  <>
    {versions.map((v) => (
      <Composition key={v.id} id={v.id} component={Promo} defaultProps={v.props} durationInFrames={DURATION} fps={FPS} width={v.width} height={v.height} />
    ))}
  </>
);

registerRoot(Root);
