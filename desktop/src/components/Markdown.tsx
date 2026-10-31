import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useApp } from "../state";

/** Bloques de Markdown de un mensaje: lo que Claude Code escribe en sus respuestas. */
export type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "code"; language: string; text: string }
  | { kind: "list"; items: { marker: string; level: number; text: string }[] }
  | { kind: "quote"; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "rule" };

type Token =
  | { kind: "text" | "strong" | "em" | "code" | "del"; text: string }
  | { kind: "link"; text: string; href: string };

// MARK: Análisis

const blockCache = new Map<string, Block[]>();

export function blocks(text: string): Block[] {
  const cached = blockCache.get(text);
  if (cached) return cached;
  if (blockCache.size > 4000) blockCache.clear();
  const parsed = parse(text);
  blockCache.set(text, parsed);
  return parsed;
}

const listItem = /^( *)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const tableSeparator = /^\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?$/;

export function parse(text: string): Block[] {
  const lines = text.split("\n");
  const result: Block[] = [];
  let paragraph: string[] = [];
  let i = 0;
  const flush = () => {
    const joined = paragraph.join("\n").replace(/^\n+|\n+$/g, "");
    if (joined.trim()) result.push({ kind: "paragraph", text: joined });
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const fence = ["```", "~~~"].find((f) => trimmed.startsWith(f));
    if (fence) {
      flush();
      const language = trimmed.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) code.push(lines[i++]);
      result.push({ kind: "code", language, text: code.join("\n") });
      i++;
      continue;
    }
    if (!trimmed) {
      flush();
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*$/.exec(trimmed);
    if (heading) {
      flush();
      result.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (/^((-\s*){3,}|(\*\s*){3,}|(_\s*){3,})$/.test(trimmed)) {
      flush();
      result.push({ kind: "rule" });
      i++;
      continue;
    }
    if (trimmed.startsWith(">")) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) quote.push(lines[i++].trim().slice(1).trim());
      result.push({ kind: "quote", text: quote.join("\n") });
      continue;
    }
    if (listItem.test(line)) {
      flush();
      const items: { marker: string; level: number; text: string }[] = [];
      while (i < lines.length) {
        const match = listItem.exec(lines[i]);
        if (match) {
          const marker = /^\d/.test(match[2]) ? match[2].replace(")", ".") : "•";
          items.push({ marker, level: Math.floor(match[1].length / 2), text: match[3] });
        } else if (items.length && lines[i].startsWith("  ") && lines[i].trim()) {
          items[items.length - 1].text += "\n" + lines[i].trim();
        } else {
          break;
        }
        i++;
      }
      result.push({ kind: "list", items });
      continue;
    }
    if (trimmed.startsWith("|") && i + 1 < lines.length && lines[i + 1].includes("-") && tableSeparator.test(lines[i + 1].trim())) {
      flush();
      const header = cells(trimmed);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++].trim()));
      result.push({ kind: "table", header, rows });
      continue;
    }
    paragraph.push(line);
    i++;
  }
  flush();
  return result;
}

function cells(row: string) {
  const parts = row.split("|").map((c) => c.trim());
  if (parts[0] === "") parts.shift();
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

/** Negrita, cursiva, `código`, ~~tachado~~ y enlaces dentro de una línea. */
function inline(text: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\[[^\]\n]+\]\([^)\s]+\)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_(?![A-Za-z0-9]))/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ kind: "text", text: text.slice(last, index) });
    const raw = match[0];
    if (raw.startsWith("`")) tokens.push({ kind: "code", text: raw.slice(1, -1) });
    else if (raw.startsWith("**") || raw.startsWith("__")) tokens.push({ kind: "strong", text: stripLink(raw.slice(2, -2)) });
    else if (raw.startsWith("~~")) tokens.push({ kind: "del", text: raw.slice(2, -2) });
    else if (raw.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(raw)!;
      tokens.push({ kind: "link", text: link[1], href: link[2] });
    } else if (raw.startsWith("http")) tokens.push({ kind: "link", text: raw, href: raw });
    else tokens.push({ kind: "em", text: raw.slice(1, -1) });
    last = index + raw.length;
  }
  if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) });
  return tokens;
}

/** `**[texto](url)**`: se queda el texto (la negrita no lleva enlaces dentro aquí). */
function stripLink(text: string) {
  return text.replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1");
}

// MARK: Coincidencias

/** Textos del bloque en el orden en que se ven: se resalta y se cuenta token a token. */
function texts(block: Block): string[] {
  switch (block.kind) {
    case "paragraph":
    case "heading":
    case "quote":
      return inline(block.text).map((t) => t.text);
    case "code":
      return [block.text];
    case "list":
      return block.items.flatMap((item) => inline(item.text).map((t) => t.text));
    case "table":
      return [...block.header, ...block.rows.flat()].flatMap((cell) => inline(cell).map((t) => t.text));
    case "rule":
      return [];
  }
}

