"""Monta el vídeo v3 en el editor de vídeo de Blender a partir de la EDL.

Se ejecuta dentro de Blender con la plantilla «Editar vídeo» abierta (por MCP, en la consola o en
segundo plano), indicando idioma y formato; guarda edit/lanzamiento-<idioma>-<formato>.blend:
    LP_LANG, LP_FORMAT = "es", "9x16"; exec(open("/…/promo/edit/build_blender.py").read())
En segundo plano (monta y renderiza sin abrir la ventana):
    Blender -b edit/lanzamiento.blend --python-expr 'LP_LANG="en";LP_FORMAT="9x16";exec(open("edit/build_blender.py").read())' -a

Pistas (canales):
    2…12   tomas de la app, una por escena; la que entra va siempre encima
    20     capa gráfica de Remotion (ProRes 4444 con alfa): cursor, rótulos, titulares, transiciones
    21–22  música (dos trozos de la misma pista unidos en un compás)
    23+    efectos de sonido
La cámara de cada toma son keyframes de escala y desplazamiento: se pueden retocar a mano.
"""
import json
import math

import bpy

ROOT = "/Users/mac/Documents/Dev/Apps/LostAndPrompt/promo"
LANG, FORMAT = globals().get("LP_LANG", "es"), globals().get("LP_FORMAT", "16x9")
edl = json.load(open(f"{ROOT}/edit/edl-{LANG}-{FORMAT}.json"))
W, H, FPS = edl["width"], edl["height"], edl["fps"]
B = lambda fr: int(fr) + 1  # fotograma de la EDL (desde 0) → fotograma de Blender (desde 1)

scene = bpy.context.scene
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = W, H, 100
scene.render.fps, scene.render.fps_base = FPS, 1
scene.frame_start, scene.frame_end = 1, edl["frames"]
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.sequencer_colorspace_settings.name = "sRGB"
ed = scene.sequence_editor or scene.sequence_editor_create()
for strip in list(ed.strips):
    ed.strips.remove(strip)
for marker in list(scene.timeline_markers):
    scene.timeline_markers.remove(marker)
if scene.animation_data:
    scene.animation_data_clear()

ease = lambda k: k * k * (3 - 2 * k)  # suave al entrar y al salir


def keyframes(strip, frames):
    """frames: lista de (fotograma Blender, {propiedad: valor}). Interpolación lineal (la curva ya viene muestreada)."""
    for fr, props in frames:
        for prop, value in props.items():
            target = strip.transform if prop in ("scale_x", "scale_y", "offset_x", "offset_y") else strip
            setattr(target, prop, value)
            target.keyframe_insert(prop, frame=fr)


# Fondo blanco: se ve donde la toma no llena el cuadro (formato vertical en «explicación»).
bg = ed.strips.new_effect("fondo blanco", "COLOR", channel=1, frame_start=1, length=edl["frames"])
bg.color = (1.0, 1.0, 1.0)
bg.width, bg.height = W, H  # en Blender 5 la pista de color mide 1×1 px si no se indica

scenes = edl["scenes"]
for i, s in enumerate(scenes):
    strip = ed.strips.new_movie(f"{i:02d} {s['name']}", f"{ROOT}/{s['media']}", channel=2 + i, frame_start=B(s["first"]), fit_method="FIT")
    strip.frame_final_end = B(s["last"])
    strip.blend_type = "ALPHA_OVER"
    nxt = scenes[i + 1] if i + 1 < len(scenes) else None
    push_out = nxt and nxt["in"]["type"] == "push-left"
    keys = []
    cams = s["camera"]
    for j, cam in enumerate(cams):
        last = j == len(cams) - 1
        if j % 2 and not last:
            continue
        fr = cam["f"]
        S = cam["scale"]
        fit = W / s["sourceSize"][0]  # «ajustar al cuadro» de Blender es esta escala base
        ox = -(cam["x"] - 0.5) * W * S
        oy = (cam["y"] - 0.5) * s["sourceSize"][1] * fit * S  # alto mostrado de la toma (puede no ser H)
        # Empuje lateral: la toma que entra llega desde la derecha y la que sale se va a la izquierda.
        if s["in"]["type"] == "push-left" and fr < s["first"] + s["in"]["frames"]:
            ox += W * (1 - ease((fr - s["first"]) / s["in"]["frames"]))
        if push_out and fr >= nxt["first"]:
            ox -= W * ease(min(1, (fr - nxt["first"]) / nxt["in"]["frames"]))
        keys.append((B(fr), {"scale_x": S * fit, "scale_y": S * fit, "offset_x": ox, "offset_y": oy}))
    keyframes(strip, keys)
    if s["in"]["type"] == "crossfade":
        keyframes(strip, [(B(s["first"]), {"blend_alpha": 0.0}), (B(s["first"] + s["in"]["frames"]), {"blend_alpha": 1.0})])

