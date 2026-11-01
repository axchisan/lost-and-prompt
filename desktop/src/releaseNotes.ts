import type { Language } from "./i18n";

/** Una versión del CHANGELOG, tal como la publica `latest.json` en `history`. */
export interface Release {
  version: string;
  date: string;
  notes: string;
}

const englishHeading = /^###\s+(Added|Changed|Fixed|Removed|Deprecated|Security)\b/;
const spanishHeading = /^###\s+(Añadido|Cambiado|Corregido|Eliminado|Obsoleto|Seguridad)\b/;

/**
 * Las notas de una versión en un idioma. El CHANGELOG trae los dos: con títulos en cada idioma
 * («### Added» / «### Añadido»), o inglés y español separados por `---`; las más antiguas, solo inglés.
 */
export function inLanguage(notes: string, language: Language): string {
  const lines = notes.split("\n");
  const separator = lines.findIndex((line) => line.trim() === "---");
  if (separator >= 0) return (language === "es" ? lines.slice(separator + 1) : lines.slice(0, separator)).join("\n").trim();
  if (!lines.some((line) => spanishHeading.test(line))) return notes.trim();
  const kept: string[] = [];
  let keep = true;
  for (const line of lines) {
    if (englishHeading.test(line)) keep = language === "en";
    else if (spanishHeading.test(line)) keep = language === "es";
    if (keep) kept.push(line);
  }
  return kept.join("\n").trim();
}

/** `true` si la versión `a` es posterior a `b` (x.y.z). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** Lo que trajo cada versión posterior a la instalada, de la más nueva a la más antigua. */
export function releasesSince(history: Release[], current: string, language: Language): Release[] {
  return history
    .filter((release) => !current || isNewer(release.version, current))
    .map((release) => ({ ...release, notes: inLanguage(release.notes, language) }));
}
