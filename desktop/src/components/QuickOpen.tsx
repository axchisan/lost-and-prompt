import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, Search, SquareTerminal, Star } from "lucide-react";
import { api, tints, type Hit, type Session } from "../api";
import { grouped, relativeDay, shortDate, usd } from "../format";
import { useApp } from "../state";
import { plain } from "./Text";

/** Lanzador: buscar y reanudar sin tocar el ratón. */
export function QuickOpen({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const { t, language, library, terminalName, modKey } = app;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (query.trim().length < 2) return setHits([]);
    const timer = setTimeout(() => api.search(query, 8).then(setHits).catch(() => setHits([])), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const base = useMemo(
    () =>
      library.sessions
        .filter((s) => s.userMessages > 0)
        .filter((s) => (filter === null ? true : filter === "fav" ? s.isFavorite : s.collectionIds.includes(filter))),
    [library.sessions, filter],
  );
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      base
        .filter((s) => !q || s.title.toLowerCase().includes(q) || s.firstPrompt.toLowerCase().includes(q) || s.cwd.toLowerCase().includes(q))
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
        .slice(0, q ? 20 : 8),
    [base, q],
  );
  const shown = new Set(matches.map((s) => s.id));
  const messageHits = hits
    .map((h) => ({ session: base.find((s) => s.id === h.sessionId), snippet: plain(h.snippet.replace(/[\u0001\u0002]/g, "")) }))
    .filter((x): x is { session: Session; snippet: string } => !!x.session && !shown.has(x.session.id));
  const all = [...matches, ...messageHits.map((x) => x.session)];
  const current = all[Math.min(highlighted, all.length - 1)];

  const resume = (session?: Session) => {
    if (!session) return;
    app.actions.resume(session);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    const mod = library.platform === "macos" ? e.metaKey : e.ctrlKey;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(all.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && mod && current) {
      app.select(current.id);
      onClose();
    } else if (e.key === "Enter") {
      resume(current);
    } else if (mod && e.key.toLowerCase() === "d" && current) {
      e.preventDefault();
      app.actions.toggleFavorite(current);
    } else if (mod && e.key.toLowerCase() === "c" && current && !window.getSelection()?.toString()) {
      e.preventDefault();
      app.actions.copyCommand(current);
    }
  };

  const row = (session: Session, index: number, snippet?: string) => (
    <div
      key={`${snippet ? "m" : "s"}-${session.id}`}
      className={`result${index === highlighted ? " on" : ""}`}
      onMouseEnter={() => setHighlighted(index)}
      onClick={() => resume(session)}
    >
      <span className="ico">{snippet ? <MessageSquareText size={15} /> : <SquareTerminal size={15} />}</span>
      <div className="tx">
        <b>{session.title}</b>
        <span>
          {session.isHome ? t("home") : session.folderName} · {snippet ?? t("nMessages", { n: grouped(session.userMessages, language) })}
        </span>
      </div>
      <time>{shortDate(session.lastActivity, language)}</time>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="quick" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="query">
          <Search />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            placeholder={t("quickSearch")}
            spellCheck={false}
          />
        </div>
        <div className="chips">
          <button className={`chip-btn${filter === null ? " on" : ""}`} onClick={() => setFilter(null)}>
            {t("all")}
          </button>
          <button className={`chip-btn${filter === "fav" ? " on" : ""}`} onClick={() => setFilter("fav")}>
            <Star />
            {t("favorites")}
          </button>
          {library.collections.map((c) => (
            <button key={c.id} className={`chip-btn${filter === c.id ? " on" : ""}`} onClick={() => setFilter(c.id)}>
              <span className="dot sm" style={{ background: tints[c.tint] }} />
              {c.name}
            </button>
          ))}
        </div>
        <div className="body">
          <div className="results">
            {matches.length > 0 && <div className="group-title">{t("inSessions")}</div>}
            {matches.map((s, i) => row(s, i))}
            {messageHits.length > 0 && <div className="group-title">{t("inMessages")}</div>}
            {messageHits.map((x, i) => row(x.session, matches.length + i, x.snippet))}
          </div>
          <div className="preview">
            {current ? (
              <>
                <div className="path">{current.abbreviatedPath}</div>
                <h4>{current.title}</h4>
                <div className="facts">
                  <span>{relativeDay(current.lastActivity, language, t)}</span>
                  {current.costUsd !== null && current.costUsd > 0 && <b>{usd(current.costUsd, language)}</b>}
                </div>
                {current.firstPrompt && (
                  <div className="quote">
                    <span>{t("startedWith")}</span>
                    {plain(current.firstPrompt)}
                  </div>
                )}
                {current.lastReply && (
                  <div className="quote">
                    <span>{t("lastFromClaude")}</span>
                    {plain(current.lastReply)}
                  </div>
                )}
              </>
            ) : (
              <div className="empty">
                <p>{t("noSelection")}</p>
              </div>
            )}
          </div>
        </div>
        <footer>
          <span className="first">
            <SquareTerminal size={14} />
            {t("opensIn", { terminal: terminalName })}
          </span>
          <span>
            <kbd>↩</kbd>
            {t("resume")}
          </span>
          <span>
            <kbd>{modKey}D</kbd>
            {t("favorite")}
          </span>
          <span>
            <kbd>{modKey}C</kbd>
            {t("copyCommand")}
          </span>
        </footer>
      </div>
    </div>
  );
}
