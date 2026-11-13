import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderInput, FolderSync, Archive, ArchiveRestore, Check, ClipboardCopy, CodeXml, Copy, FileDown, Share, FolderMinus, House, Trash2, Folder, Layers, Lock, MessageSquarePlus, Pencil, Search, SquareTerminal, Star, StickyNote } from "lucide-react";
import { api, links, tints, type Collection, type DeletePreview, type RepairPreview, type Session, type SharedSession, type Tint } from "../api";
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

/** Tamaño legible: «3,2 MB». */
function bytes(n: number, language: string) {
  const units = ["B", "KB", "MB", "GB"];
  let value = n;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value.toLocaleString(language, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

/** Eliminar sesiones: enseña antes todo lo que se quita de Claude Code y cuánto ocupa. */
export function DeleteSheet(props: {
  sessions: Session[];
  onClose: () => void;
  onDeleted: (ids: string[], permanent: boolean) => void;
  onError: (error: unknown) => void;
}) {
  const { t, language } = useApp();
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [permanent, setPermanent] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = props.sessions.map((s) => s.id);
  useEffect(() => {
    api.previewDelete(props.sessions.map((s) => s.id)).then(setPreview, props.onError);
  }, []);
  const title =
    props.sessions.length === 1 ? t("deleteOneTitle", { title: props.sessions[0].title }) : t("deleteManyTitle", { n: props.sessions.length });
  const blocked = preview ? [...preview.inUse, ...preview.unsupported] : [];
  const run = async () => {
    setBusy(true);
    try {
      const deleted = await api.deleteSessions(ids.filter((id) => !blocked.includes(id)), permanent);
      props.onClose();
      props.onDeleted(deleted, permanent);
    } catch (error) {
      props.onClose();
      props.onError(error);
    }
  };
  return (
    <Sheet title={title} onClose={props.onClose}>
      {!preview ? (
        <p>{t("deleteChecking")}</p>
      ) : (
        <>
          <p>{t("deleteLead")}</p>
          <ul className="delete-list">
            {preview.kinds.map((k) => (
              <li key={k.kind}>
                <span>{t(`deleteKind_${k.kind}`)}</span>
                <span className="hint">{bytes(k.bytes, language)}</span>
              </li>
            ))}
            {preview.historyLines > 0 && (
              <li>
                <span>{t("deleteHistory", { n: preview.historyLines })}</span>
              </li>
            )}
            <li>
              <span>{t("deleteOrganization")}</span>
            </li>
          </ul>
          {preview.inUse.length > 0 && <p className="warning">{t("deleteInUse", { n: preview.inUse.length })}</p>}
          {preview.unsupported.length > 0 && <p className="warning">{t("deleteWsl", { n: preview.unsupported.length })}</p>}
          <label className="check-row">
            <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
            <span>
              {t("deletePermanent")}
              <span className="hint" style={{ display: "block" }}>{permanent ? t("deletePermanentHint") : t("deleteTrashHint")}</span>
            </span>
          </label>
        </>
      )}
      <div className="buttons">
        <button className="btn" onClick={props.onClose}>
          {t("cancel")}
        </button>
        <button className="btn destructive" disabled={!preview || preview.sessions === 0 || busy} onClick={run}>
          {preview ? t(permanent ? "deletePermanentButton" : "deleteButton", { size: bytes(preview.totalBytes, language) }) : t("deleteButtonPlain")}
        </button>
      </div>
    </Sheet>
  );
}

/** Reparar una carpeta movida: enseña antes qué carpetas de proyecto, ajustes e historial cambian. */
export function RepairSheet(props: {
  from: string;
  to: string;
  /** Mover la carpeta en el disco además de reparar. */
  moving: boolean;
  onClose: () => void;
  onRepaired: () => void;
  onError: (error: unknown) => void;
}) {
  const { t, accountName, accounts } = useApp();
  const [preview, setPreview] = useState<RepairPreview | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.previewRepair(props.from, props.to, props.moving).then(setPreview, props.onError);
  }, []);
  const same = props.from.replace(/[\\/]+$/, "") === props.to.replace(/[\\/]+$/, "");
  const run = async () => {
    setBusy(true);
    try {
      await (props.moving ? api.moveFolder(props.from, props.to) : api.repairFolder(props.from, props.to));
      props.onClose();
      props.onRepaired();
    } catch (error) {
      props.onClose();
      props.onError(error);
    }
  };
  const empty = !preview || (!props.moving && preview.folders.length === 0 && preview.historyLines === 0 && preview.settings === 0);
  const blocked = preview?.moveCheck?.error ?? null;
  return (
    <Sheet title={t(props.moving ? "moveTitle" : "repairTitle")} onClose={props.onClose}>
      <p>
        <code className="selectable">{props.from}</code> → <code className="selectable">{props.to}</code>
      </p>
      {!preview ? (
        <p>{t("deleteChecking")}</p>
      ) : same || empty ? (
        <p>{t("repairNothing")}</p>
      ) : (
        <>
          <p>{t(props.moving ? "moveLead" : "repairLead")}</p>
          <ul className="delete-list">
            {preview.folders.map((f) => (
              <li key={`${f.account}|${f.fromCwd}`}>
                <span className="selectable">
                  {f.toCwd}
                  {accounts.length > 1 && <span className="env">{accountName(f.account)}</span>}
                  {f.merge && <span className="hint"> · {t("repairMerge")}</span>}
                  {f.hasMemory && <span className="hint"> · {t("repairMemory")}</span>}
                </span>
                <span className="hint">{f.sessions === 1 ? t("oneSession") : t("sessions", { n: f.sessions })}</span>
              </li>
            ))}
            {preview.settings > 0 && (
              <li>
                <span>{t("repairSettings", { n: preview.settings })}</span>
              </li>
            )}
            {preview.historyLines > 0 && (
              <li>
                <span>{t("repairHistory", { n: preview.historyLines })}</span>
              </li>
            )}
          </ul>
          <p className="hint">{t(props.moving ? "moveBackup" : "repairBackup")}</p>
          {!props.moving && preview.targetMissing && <p className="warning">{t("repairTargetMissing")}</p>}
          {blocked && <p className="warning">{blocked}</p>}
          {preview.moveCheck?.isWorktree && <p className="warning">{t("moveWorktree")}</p>}
          {preview.moveCheck?.hasWorktrees && <p className="warning">{t("moveHasWorktrees")}</p>}
          {preview.inUse.length > 0 && <p className="warning">{t("repairInUse")}</p>}
        </>
      )}
      <div className="buttons">
        <button className="btn" onClick={props.onClose}>
          {t("cancel")}
        </button>
        <button className="btn primary" disabled={!preview || same || empty || !!blocked || preview.inUse.length > 0 || busy} onClick={run}>
          {t(props.moving ? "moveButton" : "repairButton")}
        </button>
      </div>
    </Sheet>
  );
}

