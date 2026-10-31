import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy, Ellipsis, Folder, FolderOpen, House, Layers, LoaderCircle, MessagesSquare, Pencil, Hash,
  SquareTerminal, Star, StickyNote, TriangleAlert, User, Sparkle, Wrench, Check, CodeXml, MessageSquarePlus,
  Search, ChevronUp, ChevronDown, TextSearch,
} from "lucide-react";
import type { Message, Session } from "../api";
import { grouped, relativeDay, timeOnly, usd } from "../format";
import { useApp } from "../state";
import { Markdown, countMatches } from "./Markdown";

export function NoSelection() {
  const { t, modKey } = useApp();
  return (
    <section className="column">
      <div className="empty">
        <MessagesSquare />
        <b>{t("chooseSession")}</b>
        <p>{t("chooseSessionHint", { shortcut: `${modKey}K` })}</p>
      </div>
    </section>
  );
}

export function Detail({ session }: { session: Session }) {
  const app = useApp();
  const { t, language, terminalName, actions, open, messages, loadMessages, editor, find, setFind } = app;

  useEffect(() => loadMessages(session), [session.id, session.lastActivity, loadMessages]);

  // Coincidencias de Ctrl+F, mensaje a mensaje, para saber dónde empieza cada uno.
  const list = messages[session.id];
  const query = find.open ? find.query.trim() : "";
  const { starts, total } = useMemo(() => {
    const starts: number[] = [];
    let total = 0;
    for (const m of list ?? []) {
      starts.push(total);
      total += countMatches(m.text, query);
    }
    return { starts, total };
  }, [list, query]);
  useEffect(() => setFind({ total, index: find.index < total ? find.index : 0 }), [total]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lleva a la vista la coincidencia actual.
  useEffect(() => {
    if (!query || total === 0) return;
    requestAnimationFrame(() => document.querySelector(".detail mark.find.current")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, [query, find.index, total]);

  return (
    <section className="column">
      <div className="detail-toolbar">
        <button className="icon-btn" title={session.isFavorite ? t("removeFavorite") : t("addFavorite")} onClick={() => actions.toggleFavorite(session)}>
          <Star className={session.isFavorite ? "star" : ""} />
        </button>
        <CollectionsMenu session={session} />
        <MoreMenu session={session} />
      </div>
      {find.open && <FindBar />}
      <div className="detail">
        <div className="head">
          <div className="path selectable">
            {session.isHome ? <House size={14} /> : <Folder size={14} />}
            {session.abbreviatedPath}
            {session.environment && <span className="env">WSL · {session.environment}</span>}
          </div>
          <h1 className="selectable">{session.title}</h1>
          <div className="facts">
            <span>{relativeDay(session.lastActivity, language, t)}</span>
            <span>
              <b>{grouped(session.userMessages, language)}</b> {t("messages")}
            </span>
            {session.costUsd !== null && session.costUsd > 0 && (
              <span>
                <b>{usd(session.costUsd, language)}</b>
              </span>
            )}
            <span>{session.model}</span>
            {session.gitBranch && (
              <span title={t("gitBranch")}>
                <b>{session.gitBranch}</b>
              </span>
            )}
          </div>
          {session.note && (
            <button className="note" style={{ all: "unset" }} onClick={() => open.note(session)}>
              <span className="note">
                <StickyNote size={15} />
                <span className="selectable">{session.note}</span>
              </span>
            </button>
          )}
          {!session.folderExists && (
            <div className="missing">
              <TriangleAlert />
              <div>
                <b>{t("folderMissing")}</b>
                <span>{t("folderMissingHint")}</span>
              </div>
              {!session.environment && (
                <button className="btn small" onClick={() => actions.chooseFolder(session)}>
                  {t("chooseFolder")}
                </button>
              )}
            </div>
          )}
          <div className="actions">
            <button className="btn primary large" onClick={() => actions.resume(session)} disabled={!session.folderExists}>
              <SquareTerminal size={16} />
              {t("resumeIn", { terminal: terminalName })}
            </button>
            <button className="btn large" onClick={() => actions.copyCommand(session)} title={t("copyCommand")}>
              <Copy size={15} />
              <span className="label">{t("copyCommand")}</span>
            </button>
            {editor ? (
              <button className="btn large" onClick={() => actions.openInEditor(session)} disabled={!session.folderExists} title={t("openFolderIn", { editor: editor.name })}>
                <CodeXml size={15} />
                <span className="label">{t("openIn", { editor: shortEditorName(editor.name) })}</span>
              </button>
            ) : (
              <button className="btn large" onClick={() => actions.reveal(session)} disabled={!session.folderExists} title={t("openFolder")}>
                <FolderOpen size={15} />
                <span className="label">{t("openFolder")}</span>
              </button>
            )}
          </div>
        </div>
        <div className="conversation">
          <div className="conversation-head">
            <h3>{t("conversation")}</h3>
          </div>
          {list ? (
            list.map((m, i) => <MessageView key={i} message={m} query={query} current={find.index - starts[i]} />)
          ) : (
            <div className="loading">
              <LoaderCircle size={16} className="spin" />
              {t("readingConversation")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** «VS Code» en lugar de «Visual Studio Code» en el botón. */
export function shortEditorName(name: string) {
  return name === "Visual Studio Code" ? "VS Code" : name;
}

/** Barra de Ctrl+F: buscar dentro de la conversación abierta. */
function FindBar() {
  const { t, find, setFind, moveFind } = useApp();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <div className="find-bar">
      <Search size={14} />
      <input
        ref={input}
        value={find.query}
        placeholder={t("findInConversation")}
        spellCheck={false}
        onChange={(e) => setFind({ query: e.target.value, index: 0 })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            moveFind(e.shiftKey ? -1 : 1);
          }
        }}
      />
      {find.query.trim() && <span className="count">{find.total === 0 ? t("noMatches") : t("matchOf", { n: find.index + 1, total: find.total })}</span>}
      <button className="icon-btn" title={t("previousMatch")} disabled={find.total === 0} onClick={() => moveFind(-1)}>
        <ChevronUp />
      </button>
      <button className="icon-btn" title={t("nextMatch")} disabled={find.total === 0} onClick={() => moveFind(1)}>
        <ChevronDown />
      </button>
      <button className="btn small" onClick={() => setFind({ open: false })}>
        {t("done")}
      </button>
    </div>
  );
}

function MessageView({ message, query, current }: { message: Message; query: string; current: number }) {
  const { t, language } = useApp();
  const user = message.role === "user";
  return (
    <div className="msg">
      <span className={`avatar${user ? "" : " claude"}`}>{user ? <User /> : <Sparkle />}</span>
      <div>
        <div className="who">
          {user ? t("you") : t("claude")}
          <time>{timeOnly(message.date, language)}</time>
        </div>
        {message.text && (
          <div className="text selectable">
            <Markdown text={message.text} query={query} current={current} />
          </div>
        )}
        {message.toolCount > 0 && (
          <span className="chip">
            <Wrench />
            {message.toolCount === 1 ? t("oneTool") : t("nTools", { n: message.toolCount })}
          </span>
        )}
      </div>
    </div>
  );
}

/** Menú desplegable anclado a un botón; se cierra al hacer clic fuera. */
function Dropdown({ icon, title, children }: { icon: React.ReactNode; title: string; children: (close: () => void) => React.ReactNode }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!rect) return;
    const close = () => setRect(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [rect]);
  return (
    <>
      <button
        ref={button}
        className="icon-btn"
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          setRect(rect ? null : button.current!.getBoundingClientRect());
        }}
      >
        {icon}
      </button>
      {rect && (
        <div className="menu" style={{ top: rect.bottom + 4, right: window.innerWidth - rect.right }} onClick={(e) => e.stopPropagation()}>
          {children(() => setRect(null))}
        </div>
      )}
    </>
  );
}

function CollectionsMenu({ session }: { session: Session }) {
  const { t, library, actions, open } = useApp();
  return (
    <Dropdown icon={<Layers />} title={t("addToCollection")}>
      {(close) => (
        <>
          {library.collections.map((c) => (
            <button key={c.id} onClick={() => actions.toggleMembership(session, c.id)}>
              <span className="check">{session.collectionIds.includes(c.id) && <Check size={14} />}</span>
              {c.name}
            </button>
          ))}
          {library.collections.length > 0 && <hr />}
          <button
            onClick={() => {
              close();
              open.newCollection();
            }}
          >
            <span className="check" />
            {t("newCollection")}…
          </button>
        </>
      )}
    </Dropdown>
  );
}

function MoreMenu({ session }: { session: Session }) {
  const { t, actions, open, editor, setFind } = useApp();
  return (
    <Dropdown icon={<Ellipsis />} title={t("more")}>
      {(close) => (
        <>
          <button onClick={() => (close(), open.rename(session))}>
            <Pencil size={14} />
            {t("rename")}
          </button>
          <button onClick={() => (close(), open.note(session))}>
            <StickyNote size={14} />
            {session.note ? t("editNote") : t("addNote")}
          </button>
          <hr />
          <button disabled={!session.folderExists} onClick={() => (close(), actions.newSession(session))}>
            <MessageSquarePlus size={14} />
            {t("newSessionHere")}
          </button>
          <button onClick={() => (close(), setFind({ open: true }))}>
            <TextSearch size={14} />
            {t("findInConversation")}
          </button>
          <hr />
          {editor && (
            <button disabled={!session.folderExists} onClick={() => (close(), actions.openInEditor(session))}>
              <CodeXml size={14} />
              {t("openIn", { editor: shortEditorName(editor.name) })}
            </button>
          )}
          <button onClick={() => (close(), actions.reveal(session))}>
            <Folder size={14} />
            {t("showInFolder")}
          </button>
          <button onClick={() => (close(), actions.copyId(session))}>
            <Hash size={14} />
            {t("copySessionId")}
          </button>
        </>
      )}
    </Dropdown>
  );
}
