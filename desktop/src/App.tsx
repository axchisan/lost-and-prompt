import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, type Library, type Message, type Session, type TerminalInfo, type Tint } from "./api";
import { makeT, systemLanguage, type Language } from "./i18n";
import { Ctx, defaultPrefs, resumeCommand, type AppContext, type MenuState, type Prefs, type SidebarItem } from "./state";
import { Sidebar } from "./components/Sidebar";
import { SessionList, SessionCards } from "./components/SessionList";
import { Detail, NoSelection } from "./components/Detail";
import { Activity } from "./components/Activity";
import { QuickOpen } from "./components/QuickOpen";
import { Settings } from "./components/Settings";
import { ConfirmSheet, ContextMenu, NewCollectionSheet, NoteSheet, RenameSheet, Welcome, ErrorSheet, Toast } from "./components/Dialogs";

type Dialog =
  | { kind: "rename"; session: Session }
  | { kind: "note"; session: Session }
  | { kind: "newCollection" }
  | { kind: "settings"; pane: "general" | "history" | "appearance" }
  | { kind: "quick" }
  | { kind: "error"; message: string }
  | { kind: "confirm"; message: string; confirmLabel: string; action: () => void }
  | null;

function loadPrefs(): Prefs {
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem("prefs") ?? "{}") };
  } catch {
    return defaultPrefs;
  }
}

