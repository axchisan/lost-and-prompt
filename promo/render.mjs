// Renderiza las cuatro versiones del vídeo en out/. Uso: npm run render [-- promo-es-16x9 …]
import { execFileSync } from "node:child_process";

const all = ["promo-es-16x9", "promo-en-16x9", "promo-es-9x16", "promo-en-9x16"];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;
for (const id of ids) {
  execFileSync("npx", ["remotion", "render", "src/index.tsx", id, `out/${id}.mp4`, "--crf", "18"], { stdio: "inherit" });
}
