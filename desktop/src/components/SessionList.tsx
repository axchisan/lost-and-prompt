import { Check, ClockAlert, Folder, Layers, ListFilter, MessageSquarePlus, FolderSearch, House, LayoutGrid, List, Star, Inbox, SearchX, LoaderCircle } from "lucide-react";
import { tints, type Session } from "../api";
import { dayGroups, grouped, shortDate } from "../format";
import { collectionsOf, noFilter, useApp } from "../state";
import { Dropdown } from "./Detail";
import { plain, Snippet } from "./Text";

function sectionTitle(app: ReturnType<typeof useApp>) {
  const { sidebar, t, library } = app;
  switch (sidebar.kind) {
    case "favorites":
      return t("favorites");
    case "archived":
      return t("archived");
    case "collection":
      return app.collection(sidebar.id)?.name ?? "";
    case "folder":
      return sidebar.path === library.home ? t("home") : sidebar.path.split(/[\\/]/).filter(Boolean).pop() ?? "";
    default:
      return t("recents");
  }
}

/** Periodo, solo favoritos y rama de git; el icono se rellena con algún filtro activo. */
function FilterMenu() {
  const { t, filter, setFilter, branches } = useApp();
  const active = filter.period !== "all" || filter.favoritesOnly || filter.branch !== null;
  const periods = [
    ["all", t("anyDate")],
    ["today", t("today")],
    ["week", t("last7Days")],
    ["month", t("last30Days")],
    ["quarter", t("last3Months")],
  ] as const;
  const check = (on: boolean) => <span className="check">{on && <Check size={14} />}</span>;
  return (
    <span className={`filter-menu${active ? " active" : ""}`}>
      <Dropdown icon={<ListFilter />} title={active ? t("filtersOn") : t("filterList")} align="left">
        {(close) => (
          <>
            {periods.map(([value, label]) => (
              <button key={value} role="menuitemradio" aria-checked={filter.period === value} onClick={() => setFilter({ period: value })}>
                {check(filter.period === value)}
                {label}
              </button>
            ))}
            <hr />
            <button role="menuitemcheckbox" aria-checked={filter.favoritesOnly} onClick={() => setFilter({ favoritesOnly: !filter.favoritesOnly })}>
              {check(filter.favoritesOnly)}
              {t("favoritesOnly")}
            </button>
            {branches.length > 0 && (
              <>
                <hr />
                <button role="menuitemradio" aria-checked={filter.branch === null} onClick={() => setFilter({ branch: null })}>
                  {check(filter.branch === null)}
                  {t("anyBranch")}
                </button>
                {branches.map((b) => (
                  <button key={b} role="menuitemradio" aria-checked={filter.branch === b} onClick={() => setFilter({ branch: b })}>
                    {check(filter.branch === b)}
                    <span className="mono-label">{b}</span>
                  </button>
                ))}
              </>
            )}
            <hr />
            <button role="menuitem" disabled={!active} onClick={() => (setFilter(noFilter), close())}>
              {check(false)}
              {t("clearFilters")}
            </button>
          </>
        )}
      </Dropdown>
    </span>
  );
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
        <button className={prefs.listStyle === "rows" ? "on" : ""} onClick={() => setPrefs({ listStyle: "rows" })} title={t("rows")} aria-label={t("rows")} aria-pressed={prefs.listStyle === "rows"}>
          <List size={16} />
        </button>
        <button className={prefs.listStyle === "cards" ? "on" : ""} onClick={() => setPrefs({ listStyle: "cards" })} title={t("cards")} aria-label={t("cards")} aria-pressed={prefs.listStyle === "cards"}>
          <LayoutGrid size={16} />
        </button>
      </div>
      <FilterMenu />
      <button className="icon-btn" title={`${t("newSessionEllipsis")} (${app.modKey}N)`} aria-label={t("newSessionEllipsis")} onClick={app.open.newSession}>
        <MessageSquarePlus />
      </button>
      <div>
        <h2>{sectionTitle(app)}</h2>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}

export function EmptyState() {
  const { t, search, sidebar, library, modKey, filter, setFilter } = useApp();
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
  if (filter.period !== "all" || filter.favoritesOnly || filter.branch !== null) {
    return (
      <div className="empty">
        <ListFilter />
        <b>{t("noFilterResults")}</b>
        <button className="btn small" onClick={() => setFilter(noFilter)}>
          {t("clearFilters")}
        </button>
      </div>
    );
  }
  if (sidebar.kind === "collection") {
    return (
      <div className="empty">
        <Layers />
        <b>{t("emptyCollection")}</b>
        <p>{t("emptyCollectionHint")}</p>
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
      {collectionsOf(session).map((id) => {
        const c = app.collection(id);
        return c ? <span key={id} className="dot sm" style={{ background: tints[c.tint] }} /> : null;
      })}
      {session.isHome ? <House /> : <Folder />}
      <span>{session.isHome ? app.t("home") : session.folderName}</span>
      {session.environment && <span className="env">WSL</span>}
    </div>
  );
}

export function SessionList() {
  const app = useApp();
  const { t, visible, selected, select, language, search, contentHits, library } = app;
  const showBanner = library.retentionDays === null && library.claudeFolderExists && !search;
  return (
    <section className="column" aria-label={sectionTitle(app)}>
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
        <div className="list">
          {showBanner && <RetentionBanner />}
          <div role="listbox" aria-label={sectionTitle(app)} tabIndex={0} aria-activedescendant={selected ? `session-${selected.id}` : undefined}>
          {dayGroups(visible, t).map((group, index) => (
            <div key={group.title} role="group" aria-labelledby={`day-${index}`}>
              <div className="group-title" id={`day-${index}`}>{group.title}</div>
              {group.sessions.map((session) => (
                <div
                  key={session.id}
                  id={`session-${session.id}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", `session:${session.id}`)}
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
        </div>
      )}
    </section>
  );
}

export function SessionCards() {
  const app = useApp();
  const { t, visible, selected, select, language } = app;
  return (
    <section className="column" aria-label={sectionTitle(app)}>
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
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", `session:${session.id}`)}
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
                      {collectionsOf(session).map((id) => {
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
