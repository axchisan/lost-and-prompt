import { useMemo, useState } from "react";
import { Folder, House } from "lucide-react";
import { grouped, usd } from "../format";
import { useApp } from "../state";

/** Estadísticas globales, en una sola pantalla tranquila. */
export function Activity() {
  const { t, language, library } = useApp();
  const [period, setPeriod] = useState(30);

  const { sessions, total, daily, top, start } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - period + 1);
    const sessions = library.sessions.filter((s) => s.userMessages > 0 && new Date(s.lastActivity) >= start);
    const total = sessions.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
    const days = Math.min(period, 90);
    const daily = Array.from({ length: days }, (_, i) => {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i));
      const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
      return sessions
        .filter((s) => {
          const d = new Date(s.lastActivity);
          return d >= day && d < next;
        })
        .reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
    });
    const byFolder = new Map<string, number>();
    for (const s of sessions) byFolder.set(s.cwd, (byFolder.get(s.cwd) ?? 0) + (s.costUsd ?? 0));
    const top = [...byFolder.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { sessions, total, daily, top, start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1) };
  }, [library.sessions, period]);

  const maxDay = Math.max(...daily, 0.01);
  const maxFolder = top[0]?.[1] || 1;
  const dateLabel = (d: Date) => d.toLocaleDateString(language === "en" ? "en-US" : "es", { day: "numeric", month: "short" });

  return (
    <main className="column activity" aria-label={t("activity")}>
      <div className="activity-inner">
        <header>
          <div>
            <h1>{t("activity")}</h1>
            <p>{t("costNote")}</p>
          </div>
          <div className="segmented text">
            {[
              [7, t("days7")],
              [30, t("days30")],
              [3650, t("allTime")],
            ].map(([value, label]) => (
              <button key={value} className={period === value ? "on" : ""} onClick={() => setPeriod(value as number)}>
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="summary">
          <div>
            <b>{usd(total, language)}</b>
            <span>{t("estimatedCost")}</span>
          </div>
          <div>
            <b>{grouped(sessions.length, language)}</b>
            <span>{t("inSessions")}</span>
          </div>
          <div>
            <b>{grouped(sessions.reduce((sum, s) => sum + s.userMessages, 0), language)}</b>
            <span>{t("yourMessages")}</span>
          </div>
          <div>
            <b>{grouped(new Set(sessions.map((s) => s.cwd)).size, language)}</b>
            <span>{t("folders")}</span>
          </div>
        </div>

        <div className="chart">
          <h2>{t("costPerDay")}</h2>
          <div className="bars" role="img" aria-label={t("costPerDay")}>
            {daily.map((value, i) => (
              <div key={i} style={{ height: `${(value / maxDay) * 100}%` }} title={usd(value, language)} />
            ))}
          </div>
          <div className="axis">
            <span>{dateLabel(start)}</span>
            <span>{dateLabel(new Date())}</span>
          </div>
        </div>

        <div className="top-folders">
          <h2>{t("topFolders")}</h2>
          {top.map(([path, cost]) => (
            <div key={path} className="folder-row" title={path}>
              <span>
                {path === library.home ? <House size={15} /> : <Folder size={15} />}
                {path === library.home ? t("home") : path.split(/[\\/]/).filter(Boolean).pop()}
              </span>
              <div className="bar" style={{ width: `${Math.max(2, (cost / maxFolder) * 100)}%` }} />
              <em>{usd(cost, language)}</em>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
