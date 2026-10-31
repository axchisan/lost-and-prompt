import { invoke } from "@tauri-apps/api/core";

export type Tint = "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "indigo" | "purple" | "gray";

export interface Session {
  id: string;
  title: string;
  aiTitle: string;
  customTitle: string | null;
  cwd: string;
  folderName: string;
  abbreviatedPath: string;
  isHome: boolean;
  /** Distribución de WSL, si la sesión viene de ahí. */
  environment: string | null;
  gitBranch: string | null;
  startedAt: string;
  lastActivity: string;
  userMessages: number;
  totalMessages: number;
  costUsd: number | null;
  model: string;
  isFavorite: boolean;
  collectionIds: string[];
  firstPrompt: string;
  lastReply: string | null;
  folderExists: boolean;
  note: string | null;
}

export interface Collection {
  id: string;
  name: string;
  tint: Tint;
}

export interface Library {
  sessions: Session[];
  collections: Collection[];
  retentionDays: number | null;
  claudeFolderExists: boolean;
  platform: "windows" | "linux" | "macos" | string;
  home: string;
}

export interface Message {
  role: "user" | "assistant";
  date: string | null;
  text: string;
  toolCount: number;
}

export interface Hit {
  sessionId: string;
  snippet: string;
}

export interface TerminalInfo {
  id: string;
  name: string;
  installed: boolean;
}

export const api = {
  loadLibrary: (includeWsl: boolean) => invoke<Library>("load_library", { includeWsl }),
  messages: (id: string) => invoke<Message[]>("get_messages", { id }),
  search: (query: string, limit?: number) => invoke<Hit[]>("search", { query, limit }),
  toggleFavorite: (id: string) => invoke<boolean>("toggle_favorite", { id }),
  rename: (id: string, title: string, original: string) => invoke<void>("rename_session", { id, title, original }),
  setNote: (id: string, text: string) => invoke<void>("set_note", { id, text }),
  createCollection: (name: string, tint: Tint) => invoke<Collection>("create_collection", { name, tint }),
  deleteCollection: (id: string) => invoke<void>("delete_collection", { id }),
  toggleMembership: (id: string, collection: string) => invoke<boolean>("toggle_membership", { id, collection }),
  setRetention: (days: number) => invoke<number | null>("set_retention", { days }),
  terminals: () => invoke<TerminalInfo[]>("terminals"),
  resume: (id: string, terminal: string, extraArguments: string, customTemplate: string) =>
    invoke<void>("resume", { id, terminal, extraArguments, customTemplate }),
  reveal: (id: string) => invoke<void>("reveal", { id }),
  relocate: (id: string, newCwd: string) => invoke<void>("relocate", { id, newCwd }),
  updateTray: (content: TrayContent) => invoke<void>("update_tray", { content }),
  autostartEnabled: () => invoke<boolean>("autostart_enabled"),
  setAutostart: (enabled: boolean) => invoke<void>("set_autostart", { enabled }),
  installKind: () => invoke<"nsis" | "appimage" | "package" | "dev">("install_kind"),
  openLogs: () => invoke<void>("open_logs"),
};

export interface TrayContent {
  enabled: boolean;
  recentTitle: string;
  search: string;
  open: string;
  quit: string;
  recent: { id: string; title: string }[];
}

export const links = {
  repository: "https://github.com/axchisan/lost-and-prompt",
  releases: "https://github.com/axchisan/lost-and-prompt/releases",
  issues: "https://github.com/axchisan/lost-and-prompt/issues/new",
  license: "https://github.com/axchisan/lost-and-prompt/blob/main/LICENSE",
};

export const tints: Record<Tint, string> = {
  red: "#ff3b30",
  orange: "#ff9500",
  yellow: "#ffcc00",
  green: "#34c759",
  teal: "#30b0c7",
  blue: "#007aff",
  indigo: "#5856d6",
  purple: "#af52de",
  gray: "#8e8e93",
};
