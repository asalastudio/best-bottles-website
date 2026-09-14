"""End-to-end Empire hero set: wall (wider niche) → base frame → auto-measured closure zone → 33 fitment frames
(unmasked Sunburst edits + difference composite) → webp + manifest + review sheet.  Output: public/assets/hero/<SET>/"""
import os, sys, json, re, glob, base64, urllib.request, concurrent.futures
sys.path.insert(0, os.path.dirname(__file__))
from sunburst import edit, KEY
from PIL import Image, ImageFilter, ImageDraw, ImageFont
import numpy as np

SET = os.environ.get("HERO_SET", "v3"); OUT = f"public/assets/hero/{SET}"; os.makedirs(OUT, exist_ok=True)
S = os.environ.get("SKETCH_SCRATCH", "/tmp"); os.makedirs(f"{S}/refs", exist_ok=True)
W, H = 1536, 1024
BASE_SKU = "GBEmp50AnSpGl"
BASE_REF_SKU = os.environ.get("BASE_REF_SKU", "GBEmp50AnSpGl")   # plate used to render the base bottle
BASE_REF_KEY = os.environ.get("BASE_REF_KEY", "image")            # image | imageCapOff
BARE_BASE = os.environ.get("BARE_BASE", "0") == "1"                # base is a bare bottle (no closure) — becomes its own beat
SEQUENCE = [r for r in os.environ.get("SEQUENCE", "AnSp,LB,Rdcr").split(",") if r]  # kinds in cycle order
log = lambda *a: print(*a, flush=True)

# 1. wall with a wider niche
wall = f"{OUT}/wall.png"
if not os.path.exists(wall):
    prompt = ("Photograph of a dark honed black stone wall filling the entire frame, Sahara Noir marble with faint warm veining, matte and moody. "
              "One rectangular niche is cut into the wall right of centre, about one third of the frame wide and two thirds of the frame tall, portrait proportion. "
              "The niche's inner back wall and side faces are smooth pale bone plaster (#F5F3EF), softly and evenly lit from above so the interior reads as a warm lit alcove; its sill is a level slab of the same dark stone. "
              "The niche is empty. No objects, no text, no people. Camera straight on, no perspective tilt. Luxury fragrance-house atmosphere.")
    body = json.dumps({"model": "gpt-image-2.5-sunburst", "prompt": prompt, "size": "1536x1024", "quality": "high", "n": 1}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=body, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=400) as r: d = json.load(r)
    open(wall, "wb").write(base64.b64decode(d["data"][0]["b64_json"])); log("wall written")

# 2. base frame
rows = json.load(open("scripts/hero-empire/empire-50-rows.json"))
def ref_png(sku, key="image"):
    r = next(x for x in rows if x["sku"] == sku); p = f"{S}/refs/{sku}-{key}.png"
    if not os.path.exists(p):
        urllib.request.urlretrieve(r[key], p + ".webp"); Image.open(p + ".webp").convert("RGB").save(p)
    return p
base = f"{OUT}/base.png"
if not os.path.exists(base):
    if BARE_BASE:
        prompt = ("Using the second image as the exact product reference, place this bare Empire 50 mL clear glass perfume bottle — no closure, an open threaded 18-415 neck, nothing inside the bottle — standing upright on the stone sill inside the lit niche of the first image, "
                  "centred in the niche with clear space either side, scaled so the bottle fills about sixty percent of the niche's height, leaving room above the neck for a tall closure. Reproduce the bottle's shape, proportions and glass faithfully, at high fidelity: crisp glass edges, the plaster wall refracting through the glass, a soft contact shadow and a faint reflection on the polished sill, lit by the niche's light from above. "
                  "Everything else — the black marble wall, the niche, the plaster, the sill — stays exactly as in the first image. No text.")
    else:
        prompt = ("Using the second image as the exact product reference, place this Empire 50 mL clear glass perfume bottle with its closure standing upright on the stone sill inside the lit niche of the first image, "
                  "centred in the niche with clear space either side, scaled so the bottle and closure together fill about seventy percent of the niche's height. Reproduce the bottle's shape, proportions, glass and finish faithfully, at high fidelity: crisp glass edges, the plaster wall refracting through the glass, a soft contact shadow and a faint reflection on the polished sill, lit by the niche's light from above. "
                  "Everything else — the black marble wall, the niche, the plaster, the sill — stays exactly as in the first image. No text.")
    edit(prompt, [wall, ref_png(BASE_REF_SKU, BASE_REF_KEY)], base); log("base written")