function fold(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Posiciones de `query` en `text`, sin distinguir mayúsculas ni tildes. */
function ranges(text: string, query: string): [number, number][] {
  if (!query) return [];
  // Quitar las tildes con NFD no cambia la longitud del texto base si se trabaja carácter a carácter.
  const map: number[] = [];
  let folded = "";
  for (let i = 0; i < text.length; i++) {
    const piece = fold(text[i]);
    for (let j = 0; j < piece.length; j++) map.push(i);
    folded += piece;
  }
  const needle = fold(query);
  const found: [number, number][] = [];
  let from = 0;
  while (needle && (from = folded.indexOf(needle, from)) !== -1) {
    found.push([map[from], map[from + needle.length - 1] + 1]);
    from += needle.length;
  }
  return found;
}

export function countMatches(text: string, query: string): number {
  if (!query) return 0;
  return blocks(text).reduce((sum, block) => sum + texts(block).reduce((n, t) => n + ranges(t, query).length, 0), 0);
}

// MARK: Vista

/** Lleva la cuenta de coincidencias mientras se dibuja un mensaje, en orden. */
interface Highlighter {
  query: string;
  /** Ordinal de la coincidencia actual relativo al inicio del mensaje. */
  current: number;
  seen: number;
}

function highlighted(text: string, h: Highlighter | null, key: string): ReactNode {
  if (!h) return text;
  const found = ranges(text, h.query);
  if (!found.length) return text;
  const nodes: ReactNode[] = [];
  let last = 0;
  found.forEach(([start, end], i) => {
    if (start > last) nodes.push(text.slice(last, start));
    const current = h.seen === h.current;
    nodes.push(
      <mark key={`${key}-${i}`} className={current ? "find current" : "find"}>
        {text.slice(start, end)}
      </mark>,
    );
    h.seen++;
    last = end;
  });
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderInline(text: string, h: Highlighter | null, key: string): ReactNode[] {
  return inline(text).map((token, i) => {
    const content = highlighted(token.text, h, `${key}-${i}`);
    switch (token.kind) {
      case "strong":
        return <strong key={i}>{content}</strong>;
      case "em":
        return <em key={i}>{content}</em>;
      case "code":
        return <code key={i}>{content}</code>;
      case "del":
        return <del key={i}>{content}</del>;
      case "link":
        return (
          <a
            key={i}
            href={token.href}
            onClick={(e) => {
              e.preventDefault();
              if (/^https?:\/\//.test(token.href)) openUrl(token.href);
            }}
          >
            {content}
          </a>
        );
      default:
        return <span key={i}>{content}</span>;
    }
  });
}

export function Markdown({ text, query, current }: { text: string; query: string; current: number }) {
  const h: Highlighter | null = query ? { query, current, seen: 0 } : null;
  return (
    <div className="markdown">
      {blocks(text).map((block, index) => {
        const key = `b${index}`;
        switch (block.kind) {
          case "paragraph":
            return <p key={key}>{renderInline(block.text, h, key)}</p>;
          case "heading": {
            const Tag = (block.level <= 1 ? "h4" : block.level === 2 ? "h5" : "h6") as "h4";
            return <Tag key={key}>{renderInline(block.text, h, key)}</Tag>;
          }
          case "code":
            return <CodeBlock key={key} language={block.language} code={block.text} content={highlighted(block.text, h, key)} />;
          case "list":
            return (
              <div key={key} className="md-list">
                {block.items.map((item, i) => (
                  <div key={i} className="md-item" style={{ paddingLeft: item.level * 18 }}>
                    <span className="marker">{item.marker}</span>
                    <span>{renderInline(item.text, h, `${key}-${i}`)}</span>
                  </div>
                ))}
              </div>
            );
          case "quote":
            return <blockquote key={key}>{renderInline(block.text, h, key)}</blockquote>;
          case "table":
            return (
              <div key={key} className="md-table">
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, i) => (
                        <th key={i}>{renderInline(cell, h, `${key}-h${i}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>{renderInline(cell, h, `${key}-${r}-${c}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "rule":
            return <hr key={key} />;
        }
      })}
    </div>
  );
}

function CodeBlock({ language, code, content }: { language: string; code: string; content: ReactNode }) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <div className="code-head">
        <span>{language || t("code")}</span>
        <button
          className="link-btn"
          title={t("copyCode")}
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t("codeCopied") : t("copy")}
        </button>
      </div>
      <pre>
        <code>{content}</code>
      </pre>
    </div>
  );
}
