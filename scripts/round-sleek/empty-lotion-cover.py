"""A truly empty 18-415 clear lotion overcap for the parked and seated cover.

Jordan (3 Nov 2026): "same ghost issue on the side car". The register's empty cover
(/assets/register/overcaps/ltn-18-415-clear-overcap.webp), which every clear-overcap lotion kit parks beside the
glass in SIDECAR and seats over the pump, still shows a lighter band where the pump stood inside it when it was
photographed. Sunburst redraws it empty with its outline locked, as for the Elegant white treatment pump's cover
(scripts/elegant-masters/white-lotion-kits-60-100.py); its alpha comes from how far each pixel stands off the
ground, cut to the cover's own outline, so the clear shell stays see-through. seat-and-tubes.py draws it in place
of the register file (EMPTY_COVER).

Writes public/local-kits/shared-2026-11-03/ltn-18-415-clear-overcap-empty.png.
Usage: python3 scripts/round-sleek/empty-lotion-cover.py <work-dir>
"""
import importlib.util, os, sys
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location("elegant_tubes", "scripts/elegant-masters/psd-tubes-60-100.py")
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)

SOURCE = "public/assets/register/overcaps/ltn-18-415-clear-overcap.webp"
OUT = "public/local-kits/shared-2026-11-03/ltn-18-415-clear-overcap-empty.png"
BONE = (245, 243, 239)
PROMPT = """1. Keep geometry locked to the first image (shown on grey only so its outline is visible): the same round clear overcap shell, the same outline, size, top rim and wall thickness, at the same position in the frame.
2. The cover is empty: remove the lighter band and any shape of a pump or tube seen inside it. A clear acrylic shell with soft grey edges, a light top rim and faint vertical highlights on its curved walls, its inside clear and see-through to the background.
3. Crisp clean edges, photographic studio packshot quality.
Plain flat background #F5F3EF, no shadow, no floor, no pump, no bottle, no props, no text."""


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True); os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cover = Image.open(SOURCE).convert("RGBA")
    E.framed(cover, ground=E.GREY).save(f"{work}/cover.geometry.png")
    raw = f"{work}/cover.raw.png"
    if not os.path.exists(raw):
        E.edit([f"{work}/cover.geometry.png"], PROMPT, raw)
    fr = E.framed(cover)
    ox, oy = (fr.width - cover.width) // 2, (fr.height - cover.height) // 2
    pad = Image.new("RGBA", fr.size, (0, 0, 0, 0)); pad.alpha_composite(cover, (ox, oy))
    cut, rep = E.register(Image.open(raw).resize(fr.size, Image.LANCZOS), pad)
    rgb = np.asarray(cut.convert("RGB")).astype(float)[oy:oy + cover.height, ox:ox + cover.width]
    outline = np.asarray(cover)[..., 3].astype(float) / 255
    a = np.clip(np.abs(rgb - BONE).max(axis=2) / 40, 0.1, 1) * outline
    colour = np.clip((rgb - np.array(BONE) * (1 - a[..., None])) / np.maximum(a[..., None], 1e-3), 0, 255)
    Image.fromarray(np.dstack([colour, a * 255]).astype(np.uint8)).save(OUT)
    print(rep, OUT)


if __name__ == "__main__":
    main()
