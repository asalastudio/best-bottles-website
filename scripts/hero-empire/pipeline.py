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
EXTRA_ROWS = os.environ.get("EXTRA_ROWS_JSON")   # e.g. cylinder-50 sprayer plates: same 18-415 closure on a different bottle
if EXTRA_ROWS: rows = rows + json.load(open(EXTRA_ROWS))
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
                  "Everything else in the first image — the wall, the niche, the plaster, the sill — stays exactly as it is. No text.")
    else:
        prompt = ("Using the second image as the exact product reference, place this Empire 50 mL clear glass perfume bottle with its closure standing upright on the stone sill inside the lit niche of the first image, "
                  "centred in the niche with clear space either side, scaled so the bottle and closure together fill about seventy percent of the niche's height. Reproduce the bottle's shape, proportions, glass and finish faithfully, at high fidelity: crisp glass edges, the plaster wall refracting through the glass, a soft contact shadow and a faint reflection on the polished sill, lit by the niche's light from above. "
                  "Everything else in the first image — the wall, the niche, the plaster, the sill — stays exactly as it is. No text.")
    edit(prompt, [wall, ref_png(BASE_REF_SKU, BASE_REF_KEY)], base); log("base written")

# 3. measure the niche interior: pale plaster by row/column coverage (thin bright marble veins never reach 30% coverage)
wa = np.asarray(Image.open(wall).convert("RGB")).astype(int); ba = np.asarray(Image.open(base).convert("RGB").resize((W, H))).astype(int)
if os.environ.get("NICHE_BOX"):
    nx0, ny0, nx1, ny1 = [int(v) for v in os.environ["NICHE_BOX"].split(",")]
else:
    pale = wa.mean(axis=2) > 150
    col_cov = pale.mean(axis=0); xs = np.where(col_cov > 0.30)[0]; nx0, nx1 = int(xs.min()), int(xs.max())
    row_cov = pale[:, nx0:nx1 + 1].mean(axis=1); ys = np.where(row_cov > 0.30)[0]; ny0, ny1 = int(ys.min()), int(ys.max())
# sill: dark band directly under the plaster; include ~8% of the niche height below the plaster for the sill + reflection
sill = int(0.08 * (ny1 - ny0))
NICHE = (max(nx0 - 16, 0), max(ny0 - 16, 0), min(nx1 + 16, W), min(ny1 + sill + 16, H))
json.dump({"niche": [int(v) for v in NICHE], "plaster": [nx0, ny0, nx1, ny1]}, open(f"{OUT}/geometry.json", "w"))
log("niche", NICHE, "plaster", (nx0, ny0, nx1, ny1))
m = np.full((H, W), 255, np.uint8); m[NICHE[1]:NICHE[3], NICHE[0]:NICHE[2]] = 0   # whole niche interior may change; the diff threshold keeps unchanged glass from the base
# bottle body. Primary: base-vs-wall difference at a high threshold (the base was rendered from this wall, so plaster,
# glow and sill cancel; only the bottle and its reflection remain). Fallback: per-row plaster reference from the recess margins.
def body_from_mask(bmask, x_lo, x_hi):
    col = bmask.mean(axis=0); cols = np.where(col > 0.04)[0]
    if len(cols) == 0: return None
    runs = np.split(cols, np.where(np.diff(cols) > 10)[0] + 1); centre = (x_lo + x_hi) // 2
    run = min(runs, key=lambda r: abs((r.min() + r.max()) / 2 - centre)); xL, xR = int(run.min()), int(run.max())
    rowcov = bmask[:, xL:xR + 1].mean(axis=1); yrows = np.where(rowcov > 0.06)[0]
    if len(yrows) == 0: return None
    span = {y: (np.where(bmask[y, xL:xR + 1])[0].max() - np.where(bmask[y, xL:xR + 1])[0].min()) for y in yrows}
    maxw = max(span.values()); shoulder = min(y for y, w in span.items() if w >= 0.80 * maxw)
    return xL, xR, int(yrows.min()), int(yrows.max()), int(shoulder)
pw = nx1 - nx0; bx0, bx1 = nx0 + int(0.10 * pw), nx1 - int(0.10 * pw)
def plausible(mm):
    if not mm: return False
    xL, xR, yTop_, yBot_, sh = mm; w = xR - xL
    return 0.20 * pw <= w <= 0.70 * pw and sh - yTop_ >= 25 and yBot_ - sh >= 0.25 * (yBot_ - yTop_)
dm = np.abs(ba - wa).sum(axis=2); mm = None
for thr in (120, 160, 90):
    bm = (dm > thr); bm[:, :bx0] = False; bm[:, bx1:] = False; bm[:ny0 + 8] = False; bm[ny1 + 40:] = False
    mm = body_from_mask(bm, bx0, bx1)
    if plausible(mm): log(f"body measure: diff>{thr}", mm); break
    mm = None
