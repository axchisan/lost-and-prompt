"""Analiza una pista para montar el vídeo a su ritmo.

Uso: .venv/bin/python tools/analyze_music.py <pista.mp3> [salida.json]

Saca el tempo, cada golpe (beat) y el primero de cada compás (downbeat aproximado, cada 4 golpes
desde el golpe más fuerte del inicio), la energía por medio segundo y los «drops»: los saltos de
energía más grandes, donde conviene poner los cortes y momentos clave. El JSON lo lee Remotion.
"""
import json
import sys

import librosa
import numpy as np

path = sys.argv[1]
y, sr = librosa.load(path, sr=22050, mono=True)
duration = len(y) / sr

tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
beats = librosa.frames_to_time(beat_frames, sr=sr)
onset_env = librosa.onset.onset_strength(y=y, sr=sr)
strength = onset_env[np.clip(beat_frames, 0, len(onset_env) - 1)]

# Compases: de las 4 fases posibles, la que tiene golpes más fuertes es la del primer tiempo.
phase = int(np.argmax([strength[i::4].mean() if len(strength[i::4]) else 0 for i in range(4)]))
bars = beats[phase::4]

hop = 512
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
step = 0.5
energy = []
for t in np.arange(0, duration, step):
    window = rms[(times >= t) & (times < t + step)]
    energy.append(float(window.mean()) if len(window) else 0.0)
energy = np.array(energy)
energy_norm = (energy / energy.max()).round(3) if energy.max() > 0 else energy

# Drops: subida de energía entre los 2 s anteriores y los 2 s siguientes.
drops = []
w = int(2 / step)
for i in range(w, len(energy) - w):
    rise = energy[i : i + w].mean() - energy[i - w : i].mean()
    drops.append((rise, i * step))
drops.sort(reverse=True)
picked = []
for rise, t in drops:
    if rise <= 0:
        break
    if all(abs(t - p) > 4 for p, _ in picked):
        # Se ajusta al compás más cercano: los cambios de la música caen ahí.
        nearest = float(bars[np.argmin(np.abs(bars - t))]) if len(bars) else t
        picked.append((nearest, float(rise / energy.max())))
    if len(picked) == 6:
        break

result = {
    "file": path.split("/")[-1],
    "duration": round(duration, 3),
    "bpm": round(float(np.atleast_1d(tempo)[0]), 2),
    "beats": [round(float(b), 3) for b in beats],
    "bars": [round(float(b), 3) for b in bars],
    "energy_step": step,
    "energy": [float(e) for e in energy_norm],
    "drops": sorted([{"time": round(t, 3), "rise": round(r, 3)} for t, r in picked], key=lambda d: d["time"]),
}
if len(sys.argv) > 2:
    with open(sys.argv[2], "w") as f:
        json.dump(result, f)

# Resumen legible: energía en una línea por cada 2 s, para ver la forma de la pista.
blocks = " ▁▂▃▄▅▆▇█"
line = "".join(blocks[min(8, int(e * 8.99))] for e in energy_norm[::2])
print(f"{result['file']}: {result['duration']:.1f}s · {result['bpm']} BPM · {len(beats)} golpes · {len(bars)} compases")
print(f"  energía (1 car = 1 s): {line}")
print("  drops: " + ", ".join(f"{d['time']:.1f}s (+{d['rise']:.2f})" for d in result["drops"]))
