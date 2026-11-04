import { useEffect, useMemo, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { BookOpen, Keyboard, Search, Sparkles, X } from "lucide-react";
import guide from "../../../docs/guia/guia.json";
import changelog from "../../../CHANGELOG.md?raw";
import { useApp } from "../state";
import type { Language } from "../i18n";
import { inLanguage, parseChangelog } from "../releaseNotes";
import { Markdown } from "./Markdown";

export type GuideTab = "guide" | "shortcuts" | "news";

type Text = { es: string; en: string };
interface Item {
  id: string;
  since: string;
  only?: string;
  try?: string;
  keys?: { mac?: string; win?: string };
  title: Text;
  body: Text;
}
interface Topic {
  id: string;
  title: Text;
  intro: Text;
  items: Item[];
}
interface ShortcutGroup {
  title: Text;
  items: { label: Text; mac?: string; win?: string }[];
}

const topics = (guide.topics as Topic[]).map((topic) => ({ ...topic, items: topic.items.filter((item) => item.only !== "mac") }));
const shortcutGroups = (guide.shortcuts as ShortcutGroup[])
  .map((group) => ({ ...group, items: group.items.filter((item) => item.win) }))
  .filter((group) => group.items.length > 0);
const releases = parseChangelog(changelog);

/** El atajo en el idioma de la app («Mayús» en español, como en Windows). */
function keyLabel(keys: string, language: Language) {
  return language === "es" ? keys.replace(/\bShift\b/g, "Mayús") : keys;
}

/** «Nuevo» marca lo que llegó en la versión menor que tienes (0.6.x en la 0.6.1). */
function isNew(since: string, current: string) {
  return current !== "" && since.split(".").slice(0, 2).join(".") === current.split(".").slice(0, 2).join(".");
}

function matches(query: string, ...texts: string[]) {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const haystack = texts.join(" ").toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** «Aprende a usar Lost & Prompt»: guía de funciones, atajos y novedades de cada versión. */
export function Guide({ initialTab, onClose }: { initialTab: GuideTab; onClose: () => void }) {
  const { t } = useApp();
  const [tab, setTab] = useState<GuideTab>(initialTab);
  const [current, setCurrent] = useState("");
  useEffect(() => {
    getVersion().then(setCurrent).catch(() => {});
  }, []);
  const tabs: [GuideTab, string, React.ReactNode][] = [
    ["guide", t("guideTab"), <BookOpen key="g" />],
    ["shortcuts", t("shortcutsTab"), <Keyboard key="s" />],
    ["news", t("newsTab"), <Sparkles key="n" />],
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="guide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("learnApp")}>
        <header>
          <h2>{t("learnApp")}</h2>
          <div className="segmented" role="tablist">
            {tabs.map(([id, label, icon]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
                {icon}
                {label}
              </button>
            ))}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t("close")}>
            <X />
          </button>
        </header>
        {tab === "guide" && <GuidePane current={current} onClose={onClose} />}
        {tab === "shortcuts" && <ShortcutsPane />}
        {tab === "news" && <NewsPane current={current} />}
      </div>
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="guide-search">
      <Search size={14} aria-hidden />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoFocus />
    </label>
  );
}

function GuidePane({ current, onClose }: { current: string; onClose: () => void }) {
  const { t, language, open, actions, setSidebar } = useApp();
  const [topicId, setTopicId] = useState(topics[0].id);
  const [query, setQuery] = useState("");
  const main = useRef<HTMLDivElement>(null);
  const l = (text: Text) => text[language];

  const run = (action: string) => {
    onClose();
    if (action === "quick") open.quick();
    else if (action === "newSession") open.newSession();
    else if (action === "newCollection") open.newCollection();
    else if (action === "importSession") actions.importSession();
    else if (action === "activity") setSidebar({ kind: "activity" });
    else if (action.startsWith("settings:")) open.settings(action.slice(9) as "general" | "history" | "appearance");
  };

  const shown = query.trim()
    ? topics
        .map((topic) => ({ ...topic, items: topic.items.filter((item) => matches(query, l(item.title), l(item.body), item.keys?.win ?? "", l(topic.title))) }))
        .filter((topic) => topic.items.length > 0)
    : topics.filter((topic) => topic.id === topicId);

  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [topicId]);

  return (
    <div className="guide-body">
      <nav aria-label={t("guideTab")}>
        <SearchField value={query} onChange={setQuery} placeholder={t("searchGuide")} />
        {topics.map((topic, index) => (
          <button
            key={topic.id}
            className={!query.trim() && topic.id === topicId ? "on" : ""}
            aria-current={!query.trim() && topic.id === topicId ? "page" : undefined}
            onClick={() => {
              setQuery("");
              setTopicId(topic.id);
            }}
          >
            <span>
              {index + 1}. {l(topic.title)}
            </span>
            {topic.items.some((item) => isNew(item.since, current)) && <span className="badge">{t("newBadge")}</span>}
          </button>
        ))}
      </nav>
      <div ref={main} className="guide-main selectable" tabIndex={0}>
        {shown.length === 0 && <p className="guide-empty">{t("noGuideResults", { query })}</p>}
        {shown.map((topic) => (
          <section key={topic.id} className="guide-topic">
            <h3>{l(topic.title)}</h3>
            {!query.trim() && <p className="intro">{l(topic.intro)}</p>}
            {topic.items.map((item) => (
              <article key={item.id} className="guide-item">
                <div className="guide-item-head">
                  <h4>{l(item.title)}</h4>
                  {isNew(item.since, current) && <span className="badge">{t("newIn", { version: item.since })}</span>}
                  {item.keys?.win && <kbd>{keyLabel(item.keys.win, language)}</kbd>}
                </div>
                <p>{l(item.body)}</p>
                {item.try && (
                  <button className="btn" onClick={() => run(item.try!)}>
                    {t("tryNow")}
                  </button>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function ShortcutsPane() {
  const { t, language } = useApp();
  const [query, setQuery] = useState("");
  const groups = shortcutGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => matches(query, item.label[language], item.win ?? "")) }))
    .filter((group) => group.items.length > 0);
  return (
    <div className="guide-shortcuts">
      <SearchField value={query} onChange={setQuery} placeholder={t("searchShortcut")} />
      {groups.length === 0 && <p className="guide-empty">{t("noGuideResults", { query })}</p>}
      <div className="groups">
        {groups.map((group) => (
          <section key={group.title.en}>
            <h3>{group.title[language]}</h3>
            <dl>
              {group.items.map((item) => (
                <div key={item.label.en}>
                  <dt>{item.label[language]}</dt>
                  <dd>
                    <kbd>{keyLabel(item.win!, language)}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

function NewsPane({ current }: { current: string }) {
  const { t, language } = useApp();
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const [selected, setSelected] = useState(releases[0]?.version ?? "");
  const notes = useMemo(() => releases.map((r) => ({ ...r, text: inLanguage(r.notes, language).replace(/^### /gm, "## ") })), [language]);
  const date = (iso: string) => {
    const parsed = new Date(`${iso}T12:00:00`);
    return isNaN(parsed.getTime()) ? iso : parsed.toLocaleDateString(language, { day: "numeric", month: "long", year: "numeric" });
  };
  return (
    <div className="guide-body">
      <nav aria-label={t("newsTab")} className="versions">
        {notes.map((release) => (
          <button
            key={release.version}
            className={release.version === selected ? "on" : ""}
            onClick={() => {
              setSelected(release.version);
              refs.current[release.version]?.scrollIntoView({ block: "start" });
            }}
          >
            <span>{release.version}</span>
            {release.version === current && <span className="hint">{t("yourVersion")}</span>}
          </button>
        ))}
      </nav>
      <div className="guide-main selectable news" tabIndex={0} aria-label={t("newsTab")}>
        {notes.map((release) => (
          <article key={release.version} ref={(el) => void (refs.current[release.version] = el)}>
            <h3>
              Lost &amp; Prompt {release.version}
              <span className="date">
                {release.date && date(release.date)}
                {release.version === current && ` · ${t("yourVersion")}`}
              </span>
            </h3>
            <Markdown text={release.text} query="" current={0} />
          </article>
        ))}
      </div>
    </div>
  );
}
