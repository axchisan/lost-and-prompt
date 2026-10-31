import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, CodeXml, Copy, Folder, Layers, Lock, MessageSquarePlus, Pencil, Search, SquareTerminal, Star, StickyNote } from "lucide-react";
import { links, tints, type Session, type Tint } from "../api";
import { useApp, type MenuState } from "../state";
import { shortEditorName } from "./Detail";
import icon from "../../src-tauri/icons/128x128@2x.png";

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h4>{title}</h4>
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

export function NewCollectionSheet({ onClose }: { onClose: () => void }) {
  const { t, actions } = useApp();
  const [name, setName] = useState("");
  const [tint, setTint] = useState<Tint>("blue");
  const create = () => {
    if (!name.trim()) return;
    actions.createCollection(name.trim(), tint);
    onClose();
  };
  return (
    <Sheet title={t("newCollection")} onClose={onClose}>
      <input className="field" autoFocus value={name} placeholder={t("collectionPlaceholder")} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
      <div className="swatches">
        {(Object.keys(tints) as Tint[]).map((value) => (
          <button key={value} className={`swatch${tint === value ? " on" : ""}`} style={{ background: tints[value] }} onClick={() => setTint(value)} aria-label={value} />
        ))}
      </div>
      <div className="buttons">
        <button className="btn" onClick={onClose}>
          {t("cancel")}
        </button>
        <button className="btn primary" onClick={create} disabled={!name.trim()}>
          {t("create")}
        </button>
      </div>
    </Sheet>
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
  const run = (action: () => void) => () => {
    action();
    onClose();
  };
  const x = Math.min(state.x, window.innerWidth - 240);
  const y = Math.min(state.y, window.innerHeight - 360);
  if (state.folder) {
    const folder = state.folder;
    return (
      <div className="menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
        <button onClick={run(() => actions.newSession(folder))}>
          <MessageSquarePlus size={14} />
          {t("newSessionHere")}
        </button>
        {editor && (
          <button onClick={run(() => actions.openInEditor(folder))}>
            <CodeXml size={14} />
            {t("openIn", { editor: shortEditorName(editor.name) })}
          </button>
        )}
      </div>
    );
  }
  const session = library.sessions.find((s) => s.id === state.session.id) ?? state.session;
  return (
    <div className="menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <button onClick={run(() => actions.resume(session))}>
        <SquareTerminal size={14} />
        {t("resumeIn", { terminal: terminalName })}
      </button>
      <button onClick={run(() => actions.copyCommand(session))}>
        <Copy size={14} />
        {t("copyCommand")}
      </button>
      <hr />
      <button onClick={run(() => actions.toggleFavorite(session))}>
        <Star size={14} />
        {session.isFavorite ? t("removeFavorite") : t("addFavorite")}
      </button>
      {library.collections.map((c) => (
        <button key={c.id} onClick={run(() => actions.toggleMembership(session, c.id))}>
          <span className="check">{session.collectionIds.includes(c.id) ? <Check size={14} /> : <span className="dot sm" style={{ background: tints[c.tint] }} />}</span>
          {c.name}
        </button>
      ))}
      <button onClick={run(() => open.rename(session))}>
        <Pencil size={14} />
        {t("rename")}
      </button>
      <button onClick={run(() => open.note(session))}>
        <StickyNote size={14} />
        {session.note ? t("editNote") : t("addNote")}
      </button>
      <hr />
      <button disabled={!session.folderExists} onClick={run(() => actions.newSession(session))}>
        <MessageSquarePlus size={14} />
        {t("newSessionHere")}
      </button>
      {editor && (
        <button disabled={!session.folderExists} onClick={run(() => actions.openInEditor(session))}>
          <CodeXml size={14} />
          {t("openIn", { editor: shortEditorName(editor.name) })}
        </button>
      )}
      <button onClick={run(() => actions.reveal(session))}>
        <Folder size={14} />
        {t("showInFolder")}
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
