"""Per-fitment frames: UNMASKED Sunburst edits of the base frame (masked inpainting repainted the plaster dark),
then a difference composite: inside the closure zone (niche interior minus bottle body) take the generated pixels
only where they differ from the base; everywhere else keep the base. Glass, sill, wall and plaster stay identical."""
import os, sys, json, urllib.request, concurrent.futures
sys.path.insert(0, os.path.dirname(__file__))
from sunburst import edit
from PIL import Image, ImageFilter
import numpy as np
S = os.environ.get("SKETCH_SCRATCH", "/tmp")
BASE = "public/assets/hero/frames/base-GBEmp50AnSpGl.png"
BASE_SKU = "GBEmp50AnSpGl"
W, H = 1536, 1024
NICHE = (822, 120, 1208, 800)          # interior incl. sill
BODY = (950, 428, 1118, 800)           # bottle body + sill under it: locked
# mask: alpha 0 = editable
mask = Image.new("RGBA", (W, H), (0, 0, 0, 255))
m = np.full((H, W), 255, np.uint8)
m[NICHE[1]:NICHE[3], NICHE[0]:NICHE[2]] = 0
m[BODY[1]:BODY[3], BODY[0]:BODY[2]] = 255
mask.putalpha(Image.fromarray(m)); mask.save("public/assets/hero/frames/_mask.png")
rows = json.load(open("scripts/hero-empire/empire-50-rows.json"))
only = sys.argv[1].split(",") if len(sys.argv) > 1 else None
todo = [r for r in rows if r["sku"] != BASE_SKU and (not only or r["sku"] in only)]
os.makedirs(f"{S}/refs", exist_ok=True)
def one(r):
    sku = r["sku"]; ref = f"{S}/refs/{sku}.png"
    if not os.path.exists(ref):
        urllib.request.urlretrieve(r["image"], ref + ".webp"); Image.open(ref + ".webp").convert("RGB").save(ref)
    out = f"public/assets/hero/frames/raw2-{sku}.png"
    if not os.path.exists(out):
        prompt = ("Replace the closure on the bottle in the first image with the exact closure shown on the same bottle in the second image — "
                  "same type, shape, proportions, colour and finish — fitted on the same neck at the same scale, lit by the niche's light from above with matching reflections. "
                  "Only the closure changes; the glass bottle, the sill, the plaster and the marble wall stay exactly as they are. No text.")
        edit(prompt, [BASE, ref], out)
    # difference composite inside the closure zone (m == 0), base everywhere else
    base = np.asarray(Image.open(BASE).convert("RGB")).astype(float)
    gen = np.asarray(Image.open(out).convert("RGB").resize((W, H))).astype(float)
    diff = np.abs(gen - base).sum(axis=2)
    changed = ((diff > 40) & (m == 0)).astype(np.uint8) * 255
    changed = Image.fromarray(changed).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2.5))
    a = np.asarray(changed).astype(float) / 255.0
    comp = base * (1 - a[..., None]) + gen * a[..., None]
    final = f"public/assets/hero/frames/frame-{sku}.png"
    Image.fromarray(comp.round().astype(np.uint8)).save(final)
    drift = np.abs(gen - base)[m == 255].mean(); pct = 100 * (a > 0.5).mean()
    return sku, drift, pct
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for sku, drift, pct in ex.map(one, todo): print(f"{sku}: outside-zone drift {drift:.2f}/255 · replaced {pct:.1f}% of frame")
# base frame is frame 0
Image.open(BASE).convert("RGB").save(f"public/assets/hero/frames/frame-{BASE_SKU}.png")
print("done", len(todo) + 1, "frames")
