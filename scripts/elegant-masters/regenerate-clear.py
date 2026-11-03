"""Regenerate an Elegant clear master with Sunburst (gpt-image-2.5-sunburst).

Jordan (3 Nov 2026): the 60 ml clear candidate looked fake and too white, and the 30 ml clear has the
same subtle white square inside. Their bodies were filled near pure white (253) where the stage
ground (#F5F3EF, 245) should show through the glass. The register plate is the geometry authority
and already reads as real glass; the size's PSD bottle layer is a photograph of the same bottle.
Sunburst redraws the plate (first image, shape locked) as clear glass with the ground seen through
it, the photograph as material reference; regenerate-frosted.py's pipeline then registers the
output uniformly onto the plate and cuts it with the plate's alpha.

Writes public/reviews/elegant-master-candidates-2026-11-03/elegant<size>-clear-master-r3.png.
Usage: python3 scripts/elegant-masters/regenerate-clear.py <30|60> <work-dir>
"""
import os, sys
from importlib import import_module
from PIL import Image
from psd_tools import PSDImage

sys.path.insert(0, os.path.dirname(__file__))
pipeline = import_module("regenerate-frosted")
SIZES = {  # size: (plate key, PSD, bottle layer)
    "60": ("elegant-60ml-18-415|Clear",
           "/Volumes/Achive/Client Work/Nemat-International/Best-Bottles-Original-Photoshop-Sources/2. 18-415 Bottles/17. Elegant 60ml/1. Elegant 60ml PSD/17. GBElg60SpryShnGl.psd", "Layer 16"),
    "30": ("elegant-30ml-15-415|Clear",
           "/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master/4.  15-415 Bottles/5. Elegant Clear 30ml - Capped/Elegant Clear 30/2. GBElg30SpryShnGl.psd", "Layer 21"),
}
PROMPT = """1. Keep geometry locked to the first image: the same bottle outline, neck threads, shoulder line, rounded corners and base, at the same position and size in the frame. Do not redraw the shape.
2. Clear, colourless glass as in a studio photograph (the second image is a photograph of this same bottle): fully transparent, the flat background seen through the body unchanged, not whiter, not milky, not frosted; crisp dark refraction lines along the edges and corners, a thick clear base with its refraction, crisp clear neck threads. No tube, no liquid, no label.
3. Enhance the quality: clean edges, photographic studio packshot.
Plain flat background #F5F3EF, no shadow, no floor, no props, no text."""


def main():
    size, work = sys.argv[1], sys.argv[2]; os.makedirs(work, exist_ok=True)
    plate_key, psd, layer = SIZES[size]
    named = {l.name: l for l in PSDImage.open(psd).descendants()}
    photo = named[layer].composite(); photo = photo.crop(photo.getchannel("A").getbbox())
    pad = Image.new("RGBA", (max(photo.width, round(photo.height / 1.4)), photo.height), (0, 0, 0, 0))   # room for the 2:3 frame
    pad.alpha_composite(photo, ((pad.width - photo.width) // 2, 0))
    pad.save(f"{work}/psd-photo.png")
    pipeline.MATERIAL = f"{work}/psd-photo.png"
    pipeline.PROMPT = PROMPT
    pipeline.TARGETS = {plate_key: f"elegant{size}-clear-master-r3.png"}
    sys.argv = [sys.argv[0], work]
    pipeline.main()


if __name__ == "__main__":
    main()
