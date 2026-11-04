#!/usr/bin/env python3
"""Genera las páginas /aprende y /novedades de la web desde la misma fuente que las apps.

Uso (desde la raíz del repositorio):
    python3 scripts/build_guide.py _site

Lee docs/guia/guia.json (la guía «Aprende a usarla») y CHANGELOG.md, y escribe
<salida>/aprende/index.html y <salida>/novedades/index.html con los tokens de color de
site/index.html. Lo ejecuta el build de Vercel (vercel.json); no hace falta guardar el resultado.
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
GUIDE = json.loads((ROOT / "docs/guia/guia.json").read_text(encoding="utf-8"))
CHANGELOG = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
INDEX = (ROOT / "site/index.html").read_text(encoding="utf-8")
SITE = "https://lostandprompt.axchisan.com"

ENGLISH = re.compile(r"^###\s+(Added|Changed|Fixed|Removed|Deprecated|Security)\b")
SPANISH = re.compile(r"^###\s+(Añadido|Cambiado|Corregido|Eliminado|Obsoleto|Seguridad)\b")
MONTHS = {
    "es": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
}


def e(text):
    return html.escape(text, quote=True)


def both(text):
    """Un texto {es, en} como dos spans que la página muestra según el idioma elegido."""
    return f'<span class="es">{e(text["es"])}</span><span class="en">{e(text["en"])}</span>'


def tokens():
    """Los colores y fuentes de la portada, para que las páginas se vean igual."""
    root = re.search(r":root \{.*?\n\}\n@media \(prefers-color-scheme: dark\) \{.*?\n\}", INDEX, re.S)
    if not root:
        sys.exit("No encontré los tokens de color en site/index.html")
    return root.group(0)


def kbd(keys):
    return f"<kbd>{e(keys)}</kbd>" if keys else '<span class="none">—</span>'


def inline(text):
    """Markdown en línea del CHANGELOG: `código`, **negrita** y [enlaces](url)."""
    out = e(text)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", out)
    out = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2">\1</a>', out)
    return out


def markdown(text):
    """Los bloques que usa el CHANGELOG: títulos ###, listas con «- » (y sus líneas de continuación) y párrafos."""
    blocks, items, paragraph = [], [], []

    def flush():
        if items:
            blocks.append("<ul>" + "".join(f"<li>{inline(i)}</li>" for i in items) + "</ul>")
            items.clear()
        if paragraph:
            blocks.append(f"<p>{inline(' '.join(paragraph))}</p>")
            paragraph.clear()

    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            flush()
        elif stripped.startswith("### "):
            flush()
            blocks.append(f"<h3>{inline(stripped[4:])}</h3>")
        elif stripped.startswith("- "):
            if paragraph:
                flush()
            items.append(stripped[2:])
        elif items and line.startswith("  "):
            items[-1] += " " + stripped
        else:
            if items:
                flush()
            paragraph.append(stripped)
    flush()
    return "\n".join(blocks)


def in_language(notes, language):
    """Igual que releaseNotes.ts / ReleaseNotes.swift: separa inglés y español."""
    lines = notes.split("\n")
    if any(l.strip() == "---" for l in lines):
        cut = next(i for i, l in enumerate(lines) if l.strip() == "---")
        return "\n".join(lines[cut + 1:] if language == "es" else lines[:cut]).strip()
    if not any(SPANISH.match(l) for l in lines):
        return notes.strip()
    kept, keep = [], True
    for line in lines:
        if ENGLISH.match(line):
            keep = language == "en"
        elif SPANISH.match(line):
            keep = language == "es"
        if keep:
            kept.append(line)
    return "\n".join(kept).strip()


def releases():
    found = []
    for match in re.finditer(r"^## \[(\d+\.\d+\.\d+)\](?: - (\S+))?\n(.*?)(?=^## \[|\Z)", CHANGELOG, re.S | re.M):
        notes = "\n".join(l for l in match.group(3).split("\n") if not re.match(r"^\[[^\]]+\]:\s*http", l))
        found.append((match.group(1), match.group(2) or "", notes))
    return found


def date(iso, language):
    year, month, day = (int(p) for p in iso.split("-"))
    name = MONTHS[language][month - 1]
    return f"{day} de {name} de {year}" if language == "es" else f"{name} {day}, {year}"


