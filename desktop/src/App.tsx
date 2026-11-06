import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { api, type Account, type Collection, type EditorInfo, type Library, type Message, type Session, type TerminalInfo, type Tint } from "./api";
import { makeT, systemLanguage, type Language } from "./i18n";
import { Ctx, defaultPrefs, inCollection, noFilter, resumeCommand, type AppContext, type CollectionTarget, type FindState, type ListFilter, type MenuState, type Prefs, type SidebarItem } from "./state";
import { exportFileName, sessionMarkdown } from "./sessionExport";
import { Sidebar } from "./components/Sidebar";
import { SessionList, SessionCards } from "./components/SessionList";
import { Detail, NoSelection } from "./components/Detail";
import { Activity } from "./components/Activity";
import { QuickOpen } from "./components/QuickOpen";
import { Settings } from "./components/Settings";
import { UpdateSheet } from "./components/Update";
import { Guide, type GuideTab } from "./components/Guide";
import { About, ConfirmSheet, ContextMenu, CollectionSheet, NewSessionSheet, NoteSheet, RenameSheet, Welcome, ErrorSheet, Toast } from "./components/Dialogs";

type Dialog =
  | { kind: "rename"; session: Session }
  | { kind: "note"; session: Session }
  | { kind: "newCollection"; target?: CollectionTarget }
  | { kind: "editCollection"; collection: Collection }
  | { kind: "settings"; pane: "general" | "history" | "appearance" }
  | { kind: "quick" }
  | { kind: "newSession" }
  | { kind: "error"; message: string }
  | { kind: "confirm"; message: string; confirmLabel: string; action: () => void }
  | { kind: "about" }
  | { kind: "update"; update: Update }
  | { kind: "guide"; tab: GuideTab }
  | null;

function loadPrefs(): Prefs {
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem("prefs") ?? "{}") };
  } catch {
    return defaultPrefs;
  }
}