if mm is None:
    mw = max(8, int(0.12 * (bx1 - bx0))); bmask = np.zeros((H, W), bool)
    for y in range(ny0 + 8, ny1):
        ref = np.median(np.concatenate([ba[y, bx0:bx0 + mw], ba[y, bx1 - mw:bx1]]), axis=0)
        bmask[y, bx0:bx1] = np.abs(ba[y, bx0:bx1] - ref).sum(axis=1) > 60
    mm = body_from_mask(bmask, bx0, bx1); log("body measure: margin fallback", mm)
    if not plausible(mm): raise SystemExit(f"bottle measurement implausible: {mm} — set BODY_BOX manually")
xL, xR, yTop, yBot, shoulder = mm
if os.environ.get("BODY_BOX"):
    xL, shoulder, xR, yBot = [int(v) for v in os.environ["BODY_BOX"].split(",")]; shoulder -= 10; yBot -= 40
BODY = (xL - 6, int(shoulder) + 10, xR + 6, min(yBot + 40, H))
m_cap = m.copy(); m_cap[BODY[1]:BODY[3], BODY[0]:BODY[2]] = 255
# sprayers/pumps: glass locked too, except a narrow column for the dip tube (so only the tube can change inside the body)
TUBE_HALF = 16; ncx = int((BODY[0] + BODY[2]) / 2)
m_tube = m_cap.copy(); m_tube[BODY[1]:BODY[3] - 40, ncx - TUBE_HALF:ncx + TUBE_HALF] = 0
json.dump({"niche": [int(v) for v in NICHE], "plaster": [nx0, ny0, nx1, ny1], "body": [int(v) for v in BODY]}, open(f"{OUT}/geometry.json", "w"))
log("body lock (caps only)", BODY)
if os.environ.get("MEASURE_ONLY"): raise SystemExit("measure-only")

# 4. frames
NECK_CX = (BODY[0] + BODY[2]) / 2; SHOULDER = BODY[1] - 10; NECK_TOP = yTop
def seat_metrics(frame):
    """closure vs base. seat = collar bottom (measured in two strips beside the dip-tube column so the tube never counts)
    minus the shoulder line; dx = collar centre (rows just above the shoulder, ±70px) minus the neck centre."""
    d = np.abs(frame - ba).sum(axis=2) > 40
    y0 = max(NICHE[1], 0); c = int(NECK_CX)
    strips = d[y0:SHOULDER + 14, c - 34:c - 16].any(axis=1) | d[y0:SHOULDER + 14, c + 16:c + 34].any(axis=1)
    rows_hit = np.where(strips)[0]
    if len(rows_hit) == 0: return None
    seat = int(rows_hit.max()) + y0 - SHOULDER
    collar = d[max(SHOULDER - 70, y0):SHOULDER, c - 70:c + 70]; ys_, xs_ = np.where(collar)
    dx = float(xs_.mean()) + c - 70 - NECK_CX if len(xs_) else 0.0
    return seat, dx
SEAT_TOL, DX_TOL, MAX_TRIES = 12, 8, 3
TUBE_KINDS = ("AnSp", "LB", "Spry")
def tube_present(frame):
    """a dip tube = changed pixels forming a thin vertical run inside the body, near the neck centre, over most of the body height"""
    d = np.abs(frame - ba).sum(axis=2) > 30
    band = d[BODY[1] + 20:BODY[3] - 60, int(NECK_CX) - 40:int(NECK_CX) + 40]
    rows_with = band.any(axis=1).mean()
    return rows_with > 0.55
def one(r):
    sku = r["sku"]; raw = f"{OUT}/raw-{sku}.png"
    best = None
    for attempt in range(MAX_TRIES):
        if attempt > 0 and os.path.exists(raw): os.rename(raw, f"{OUT}/raw-{sku}.try{attempt}.png")
        res = render_and_composite(sku, r, raw, reinforced=attempt > 0)
        _, pct, mt, snapped = res
        frame = np.asarray(Image.open(f"{OUT}/frame-{sku}.png").convert("RGB")).astype(float)
        tube_ok = tube_present(frame) if kind(sku) in TUBE_KINDS else True
        score = ((abs(mt[0]) + abs(mt[1])) if mt else 999) + (0 if snapped else 500) + (0 if tube_ok else 200)
        os.replace(f"{OUT}/frame-{sku}.png", f"{OUT}/frame-{sku}.a{attempt}.png")
        if best is None or score < best[0]: best = (score, mt, res, attempt)
        if snapped and tube_ok: break
        log(f"{sku}: pre-snap seat {mt} snapped {snapped} tube {tube_ok} — attempt {attempt + 1}/{MAX_TRIES}")
    os.replace(f"{OUT}/frame-{sku}.a{best[3]}.png", f"{OUT}/frame-{sku}.png")
    for f in glob.glob(f"{OUT}/frame-{sku}.a*.png"): os.remove(f)
    return sku, best[2][1], best[1]
