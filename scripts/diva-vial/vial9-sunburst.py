"""The 9 ml 18-400 vial's black cap and glass applicator rod redrawn with Sunburst (gpt-image-2.5-sunburst).

Jordan (4 Nov 2026): the 9 ml 18-400 "needs to be regenerated, and its cap and applicator, or at least just the
applicator ... using GPT 2.5 Sunburst". vial-kits.py takes them from the master library PSD (0. All Vials/Capped), whose
layers are small (the cap 247 px wide, drawn ~1.5x up on the stage): the ribs smear and the rod reads as a flat milky
strip. Here each is redrawn at 4x on its own outline:
- the cap (GB09BlackCapSht's, and the applicator's cap) as a crisp black ribbed 18-400 screw cap;
- the rod (the applicator's layer below its cap) as clear glass with bright core, thin dark edges and its ball tip;
the applicator's cap layer is the new cap over the new rod, at the PSD's places. Boxes are unchanged.
Run after vial-kits.py. Usage: python3 scripts/diva-vial/vial9-sunburst.py <work-dir>
"""
import concurrent.futures, hashlib, importlib.util, json, os, sys
import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location("elegant_tubes", "scripts/elegant-masters/psd-tubes-60-100.py")
E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)
spec = importlib.util.spec_from_file_location("vial_kits", "scripts/diva-vial/vial-kits.py")
V = importlib.util.module_from_spec(spec); spec.loader.exec_module(V)

UP = 4
CAP = """1. Keep geometry locked to the first image: the same short black screw cap, its outline, height, width, flat top and straight sides, at the same position and size in the frame. Do not redraw or move the shape.
2. Material: a black polypropylene 18-400 continuous-thread screw cap, satin black with fine evenly spaced vertical knurled ribs around the whole side, a soft cool highlight band and crisp rib edges, a thin clean bottom rim. Real product photograph, sharp and detailed.
3. Front view, studio packshot quality, crisp clean edges.
Plain flat background #F5F3EF, no shadow, no floor, no bottle, no props, no text."""
ROD = """1. Keep geometry locked to the first image (shown on grey only so its outline is visible): the same perfectly straight, vertical thin applicator rod, its thickness, length, and the small round ball at its tip, at the same position and size in the frame. Do not bend, move or resize it.
2. Material: a clear borosilicate glass applicator rod: transparent glass with a bright clear core, thin crisp darker grey edges on both sides and a small specular highlight line, the ball tip clear glass with a bright highlight. Natural, not flat white, no glow.
3. Crisp clean edges, photographic studio packshot quality.
Plain flat background #F5F3EF, no shadow, no floor, no cap, no bottle, no liquid, no props, no text."""


def up(img):
    return img.resize((img.width * UP, img.height * UP), Image.LANCZOS)


def main():
    work = sys.argv[1]; os.makedirs(work, exist_ok=True)
    kits = json.load(open(f"{V.DIR}/kits.json")); rows = kits["rows"]
    part = lambda sku: next(p for p in rows[sku]["parts"] if p["slot"] == "cap")
    src = lambda p: Image.open("public" + p["image"]["url"]).convert("RGBA")
    cap, combo = src(part("GB09BlackCapSht")), src(part("GB09BlackCapApp"))
    # The applicator layer: the cap on top, the rod below it (rows narrower than half the cap).
    w = (np.asarray(combo)[..., 3] > 40).sum(1)
    cap_rows = int(np.argmax((w > 0) & (w < 0.5 * w.max()) & (np.arange(len(w)) > np.argmax(w > 0))))
    rod = np.asarray(combo).copy(); rod[:cap_rows, :, 3] = 0
    rod = Image.fromarray(rod); rod_box = rod.getchannel("A").getbbox(); rod = rod.crop(rod_box)
    combo_cap = combo.crop((0, 0, combo.width, cap_rows)); cap_box = combo_cap.getchannel("A").getbbox()
    jobs = {"cap": (up(cap), CAP, E.BONE), "rod": (up(rod), ROD, E.GREY)}
    for name, (layer, _, ground) in jobs.items():
        E.framed(layer, ground=ground).save(f"{work}/{name}.geometry.png")

    def run(name):
        raw = f"{work}/{name}.raw.png"
        if not os.path.exists(raw):
            E.edit([f"{work}/{name}.geometry.png"], jobs[name][1], raw)
        return name, raw
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        raws = dict(pool.map(run, jobs))
    out = {}
    for name, (layer, _, _) in jobs.items():
        fr = E.framed(layer); raw = Image.open(raws[name]).resize(fr.size, Image.LANCZOS)
        ox, oy = (fr.width - layer.width) // 2, (fr.height - layer.height) // 2
        pad = Image.new("RGBA", fr.size, (0, 0, 0, 0)); pad.alpha_composite(layer, (ox, oy))
        cut, rep = E.register(raw, pad); out[name] = cut.crop((ox, oy, ox + layer.width, oy + layer.height))
        out[name].save(f"{work}/{name}.cut.png"); print(name, rep)
    # The applicator's layer at 4x: the new rod where the old rod was, the new cap over it where the old cap was.
    new_combo = Image.new("RGBA", (combo.width * UP, combo.height * UP), (0, 0, 0, 0))
    new_combo.alpha_composite(out["rod"], (rod_box[0] * UP, rod_box[1] * UP))   # rod_box is in the layer's own px
    c = out["cap"].resize(((cap_box[2] - cap_box[0]) * UP, (cap_box[3] - cap_box[1]) * UP), Image.LANCZOS)
    new_combo.alpha_composite(c, (cap_box[0] * UP, cap_box[1] * UP))
    for sku, img, name in (("GB09BlackCapSht", out["cap"], "cap-9ml-black-sunburst"), ("GB09BlackCapApp", new_combo, "cap-9ml-black-rod-sunburst")):
        p = part(sku); p["image"] = V.save(img, name); p["image2x"] = None; p["derivation"] = "sunburst-vial9"
    V.prune(V.OUT, rows)
    kits["version"] = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:12]
    open(f"{V.DIR}/kits.json", "w").write(json.dumps(kits, indent=1) + "\n")
    print("Vial kits version", kits["version"])


if __name__ == "__main__":
    main()
