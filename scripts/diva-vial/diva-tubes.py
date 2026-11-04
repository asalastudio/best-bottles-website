"""The Diva dip tubes: the regenerated Round tubes of the same fitment type.

No Diva PSD has a tube layer (30, 46 and 100 ml; spray, lotion and bulb files hold only the bottle, the head and the
cover). The Round tubes are the same 18-415 spray, lotion and bulb tubes, regenerated with Sunburst from the Round PSDs
(scripts/round-sleek/psd-tubes.py): 78 ml for Diva 30 and 46 ml, 128 ml for Diva 100 ml. seat-and-tubes.py fits each
to the register tube's place in the kit, so its length follows the Diva glass.

Jordan (3 Nov 2026): "The diptube needs to be fixed". The Round tubes curve to follow the Round glass; standing in
Diva's tall fluted bowl they read as a faint slanted line off the axis. Each is straightened here, row by row (every
row shifted so its centre sits on one line; the photographed texture is kept), and seat-and-tubes.py stands it on
the axis (TUBE_ON_AXIS).
Writes public/local-kits/diva-masters-2026-11-03/tubes/tubes.json.
Usage: python3 scripts/diva-vial/diva-tubes.py
"""
import hashlib, io, json, os
import numpy as np
from PIL import Image

ROUND = json.load(open("public/local-kits/round-sleek-masters-2026-11-03/tubes/tubes.json"))
SOURCE = {"diva30": "round78", "diva46": "round78", "diva100": "round128"}
OUT = "public/local-kits/diva-masters-2026-11-03/tubes/tubes.json"

os.makedirs(os.path.dirname(OUT), exist_ok=True)
DIR = "public/local-kits/diva-masters-2026-11-03/tubes"
DEEPEN = 2.2


def straightened(url):
    a = np.asarray(Image.open("public" + url).convert("RGBA")); rows = [np.where(r[:, 3] > 30)[0] for r in a]
    half = max((r.max() - r.min() + 1) for r in rows if len(r)) // 2 + 2
    out = np.zeros((a.shape[0], 2 * half, 4), np.uint8)
    for y, r in enumerate(rows):
        if len(r):
            c = (r.min() + r.max() + 1) // 2; lo = max(0, c - half); hi = min(a.shape[1], c + half)
            out[y, half - (c - lo):half + (hi - c)] = a[y, lo:hi]
    # Diva's bright fluting hides the Round tube's pale tone: deepen it (multiplied, so the glass still shows through).
    rgb = out[..., :3].astype(np.float32); out[..., :3] = (255 - (255 - rgb) * DEEPEN).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(out); img = img.crop(img.getchannel("A").getbbox())
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); data = buf.getvalue()
    name = os.path.basename(url).split(".")[0] + "-straight"
    path = f"{DIR}/{name}.{hashlib.sha256(data).hexdigest()[:12]}.png"
    open(path, "wb").write(data)
    return "/" + path.removeprefix("public/"), [img.width, img.height]


for old in os.listdir(DIR):
    if old.endswith(".png"):
        os.remove(f"{DIR}/{old}")
made = {}
tubes = {}
for size, src in SOURCE.items():
    for kind in ("spray", "lotion", "atomizer"):
        base = ROUND[f"{src}-{kind}"]
        if base["file"] not in made:
            made[base["file"]] = straightened(base["file"])
        file, pixels = made[base["file"]]
        tubes[f"{size}-{kind}"] = {**base, "file": file, "pixels": pixels, "sharedFrom": f"{src}-{kind}", "straightened": True}
json.dump(tubes, open(OUT, "w"), indent=1)
print(len(tubes), "Diva tube entries")
