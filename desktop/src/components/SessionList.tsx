import { ClockAlert, Folder, FolderSearch, House, LayoutGrid, List, Star, Inbox, SearchX, LoaderCircle } from "lucide-react";
import { tints, type Session } from "../api";
import { dayGroups, grouped, shortDate } from "../format";
import { useApp } from "../state";
import { plain, Snippet } from "./Text";

function sectionTitle(app: ReturnType<typeof useApp>) {
  const { sidebar, t, library } = app;
  switch (sidebar.kind) {
    case "favorites":
      return t("favorites");
    case "collection":
      return app.collection(sidebar.id)?.name ?? "";
    case "folder":
      return sidebar.path === library.home ? t("home") : sidebar.path.split(/[\\/]/).filter(Boolean).pop() ?? "";
    default:
      return t("recents");
  }
}

function Head() {
  const app = useApp();
  const { t, visible, indexProgress, prefs, setPrefs } = app;
  const subtitle = indexProgress
    ? t("indexing", indexProgress)
    : visible.length === 1
      ? t("oneSession")
      : t("sessions", { n: visible.length });
  return (
    <div className="column-head">
      <div className="segmented" role="group" aria-label={t("listView")}>
        <button className={prefs.listStyle === "rows" ? "on" : ""} onClick={() => setPrefs({ listStyle: "rows" })} title={t("rows")}>
          <List size={16} />
        </button>
        <button className={prefs.listStyle === "cards" ? "on" : ""} onClick={() => setPrefs({ listStyle: "cards" })} title={t("cards")}>
          <LayoutGrid size={16} />
        </button>
      </div>
      <div>
        <h2>{sectionTitle(app)}</h2>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}

export function EmptyState() {
  const { t, search, sidebar, library, modKey } = useApp();
  if (!library.claudeFolderExists) {
    return (
      <div className="empty">
        <FolderSearch />
        <b>{t("noClaude")}</b>
        <p>{t("noClaudeHint", { path: library.platform === "windows" ? "%USERPROFILE%\\.claude\\projects" : "~/.claude/projects" })}</p>
      </div>
    );
  }
  if (search) {
    return (
      <div className="empty">
        <SearchX />
        <b>{t("noResults", { query: search })}</b>
        <p>{t("noResultsHint")}</p>
      </div>
    );
  }
  if (sidebar.kind === "favorites") {
    return (
      <div className="empty">
        <Star />
        <b>{t("noFavorites")}</b>
        <p>{t("noFavoritesHint", { shortcut: `${modKey}D` })}</p>
      </div>
    );
  }
  return (
    <div className="empty">
      <Inbox />
      <b>{t("noSessions")}</b>
      <p>{t("noSessionsHint")}</p>
    </div>
  );
}

function RetentionBanner() {
  const { t, actions, open } = useApp();
  return (
    <div className="banner">
      <b>
        <ClockAlert size={16} />
        {t("retentionTitle")}
      </b>
      <p>{t("retentionHint")}</p>
      <div className="actions">
        <button className="btn small" onClick={() => actions.applyRetention(180)}>
          {t("keep6Months")}
        </button>
        <button className="btn small" onClick={() => open.settings("history")}>
          {t("otherPeriod")}
        </button>
      </div>
    </div>
  );
}

function Meta({ session }: { session: Session }) {
  const app = useApp();
  return (
    <div className="meta">
      {session.isFavorite && <Star className="star" />}
      {session.collectionIds.map((id) => {
        const c = app.collection(id);
        return c ? <span key={id} className="dot sm" style={{ background: tints[c.tint] }} /> : null;
      })}
      {session.isHome ? <House /> : <Folder />}
      <span>{session.isHome ? app.t("home") : session.folderName}</span>
    </div>
  );
}

export function SessionList() {
  const app = useApp();
  const { t, visible, selected, select, language, search, contentHits, library } = app;
  const showBanner = library.retentionDays === null && library.claudeFolderExists && !search;
  return (
    <section className="column">
      <Head />
      {visible.length === 0 ? (
        library.sessions.length === 0 && library.claudeFolderExists && !search ? (
          <div className="empty">
            <LoaderCircle className="spin" />
            <p>{t("readingSessions")}</p>
          </div>
        ) : (
          <EmptyState />
        )
      ) : (
        <div className="list" role="listbox" aria-label={sectionTitle(app)}>
          {showBanner && <RetentionBanner />}
          {dayGroups(visible, t).map((group) => (
            <div key={group.title}>
              <div className="group-title">{group.title}</div>
              {group.sessions.map((session) => (
                <div
                  key={session.id}
                  role="option"
                  aria-selected={selected?.id === session.id}
                  className={`row${selected?.id === session.id ? " on" : ""}`}
                  onClick={() => select(session.id)}
                  onDoubleClick={() => app.actions.resume(session)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    select(session.id);
                    app.open.menu({ x: e.clientX, y: e.clientY, session });
                  }}
                >
                  <div className="top">
                    <span className="title">{session.title}</span>
                    <time>{shortDate(session.lastActivity, language)}</time>
                  </div>
                  <Meta session={session} />
                  {search && contentHits[session.id] && <Snippet className="snippet" text={contentHits[session.id]} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function SessionCards() {
  const app = useApp();
  const { t, visible, selected, select, language } = app;
  return (
    <section className="column">
      <Head />
      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="cards">
          {dayGroups(visible, t).map((group) => (
            <div key={group.title}>
              <h3>
                {group.title}
                <small>{group.sessions.length === 1 ? t("oneSession") : t("sessions", { n: group.sessions.length })}</small>
              </h3>
              <div className="card-grid">
                {group.sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`card${selected?.id === session.id ? " on" : ""}`}
                    onClick={() => select(session.id)}
                    onDoubleClick={() => app.actions.resume(session)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      select(session.id);
                      app.open.menu({ x: e.clientX, y: e.clientY, session });
                    }}
                  >
                    <div className="top">
                      {session.isHome ? <House /> : <Folder />}
                      <span>{session.isHome ? t("home") : session.folderName}</span>
                      <time>{shortDate(session.lastActivity, language)}</time>
                    </div>
                    <b>{session.title}</b>
                    <p>{plain(session.firstPrompt)}</p>
                    <div className="foot">
                      {session.isFavorite && <Star size={12} className="star" />}
                      {session.collectionIds.map((id) => {
                        const c = app.collection(id);
                        return c ? (
                          <span key={id} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                            <span className="dot sm" style={{ background: tints[c.tint] }} />
                            {c.name}
                          </span>
                        ) : null;
                      })}
                      <span className="grow" />
                      {session.userMessages === 1 ? t("oneMessage") : t("nMessages", { n: grouped(session.userMessages, language) })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
