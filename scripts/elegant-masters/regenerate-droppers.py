"""Regenerate the complete 18-415 droppers with Sunburst (gpt-image-2.5-sunburst), real glass pipettes.

Jordan (3 Nov 2026): the droppers lifted in EXPLODED come from the master library's photographs
(20. Caps / 29. 18-415 Droppers), whose glass pipette is baked near white and does not read as glass.
Sunburst redraws each finish with its geometry locked (the photograph, on grey so the outline shows),
the bulb and metal collar unchanged and the pipette as clear glass; the output maps back through the frame and
is cut with the photograph's alpha, so every finish keeps the photograph's shape.

Writes public/local-kits/elegant60-100-masters-2026-11-03/droppers/Drp18-415<finish>-r2.png, read by
universal-dip-tube-60-100.py. Usage: python3 scripts/elegant-masters/regenerate-droppers.py <work-dir>
"""
import os, sys
from importlib import import_module
from PIL import Image
from psd_tools import PSDImage

sys.path.insert(0, os.path.dirname(__file__))
tubes = import_module("psd-tubes-60-100")      # edit(), framed(), register(), GREY
ROOT = "/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/20. Caps/29. 18-415 Droppers"
OUT = "public/local-kits/elegant60-100-masters-2026-11-03/droppers"
MATERIAL = "public/reviews/elegant-master-candidates-2026-11-03/elegant60-clear-master-r3.png"
PROMPT = """1. Keep geometry locked to the first image (shown on grey only so its outline is visible): the same dropper, its rubber bulb, metal collar and glass pipette with its tip, the same outline, size and position in the frame. Do not redraw the shape.
2. Keep the bulb and the metal collar exactly as in the first image: the same colour, finish and highlights. Render the pipette as real clear glass, like the glass of the second image: transparent, the flat background seen through it unchanged, thin crisp grey edges with refraction highlights, the tip slightly darker where the glass is thicker. Not white, not milky, not frosted.
3. Crisp clean edges, photographic studio packshot quality.
Plain flat background #F5F3EF, no shadow, no floor, no bottle, no props, no text."""


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    tubes.framed(Image.open(MATERIAL).convert("RGBA")).save(f"{work}/material.png")
    for finish in ("Sl", "Gl", "Cu"):
        p = PSDImage.open(f"{ROOT}/Drp18-415{finish}.psd")
        for l in p.descendants():
            if l.name == "Background":
                l.visible = False
        layer = p.composite(force=True); layer = layer.crop(layer.getchannel("A").getbbox())
        tubes.framed(layer, ground=tubes.GREY).save(f"{work}/{finish}.geometry.png")
        raw = f"{work}/{finish}.raw.png"
        if not os.path.exists(raw):
            tubes.edit([f"{work}/{finish}.geometry.png", f"{work}/material.png"], PROMPT, raw)
        fr = tubes.framed(layer)
        ox, oy = (fr.width - layer.width) // 2, (fr.height - layer.height) // 2
        # Sunburst keeps the dropper where the frame put it (the gold fit measured scale 1.009, shift 3 px), and
        # outline matching on a light ground latched onto the wrong edges for silver and copper: map it back
        # through the frame directly.
        cut = Image.open(raw).convert("RGB").resize(fr.size, Image.LANCZOS).crop((ox, oy, ox + layer.width, oy + layer.height)).convert("RGBA")
        rep = "frame-aligned"
        cut.putalpha(layer.getchannel("A"))                          # the photograph's own outline
        cut.save(f"{OUT}/Drp18-415{finish}-r2.png", optimize=True)
        print(finish, rep)


if __name__ == "__main__":
    main()
