import type { ReactNode } from "react";

/** Fragmento de búsqueda con la coincidencia (entre `\u0001` y `\u0002`) resaltada. */
export function Snippet({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\u0001[^\u0002]*\u0002)/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith("\u0001") ? <mark key={i}>{part.slice(1, -1)}</mark> : <span key={i}>{part}</span>,
      )}
    </span>
  );
}

/** Markdown en línea: **negrita** y `código`. Los saltos de línea se respetan con CSS. */
export function InlineMarkdown({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const token = match[0];
    nodes.push(token.startsWith("**") ? <strong key={index}>{token.slice(2, -2)}</strong> : <code key={index}>{token.slice(1, -1)}</code>);
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

/** Texto sin marcas de Markdown, para vistas previas de una o dos líneas. */
export function plain(text: string) {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
}