export default function App() {
  const [fullLibrary, setLibrary] = useState<Library | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [editors, setEditors] = useState<EditorInfo[]>([]);
  const [find, setFindState] = useState<FindState>({ open: false, query: "", index: 0, total: 0 });
  const [filter, setFilterState] = useState<ListFilter>(noFilter);
  const [showThinking, setShowThinking] = useState(false);
  const [sidebar, setSidebar] = useState<SidebarItem>({ kind: "recents" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contentHits, setContentHits] = useState<Record<string, string>>({});
  const [indexProgress, setIndexProgress] = useState<{ done: number; total: number } | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  // Versión cuyo aviso ya salió solo: no se repite en cada comprobación, queda el indicador.
  const announcedRef = useRef<string | null>(null);
  const lastCheckRef = useRef(0);
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const loadingRef = useRef(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

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
      const next = await api.loadLibrary(prefsRef.current.includeWsl);
      // La conversación en caché se conserva: si la sesión cambió, el detalle la vuelve a pedir
      // (loadMessages usa la última actividad como clave) y mientras tanto se ve la anterior.
      setLibrary(next);
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
    api.editors().then(setEditors).catch(() => setEditors([]));
    const unlisten = [
      listen("sessions-changed", () => reload()),
      listen<{ done: number; total: number }>("index-progress", (e) =>
        setIndexProgress(e.payload.done < e.payload.total ? e.payload : null),
      ),
      listen("index-finished", () => setIndexProgress(null)),
      listen("quick-open", () => setDialog({ kind: "quick" })),
      listen("new-session", () => setDialog({ kind: "newSession" })),
      listen<string>("tray-resume", (e) => resumeRef.current(e.payload)),
    ];
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => {
      unlisten.forEach((p) => p.then((off) => off()));
      media.removeEventListener("change", onChange);
    };
  }, [reload]);

  const firstWsl = useRef(true);
  useEffect(() => {
    if (firstWsl.current) {
      firstWsl.current = false;
      return;
    }
    reload();
  }, [prefs.includeWsl, reload]);

  // Tema y plataforma en la raíz del documento.
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.lang = language;
    if (fullLibrary) document.documentElement.dataset.platform = fullLibrary.platform;
  }, [dark, language, fullLibrary]);

  // La barra de título nativa sigue el tema elegido; con «Sistema» vuelve al del sistema.
  useEffect(() => {
    getCurrentWindow()
      .setTheme(prefs.theme === "system" ? null : prefs.theme)
      .catch(() => {});
  }, [prefs.theme]);

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

  // Cuentas de Claude Code: con más de una se ve la elegida en la barra lateral (por defecto la
  // principal) o todas a la vez.
  const accounts = useMemo(() => (fullLibrary?.accounts ?? []).filter((a) => !a.hidden), [fullLibrary]);
  const account: Account | null = useMemo(() => {
    if (accounts.length < 2 || prefs.account === "all") return null;
    return accounts.find((a) => a.id === prefs.account) ?? accounts.find((a) => a.isDefault) ?? accounts[0];
  }, [accounts, prefs.account]);
  const library = useMemo(() => {
    if (!fullLibrary || !account) return fullLibrary;
    return { ...fullLibrary, sessions: fullLibrary.sessions.filter((s) => s.account === account.id), retentionDays: account.retentionDays };
  }, [fullLibrary, account]);
  const accountName = useCallback(
    (id: string) => {
      const found = fullLibrary?.accounts.find((a) => a.id === id);
      return found?.name || t("mainAccount");
    },
    [fullLibrary, t],
  );

  const sessions = library?.sessions ?? [];
  const active = useMemo(() => sessions.filter((s) => !s.isArchived), [sessions]);
  const branches = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of active) if (s.gitBranch && s.gitBranch !== "HEAD") counts.set(s.gitBranch, (counts.get(s.gitBranch) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 15).map(([name]) => name);
  }, [active]);
  const visible = useMemo(() => {
    let list = sidebar.kind === "archived" ? sessions.filter((s) => s.isArchived) : active;
    if (sidebar.kind === "favorites") list = list.filter((s) => s.isFavorite);
    else if (sidebar.kind === "collection") list = list.filter((s) => inCollection(s, sidebar.id));
    else if (sidebar.kind === "folder") list = list.filter((s) => s.cwd === sidebar.path || isInside(s.cwd, sidebar.path));
    if (prefs.hideEmpty) list = list.filter((s) => s.userMessages > 0);
    const start = periodStart(filter.period);
    if (start) list = list.filter((s) => new Date(s.lastActivity) >= start);
    if (filter.favoritesOnly) list = list.filter((s) => s.isFavorite);
    if (filter.branch) list = list.filter((s) => s.gitBranch === filter.branch);
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
  }, [sessions, active, sidebar, prefs.hideEmpty, search, contentHits, filter]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const setFind = useCallback((change: Partial<FindState>) => setFindState((f) => ({ ...f, ...change })), []);
  const moveFind = useCallback(
    (step: number) => setFindState((f) => (f.total > 0 ? { ...f, index: (f.index + step + f.total) % f.total } : f)),
    [],
  );
  useEffect(() => setFind({ index: 0 }), [selectedId, setFind]);
  useEffect(() => {
    if (!selectedId && visible.length > 0 && sidebar.kind !== "activity") setSelectedId(visible[0].id);
  }, [visible, selectedId, sidebar.kind]);

  const resumeRef = useRef<(id: string) => void>(() => {});
  const otherAccountConfirmed = useRef(new Set<string>());
  const terminal = terminals.find((x) => x.id === prefs.terminal) ?? terminals.find((x) => x.installed) ?? terminals[0];
  const editor = editors.find((x) => x.id === prefs.editor) ?? editors[0] ?? null;

  const updateSession = (id: string, change: Partial<Session>) =>
    setLibrary((lib) => lib && { ...lib, sessions: lib.sessions.map((s) => (s.id === id ? { ...s, ...change } : s)) });

  const actions: AppContext["actions"] = {
    resume: (session) => {
      if (!terminal) return showError(t("noTerminal"));
      api.resume(session.id, terminal.id, prefs.extraArguments, prefs.customTerminal).catch(showError);
    },
    copyCommand: (session) => {
      navigator.clipboard.writeText(resumeCommand(session, prefs.extraArguments)).then(() => setToast(t("copied")), showError);
    },
    copyId: (session) => navigator.clipboard.writeText(session.id).catch(showError),
    reveal: (session) => api.reveal(session.id).catch(showError),
    newSession: (place) => {
      if (!terminal) return showError(t("noTerminal"));
      const others = prefs.recentFolders.filter((f) => f.cwd !== place.cwd || f.environment !== place.environment);
      setPrefs({ recentFolders: [{ cwd: place.cwd, environment: place.environment, at: new Date().toISOString() }, ...others].slice(0, 12) });
      // Con la cuenta elegida; viendo todas, con la de la última sesión en esa carpeta.
      const latest = sessions
        .filter((s) => s.cwd === place.cwd && s.environment === place.environment)
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))[0];
      const accountId = account?.id ?? latest?.account ?? null;
      api.newSession(place.cwd, place.environment, accountId, terminal.id, prefs.extraArguments, prefs.customTerminal).catch(showError);
    },
    openInEditor: (place) => {
      if (editor) api.openInEditor(editor.id, place.cwd, place.environment).catch(showError);
    },
    toggleFavorite: (session) =>
      api.toggleFavorite(session.id).then((isFavorite) => updateSession(session.id, { isFavorite }), showError),
    toggleArchive: (session) =>
      api.toggleArchive(session.id).then((isArchived) => {
        // Al archivar la elegida, pasa a la siguiente de la lista.
        if (session.id === selectedId) {
          const position = visible.findIndex((s) => s.id === session.id);
          const rest = visible.filter((s) => s.id !== session.id);
          setSelectedId(rest.length ? rest[Math.min(position, rest.length - 1)].id : null);
        }
        updateSession(session.id, { isArchived });
      }, showError),
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
    createCollection: (name, tint: Tint, target) =>
      api.createCollection(name, tint).then(async (collection) => {
        setLibrary((lib) => lib && { ...lib, collections: [...lib.collections, collection] });
        if (target && "session" in target) await api.toggleMembership(target.session.id, collection.id);
        if (target && "folder" in target) await api.toggleFolderMembership(collection.id, target.folder);
        if (target) await reload();
        setSidebar({ kind: "collection", id: collection.id });
      }, showError),
    updateCollection: (id, name, tint) =>
      api.updateCollection(id, name, tint).then(
        () => setLibrary((lib) => lib && { ...lib, collections: lib.collections.map((c) => (c.id === id ? { ...c, name: name.trim(), tint } : c)) }),
        showError,
      ),
    // La pertenencia por carpeta la calcula el núcleo: se vuelve a leer la biblioteca.
    toggleFolder: (collection, folder) => api.toggleFolderMembership(collection, folder).then(() => reload(), showError),
    dropOnCollection: (collection, data) => {
      if (data.startsWith("folder:")) {
        const folder = data.slice("folder:".length);
        if (!(library?.collectionFolders[collection] ?? []).includes(folder)) actions.toggleFolder(collection, folder);
      } else if (data.startsWith("session:")) {
        const session = sessions.find((s) => s.id === data.slice("session:".length));
        if (session && !session.collectionIds.includes(collection)) actions.toggleMembership(session, collection);
      }
    },
    deleteCollection: (id) =>
      api.deleteCollection(id).then(() => {
        setLibrary(
          (lib) =>
            lib && {
              ...lib,
              collections: lib.collections.filter((c) => c.id !== id),
              sessions: lib.sessions.map((s) => ({
                ...s,
                collectionIds: s.collectionIds.filter((c) => c !== id),
                folderCollectionIds: s.folderCollectionIds.filter((c) => c !== id),
              })),
            },
        );
        if (sidebar.kind === "collection" && sidebar.id === id) setSidebar({ kind: "recents" });
      }, showError),
    applyRetention: (days, accountId) =>
      api.setRetention(days, accountId).then(() => reload(), showError),
    setAccount: (id) => {
      setPrefs({ account: id });
      setSidebar({ kind: "recents" });
      setSelectedId(null);
    },
    renameAccount: (id, name) => api.setAccountName(id, name).then(() => reload(), showError),
    setAccountHidden: (id, hidden) => api.setAccountHidden(id, hidden).then(() => reload(), showError),
    addAccount: async () => {
      const dir = await openDialog({ directory: true, title: t("addAccountTitle") });
      if (typeof dir !== "string") return;
      try {
        await api.addAccount(dir);
        await reload();
      } catch (error) {
        showError(error);
      }
    },
    removeAccount: (id) => api.removeAccount(id).then(() => reload(), showError),
    reload,
    chooseFolder: async (session) => {
      const folder = await openDialog({ directory: true, title: t("chooseFolderTitle", { title: session.title }) });
      if (typeof folder !== "string") return;
      try {
        await api.relocate(session.id, folder);
        await reload();
        if (terminal) await api.resume(session.id, terminal.id, prefs.extraArguments, prefs.customTerminal);
      } catch (error) {
        showError(error);
      }
    },
    copyMarkdown: (session) =>
      api
        .messages(session.id)
        .then((messages) => navigator.clipboard.writeText(sessionMarkdown(session, messages, t, language)))
        .then(() => setToast(t("markdownCopied")), showError),
    exportMarkdown: async (session) => {
      if (!session.accountEnv || otherAccountConfirmed.current.has(session.id)) otherAccountConfirmed.current.delete(session.id);
      else {
        // Sesiones de otra cuenta (p. ej. la del trabajo): se avisa antes de sacarlas del equipo.
        return setDialog({
          kind: "confirm",
          message: t("otherAccountExport", { account: accountName(session.account) }),
          confirmLabel: t("exportMarkdown"),
          action: () => {
            otherAccountConfirmed.current.add(session.id);
            actions.exportMarkdown(session);
          },
        });
      }
      try {
        const path = await saveDialog({ defaultPath: exportFileName(session, "md"), filters: [{ name: "Markdown", extensions: ["md"] }] });
        if (!path) return;
        await api.saveText(path, sessionMarkdown(session, await api.messages(session.id), t, language));
        setToast(t("exportedTo", { path }));
      } catch (error) {
        showError(error);
      }
    },
    // El .jsonl tal cual, para que otro lo importe y lo continúe; antes se avisa de lo que contiene.
    exportSession: (session) =>
      setDialog({
        kind: "confirm",
        message: session.accountEnv
          ? `${t("otherAccountExport", { account: accountName(session.account) })}\n\n${t("exportForClaudeWarning")}`
          : t("exportForClaudeWarning"),
        confirmLabel: t("exportForClaudeTitle"),
        action: async () => {
          try {
            const path = await saveDialog({ defaultPath: exportFileName(session, "jsonl"), filters: [{ name: t("sessionFile"), extensions: ["jsonl"] }] });
            if (!path) return;
            await api.exportSession(session.id, path);
            setToast(t("exportedTo", { path }));
          } catch (error) {
            showError(error);
          }
        },
      }),
    importSession: async () => {
      try {
        const file = await openDialog({ title: t("importSession"), filters: [{ name: t("sessionFile"), extensions: ["jsonl"] }] });
        if (typeof file !== "string") return;
        const shared = await api.inspectSessionFile(file);
        if (fullLibrary?.sessions.some((s) => s.id === shared.id)) {
          const existing = fullLibrary.sessions.find((s) => s.id === shared.id);
          if (existing && account && existing.account !== account.id) setPrefs({ account: existing.account });
          setSidebar({ kind: "recents" });
          setSelectedId(shared.id);
          return showError(t("importAlreadyHave"));
        }
        const folder = await openDialog({
          directory: true,
          title: t("importChooseFolder"),
          defaultPath: shared.cwdExists && shared.cwd ? shared.cwd : undefined,
        });
        if (typeof folder !== "string") return;
        const id = await api.importSession(file, folder, account?.id ?? null);
        await reload();
        setSidebar({ kind: "recents" });
        setSelectedId(id);
        setToast(t("imported"));
      } catch (error) {
        showError(error);
      }
    },
    checkForUpdates: async (manual) => {
      lastCheckRef.current = Date.now();
      const how = manual ? "manual" : "automática";
      try {
        const update = await check();
        api.writeLog(`actualizaciones (${how}): ${update ? `hay ${update.version}` : "al día"}`).catch(() => {});
        setPendingUpdate(update);
        if (!update) {
          if (manual) setToast(t("upToDate"));
          return;
        }
        // El aviso automático sale una vez por versión y nunca tapa otro diálogo abierto;
        // el indicador de la barra lateral lo vuelve a abrir cuando se quiera.
        const busy = dialogRef.current && dialogRef.current.kind !== "update";
        if (manual || (!busy && announcedRef.current !== update.version)) {
          announcedRef.current = update.version;
          setDialog({ kind: "update", update });
        }
      } catch (error) {
        api.writeLog(`actualizaciones (${how}): falló la comprobación: ${error}`, true).catch(() => {});
        // Sin conexión con GitHub (DNS, antivirus, proxy…), el error técnico no ayuda: se explica.
        if (manual) showError(`${t("updateCheckFailed")} ${isConnectionError(error) ? t("updateConnectionHint") : ""}\n\n${error}`);
      }
    },
  };
  resumeRef.current = (id) => {
    const session = sessions.find((s) => s.id === id);
    if (session) actions.resume(session);
  };

  // Bandeja del sistema: sesiones recientes y textos en el idioma de la app.
  useEffect(() => {
    if (!library) return;
    const recent = [...library.sessions]
      .filter((s) => s.userMessages > 0 && !s.isArchived)
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
      .slice(0, 8)
      .map((s) => ({ id: s.id, title: s.title }));
    api
      .updateTray({ enabled: prefs.showInTray, recentTitle: t("recents"), search: t("searchEllipsis"), newSession: t("newSessionEllipsis"), open: t("openApp"), quit: t("quit"), recent })
      .catch(() => {});
  }, [library, prefs.showInTray, t]);

  // Actualizaciones: al abrir (con unos segundos de margen), cada pocas horas y al volver a la
  // ventana. En Windows la app vive en la bandeja durante días: abrirla desde el acceso directo
  // solo muestra la ventana que ya existía, así que comprobar al arrancar no basta.
  const checkRef = useRef(actions.checkForUpdates);
  checkRef.current = actions.checkForUpdates;
  useEffect(() => {
    if (!prefs.autoUpdate) return;
    const HOUR = 60 * 60 * 1000;
    const ifStale = () => {
      if (Date.now() - lastCheckRef.current > HOUR) checkRef.current(false);
    };
    const first = setTimeout(() => checkRef.current(false), 5000);
    const every = setInterval(() => checkRef.current(false), 4 * HOUR);
    const shown = listen("window-shown", ifStale);
    const focus = getCurrentWindow()
      .onFocusChanged(({ payload }) => payload && ifStale())
      .catch(() => () => {});
    window.addEventListener("focus", ifStale);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      shown.then((off) => off());
      focus.then((off) => off());
      window.removeEventListener("focus", ifStale);
    };
  }, [prefs.autoUpdate]);

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
        else if (find.open) setFind({ open: false });
        return;
      }
      const findNext = event.key === "F3" || (mod && event.key.toLowerCase() === "g");
      if (!dialog && find.open && findNext) {
        event.preventDefault();
        moveFind(event.shiftKey ? -1 : 1);
        return;
      }
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDialog((d) => (d?.kind === "quick" ? null : { kind: "quick" }));
      } else if (event.key === "F1") {
        event.preventDefault();
        setDialog({ kind: "guide", tab: "guide" });
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
      } else if (mod && event.key.toLowerCase() === "f" && (event.shiftKey || !selected || dialog)) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".sidebar .search input")?.focus();
      } else if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFind({ open: true });
        const input = document.querySelector<HTMLInputElement>(".find-bar input");
        input?.focus();
        input?.select();
      } else if (!dialog && selected && mod && event.altKey && event.key.toLowerCase() === "n" && selected.folderExists) {
        event.preventDefault();
        actions.newSession(selected);
      } else if (!dialog && mod && !event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setDialog({ kind: "newSession" });
      } else if (!dialog && selected && mod && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        actions.toggleArchive(selected);
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
    accounts,
    account,
    accountName,
    prefs,
    setPrefs,
    terminals,
    terminalName: terminal?.id === "custom" ? t("yourTerminal") : (terminal?.name ?? "—"),
    editors,
    editor,
    filter,
    setFilter: (change) => setFilterState((f) => ({ ...f, ...change })),
    branches,
    showThinking,
    setShowThinking,
    find,
    setFind,
    moveFind,
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
      newCollection: (target) => setDialog({ kind: "newCollection", target }),
      editCollection: (collection) => setDialog({ kind: "editCollection", collection }),
      settings: (pane = "general") => setDialog({ kind: "settings", pane }),
      quick: () => setDialog({ kind: "quick" }),
      newSession: () => setDialog({ kind: "newSession" }),
      menu: setMenu,
      confirm: (message, confirmLabel, action) => setDialog({ kind: "confirm", message, confirmLabel, action }),
      about: () => setDialog({ kind: "about" }),
      update: () => pendingUpdate && setDialog({ kind: "update", update: pendingUpdate }),
      guide: (tab = "guide") => setDialog({ kind: "guide", tab }),
    },
    pendingUpdate: pendingUpdate?.version ?? null,
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
      {dialog?.kind === "newCollection" && <CollectionSheet target={dialog.target} onClose={() => setDialog(null)} />}
      {dialog?.kind === "editCollection" && <CollectionSheet editing={dialog.collection} onClose={() => setDialog(null)} />}
      {dialog?.kind === "settings" && <Settings initialPane={dialog.pane} onClose={() => setDialog(null)} />}
      {dialog?.kind === "quick" && <QuickOpen onClose={() => setDialog(null)} />}
      {dialog?.kind === "newSession" && <NewSessionSheet onClose={() => setDialog(null)} />}
      {dialog?.kind === "error" && <ErrorSheet message={dialog.message} onClose={() => setDialog(null)} />}
      {dialog?.kind === "about" && <About onClose={() => setDialog(null)} />}
      {dialog?.kind === "guide" && <Guide initialTab={dialog.tab} onClose={() => setDialog(null)} />}
      {dialog?.kind === "update" && <UpdateSheet update={dialog.update} onClose={() => setDialog(null)} />}
      {dialog?.kind === "confirm" && (
        <ConfirmSheet message={dialog.message} confirmLabel={dialog.confirmLabel} onConfirm={dialog.action} onClose={() => setDialog(null)} />
      )}
      {!prefs.didShowWelcome && !dialog && <Welcome
          onClose={() => setPrefs({ didShowWelcome: true })}
          onGuide={() => {
            setPrefs({ didShowWelcome: true });
            setDialog({ kind: "guide", tab: "guide" });
          }}
        />}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </Ctx.Provider>
  );
}

/** Errores de red del actualizador: no se llegó a hablar con GitHub. */
export function isConnectionError(error: unknown) {
  return /error sending request|dns|timed out|connection|network|certificate|proxy/i.test(String(error));
}

/** Fecha desde la que se muestran sesiones con el filtro de periodo (null = todas). */
function periodStart(period: ListFilter["period"]): Date | null {
  if (period === "all") return null;
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  if (period === "today") return day;
  if (period === "quarter") {
    day.setMonth(day.getMonth() - 3);
    return day;
  }
  day.setDate(day.getDate() - (period === "week" ? 6 : 29));
  return day;
}

/** `true` si `path` está dentro de `folder` (con `/` o `\`). */
export function isInside(path: string, folder: string) {
  return path.startsWith(folder + "/") || path.startsWith(folder + "\\");
}
