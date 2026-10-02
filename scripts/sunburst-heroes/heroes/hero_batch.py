"""Registry-hero Sunburst batch. usage: hero_batch.py <scratch> <shard-index> <shard-count> [family ...]
For every registry hero on disk (ordered by family priority), a Sunburst 2.5 edit at 2080×2288 with the glass reference, per-SKU prompt built
from Convex fields, downscaled to the 1560×1716 hero canvas, gated on the silhouette bbox (h/w ≤2 %, base ≤8 px) and a loose outline band.
Never writes to the registry: outputs are review candidates."""
import json, os, subprocess, sys, time, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from scipy import ndimage
S, shard, nshard = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); FAMS = sys.argv[4:] or None
REF = f"{S}/../gpt25/bare-glass/9ml-bare-glass.sunburst-high.png"; OUT = f"{S}/heroes/out"; os.makedirs(OUT, exist_ok=True); BONE = np.array((245, 243, 239))
prod = {}; 
for p in json.load(open(f"{S}/convex-prod-enriched.json")):
    for k in ("websiteSku", "graceSku"):
        if p.get(k): prod[p[k]] = p
reg = json.load(open("src/lib/products/catalog-heroes.json")); rows = reg if isinstance(reg, list) else reg.get("rows") or list(reg.values())
PRIORITY = ["Empire", "Cylinder", "Circle", "Elegant", "Boston Round", "Round", "Sleek", "Diva", "Slim", "Rectangle", "Tulip", "Grace", "Diamond", "Royal", "Flair", "Square"]
jobs = []
for r in rows:
    if not isinstance(r, dict) or not r.get("url"): continue
    p = prod.get(r.get("websiteSku")) or prod.get(r.get("graceSku"))
    fam = (p or {}).get("family") or r.get("family"); hero = "public" + r["url"]
    if not os.path.exists(hero) or (FAMS and fam not in FAMS): continue
    jobs.append(dict(sku=r.get("websiteSku") or r.get("graceSku"), family=fam, hero=hero, p=p or {}))
if os.environ.get("JOBS_FILE"):
    jobs = [dict(sku=j["sku"], family=j["family"], hero=j["hero"], p=prod.get(j["sku"], {}), ref=j.get("ref"), ref_clause=j.get("ref_clause"), material_clause=j.get("material_clause")) for j in json.load(open(os.environ["JOBS_FILE"]))]
jobs.sort(key=lambda j: (PRIORITY.index(j["family"]) if j["family"] in PRIORITY else 99, j["sku"])); jobs = jobs[shard::nshard]
APPL = {"Reducer": "an orifice reducer in the neck with its {cap} screw cap fitted", "Perfume Spray Pump": "a {cap} fine-mist perfume spray pump with its {cap} overcap", "Fine Mist Sprayer": "a {cap} fine-mist sprayer with its {cap} overcap",
        "Lotion Pump": "a {cap} lotion pump with its {cap} overcap", "Vintage Bulb Sprayer": "a {cap} vintage bulb atomizer with a mesh-wrapped squeeze bulb", "Vintage Bulb Sprayer with Tassel": "a {cap} vintage bulb atomizer with a mesh-wrapped squeeze bulb and a hanging tassel",
        "Dropper": "a {cap} glass-pipette dropper with its {cap} bulb cap", "Metal Roller Ball": "a roll-on applicator with a steel ball and its {cap} cap", "Plastic Roller Ball": "a roll-on applicator with a plastic ball and its {cap} cap",
        "Cap/Closure": "its {cap} screw cap", "Glass Rod": "a {cap} cap with a glass dabber rod"}
BOTTLE_FAMS = {"Empire","Cylinder","Circle","Elegant","Boston Round","Round","Sleek","Diva","Slim","Rectangle","Tulip","Grace","Diamond","Royal","Flair","Square","Bell","Queen","Daisy","Apothecary","Vial","Heart","Teardrop","Pillar","Lotion Bottle","Plastic Bottle"}
def describe(p):
    if (p.get("category") not in (None, "Glass Bottle")) or (p.get("family") not in BOTTLE_FAMS):
        name = p.get("itemName") or p.get("graceDescription") or p.get("family") or "product"
        return f"the exact Best Bottles product shown — {name} ({p.get('family','')}) — every part exactly as photographed, nothing added"
    cap = (p.get("capColor") or "").lower().strip() or "matching"; app = p.get("applicator") or ""; comp = APPL.get(app, f"its {cap} {app.lower()}" if app else "its closure").format(cap=cap)
    glass = (p.get("color") or "clear").lower(); fam = p.get("family", ""); capml = (p.get("capacity") or "").split(" (")[0]
    return f"the exact Best Bottles {fam} {capml} {glass} glass bottle with {comp}"
def nonbone(img): return np.abs(np.array(img.convert("RGB")).astype(float) - BONE).sum(axis=2) > 40
def bbox(m): ys, xs = np.where(m); return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
def outline_of(m):
    lab, n = ndimage.label(ndimage.binary_closing(m, iterations=6)); t = max(range(1, n + 1), key=lambda i: np.ptp(np.where(lab == i)[0])); return ndimage.binary_fill_holes(lab == t)