STYLE = """
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 var(--font); -webkit-font-smoothing: antialiased; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 max(16px, env(safe-area-inset-left)); }
nav { display: flex; align-items: center; justify-content: space-between; padding-block: 18px; gap: 12px; flex-wrap: wrap; }
nav .brand { display: flex; align-items: center; gap: 10px; font-weight: 650; color: var(--fg); }
nav .brand img { width: 30px; height: 30px; }
nav .links { display: flex; gap: 18px; align-items: center; font-size: 15px; flex-wrap: wrap; }
nav .links a { color: var(--muted); }
nav .links a[aria-current] { color: var(--fg); font-weight: 600; }
.lang { border: 1px solid var(--line); background: var(--card); color: var(--fg); border-radius: 8px; padding: 4px 10px; font: inherit; font-size: 14px; cursor: pointer; }
h1 { margin: 32px 0 8px; font: 700 clamp(32px, 5vw, 48px)/1.1 var(--display); letter-spacing: -.02em; }
.lead { margin: 0 0 28px; color: var(--muted); font-size: 18px; max-width: 680px; }
.layout { display: flex; gap: 40px; align-items: flex-start; flex-wrap: wrap; }
.toc { flex: 0 1 220px; position: sticky; top: 16px; display: grid; gap: 2px; font-size: 15px; }
.toc a { color: var(--muted); padding: 5px 0; }
.content { flex: 999 1 560px; min-width: 0; display: grid; gap: 44px; padding-bottom: 40px; }
section h2 { margin: 0 0 4px; font: 700 26px/1.2 var(--display); scroll-margin-top: 16px; }
section > p { margin: 0 0 16px; color: var(--muted); }
.item { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; scroll-margin-top: 16px; }
.item .head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.item h3 { margin: 0; font-size: 17px; flex: 1; min-width: 200px; }
.item p { margin: 8px 0 0; color: var(--muted); }
.keys { display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; color: var(--muted); align-items: center; }
kbd { font: 600 12.5px var(--font); background: var(--soft); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 6px; padding: 1px 7px; color: var(--fg); white-space: nowrap; }
.tag { font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 99px; background: var(--soft); color: var(--fg); border: 1px solid var(--line); }
.table-box { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 15px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 13px; color: var(--muted); font-weight: 600; }
td.group { padding-top: 22px; font-weight: 650; border-bottom: 0; }
.none { color: var(--muted); }
.release { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px 22px; scroll-margin-top: 16px; }
.release h2 { margin: 0; font: 700 22px/1.25 var(--display); }
.release .date { color: var(--muted); font-size: 14px; }
.release h3 { margin: 16px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.release ul { margin: 0; padding-left: 20px; }
.release li { margin: 4px 0; }
.release p { margin: 8px 0 0; }
code { font-family: var(--mono); font-size: 13.5px; background: var(--soft); padding: 1px 5px; border-radius: 5px; overflow-wrap: anywhere; }
footer a { color: var(--fg); text-decoration: underline; text-underline-offset: 2px; }
footer { padding-block: 40px; text-align: center; color: var(--muted); font-size: 14px; display: grid; gap: 8px; border-top: 1px solid var(--line); }
[data-lang="en"] .es, [data-lang="es"] .en { display: none !important; }
@media (max-width: 720px) { .toc { position: static; flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 2px 16px; } }
"""

SCRIPT = """<script>
(function () {
  var body = document.body, lang = "es";
  try { lang = localStorage.getItem("lang") === "en" ? "en" : "es"; } catch (e) {}
  function apply(next) {
    lang = next;
    body.dataset.lang = next;
    document.documentElement.lang = next;
    document.title = body.dataset["title" + (next === "es" ? "Es" : "En")];
    document.getElementById("lang").textContent = next === "es" ? "English" : "Español";
    try { localStorage.setItem("lang", next); } catch (e) {}
  }
  apply(lang);
  document.getElementById("lang").addEventListener("click", function () { apply(lang === "es" ? "en" : "es"); });
})();
</script>"""


def page(path, title, description, current, main):
    links = [("/aprende", {"es": "Aprende a usarla", "en": "Learn"}), ("/novedades", {"es": "Novedades", "en": "What's new"})]
    nav_links = "".join(
        f'<a href="{href}"{" aria-current=\"page\"" if href == current else ""}>{both(label)}</a>' for href, label in links
    )
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title["es"])}</title>
<meta name="description" content="{e(description["es"])}">
<meta property="og:title" content="{e(title["es"])}">
<meta property="og:description" content="{e(description["es"])}">
<meta property="og:image" content="{SITE}/og.png?v=2">
<meta property="og:url" content="{SITE}{path}">
<link rel="canonical" href="{SITE}{path}">
<link rel="icon" href="/icon.png">
<style>
{tokens()}
{STYLE}
</style>
</head>
<body data-lang="es" data-title-es="{e(title["es"])}" data-title-en="{e(title["en"])}">
<div class="wrap">
  <nav>
    <a class="brand" href="/"><img src="/icon.png" alt="">Lost &amp; Prompt</a>
    <div class="links">
      {nav_links}
      <a href="https://github.com/axchisan/lost-and-prompt">GitHub</a>
      <button class="lang" id="lang" type="button">English</button>
    </div>
  </nav>
  <main>
{main}
  </main>
  <footer>
    <div><a href="/">{both({"es": "Inicio", "en": "Home"})}</a> · <a href="https://github.com/axchisan/lost-and-prompt/releases">{both({"es": "Descargas", "en": "Downloads"})}</a> · <a href="https://github.com/axchisan/lost-and-prompt/issues/new/choose">{both({"es": "Reportar un problema", "en": "Report a problem"})}</a></div>
    <div>© 2026 axchisan · MIT · {both({"es": "Proyecto independiente, sin relación con Anthropic.", "en": "Independent project, not affiliated with Anthropic."})}</div>
  </footer>
