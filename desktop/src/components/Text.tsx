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

/** Texto sin marcas de Markdown, para vistas previas de una o dos líneas. */
export function plain(text: string) {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
}
