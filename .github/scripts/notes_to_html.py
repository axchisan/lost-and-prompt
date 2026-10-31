"""Convierte las notas del CHANGELOG (Markdown sencillo) en HTML para el aviso de Sparkle."""
import html
import re
import sys

lines = open(sys.argv[1], encoding="utf-8").read().splitlines()
blocks, item = [], None


def flush():
    global item
    if item is not None:
        blocks.append(("li", item))
        item = None


def inline(text):
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)


for raw in lines:
    line = raw.rstrip()
    if line.startswith("### "):
        flush()
        blocks.append(("h3", line[4:]))
    elif line.strip() == "---":
        flush()
        blocks.append(("hr", ""))
    elif line.startswith("- "):
        flush()
        item = line[2:]
    elif line.startswith("  ") and item is not None:
        item += " " + line.strip()
    elif line.strip():
        flush()
        blocks.append(("p", line.strip()))
    else:
        flush()
flush()

out, in_list = [], False
for kind, text in blocks:
    if kind == "li" and not in_list:
        out.append("<ul>")
        in_list = True
    if kind != "li" and in_list:
        out.append("</ul>")
        in_list = False
    out.append({"h3": f"<h3>{inline(text)}</h3>", "hr": "<hr>", "p": f"<p>{inline(text)}</p>", "li": f"<li>{inline(text)}</li>"}[kind])
if in_list:
    out.append("</ul>")
print('<div style="font: 13px -apple-system, sans-serif">' + "".join(out) + "</div>")
