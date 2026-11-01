import { createContext, useContext } from "react";
import type { Collection, EditorInfo, Library, Message, Session, TerminalInfo, Tint } from "./api";
import type { Language, T } from "./i18n";

export type SidebarItem =
  | { kind: "recents" }
  | { kind: "favorites" }
  | { kind: "activity" }
  | { kind: "archived" }
  | { kind: "collection"; id: string }
  | { kind: "folder"; path: string };

export interface Prefs {
  terminal: string;
  customTerminal: string;
  /** Editor para «Abrir en …»; vacío = el primero instalado. */
  editor: string;
  extraArguments: string;
  listStyle: "rows" | "cards";
  theme: "system" | "light" | "dark";
  language: "system" | Language;
  hideEmpty: boolean;
  didShowWelcome: boolean;
  showInTray: boolean;
  includeWsl: boolean;
  autoUpdate: boolean;
  /** Carpetas donde se abrió una sesión nueva desde la app (para Ctrl+N), la más reciente primero. */
  recentFolders: { cwd: string; environment: string | null; at: string }[];
}

export const defaultPrefs: Prefs = {
  terminal: "",
  customTerminal: "",
  editor: "",
  extraArguments: "",
  listStyle: "rows",
  theme: "system",
  language: "system",
  hideEmpty: true,
  didShowWelcome: false,
  showInTray: true,
  includeWsl: true,
  autoUpdate: true,
  recentFolders: [],
};

/** Una carpeta donde abrir algo: la de una sesión o una de la barra lateral. */
export interface Place {
  cwd: string;
  /** Distribución de WSL, si la carpeta está ahí. */
  environment: string | null;
}

/** Menú contextual de una sesión o de una carpeta de la barra lateral. */
export type MenuState = { x: number; y: number } & ({ session: Session; folder?: undefined } | { folder: Place; session?: undefined });

/** Filtros de la lista; no se guardan, al abrir la app se ve todo. */
export interface ListFilter {
  period: "all" | "today" | "week" | "month" | "quarter";
  favoritesOnly: boolean;
  branch: string | null;
}

export const noFilter: ListFilter = { period: "all", favoritesOnly: false, branch: null };

/** Buscar dentro de la conversación abierta (Ctrl+F). */
export interface FindState {
  open: boolean;
  query: string;
  /** Coincidencia actual, desde 0. */
  index: number;
  total: number;
}

export interface AppContext {
  t: T;
  language: Language;
  library: Library;
  prefs: Prefs;
  setPrefs: (change: Partial<Prefs>) => void;
  terminals: TerminalInfo[];
  terminalName: string;
  editors: EditorInfo[];
  /** Editor elegido, o null si no hay ninguno conocido instalado. */
  editor: EditorInfo | null;
  find: FindState;
  filter: ListFilter;
  setFilter: (change: Partial<ListFilter>) => void;
  /** Ramas de git de las sesiones, de la más usada a la menos. */
  branches: string[];
  showThinking: boolean;
  setShowThinking: (value: boolean) => void;
  setFind: (change: Partial<FindState>) => void;
  moveFind: (step: number) => void;
  modKey: string;
  sidebar: SidebarItem;
  setSidebar: (item: SidebarItem) => void;
  selected: Session | null;
  select: (id: string | null) => void;
  search: string;
  setSearch: (value: string) => void;
  contentHits: Record<string, string>;
  visible: Session[];
  indexProgress: { done: number; total: number } | null;
  messages: Record<string, Message[]>;
  loadMessages: (session: Session) => void;
  collection: (id: string) => Collection | undefined;
  actions: {
    resume: (session: Session) => void;
    copyCommand: (session: Session) => void;
    copyId: (session: Session) => void;
    reveal: (session: Session) => void;
    newSession: (place: Place) => void;
    openInEditor: (place: Place) => void;
    toggleFavorite: (session: Session) => void;
    toggleArchive: (session: Session) => void;
    toggleMembership: (session: Session, collection: string) => void;
    rename: (session: Session, title: string) => void;
    setNote: (session: Session, text: string) => void;
    createCollection: (name: string, tint: Tint) => void;
    deleteCollection: (id: string) => void;
    applyRetention: (days: number) => void;
    reload: () => void;
    chooseFolder: (session: Session) => void;
    checkForUpdates: (manual: boolean) => void;
  };
  open: {
    rename: (session: Session) => void;
    note: (session: Session) => void;
    newCollection: () => void;
    settings: (pane?: "general" | "history" | "appearance") => void;
    quick: () => void;
    newSession: () => void;
    menu: (state: MenuState) => void;
    confirm: (message: string, confirmLabel: string, action: () => void) => void;
    about: () => void;
  };
}

export const Ctx = createContext<AppContext | null>(null);

export function useApp(): AppContext {
  const context = useContext(Ctx);
  if (!context) throw new Error("useApp fuera de la app");
  return context;
}

export function resumeCommand(session: Session, extraArguments: string) {
  const extra = extraArguments.trim();
  const quoted = session.cwd.includes("'") ? `"${session.cwd}"` : `'${session.cwd}'`;
  return `cd ${quoted} && claude --resume ${session.id}${extra ? " " + extra : ""}`;
}
