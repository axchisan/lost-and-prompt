import { useEffect, useMemo, useState } from "react";
import { ChartColumn, ChevronRight, CircleHelp, Clock, Folder, House, Info, MessageSquareWarning, Plus, RefreshCw, Search, Settings, Star, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { links } from "../api";
import { tints, type Session } from "../api";
import { useApp, type SidebarItem } from "../state";
import { isInside } from "../App";

interface FolderNode {
  path: string;
  name: string;
  count: number;
  children: FolderNode[];
}

/** Carpetas con sesiones, anidadas bajo su carpeta padre más cercana que también tenga sesiones. */
function folderTree(sessions: Session[], home: string, homeName: string): FolderNode[] {
  const counts = new Map<string, number>();
  for (const s of sessions) counts.set(s.cwd, (counts.get(s.cwd) ?? 0) + 1);
  const paths = [...counts.keys()];
  const name = (path: string) => (path === home ? homeName : path.split(/[\\/]/).filter(Boolean).pop() ?? path);
  const parentOf = (path: string) =>
    paths.filter((p) => p !== path && p !== home && isInside(path, p)).sort((a, b) => b.length - a.length)[0];
  const build = (parent: string | undefined): FolderNode[] =>
    paths
      .filter((p) => (p === home ? parent === undefined : parentOf(p) === parent))
      .map((p) => ({ path: p, name: name(p), count: counts.get(p) ?? 0, children: p === home ? [] : build(p) }))
      .sort((a, b) => (a.path === home ? -1 : b.path === home ? 1 : a.name.localeCompare(b.name)));
  return build(undefined);
}

export function Sidebar() {
  const app = useApp();
  const { t, library, sidebar, setSidebar, search, setSearch } = app;
  const sessions = library.sessions;
  const tree = useMemo(() => folderTree(sessions, library.home, t("home")), [sessions, library.home, t]);
  const nonEmpty = sessions.filter((s) => s.userMessages > 0).length;
  const favorites = sessions.filter((s) => s.isFavorite).length;

  const is = (item: SidebarItem) =>
    item.kind === sidebar.kind &&
    (item.kind !== "collection" || (sidebar.kind === "collection" && sidebar.id === item.id)) &&
    (item.kind !== "folder" || (sidebar.kind === "folder" && sidebar.path === item.path));

  return (
    <aside className="sidebar">
      <label className="search">
        <Search size={15} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search")}
          aria-label={t("searchPlaceholder")}
          spellCheck={false}
        />
        {search && (
          <button className="clear" onClick={() => setSearch("")} aria-label="×">
            <X size={14} />
          </button>
        )}
      </label>
      <nav>
        <Item item={{ kind: "recents" }} icon={<Clock />} label={t("recents")} count={nonEmpty} on={is({ kind: "recents" })} onSelect={setSidebar} />
        <Item item={{ kind: "favorites" }} icon={<Star />} label={t("favorites")} count={favorites} on={is({ kind: "favorites" })} onSelect={setSidebar} />
        <Item item={{ kind: "activity" }} icon={<ChartColumn />} label={t("activity")} on={is({ kind: "activity" })} onSelect={setSidebar} />

        <h6>{t("collections")}</h6>
        {library.collections.map((c) => (
          <Item
            key={c.id}
            item={{ kind: "collection", id: c.id }}
            icon={<span className="dot" style={{ background: tints[c.tint] }} />}
            label={c.name}
            count={sessions.filter((s) => s.collectionIds.includes(c.id)).length}
            on={is({ kind: "collection", id: c.id })}
            onSelect={setSidebar}
            onDelete={() => app.actions.deleteCollection(c.id)}
          />
        ))}
        <button className="side-item muted" onClick={app.open.newCollection}>
          <Plus />
          <span className="label">{t("newCollection")}</span>
        </button>

        <h6>{t("folders")}</h6>
        {tree.map((node) => (
          <FolderRow key={node.path} node={node} depth={0} isHome={node.path === library.home} />
        ))}
      </nav>
      <SidebarFooter />
    </aside>
  );
}

function Item(props: {
  item: SidebarItem;
  icon: React.ReactNode;
  label: string;
  count?: number;
  on: boolean;
  onSelect: (item: SidebarItem) => void;
  onDelete?: () => void;
}) {
  const { t, open } = useApp();
  return (
    <button
      className={`side-item${props.on ? " on" : ""}`}
      onClick={() => props.onSelect(props.item)}
      onContextMenu={(e) => {
        if (!props.onDelete) return;
        e.preventDefault();
        open.confirm(t("deleteCollectionConfirm", { name: props.label }), t("deleteCollection"), props.onDelete);
      }}
    >
      {props.icon}
      <span className="label">{props.label}</span>
      {props.count !== undefined && props.count > 0 && <span className="count">{props.count}</span>}
    </button>
  );
}

function FolderRow({ node, depth, isHome }: { node: FolderNode; depth: number; isHome: boolean }) {
  const { sidebar, setSidebar } = useApp();
  const [open, setOpen] = useState(depth < 2);
  const on = sidebar.kind === "folder" && sidebar.path === node.path;
  return (
    <>
      <button
        className={`side-item${on ? " on" : ""}`}
        style={{ paddingLeft: 10 + depth * 16 }}
        onClick={() => setSidebar({ kind: "folder", path: node.path })}
        title={node.path}
      >
        {node.children.length > 0 ? (
          <ChevronRight
            className={`chev${open ? " open" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          />
        ) : (
          <span style={{ width: 9 }} />
        )}
        {isHome ? <House /> : <Folder />}
        <span className="label">{node.name}</span>
        <span className="count">{node.count}</span>
      </button>
      {open && node.children.map((child) => <FolderRow key={child.path} node={child} depth={depth + 1} isHome={false} />)}
    </>
  );
}

/** Engranaje fijo abajo: en Windows y Linux no hay barra de menús como en Mac. */
function SidebarFooter() {
  const { t, open, modKey } = useApp();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);
  const item = (icon: React.ReactNode, label: string, action: () => void, shortcut?: string) => (
    <button
      onClick={() => {
        setMenu(false);
        action();
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
  return (
    <div className="sidebar-footer">
      <button
        className="icon-btn"
        title={t("settings")}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setMenu(!menu);
        }}
      >
        <Settings />
      </button>
      {menu && (
        <div className="menu up" role="menu" onClick={(e) => e.stopPropagation()}>
          {item(<Settings size={14} />, t("settingsEllipsis"), () => open.settings(), `${modKey},`)}
          <hr />
          {item(<RefreshCw size={14} />, t("checkUpdates"), () => openUrl(links.releases))}
          {item(<MessageSquareWarning size={14} />, t("reportProblem"), () => openUrl(links.issues))}
          {item(<CircleHelp size={14} />, t("help"), () => openUrl(links.repository))}
          <hr />
          {item(<Info size={14} />, t("aboutApp"), open.about)}
        </div>
      )}
    </div>
  );
}