</div>
{SCRIPT}
</body>
</html>
"""


def guide_page():
    platform = {"mac": {"es": "solo en Mac", "en": "Mac only"}, "win": {"es": "solo en Windows y Linux", "en": "Windows and Linux only"}}
    toc = "\n".join(f'<a href="#{t["id"]}">{i + 1}. {both(t["title"])}</a>' for i, t in enumerate(GUIDE["topics"]))
    sections = []
    for i, topic in enumerate(GUIDE["topics"]):
        items = []
        for item in topic["items"]:
            keys = item.get("keys") or {}
            key_html = ""
            if keys.get("mac") or keys.get("win"):
                parts = []
                if keys.get("mac"):
                    parts.append(f"Mac {kbd(keys['mac'])}")
                if keys.get("win"):
                    parts.append(f"Windows/Linux {kbd(keys['win'])}")
                key_html = f'<span class="keys">{" ".join(parts)}</span>'
            only = f'<span class="tag">{both(platform[item["only"]])}</span>' if item.get("only") else ""
            items.append(
                f'<article class="item" id="{topic["id"]}-{item["id"]}"><div class="head"><h3>{both(item["title"])}</h3>{only}{key_html}</div>'
                f'<p>{both(item["body"])}</p></article>'
            )
        sections.append(
            f'<section id="{topic["id"]}"><h2>{i + 1}. {both(topic["title"])}</h2><p>{both(topic["intro"])}</p>\n' + "\n".join(items) + "</section>"
        )
    rows = []
    for group in GUIDE["shortcuts"]:
        rows.append(f'<tr><td class="group" colspan="3">{both(group["title"])}</td></tr>')
        for item in group["items"]:
            rows.append(f'<tr><td>{both(item["label"])}</td><td>{kbd(item.get("mac"))}</td><td>{kbd(item.get("win"))}</td></tr>')
    shortcuts = (
        f'<section id="shortcuts"><h2>{len(GUIDE["topics"]) + 1}. {both({"es": "Atajos", "en": "Shortcuts"})}</h2>'
        f'<div class="table-box"><table><thead><tr><th>{both({"es": "Acción", "en": "Action"})}</th><th>Mac</th><th>Windows / Linux</th></tr></thead>'
        f'<tbody>{"".join(rows)}</tbody></table></div></section>'
    )
    toc += f'\n<a href="#shortcuts">{len(GUIDE["topics"]) + 1}. {both({"es": "Atajos", "en": "Shortcuts"})}</a>'
    main = f"""<h1>{both({"es": "Aprende a usar Lost & Prompt", "en": "Learn Lost & Prompt"})}</h1>
<p class="lead">{both({"es": "Todo lo que hace la app y cómo se usa, con sus atajos en Mac y en Windows/Linux. La misma guía está dentro de la app: menú Ayuda en Mac (⌘?) y el engranaje de la barra lateral en Windows y Linux (F1).", "en": "Everything the app does and how to use it, with its shortcuts on Mac and Windows/Linux. The same guide is inside the app: the Help menu on the Mac (⌘?) and the gear in the sidebar on Windows and Linux (F1)."})}</p>
<div class="layout">
<nav class="toc" aria-label="{e("Temas")}">{toc}</nav>
<div class="content">
{chr(10).join(sections)}
{shortcuts}
</div>
</div>"""
    return page(
        "/aprende",
        {"es": "Aprende a usar Lost & Prompt", "en": "Learn Lost & Prompt"},
        {"es": "Guía de todas las funciones de Lost & Prompt y sus atajos en Mac, Windows y Linux.", "en": "Guide to every Lost & Prompt feature and its shortcuts on Mac, Windows and Linux."},
        "/aprende",
        main,
    )


def news_page():
    found = releases()
    toc = "\n".join(f'<a href="#v{v}">{v}</a>' for v, _, _ in found)
    articles = []
    for version, iso, notes in found:
        when = f'<span class="date"><span class="es">{date(iso, "es")}</span><span class="en">{date(iso, "en")}</span></span>' if iso else ""
        articles.append(
            f'<article class="release" id="v{version}"><h2>Lost &amp; Prompt {version}</h2>{when}'
            f'<div class="es">{markdown(in_language(notes, "es"))}</div><div class="en">{markdown(in_language(notes, "en"))}</div></article>'
        )
    main = f"""<h1>{both({"es": "Novedades", "en": "What's new"})}</h1>
<p class="lead">{both({"es": "Lo que trajo cada versión de Lost & Prompt, desde la primera.", "en": "What every version of Lost & Prompt brought, since the first one."})}</p>
<div class="layout">
<nav class="toc" aria-label="Versiones">{toc}</nav>
<div class="content">
{chr(10).join(articles)}
</div>
</div>"""
    return page(
        "/novedades",
        {"es": "Novedades de Lost & Prompt", "en": "What's new in Lost & Prompt"},
        {"es": "El historial de versiones de Lost & Prompt: qué trajo cada una.", "en": "Lost & Prompt's version history: what each release brought."},
        "/novedades",
        main,
    )


def main():
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    for name, content in (("aprende", guide_page()), ("novedades", news_page())):
        target = out / name / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        print(f"ok {target}")


if __name__ == "__main__":
    main()