export default function App() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [sidebar, setSidebar] = useState<SidebarItem>({ kind: "recents" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contentHits, setContentHits] = useState<Record<string, string>>({});
  const [indexProgress, setIndexProgress] = useState<{ done: number; total: number } | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const loadingRef = useRef(false);

  const language: Language = prefs.language === "system" ? systemLanguage() : prefs.language;
  const t = useMemo(() => makeT(language), [language]);

  const setPrefs = useCallback((change: Partial<Prefs>) => {
    setPrefsState((current) => {
      const next = { ...current, ...change };
      try {
        localStorage.setItem("prefs", JSON.stringify(next));
      } catch {
        /* sin almacenamiento: las preferencias duran la sesión */
      }
      return next;
    });
  }, []);

  const showError = useCallback((error: unknown) => setDialog({ kind: "error", message: String(error) }), []);

  const reload = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const next = await api.loadLibrary();
      setLibrary((previous) => {
        // La conversación en caché deja de valer si la sesión cambió.
        if (previous) {
          const before = new Map(previous.sessions.map((s) => [s.id, s.lastActivity]));
          setMessages((cache) => {
            const kept = { ...cache };
            for (const s of next.sessions) if (before.get(s.id) !== s.lastActivity) delete kept[s.id];
            return kept;
          });
        }
        return next;
      });
    } catch (error) {
      showError(error);
    } finally {
      loadingRef.current = false;
    }
  }, [showError]);

  // Carga inicial, terminales disponibles y avisos del backend.
  useEffect(() => {
    reload();
    api.terminals().then(setTerminals).catch(() => setTerminals([]));
    const unlisten = [
      listen("sessions-changed", () => reload()),
      listen<{ done: number; total: number }>("index-progress", (e) =>
        setIndexProgress(e.payload.done < e.payload.total ? e.payload : null),
      ),
      listen("index-finished", () => setIndexProgress(null)),
    ];
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => {
      unlisten.forEach((p) => p.then((off) => off()));
      media.removeEventListener("change", onChange);
    };
  }, [reload]);

  // Tema y plataforma en la raíz del documento.
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.lang = language;
    if (library) document.documentElement.dataset.platform = library.platform;
  }, [dark, language, library]);

  // Búsqueda en las conversaciones, con una pequeña espera entre pulsaciones.
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setContentHits({});
      return;
    }
    const timer = setTimeout(() => {
      api.search(query).then((hits) => setContentHits(Object.fromEntries(hits.map((h) => [h.sessionId, h.snippet])))).catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [search, indexProgress === null]);

  const sessions = library?.sessions ?? [];
  const visible = useMemo(() => {
    let list = sessions;
    if (sidebar.kind === "favorites") list = list.filter((s) => s.isFavorite);
    else if (sidebar.kind === "collection") list = list.filter((s) => s.collectionIds.includes(sidebar.id));
    else if (sidebar.kind === "folder") list = list.filter((s) => s.cwd === sidebar.path || isInside(s.cwd, sidebar.path));
    if (prefs.hideEmpty) list = list.filter((s) => s.userMessages > 0);
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.cwd.toLowerCase().includes(query) ||
          s.firstPrompt.toLowerCase().includes(query) ||
          contentHits[s.id] !== undefined,
      );
    }
    return [...list].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  }, [sessions, sidebar, prefs.hideEmpty, search, contentHits]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  useEffect(() => {
    if (!selectedId && visible.length > 0 && sidebar.kind !== "activity") setSelectedId(visible[0].id);
  }, [visible, selectedId, sidebar.kind]);

  const terminal = terminals.find((x) => x.id === prefs.terminal) ?? terminals[0];

  const updateSession = (id: string, change: Partial<Session>) =>
    setLibrary((lib) => lib && { ...lib, sessions: lib.sessions.map((s) => (s.id === id ? { ...s, ...change } : s)) });

  const actions: AppContext["actions"] = {
    resume: (session) => {
      if (!terminal) return showError(t("noTerminal"));
      api.resume(session.id, terminal.id, prefs.extraArguments).catch(showError);
    },
    copyCommand: (session) => {
      navigator.clipboard.writeText(resumeCommand(session, prefs.extraArguments)).then(() => setToast(t("copied")), showError);
    },
    copyId: (session) => navigator.clipboard.writeText(session.id).catch(showError),
    reveal: (session) => api.reveal(session.id).catch(showError),
    toggleFavorite: (session) =>
      api.toggleFavorite(session.id).then((isFavorite) => updateSession(session.id, { isFavorite }), showError),
    toggleMembership: (session, collection) =>
      api.toggleMembership(session.id, collection).then((inside) => {
        const ids = inside ? [...session.collectionIds, collection] : session.collectionIds.filter((c) => c !== collection);
        updateSession(session.id, { collectionIds: ids });
      }, showError),
    rename: (session, title) =>
      api.rename(session.id, title, session.aiTitle).then(() => {
        const custom = title.trim() && title.trim() !== session.aiTitle ? title.trim() : null;
        updateSession(session.id, { customTitle: custom, title: custom ?? session.aiTitle });
      }, showError),
    setNote: (session, text) =>
      api.setNote(session.id, text).then(() => updateSession(session.id, { note: text.trim() || null }), showError),
    createCollection: (name, tint: Tint) =>
      api.createCollection(name, tint).then((collection) => {
        setLibrary((lib) => lib && { ...lib, collections: [...lib.collections, collection] });
        setSidebar({ kind: "collection", id: collection.id });
      }, showError),
    deleteCollection: (id) =>
      api.deleteCollection(id).then(() => {
        setLibrary(
          (lib) =>
            lib && {
              ...lib,
              collections: lib.collections.filter((c) => c.id !== id),
              sessions: lib.sessions.map((s) => ({ ...s, collectionIds: s.collectionIds.filter((c) => c !== id) })),
            },
        );
        if (sidebar.kind === "collection" && sidebar.id === id) setSidebar({ kind: "recents" });
      }, showError),
    applyRetention: (days) =>
      api.setRetention(days).then((value) => setLibrary((lib) => lib && { ...lib, retentionDays: value }), showError),
    reload,
  };

  const requested = useRef(new Set<string>());
  const loadMessages = useCallback((session: Session) => {
    const key = `${session.id}@${session.lastActivity}`;
    if (requested.current.has(key)) return;
    requested.current.add(key);
    api
      .messages(session.id)
      .then((list) => setMessages((c) => ({ ...c, [session.id]: list })))
      .catch(() => requested.current.delete(key));
  }, []);

  const modKey = library?.platform === "macos" ? "⌘" : "Ctrl+";

  // Atajos de teclado
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = library?.platform === "macos" ? event.metaKey : event.ctrlKey;
      const typing = (event.target as HTMLElement).closest("input, textarea, select");
      if (event.key === "Escape") {
        setMenu(null);
        if (dialog) setDialog(null);
        return;
      }
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDialog((d) => (d?.kind === "quick" ? null : { kind: "quick" }));
      } else if (mod && event.key === ",") {
        event.preventDefault();
        setDialog({ kind: "settings", pane: "general" });
      } else if (mod && event.key.toLowerCase() === "r") {
        event.preventDefault();
        reload();
      } else if (mod && event.key === "1") {
        setPrefs({ listStyle: "rows" });
      } else if (mod && event.key === "2") {
        setPrefs({ listStyle: "cards" });
      } else if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".sidebar .search input")?.focus();
      } else if (!dialog && selected && mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        actions.toggleFavorite(selected);
      } else if (!dialog && !typing && selected && event.key === "Enter") {
        actions.resume(selected);
      } else if (!dialog && !typing && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const index = visible.findIndex((s) => s.id === selectedId);
        const next = visible[Math.max(0, Math.min(visible.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))];
        if (next) setSelectedId(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!library) {
    return (
      <div className="empty" style={{ height: "100%" }}>
        <p>{t("readingSessions")}</p>
      </div>
    );
  }

  const context: AppContext = {
    t,
    language,
    library,
    prefs,
    setPrefs,
    terminals,
    terminalName: terminal?.name ?? "—",
    modKey,
    sidebar,
    setSidebar: (item) => {
      setSidebar(item);
      setSelectedId(null);
    },
    selected,
    select: setSelectedId,
    search,
    setSearch,
    contentHits,
    visible,
    indexProgress,
    messages,
    loadMessages,
    collection: (id) => library.collections.find((c) => c.id === id),
    actions,
    open: {
      rename: (session) => setDialog({ kind: "rename", session }),
      note: (session) => setDialog({ kind: "note", session }),
      newCollection: () => setDialog({ kind: "newCollection" }),
      settings: (pane = "general") => setDialog({ kind: "settings", pane }),
      quick: () => setDialog({ kind: "quick" }),
      menu: setMenu,
      confirm: (message, confirmLabel, action) => setDialog({ kind: "confirm", message, confirmLabel, action }),
    },
  };

  const layout = sidebar.kind === "activity" ? "two" : prefs.listStyle === "cards" ? (selected ? "cards-open" : "two") : "";

  return (
    <Ctx.Provider value={context}>
      <div className={`app ${layout}`} onClick={() => setMenu(null)}>
        <Sidebar />
        {sidebar.kind === "activity" ? (
          <Activity />
        ) : prefs.listStyle === "cards" ? (
          <>
            <SessionCards />
            {selected && <Detail session={selected} />}
          </>
        ) : (
          <>
            <SessionList />
            {selected ? <Detail session={selected} /> : <NoSelection />}
          </>
        )}
      </div>

      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
      {dialog?.kind === "rename" && <RenameSheet session={dialog.session} onClose={() => setDialog(null)} />}
      {dialog?.kind === "note" && <NoteSheet session={dialog.session} onClose={() => setDialog(null)} />}
      {dialog?.kind === "newCollection" && <NewCollectionSheet onClose={() => setDialog(null)} />}
      {dialog?.kind === "settings" && <Settings initialPane={dialog.pane} onClose={() => setDialog(null)} />}
      {dialog?.kind === "quick" && <QuickOpen onClose={() => setDialog(null)} />}
      {dialog?.kind === "error" && <ErrorSheet message={dialog.message} onClose={() => setDialog(null)} />}
      {dialog?.kind === "confirm" && (
        <ConfirmSheet message={dialog.message} confirmLabel={dialog.confirmLabel} onConfirm={dialog.action} onClose={() => setDialog(null)} />
      )}
      {!prefs.didShowWelcome && !dialog && <Welcome onClose={() => setPrefs({ didShowWelcome: true })} />}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </Ctx.Provider>
  );
}

/** `true` si `path` está dentro de `folder` (con `/` o `\`). */
export function isInside(path: string, folder: string) {
  return path.startsWith(folder + "/") || path.startsWith(folder + "\\");
}
