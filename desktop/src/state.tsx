import { createContext, useContext } from "react";
import type { Collection, Library, Message, Session, TerminalInfo, Tint } from "./api";
import type { Language, T } from "./i18n";

export type SidebarItem =
  | { kind: "recents" }
  | { kind: "favorites" }
  | { kind: "activity" }
  | { kind: "collection"; id: string }
  | { kind: "folder"; path: string };

export interface Prefs {
  terminal: string;
  customTerminal: string;
  extraArguments: string;
  listStyle: "rows" | "cards";
  theme: "system" | "light" | "dark";
  language: "system" | Language;
  hideEmpty: boolean;
  didShowWelcome: boolean;
  showInTray: boolean;
  includeWsl: boolean;
  autoUpdate: boolean;
}

export const defaultPrefs: Prefs = {
  terminal: "",
  customTerminal: "",
  extraArguments: "",
  listStyle: "rows",
  theme: "system",
  language: "system",
  hideEmpty: true,
  didShowWelcome: false,
  showInTray: true,
  includeWsl: true,
  autoUpdate: true,
};

export interface MenuState {
  x: number;
  y: number;
  session: Session;
}

export interface AppContext {
  t: T;
  language: Language;
  library: Library;
  prefs: Prefs;
  setPrefs: (change: Partial<Prefs>) => void;
  terminals: TerminalInfo[];
  terminalName: string;
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
    toggleFavorite: (session: Session) => void;
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