const secretNames: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  github: "GitHub",
  aws: "AWS",
  google: "Google",
  slack: "Slack",
  stripe: "Stripe",
  resend: "Resend",
  npm: "npm",
  huggingface: "Hugging Face",
};

/** «Exportar para continuar en Claude Code»: opciones del paquete `.lap` y claves encontradas. */
export function ShareSheet(props: {
  session: Session;
  onClose: () => void;
  onExport: (toolOutput: boolean, redact: boolean) => void;
  onError: (error: unknown) => void;
}) {
  const { t, accountName } = useApp();
  const [toolOutput, setToolOutput] = useState(true);
  const [redact, setRedact] = useState(true);
  const [secrets, setSecrets] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    setSecrets(null);
    api.scanSecrets(props.session.id, toolOutput).then(setSecrets, props.onError);
  }, [toolOutput]);
  const label = (kind: string) =>
    kind === "privateKey" ? t("secretPrivateKey") : kind === "jwt" ? t("secretJwt") : kind === "databaseUrl" ? t("secretDatabaseUrl") : secretNames[kind] ?? kind;
  const found = secrets ? Object.entries(secrets) : [];
  return (
    <Sheet title={t("exportForClaudeTitle")} onClose={props.onClose}>
      {props.session.accountEnv && <p className="warning">{t("otherAccountExport", { account: accountName(props.session.account) })}</p>}
      <p>{t("shareLead")}</p>
      <label className="check-row">
        <input type="checkbox" checked={toolOutput} onChange={(e) => setToolOutput(e.target.checked)} />
        <span>
          {t("shareToolOutput")}
          <span className="hint" style={{ display: "block" }}>{t("shareToolOutputHint")}</span>
        </span>
      </label>
      {!secrets ? (
        <p className="hint">{t("shareChecking")}</p>
      ) : found.length === 0 ? (
        <p className="hint">{t("shareNoSecrets")}</p>
      ) : (
        <>
          <p className="warning">{t("shareSecrets", { list: found.map(([kind, n]) => `${label(kind)} (${n})`).join(", ") })}</p>
          <label className="check-row">
            <input type="checkbox" checked={redact} onChange={(e) => setRedact(e.target.checked)} />
            <span>{t("shareRedact")}</span>
          </label>
        </>
      )}
      <div className="buttons">
        <button className="btn" onClick={props.onClose}>
          {t("cancel")}
        </button>
        <button className="btn primary" disabled={!secrets} onClick={() => (props.onClose(), props.onExport(toolOutput, redact && found.length > 0))}>
          {t("shareButton")}
        </button>
      </div>
    </Sheet>
  );
}

