// Textos del vídeo en los dos idiomas. Van quemados en la imagen: muchas redes reproducen sin sonido.

export type Lang = "es" | "en";

export const copy = {
  es: {
    hook: "¿Dónde quedó esa sesión de Claude Code?",
    hookSub: "Estaba en alguna carpeta…",
    tagline: "Todas tus sesiones de Claude Code, en un solo lugar.",
    scenes: [
      { title: "Todas tus carpetas, en una ventana", detail: "Recientes, favoritos y cada proyecto, sin abrir la terminal." },
      { title: "Busca en todo lo que dijiste", detail: "Títulos, carpetas y el texto de cada conversación.", keys: "⌘K · Ctrl+K" },
      { title: "Reanuda donde lo dejaste", detail: "Un clic abre la sesión en tu terminal, en su carpeta." },
      { title: "Ordénalas a tu manera", detail: "Favoritos, colecciones, nombres propios y notas." },
      { title: "Mira tu actividad y lo que cuesta", detail: "Mensajes y coste estimado por día y por carpeta." },
      { title: "En macOS, Windows y Linux", detail: "También las sesiones de WSL." },
    ],
    free: "Gratis y de código abierto",
    private: "Todo se queda en tu equipo",
  },
  en: {
    hook: "Where was that Claude Code session?",
    hookSub: "It was in some folder…",
    tagline: "Every Claude Code session you ever lost, found.",
    scenes: [
      { title: "Every folder, one window", detail: "Recents, favorites and every project, no terminal needed." },
      { title: "Search everything you said", detail: "Titles, folders and the text of every conversation.", keys: "⌘K · Ctrl+K" },
      { title: "Pick up where you left off", detail: "One click resumes the session in your terminal, in its folder." },
      { title: "Organize it your way", detail: "Favorites, collections, custom names and notes." },
      { title: "See your activity and costs", detail: "Messages and estimated cost per day and per folder." },
      { title: "On macOS, Windows and Linux", detail: "WSL sessions included." },
    ],
    free: "Free and open source",
    private: "Everything stays on your computer",
  },
} as const;

/** La captura de cada escena (en public/screenshots, copiadas de docs/screenshots). */
export const shots = (lang: Lang) => [
  `screenshots/${lang}/recents-light.png`,
  `screenshots/${lang}/quickopen-dark.png`,
  `screenshots/${lang}/recents-dark.png`,
  `screenshots/${lang}/cards-light.png`,
  `screenshots/${lang}/activity-light.png`,
  `screenshots/windows/${lang}/recents-dark.png`,
];

/** Hacia dónde se acerca la cámara en cada captura (0–1 del ancho y alto), y cuánto. */
export const focus: { x: number; y: number; zoom: number }[] = [
  { x: 0.3, y: 0.35, zoom: 1.12 },
  { x: 0.5, y: 0.3, zoom: 1.3 },
  { x: 0.62, y: 0.2, zoom: 1.45 },
  { x: 0.55, y: 0.45, zoom: 1.12 },
  { x: 0.6, y: 0.35, zoom: 1.15 },
  { x: 0.4, y: 0.4, zoom: 1.1 },
];