def render_and_composite(sku, r, raw, reinforced=False):
    if not os.path.exists(raw):
        prompt = ("Fit the exact closure shown on the bottle in the second image onto the bottle in the first image — same type, shape, proportions, colour and finish — seated on the neck at the same scale, lit by the niche's light from above with matching reflections. "
                  "Inside the glass, show exactly what the second image shows for this closure: a slim dip tube for a sprayer or pump, nothing for a cap or reducer. "
                  "The closure must actually be fitted: it covers the threaded neck completely, so no bare threads remain visible. "
                  "Everything else — the glass bottle's shape and position, the sill, the plaster and the wall — stays exactly as in the first image. No text.")
        if reinforced:
            prompt += (" The closure's collar rests exactly on the bottle's shoulder line and is centred on the neck; it must not sink into the bottle or float above it."
                       + (" A slim dip tube runs from the collar straight down inside the bottle, almost to the base, clearly visible through the glass." if kind(sku) in TUBE_KINDS else ""))
        edit(prompt, [base, ref_png(sku)], raw)
    gen = np.asarray(Image.open(raw).convert("RGB").resize((W, H))).astype(float); bf = ba.astype(float)
    zone = m_cap if kind(sku) in ("Rdcr", "Cap") else m_tube   # caps: body locked (empty bottle); sprayers/pumps: only the tube column may change inside the glass
    changed = ((np.abs(gen - bf).sum(axis=2) > 40) & (zone == 0)).astype(np.uint8) * 255
    a = np.asarray(Image.fromarray(changed).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2.5))).astype(float) / 255.0
    # KIT SNAP: measure where the collar landed and shift the closure layer onto the neck datum
    mt = seat_metrics(gen); snapped = False
    if mt and abs(mt[0]) <= 40 and abs(mt[1]) <= 40:
        snapped = True
        dy, dx = -int(round(mt[0])), -int(round(mt[1]))
        gen = np.roll(np.roll(gen, dy, axis=0), dx, axis=1); a = np.roll(np.roll(a, dy, axis=0), dx, axis=1)
        if dy < 0: a[dy:] = 0
        if dy > 0: a[:dy] = 0
    comp = bf * (1 - a[..., None]) + gen * a[..., None]
    Image.fromarray(comp.round().astype(np.uint8)).save(f"{OUT}/frame-{sku}.png")
    return sku, 100 * (a > 0.5).mean(), mt, snapped
def kind(sku):
    if sku == "BARE": return "BARE"
    return ("Tsl" if "AnSpTsl" in sku else "AnSp" if "AnSp" in sku else "Spry" if "Spry" in sku else "Drp" if "Drp" in sku
            else "Rdcr" if "Rdcr" in sku else "LB" if sku.startswith("LB") else "other")
todo = [r for r in rows if kind(r["sku"]) in SEQUENCE]
log("sequence", SEQUENCE, "→", len(todo), "frames")
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for sku, pct, mt in ex.map(one, todo): log(f"{sku}: replaced {pct:.1f}% · snapped from seat {mt[0]:+d}px dx {mt[1]:+.1f}px" if mt else f"{sku}: replaced {pct:.1f}% · closure not found")
if BARE_BASE: Image.open(base).convert("RGB").save(f"{OUT}/frame-BARE.png")

# 5. manifest + webp + review sheet
KIND = [(r"AnSpTsl","Antique sprayer · tassel"),(r"AnSp","Antique sprayer"),(r"Drp","Glass dropper"),(r"RdcrMtSlTall","Tall reducer · matte silver"),(r"RdcrShnBlkTall","Tall reducer · shiny black"),(r"Rdcr","Reducer"),(r"OvrCp","Overcap")]
COL = [(r"IvyGl","ivory & gold"),(r"IvySl","ivory & silver"),(r"MtSl","matte silver"),(r"ShnBlk","shiny black"),(r"ShnGl","shiny gold"),(r"ShnSl","shiny silver"),(r"LBrwnLthr","light brown leather"),(r"BlkLthr","black leather"),(r"BrwnLthr","brown leather"),(r"IvyLthr","ivory leather"),(r"PnkLthr","pink leather"),(r"Blk","black"),(r"Wht","white"),(r"Red","red"),(r"Pnk","pink"),(r"Lvn","lavender"),(r"Cu","copper"),(r"Gl","gold"),(r"Sl","silver")]
def label(sku):
    if sku == "BARE": return "Bare bottle · 18-415 neck"
    if sku.startswith("LB"): return "Lotion pump · white"
    if "Spry" in sku:
        col = next((l for p_, l in COL if re.search(p_, re.sub(r"^GB(Cyl|Emp)50Spry", "", sku))), None)
        return f"Fine-mist sprayer · {col}" if col else "Fine-mist sprayer"
    tail = re.sub(r"^[GL]BEmp50", "", sku); kind = next((l for p, l in KIND if re.search(p, tail)), "Closure")
    col = next((l for p, l in COL if re.search(p, re.sub(r"Tsl|AnSp|Drp|Rdcr|Tall|OvrCp|Cl", "", tail))), None)
    return f"{kind} · {col}" if col and "·" not in kind else kind
ORDER = {"AnSp": 0, "Tsl": 1, "LB": 2, "Spry": 3, "BARE": 4, "Rdcr": 5, "Drp": 6, "other": 7}
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
