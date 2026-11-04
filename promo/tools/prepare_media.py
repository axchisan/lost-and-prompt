"""Prepara las tomas de cada escena para el editor: recorta el tramo de la EDL, aplica la velocidad
y deja exactamente los fotogramas que ocupa en la línea de tiempo (60 fps, 5760×3240).
Así Blender coloca cada toma 1:1 y la cámara (keyframes) sigue siendo editable.

Uso: python3 tools/prepare_media.py edit/edl-es-16x9.json
"""
import json
import os
import subprocess
import sys

edl = json.load(open(sys.argv[1]))
os.makedirs("edit/media", exist_ok=True)
for i, s in enumerate(edl["scenes"]):
    frames = s["last"] - s["first"]
    src_in = max(0.0, s["srcIn"])
    out = f"edit/media/{i:02d}-{s['clip']}-{edl['lang']}.mp4"
    vf = f"setpts=(PTS-STARTPTS)/{s['rate']},fps=60,tpad=stop_mode=clone:stop_duration=3"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", f"{src_in:.4f}", "-i", f"public/{s['clipFile']}", "-vf", vf,
         "-frames:v", str(frames), "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", "-an", out],
        check=True,
    )
    s["media"] = out
    print(f"ok {out}: {frames} fotogramas")
json.dump(edl, open(sys.argv[1], "w"))
