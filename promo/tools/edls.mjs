// Genera src/v3/edls.ts con un import por cada EDL de edit/ (Remotion necesita imports estáticos).
import { readdirSync, writeFileSync } from "node:fs";
const files = readdirSync("edit").filter((f) => /^edl-(es|en)-(16x9|9x16|1x1|4x5)\.json$/.test(f)).sort();
const name = (f) => f.replace(/^edl-|\.json$/g, "").replace("-", "_");
writeFileSync(
  "src/v3/edls.ts",
  `// Generado por tools/edls.mjs: una EDL por idioma y formato.\n${files.map((f) => `import ${name(f).replace(/^(\d)/, "_$1")} from "../../edit/${f}";`).join("\n")}\n\nexport const EDLS = {\n${files.map((f) => `  "${f.replace(/^edl-|\.json$/g, "")}": ${name(f)},`).join("\n")}\n};\n`,
);
console.log(`src/v3/edls.ts: ${files.length} EDL`);
