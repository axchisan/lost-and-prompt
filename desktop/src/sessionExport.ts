import type { Message, Session } from "./api";
import type { Language, T } from "./i18n";
import { grouped, usd } from "./format";

/** Nombre de archivo a partir del título, sin caracteres que Windows no admite. */
export function exportFileName(session: Session, extension: string) {
  const base = session.title.replace(/[\\/:*?"<>|\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Claude Code";
  return `${base}.${extension}`;
}

/**
 * La conversación como Markdown, para leerla o compartirla: datos de la sesión arriba y luego tus
 * mensajes y las respuestas de Claude (sin el razonamiento ni las salidas de las herramientas).
 */
export function sessionMarkdown(session: Session, messages: Message[], t: T, language: Language) {
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleString(language, { dateStyle: "long", timeStyle: "short" }) : "";
  const lines = [`# ${session.title}`, ""];
  lines.push(`- ${t("exportFolder")}: \`${session.abbreviatedPath}\`${session.environment ? ` (WSL · ${session.environment})` : ""}`);
  lines.push(`- ${t("started")} ${date(session.startedAt)}`);
  lines.push(`- ${t("lastActivity")} ${date(session.lastActivity)}`);
  const facts = [session.model, `${grouped(session.userMessages, language)} ${session.userMessages === 1 ? t("message") : t("messages")}`];
  if (session.costUsd) facts.push(usd(session.costUsd, language));
  if (session.gitBranch) facts.push(`${t("gitBranch")}: \`${session.gitBranch}\``);
  lines.push(`- ${facts.join(" · ")}`, "", `> ${t("exportedWith")}`, "", "---", "");
  for (const message of messages) {
    if (message.thinking || (!message.text && !message.toolCount)) continue;
    const time = message.date ? new Date(message.date).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" }) : "";
    lines.push(`### ${message.role === "user" ? t("you") : t("claude")}${time ? ` · ${time}` : ""}`, "");
    if (message.text) lines.push(message.text.trim(), "");
    if (message.toolCount) lines.push(`_${message.toolCount === 1 ? t("oneTool") : t("nTools", { n: message.toolCount })}_`, "");
  }
  return lines.join("\n").trimEnd() + "\n";
}
