"""Últimas versiones del CHANGELOG, para que el aviso de actualización enseñe también las intermedias.

Uso:
    changelog_history.py CHANGELOG.md json 10   # [{"version", "date", "notes"}], la más nueva primero
    changelog_history.py CHANGELOG.md text 10   # las mismas secciones como texto («## [x.y.z] - fecha»)

Las apps filtran las versiones posteriores a la instalada y el idioma (cada sección trae inglés y
español); quien se salta varias versiones ve lo que trajo cada una.
"""
import json
import re
import sys

path, mode, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])
heading = re.compile(r"^## \[(\d+\.\d+\.\d+)\](?: - (\S+))?")
versions, current = [], None
for line in open(path, encoding="utf-8").read().splitlines():
    match = heading.match(line)
    if match:
        current = {"version": match[1], "date": match[2] or "", "lines": []}
        versions.append(current)
    elif line.startswith("## ") or re.match(r"^\[[^\]]+\]: ", line):
        current = None  # [Unreleased] y los enlaces del final no son notas
    elif current is not None:
        current["lines"].append(line)

history = [{"version": v["version"], "date": v["date"], "notes": "\n".join(v["lines"]).strip()} for v in versions[:limit]]
if mode == "json":
    print(json.dumps(history, ensure_ascii=False))
else:
    print("\n\n".join(f"## [{v['version']}] - {v['date']}\n\n{v['notes']}" for v in history))