# Curvas de cámara lineales entre muestras (el suavizado ya está en los datos).
if scene.animation_data and scene.animation_data.action:
    action = scene.animation_data.action
    curves = []
    for layer in getattr(action, "layers", []):
        for st in layer.strips:
            for bag in st.channelbags:
                curves += list(bag.fcurves)
    for fc in curves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"

overlay = ed.strips.new_movie("gráficos (Remotion)", f"{ROOT}/edit/media/overlay-{LANG}-{FORMAT}.mov", channel=20, frame_start=1, fit_method="FIT")
overlay.blend_type = "ALPHA_OVER"
overlay.frame_final_end = edl["frames"] + 1

# Música: el trozo A hasta el salto y el B desde el compás 45,859 s de la pista.
music = f"{ROOT}/public/{edl['music']['file']}"
jump = edl["music"]["jump"]
a = ed.strips.new_sound("música A", music, channel=21, frame_start=1)
a.frame_final_end = B(round(jump["at"] * FPS))
a.volume = 0.85
b = ed.strips.new_sound("música B", music, channel=22, frame_start=B(round(jump["at"] * FPS)) - round(jump["to"] * FPS))
b.frame_final_start = B(round(jump["at"] * FPS))
b.frame_final_end = edl["frames"] + 1
fade_from, fade_to = edl["music"]["fadeOut"]
keyframes(b, [(B(round(fade_from * FPS)), {"volume": 0.85}), (B(round(fade_to * FPS)), {"volume": 0.0})])

# Efectos de sonido: cada uno en el primer canal libre desde el 23.
busy = {}
for k, fx in enumerate(sorted(edl["sfx"], key=lambda x: x["at"])):
    start = B(max(0, round(fx["at"] * FPS)))
    channel = 23
    while busy.get(channel, 0) > start:
        channel += 1
    snd = ed.strips.new_sound(f"sfx {fx['src']}", f"{ROOT}/public/sfx/{fx['src']}.wav", channel=channel, frame_start=start)
    snd.volume = fx["volume"]
    busy[channel] = snd.frame_final_end

for name, t in edl["marks"].items():
    scene.timeline_markers.new(name, frame=B(round(t * FPS)))

# Render: H.264 + AAC (después se normaliza el volumen a -14 LUFS con ffmpeg).
r = scene.render
r.use_sequencer = True
r.image_settings.file_format = "FFMPEG"
r.ffmpeg.format = "MPEG4"
r.ffmpeg.codec = "H264"
r.ffmpeg.constant_rate_factor = "HIGH"
r.ffmpeg.ffmpeg_preset = "GOOD"
r.ffmpeg.audio_codec = "AAC"
r.ffmpeg.audio_bitrate = 320
r.ffmpeg.audio_mixrate = 48000
r.ffmpeg.audio_channels = "STEREO"
r.filepath = f"{ROOT}/out/v3-{LANG}-{FORMAT}-raw.mp4"

bpy.ops.wm.save_as_mainfile(filepath=f"{ROOT}/edit/lanzamiento-{LANG}-{FORMAT}.blend")
result = {
    "strips": len(ed.strips_all),
    "frames": edl["frames"],
    "channels": sorted({st.channel for st in ed.strips_all}),
    "file": bpy.data.filepath,
}