FORCE = set(os.environ.get("FORCE_SKUS", "").split())
for j in jobs:
    out = f"{OUT}/{j['sku']}.png"
    if os.path.exists(out + ".json") and j["sku"] not in FORCE: continue
    frosted = "frost" in ((j["p"].get("color") or "") + " " + j["sku"]).lower()
    glass_clause = j.get("material_clause") or ("This is FROSTED glass: satin-etched, translucent, milky-white all over the bottle body — keep it frosted everywhere, exactly as in image 1; do not make it clear, do not treat the milky body as an artefact; render it as premium satin glass with soft diffused light passing through it and a subtle sheen on the etched surface. "
                    if frosted else "Flat white or opaque patches inside the glass in image 1 are artefacts of an old cutout, not part of the product — replace them with true transparent glass showing the bone background through the bottle (coloured glass keeps its colour). ")
    prompt = (f"Image 1 is the locked geometry: {describe(j['p'])}, photographed straight on, on a seamless bone background. Keep the silhouette, proportions, position and scale of the bottle and of every component EXACTLY as in image 1 — including any cap or closure lying separately beside the bottle, which stays exactly where it is; do not add, remove, resize or move any part; no label, no liquid, no extra accessory. "
              + glass_clause +
              (j.get("ref_clause") or "Image 2 is the reference for GLASS RENDERING QUALITY ONLY (ignore its shape and its clear finish): thick walls, bright clean rim highlights, crisp thread and component detail, glossy base, subtle internal reflections, true refraction, no milky haze. ") + "Render metal and plastic components as premium, clean and physically correct with the same finish and colour as image 1. "
              "Same seamless bone background #F5F3EF (warm cream, not white). The bottle STANDS on the surface — it must never look like it is floating. Shadow, exactly this: a rounded contact shadow that is darkest right where the glass meets the surface and feathers out from the base ring, and from it a very light, soft, elliptical cast shadow extending behind the bottle toward the 2 o'clock direction (to the right and away from camera). The key light is front-left and above, positioned so that cast direction is correct. No shadow hanging below the base, no gap between glass and shadow, no hard edges, no second shadow. High-end editorial glass photography: premium refraction, clean specular edges, photographic finish only.")
    pf = f"{OUT}/{j['sku']}.prompt.txt"; open(pf, "w").write(prompt); big = f"{OUT}/{j['sku']}.2080.png"; t0 = time.time()
    r = subprocess.run(["python3", f"{S}/sunburst.py", big, "2080x2288", "high", pf, j["hero"], j.get("ref") or REF], capture_output=True, text=True)
    if not os.path.exists(big): print(f"{j['sku']:24} FAILED {(r.stdout + r.stderr).strip()[-160:]}", flush=True); continue
    img = Image.open(big).convert("RGB").resize((1560, 1716), Image.LANCZOS); img.save(out)
    def points(m, strong):
        m = ndimage.binary_opening(m, iterations=2); strong = ndimage.binary_opening(strong, iterations=2); rows = np.where(m.sum(axis=1) >= 3)[0]; cols = np.where(m.sum(axis=0) >= 3)[0]; srows = np.where(strong.sum(axis=1) >= 3)[0]
        return int(rows.min()), int(srows.max() if len(srows) else rows.max()), int(cols.min())
    strongof = lambda im: np.abs(np.array(im.convert("RGB")).astype(float) - BONE).sum(axis=2) > 90
    A, B = nonbone(Image.open(j["hero"])), nonbone(img); (tA, bA, lA), (tB, bB, lB) = points(A, A), points(B, strongof(img))
    dh = ((bB - tB) / (bA - tA) - 1) * 100; dw = 0.0; dleft = lB - lA; dbase = int(bB - bA)
    o = outline_of(A); ys, xs = np.where(o); side = np.zeros_like(o); side[: ys.max() + 2, : int((xs.min() + xs.max()) / 2)] = True
    band = ndimage.binary_dilation(o, iterations=12) & ~ndimage.binary_dilation(o, iterations=6) & side; ctrl = ndimage.binary_dilation(o, iterations=34) & ~ndimage.binary_dilation(o, iterations=24) & side
    grow = float(B[band].mean()); noise = float(B[ctrl].mean())
    dtop = tB - tA; v = "PASS" if abs(dtop) <= 8 and abs(dleft) <= 8 else "FAIL"            # v6: top + left anchors; base/height/band informational
    log = json.load(open(big + ".json")); rec = dict(sku=j["sku"], family=j["family"], hero=j["hero"], height_pct=round(dh, 1), width_pct=None, top_shift=int(dtop), left_shift=int(dleft), base_shift=dbase, gate="v6: top + left anchors", band_outside=round(grow, 3), band_control=round(noise, 3), verdict=v, cost_usd=log["cost_usd"], latency_s=log["latency_s"], prompt=prompt)
    json.dump(rec, open(out + ".json", "w"), indent=1); os.remove(big)
    print(f"{j['sku']:24} {j['family']:12} {v}  h {dh:+.1f}%  left {dleft:+d}px  base {dbase:+d}px  band {grow:.3f}/{noise:.3f}  ${log['cost_usd']:.3f} {time.time()-t0:.0f}s", flush=True)