const osNames: Record<string, string> = { macos: "macOS", windows: "Windows", linux: "Linux" };

/** Importar una sesión compartida: qué trae, dónde continuarla y con qué cuenta. */
export function ImportSheet(props: { file: string; shared: SharedSession; onClose: () => void; onImported: (id: string) => void; onError: (error: unknown) => void }) {
  const { t, language, accounts, account, accountName } = useApp();
  const { shared } = props;
  const [folder, setFolder] = useState<string | null>(shared.suggestion);
  const [target, setTarget] = useState<string | null>(account?.id ?? accounts[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const choose = async () => {
    const picked = await openDialog({ directory: true, title: t("importChooseFolder"), defaultPath: folder ?? (shared.cwdExists ? shared.cwd ?? undefined : undefined) });
    if (typeof picked === "string") setFolder(picked);
  };
  const run = async () => {
    if (!folder) return;
    setBusy(true);
    try {
      const id = await api.importSession(props.file, folder, target);
      props.onClose();
      props.onImported(id);
    } catch (error) {
      props.onClose();
      props.onError(error);
    }
  };
  const date = shared.exportedAt ? new Date(shared.exportedAt).toLocaleDateString(language, { dateStyle: "long" }) : null;
  const origin = [shared.os ? t("importFromOs", { os: osNames[shared.os] ?? shared.os }) : null, date ? t("importOn", { date }) : null].filter(Boolean).join(" ");
  const facts = [origin, shared.model, shared.messages ? (shared.messages === 1 ? t("message") : `${shared.messages} ${t("messages")}`) : null, shared.gitBranch ? `${t("gitBranch")}: ${shared.gitBranch}` : null].filter(Boolean);
  return (
    <Sheet title={t("importTitle")} onClose={props.onClose}>
      <p>
        <strong className="selectable">{shared.title || props.file.split(/[\\/]/).pop()}</strong>
        {facts.length > 0 && <span className="hint" style={{ display: "block" }}>{facts.join(" · ")}</span>}
      </p>
      {shared.note && <p className="selectable">{shared.note}</p>}
      {!shared.packaged && <p className="hint">{t("importLegacy")}</p>}
      {shared.cwd && (
        <p className="hint">
          {t("importOriginal")}: <code className="selectable">{shared.cwd}</code>
        </p>
      )}
      <p className="field-label">{t("importFolder")}</p>
      <div className="import-folder">
        <code className="selectable">{folder ?? "—"}</code>
        <button className="btn" onClick={choose}>
          {t("importChangeFolder")}
        </button>
      </div>
      <p className="hint">{folder && folder === shared.suggestion ? t("importSuggested") : !folder ? t("importChooseFolderHint") : ""}</p>
      {accounts.length > 1 && (
        <>
          <label className="field-label" htmlFor="import-account">
            {t("importAccount")}
          </label>
          <select id="import-account" className="field" value={target ?? ""} onChange={(e) => setTarget(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accountName(a.id)}
              </option>
            ))}
          </select>
        </>
      )}
      {shared.packaged && !shared.toolOutput && <p className="hint">{t("importNoTools")}</p>}
      {shared.redacted > 0 && <p className="hint">{t("importRedacted", { n: shared.redacted })}</p>}
      <p className="warning">{t("importWarning")}</p>
      <div className="buttons">
        <button className="btn" onClick={props.onClose}>
          {t("cancel")}
        </button>
        <button className="btn primary" disabled={!folder || busy} onClick={run}>
          {t("importButton")}
        </button>
      </div>
    </Sheet>
  );
}

export function Welcome({ onClose, onGuide }: { onClose: () => void; onGuide: () => void }) {
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
        <button className="link-btn" onClick={onGuide}>
          {t("seeGuide")}
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
  const y = Math.max(8, Math.min(state.y, window.innerHeight - 480));
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
        <button role="menuitem" onClick={run(() => actions.moveFolder(folder.cwd))}>
          <FolderInput size={14} />
          {t("moveEllipsis")}
        </button>
        <button role="menuitem" onClick={run(() => actions.repairFolder(folder.cwd))}>
          <FolderSync size={14} />
          {t("repairEllipsis")}
        </button>
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
      <button role="menuitem" className="destructive" onClick={run(() => actions.deleteSessions([session]))}>
        <Trash2 size={14} />
        {t("deleteEllipsis")}
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
      <hr />
      <button role="menuitem" onClick={run(() => actions.copyMarkdown(session))}>
        <ClipboardCopy size={14} />
        {t("copyMarkdown")}
      </button>
      <button role="menuitem" onClick={run(() => actions.exportMarkdown(session))}>
        <FileDown size={14} />
        {t("exportMarkdown")}
      </button>
      <button role="menuitem" onClick={run(() => actions.exportSession(session))}>
        <Share size={14} />
        {t("exportForClaude")}
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
