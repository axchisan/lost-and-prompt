import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Archive, ArchiveRestore, Check, CodeXml, Copy, FolderMinus, House, Trash2, Folder, Layers, Lock, MessageSquarePlus, Pencil, Search, SquareTerminal, Star, StickyNote } from "lucide-react";
import { links, tints, type Collection, type Session, type Tint } from "../api";
import { useApp, type CollectionTarget, type MenuState } from "../state";
import { shortEditorName } from "./Detail";
// Sin la sombra incrustada del icono del sistema, que dentro de un diálogo se veía como un cuadrado.
import icon from "../assets/app-icon.png";

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function RenameSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const { t, actions } = useApp();
  const [title, setTitle] = useState(session.customTitle ?? session.aiTitle);
  const save = () => {
    actions.rename(session, title);
    onClose();
  };
  return (
    <Sheet title={t("renameSession")} onClose={onClose}>
      <input className="field" autoFocus value={title} placeholder={session.aiTitle} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
      <p>{t("renameHint")}</p>
      <div className="buttons">
        <button className="btn" onClick={onClose}>
          {t("cancel")}
        </button>
        <button className="btn primary" onClick={save}>
          {t("save")}
        </button>
      </div>
    </Sheet>
  );
}

export function NoteSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const { t, actions } = useApp();
  const [text, setText] = useState(session.note ?? "");
  return (
    <Sheet title={t("note")} onClose={onClose}>
      <p>{session.title}</p>
      <textarea className="field" autoFocus value={text} onChange={(e) => setText(e.target.value)} />
      <p>{t("noteHint")}</p>
      <div className="buttons">
        {session.note && (
          <button className="btn left" onClick={() => (actions.setNote(session, ""), onClose())}>
            {t("deleteNote")}
          </button>
        )}
        <button className="btn" onClick={onClose}>
          {t("cancel")}
        </button>
        <button className="btn primary" onClick={() => (actions.setNote(session, text), onClose())}>
          {t("save")}
        </button>
      </div>
    </Sheet>
  );
}