# 3. auto-measure niche interior (pale plaster) and the bottle body to lock
wa = np.asarray(Image.open(wall).convert("RGB")).astype(int); ba = np.asarray(Image.open(base).convert("RGB").resize((W, H))).astype(int)
pale = wa.mean(axis=2) > 150
ys, xs = np.where(pale); nx0, ny0, nx1, ny1 = xs.min(), ys.min(), xs.max(), ys.max()
NICHE = (max(nx0 - 12, 0), max(ny0 - 12, 0), min(nx1 + 12, W), min(ny1 + 60, H))   # incl. sill
diff = np.abs(ba - wa).sum(axis=2) > 60
diff[:NICHE[1], :] = False; diff[NICHE[3]:, :] = False; diff[:, :NICHE[0]] = False; diff[:, NICHE[2]:] = False
rows_w = diff.sum(axis=1); yb = np.where(rows_w > 0)[0].max()
widths = [(y, np.where(diff[y])[0]) for y in range(yb, NICHE[1], -1) if rows_w[y] > 0]
bodyw = max((c.max() - c.min()) for y, c in widths[: max(1, len(widths) // 3)])   # widest rows near the bottom = glass body
top = yb
for y, c in widths:
    if (c.max() - c.min()) < 0.82 * bodyw: break
    top = y
cols = np.where(diff[top:yb].any(axis=0))[0]
BODY = (int(cols.min()) - 4, int(top) + 8, int(cols.max()) + 4, min(int(yb) + 48, H))
json.dump({"niche": [int(v) for v in NICHE], "body": [int(v) for v in BODY]}, open(f"{OUT}/geometry.json", "w"))
log("niche", NICHE, "body", BODY)
m = np.full((H, W), 255, np.uint8); m[NICHE[1]:NICHE[3], NICHE[0]:NICHE[2]] = 0   # whole niche interior may change; the diff threshold keeps unchanged glass from the base

# 4. frames
def one(r):
    sku = r["sku"]; raw = f"{OUT}/raw-{sku}.png"
    if not os.path.exists(raw):
        prompt = ("Fit the exact closure shown on the same bottle in the second image onto the bottle in the first image — same type, shape, proportions, colour and finish — seated on the neck at the same scale, lit by the niche's light from above with matching reflections. "
                  "Inside the glass, show exactly what the second image shows for this closure: a slim dip tube for a sprayer or pump, nothing for a cap or reducer. "
                  "Everything else — the glass bottle's shape and position, the sill, the plaster and the marble wall — stays exactly as in the first image. No text.")
        edit(prompt, [base, ref_png(sku)], raw)
    gen = np.asarray(Image.open(raw).convert("RGB").resize((W, H))).astype(float); bf = ba.astype(float)
    changed = ((np.abs(gen - bf).sum(axis=2) > 40) & (m == 0)).astype(np.uint8) * 255
    a = np.asarray(Image.fromarray(changed).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2.5))).astype(float) / 255.0
    comp = bf * (1 - a[..., None]) + gen * a[..., None]
    Image.fromarray(comp.round().astype(np.uint8)).save(f"{OUT}/frame-{sku}.png")
    return sku, 100 * (a > 0.5).mean()
def kind(sku):
    return "Tsl" if "AnSpTsl" in sku else "AnSp" if "AnSp" in sku else "Drp" if "Drp" in sku else "Rdcr" if "Rdcr" in sku else "LB" if sku.startswith("LB") else "other"
todo = [r for r in rows if kind(r["sku"]) in SEQUENCE]
log("sequence", SEQUENCE, "→", len(todo), "frames")
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for sku, pct in ex.map(one, todo): log(f"{sku}: replaced {pct:.1f}%")
if BARE_BASE: Image.open(base).convert("RGB").save(f"{OUT}/frame-BARE.png")

# 5. manifest + webp + review sheet
KIND = [(r"AnSpTsl","Antique sprayer · tassel"),(r"AnSp","Antique sprayer"),(r"Drp","Glass dropper"),(r"RdcrMtSlTall","Tall reducer · matte silver"),(r"RdcrShnBlkTall","Tall reducer · shiny black"),(r"Rdcr","Reducer"),(r"OvrCp","Overcap")]
COL = [(r"IvyGl","ivory & gold"),(r"IvySl","ivory & silver"),(r"MtSl","matte silver"),(r"ShnBlk","shiny black"),(r"ShnGl","shiny gold"),(r"ShnSl","shiny silver"),(r"LBrwnLthr","light brown leather"),(r"BlkLthr","black leather"),(r"BrwnLthr","brown leather"),(r"IvyLthr","ivory leather"),(r"PnkLthr","pink leather"),(r"Blk","black"),(r"Wht","white"),(r"Red","red"),(r"Pnk","pink"),(r"Lvn","lavender"),(r"Cu","copper"),(r"Gl","gold"),(r"Sl","silver")]
def label(sku):
    if sku == "BARE": return "Bare bottle · 18-415 neck"
    if sku.startswith("LB"): return "Lotion pump · white"
    tail = re.sub(r"^[GL]BEmp50", "", sku); kind = next((l for p, l in KIND if re.search(p, tail)), "Closure")
    col = next((l for p, l in COL if re.search(p, re.sub(r"Tsl|AnSp|Drp|Rdcr|Tall|OvrCp|Cl", "", tail))), None)
    return f"{kind} · {col}" if col and "·" not in kind else kind
ORDER = {"AnSp": 0, "Tsl": 1, "LB": 2, "BARE": 3, "Rdcr": 4, "Drp": 5, "other": 6}
rank = lambda s: ORDER["BARE" if s == "BARE" else kind(s)]
skus = sorted([os.path.basename(p)[6:-4] for p in glob.glob(f"{OUT}/frame-*.png")], key=lambda s: (rank(s), s))
manifest = []
for sku in skus:
    Image.open(f"{OUT}/frame-{sku}.png").convert("RGB").save(f"{OUT}/frame-{sku}.webp", "WEBP", quality=85)
    manifest.append({"sku": sku, "src": f"/assets/hero/{SET}/frame-{sku}.webp", "label": label(sku)})
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=1)
try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 13)
except Exception: font = ImageFont.load_default()
cells = []
for f in manifest:
    im = Image.open(f"{OUT}/frame-{f['sku']}.png").convert("RGB").crop((NICHE[0] - 30, NICHE[1] - 30, NICHE[2] + 30, NICHE[3] + 20)); im = im.resize((180, int(180 * im.height / im.width)))
    c = Image.new("RGB", (180, im.height + 20), "#1b1917"); c.paste(im, (0, 0)); ImageDraw.Draw(c).text((3, im.height + 3), f["label"][:30], fill="#e8e2d6", font=font); cells.append(c)
cols_, pad = 9, 8; ch = max(c.height for c in cells); rws = (len(cells) + cols_ - 1) // cols_
sheet = Image.new("RGB", (cols_ * 180 + (cols_ + 1) * pad, rws * ch + (rws + 1) * pad), "#141210")
for i, c in enumerate(cells): sheet.paste(c, (pad + (i % cols_) * (180 + pad), pad + (i // cols_) * (ch + pad)))
sheet.save(f"{OUT}/_review-frames.jpg", quality=86)
log("DONE", len(manifest), "frames")
