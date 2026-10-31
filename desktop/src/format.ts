import type { Session } from "./api";
import type { Language, T } from "./i18n";

const locale = (language: Language) => (language === "en" ? "en-US" : "es");

function daysAgo(date: Date, now: Date) {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((start(now) - start(date)) / 86_400_000);
}

export interface DayGroup {
  title: string;
  sessions: Session[];
}

/** Agrupa por Hoy, Ayer, Esta semana, Este mes y Más antiguas, como en Mac. */
export function dayGroups(sessions: Session[], t: T, now = new Date()): DayGroup[] {
  const buckets: [string, Session[]][] = [
    [t("today"), []],
    [t("yesterday"), []],
    [t("thisWeek"), []],
    [t("thisMonth"), []],
    [t("older"), []],
  ];
  for (const session of sessions) {
    const days = daysAgo(new Date(session.lastActivity), now);
    const index = days < 1 ? 0 : days === 1 ? 1 : days < 7 ? 2 : days < 31 ? 3 : 4;
    buckets[index][1].push(session);
  }
  return buckets.filter(([, list]) => list.length > 0).map(([title, list]) => ({ title, sessions: list }));
}

/** Hora para hoy y ayer, día de la semana para esta semana, fecha corta para lo demás. */
export function shortDate(value: string, language: Language, now = new Date()) {
  const date = new Date(value);
  const days = daysAgo(date, now);
  if (days < 2) return date.toLocaleTimeString(locale(language), { hour: "numeric", minute: "2-digit" });
  if (days < 7) return date.toLocaleDateString(locale(language), { weekday: "short" });
  return date.toLocaleDateString(locale(language), { day: "numeric", month: "short" });
}

export function relativeDay(value: string, language: Language, t: T, now = new Date()) {
  const date = new Date(value);
  const days = daysAgo(date, now);
  const time = date.toLocaleTimeString(locale(language), { hour: "numeric", minute: "2-digit" });
  if (days < 1) return t("todayAt", { time });
  if (days === 1) return t("yesterdayAt", { time });
  return `${date.toLocaleDateString(locale(language), { weekday: "long", day: "numeric", month: "long" })}, ${time}`;
}

export function timeOnly(value: string | null, language: Language) {
  return value ? new Date(value).toLocaleTimeString(locale(language), { hour: "numeric", minute: "2-digit" }) : "";
}

export function usd(value: number, language: Language) {
  return value.toLocaleString(locale(language), { style: "currency", currency: "USD" });
}

export function grouped(value: number, language: Language) {
  return value.toLocaleString(locale(language));
}