/** Crear una colección (con la sesión o carpeta desde la que se pidió) o editar nombre y color. */
export function CollectionSheet({ editing, target, onClose }: { editing?: Collection; target?: CollectionTarget; onClose: () => void }) {
  const { t, actions } = useApp();
  const [name, setName] = useState(editing?.name ?? "");
  const [tint, setTint] = useState<Tint>(editing?.tint ?? "blue");
  const save = () => {
    if (!name.trim()) return;
    if (editing) actions.updateCollection(editing.id, name.trim(), tint);
    else actions.createCollection(name.trim(), tint, target);
    onClose();
  };
  const hint = target && ("session" in target ? t("collectionIncludesSession", { title: target.session.title }) : t("collectionIncludesFolder", { folder: target.folder }));
  return (
    <Sheet title={editing ? t("editCollection") : t("newCollection")} onClose={onClose}>
      {!editing && hint && <p>{hint}</p>}
      <input className="field" autoFocus value={name} placeholder={t("collectionPlaceholder")} aria-label={t("collectionPlaceholder")} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
      <div className="swatches" role="radiogroup" aria-label={t("color")}>
        {(Object.keys(tints) as Tint[]).map((value) => (
          <button key={value} role="radio" aria-checked={tint === value} className={`swatch${tint === value ? " on" : ""}`} style={{ background: tints[value] }} onClick={() => setTint(value)} aria-label={value} />
        ))}
      </div>
      <div className="buttons">
        <button className="btn" onClick={onClose}>
          {t("cancel")}
        </button>
        <button className="btn primary" onClick={save} disabled={!name.trim()}>
          {editing ? t("save") : t("create")}
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Ctrl+N: abre una sesión nueva de Claude Code en cualquier carpeta. Primero las carpetas con sesiones
 * y las usadas antes, la más reciente arriba; «Elegir otra carpeta…» abre cualquiera.
 */
export function NewSessionSheet({ onClose }: { onClose: () => void }) {
  const { t, library, prefs, actions, terminalName } = useApp();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const folders = useMemo(() => {
    const byKey = new Map<string, { cwd: string; environment: string | null; name: string; path: string; count: number; last: string }>();
    for (const s of library.sessions) {
      if (s.isArchived || !s.folderExists) continue;
      const key = `${s.environment ?? ""}|${s.cwd}`;
      const entry = byKey.get(key);
      if (entry) {
        entry.count++;
        if (s.lastActivity > entry.last) entry.last = s.lastActivity;
      } else {
        byKey.set(key, { cwd: s.cwd, environment: s.environment, name: s.isHome ? t("home") : s.folderName, path: s.abbreviatedPath, count: 1, last: s.lastActivity });
      }
    }
    for (const f of prefs.recentFolders) {
      const key = `${f.environment ?? ""}|${f.cwd}`;
      const entry = byKey.get(key);
      if (entry) {
        if (f.at > entry.last) entry.last = f.at;
      } else {
        const name = f.cwd.split(/[\\/]/).filter(Boolean).pop() ?? f.cwd;
        byKey.set(key, { cwd: f.cwd, environment: f.environment, name, path: f.cwd, count: 0, last: f.at });
      }
    }
    const text = query.trim().toLowerCase();
    return [...byKey.values()]
      .filter((f) => !text || f.cwd.toLowerCase().includes(text) || f.name.toLowerCase().includes(text))
      .sort((a, b) => b.last.localeCompare(a.last));
  }, [library.sessions, prefs.recentFolders, query, t]);
  const current = folders[Math.min(index, folders.length - 1)];
  const open = (folder: { cwd: string; environment: string | null } | undefined) => {
    if (!folder) return;
    actions.newSession(folder);
    onClose();
  };
  const choose = async () => {
    const folder = await openDialog({ directory: true, title: t("chooseNewSessionFolder") });
    if (typeof folder === "string") open({ cwd: folder, environment: null });
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet new-session" role="dialog" aria-label={t("newSessionTitle")} onClick={(e) => e.stopPropagation()}>
        <div>
          <h2>{t("newSessionTitle")}</h2>
          <p>{t("newSessionHint", { terminal: terminalName })}</p>
        </div>
        <input
          className="field"
          autoFocus
          value={query}
          placeholder={t("searchFolder")}
          aria-label={t("searchFolder")}
          aria-controls="new-session-folders"
          aria-activedescendant={current ? `folder-${folders.indexOf(current)}` : undefined}
          onChange={(e) => (setQuery(e.target.value), setIndex(0))}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setIndex((i) => Math.min(i + 1, folders.length - 1)));
            else if (e.key === "ArrowUp") (e.preventDefault(), setIndex((i) => Math.max(i - 1, 0)));
            else if (e.key === "Enter") open(current);
          }}
        />
        <div className="ns-list" id="new-session-folders" role="listbox" aria-label={t("folders")}>
          {folders.length === 0 && <p className="ns-empty">{t("noFolderMatch")}</p>}
          {folders.map((f, i) => (
            <div
              key={`${f.environment ?? ""}|${f.cwd}`}
              id={`folder-${i}`}
              role="option"
              aria-selected={f === current}
              className={`ns-folder${f === current ? " on" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => open(f)}
            >
              {f.path === "~" ? <House size={16} /> : <Folder size={16} />}
              <span className="ns-text">
                <b>{f.name}</b>
                <small>
                  {f.path}
                  {f.environment && <span className="env">WSL · {f.environment}</span>}
                </small>
              </span>
              {f.count > 0 && <small className="ns-count">{f.count === 1 ? t("oneSession") : t("sessions", { n: f.count })}</small>}
            </div>
          ))}
        </div>
        <div className="buttons">
          <button className="btn left" onClick={choose}>
            {t("chooseOtherFolder")}
          </button>
          <button className="btn" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="btn primary" onClick={() => open(current)} disabled={!current}>
            {t("openSession")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ErrorSheet({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useApp();
  return (
    <Sheet title={t("error")} onClose={onClose}>
      <p className="selectable">{message}</p>
      <div className="buttons">
        <button className="btn primary" autoFocus onClick={onClose}>
          {t("ok")}
        </button>
      </div>
    </Sheet>
  );
}

export function ConfirmSheet(props: { message: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  const { t } = useApp();
  return (
    <Sheet title={props.confirmLabel} onClose={props.onClose}>
      <p>{props.message}</p>
      <div className="buttons">
        <button className="btn" onClick={props.onClose}>
          {t("cancel")}
        </button>
        <button className="btn primary" autoFocus onClick={() => (props.onConfirm(), props.onClose())}>
          {props.confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export function Welcome({ onClose }: { onClose: () => void }) {
  const { t, modKey } = useApp();
  const features: [React.ReactNode, string, string][] = [
    [<Search key="s" />, t("welcomeFind"), t("welcomeFindHint", { shortcut: `${modKey}K` })],
    [<SquareTerminal key="r" />, t("welcomeResume"), t("welcomeResumeHint")],
    [<Layers key="o" />, t("welcomeOrganize"), t("welcomeOrganizeHint")],
    [<Lock key="p" />, t("welcomePrivate"), t("welcomePrivateHint")],
  ];
  return (
    <div className="overlay">
      <div className="welcome" role="dialog" aria-label={t("welcomeTitle")}>
        <img src={icon} alt="" />
        <h2>{t("welcomeTitle")}</h2>
        <p>{t("welcomeLead")}</p>
        <div className="features">
          {features.map(([symbol, title, detail]) => (
            <div key={title} className="feature">
              {symbol}
              <div>
                <b>{title}</b>
                <p>{detail}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="btn primary large" autoFocus onClick={onClose} style={{ minWidth: 200, justifyContent: "center" }}>
          {t("getStarted")}
        </button>
      </div>
    </div>
  );
}

/** Menú contextual de una sesión (clic derecho en la lista o en una tarjeta). */
export function ContextMenu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  const { t, terminalName, actions, open, library, editor } = useApp();
  if (state.collection) return <CollectionMenu state={state} collection={state.collection} onClose={onClose} />;
  const run = (action: () => void) => () => {
    action();
    onClose();
  };
  const x = Math.min(state.x, window.innerWidth - 240);
  const y = Math.min(state.y, window.innerHeight - 360);
  if (state.folder) {
    const folder = state.folder;
    return (
      <div className="menu" role="menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
        <button role="menuitem" onClick={run(() => actions.newSession(folder))}>
          <MessageSquarePlus size={14} />
          {t("newSessionHere")}
        </button>
        {editor && (
          <button role="menuitem" onClick={run(() => actions.openInEditor(folder))}>
            <CodeXml size={14} />
            {t("openIn", { editor: shortEditorName(editor.name) })}
          </button>
        )}
        <hr />
        <div className="menu-label">{t("addFolderToCollection")}</div>
        {library.collections.map((c) => {
          const inside = (library.collectionFolders[c.id] ?? []).includes(folder.cwd);
          return (
            <button key={c.id} role="menuitemcheckbox" aria-checked={inside} onClick={run(() => actions.toggleFolder(c.id, folder.cwd))}>
              <span className="check">{inside ? <Check size={14} /> : <span className="dot sm" style={{ background: tints[c.tint] }} />}</span>
              {c.name}
            </button>
          );
        })}
        <button role="menuitem" onClick={run(() => open.newCollection({ folder: folder.cwd }))}>
          <span className="check" />
          {t("newCollection")}…
        </button>
      </div>
    );
  }
  const session = library.sessions.find((s) => s.id === state.session.id) ?? state.session;
  return (
    <div className="menu" role="menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <button role="menuitem" onClick={run(() => actions.resume(session))}>
        <SquareTerminal size={14} />
        {t("resumeIn", { terminal: terminalName })}
      </button>
      <button role="menuitem" onClick={run(() => actions.copyCommand(session))}>
        <Copy size={14} />
        {t("copyCommand")}
      </button>
      <hr />
      <button role="menuitem" onClick={run(() => actions.toggleFavorite(session))}>
        <Star size={14} />
        {session.isFavorite ? t("removeFavorite") : t("addFavorite")}
      </button>
      {library.collections.map((c) => {
        const byFolder = session.folderCollectionIds.includes(c.id) && !session.collectionIds.includes(c.id);
        const inside = session.collectionIds.includes(c.id) || byFolder;
        return (
          <button key={c.id} role="menuitemcheckbox" aria-checked={inside} disabled={byFolder} onClick={run(() => actions.toggleMembership(session, c.id))}>
            <span className="check">{inside ? <Check size={14} /> : <span className="dot sm" style={{ background: tints[c.tint] }} />}</span>
            {byFolder ? t("collectionByFolder", { name: c.name }) : c.name}
          </button>
        );
      })}
      <button role="menuitem" onClick={run(() => open.newCollection({ session }))}>
        <span className="check" />
        {t("newCollection")}…
      </button>
      <button role="menuitem" onClick={run(() => open.rename(session))}>
        <Pencil size={14} />
        {t("rename")}
      </button>
      <button role="menuitem" onClick={run(() => open.note(session))}>
        <StickyNote size={14} />
        {session.note ? t("editNote") : t("addNote")}
      </button>
      <button role="menuitem" onClick={run(() => actions.toggleArchive(session))}>
        {session.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        {session.isArchived ? t("unarchive") : t("archive")}
      </button>
      <hr />
      <button role="menuitem" disabled={!session.folderExists} onClick={run(() => actions.newSession(session))}>
        <MessageSquarePlus size={14} />
        {t("newSessionHere")}
      </button>
      {editor && (
        <button role="menuitem" disabled={!session.folderExists} onClick={run(() => actions.openInEditor(session))}>
          <CodeXml size={14} />
          {t("openIn", { editor: shortEditorName(editor.name) })}
        </button>
      )}
      <button role="menuitem" onClick={run(() => actions.reveal(session))}>
        <Folder size={14} />
        {t("showInFolder")}
      </button>
    </div>
  );
}

/** Menú contextual de una colección: editarla, quitar sus carpetas o eliminarla. */
function CollectionMenu({ state, collection, onClose }: { state: MenuState; collection: Collection; onClose: () => void }) {
  const { t, actions, open, library } = useApp();
  const run = (action: () => void) => () => {
    action();
    onClose();
  };
  const folders = library.collectionFolders[collection.id] ?? [];
  return (
    <div className="menu" role="menu" aria-label={collection.name} style={{ left: Math.min(state.x, window.innerWidth - 260), top: Math.min(state.y, window.innerHeight - 300) }} onClick={(e) => e.stopPropagation()}>
      <button role="menuitem" onClick={run(() => open.editCollection(collection))}>
        <Pencil size={14} />
        {t("editCollection")}…
      </button>
      {folders.length > 0 && (
        <>
          <hr />
          <div className="menu-label">{t("collectionFolders")}</div>
          {folders.map((folder) => (
            <button key={folder} role="menuitem" title={folder} onClick={run(() => actions.toggleFolder(collection.id, folder))}>
              <FolderMinus size={14} />
              {t("removeFolder", { folder: folder.split(/[\\/]/).filter(Boolean).pop() ?? folder })}
            </button>
          ))}
        </>
      )}
      <hr />
      <button role="menuitem" onClick={run(() => open.confirm(t("deleteCollectionConfirm", { name: collection.name }), t("deleteCollection"), () => actions.deleteCollection(collection.id)))}>
        <Trash2 size={14} />
        {t("deleteCollection")}
      </button>
    </div>
  );
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1800);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div className="toast" role="status">
      <Check size={15} />
      {text}
    </div>
  );
}

export function About({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const [version, setVersion] = useState("");
  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(""));
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="about" role="dialog" aria-label={t("aboutApp")} onClick={(e) => e.stopPropagation()}>
        <img src={icon} alt="" />
        <h2>Lost &amp; Prompt</h2>
        <p className="tagline">Every Claude Code session you ever lost, found.</p>
        <p className="selectable">{t("versionN", { v: version })}</p>
        <div className="about-links">
          <button className="btn small" onClick={() => openUrl(links.repository)}>GitHub</button>
          <button className="btn small" onClick={() => openUrl(links.releases)}>{t("checkUpdates")}</button>
          <button className="btn small" onClick={() => openUrl(links.license)}>{t("license")}</button>
        </div>
        <p className="fine">© 2026 axchisan · MIT · {t("notAffiliated")}</p>
        <button className="btn primary" autoFocus onClick={onClose}>{t("ok")}</button>
      </div>
    </div>
  );
}
