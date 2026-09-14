"""KIT-FIRST hero set from the PSD master library — no per-frame rendering, no AI.

Every Empire 50 PSD in the master library is layered: the bare bottle body (one photograph shared by the whole family),
a dip-tube layer drawn inside it, and the closure drawn fitted on the neck (bulb + collar, pump, sprayer head, cap);
'cap off' variants also carry the overcap lying beside the bottle. The hero bottle in the niche (BASE_SET base.png) is
a Sunburst render of that same photograph, so one similarity transform — scale by body width, anchor the shoulder line
on the neck axis — puts every closure exactly where the artist drew it. The dip tube is ONE shared layer (from the gold
bulb file) so it is pixel-identical across bulbs → pumps → sprayers, and absent for the bare neck and the reducer caps.

  BASE_SET=v6 HERO_SET=v7 python3 scripts/hero-empire/kit.py

Output: frame-<sku>.png/webp, lossless RGBA patch-<sku>.webp + manifest.json {base,width,height,builtAt,frames[]},
geometry.json (datum), _kit-preview.jpg (all frames, niche crop), _collars.jpg (neck zoom strip)."""
import os, re, json, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from psd_tools import PSDImage

MASTER = "/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master/2.  18-415 Bottles /21. Empire 50ml/1. Empire 50ml PSD"
BASE_SET = os.environ.get("BASE_SET", "v6"); SET = os.environ.get("HERO_SET", "v7")
BIN, OUT = f"public/assets/hero/{BASE_SET}", f"public/assets/hero/{SET}"; os.makedirs(OUT, exist_ok=True)
W, H = 1536, 1024
SEQUENCE = [k for k in os.environ.get("SEQUENCE", "AnSp,LB,Spry,BARE,Rdcr").split(",") if k]
TINT = np.array([1.0, 0.965, 0.90]); GAIN = float(os.environ.get("KIT_GAIN", "0.94"))   # studio white → niche bone
BULB_SCALE = float(os.environ.get("BULB_SCALE", "0.85"))   # the mesh ball only (collar + fitting stay at neck size); 1.0 = catalogue scale
TUBE_WIDTH = float(os.environ.get("TUBE_WIDTH", "0.55"))   # one thin dip tube for every spray frame (fraction of the drawn width)
SEAT = 1                                                    # collar bottom row = shoulder + SEAT, identical for every closure
log = lambda *a: print(*a, flush=True)

base = np.asarray(Image.open(f"{BIN}/base.png").convert("RGB").resize((W, H))).astype(float)
wall = np.asarray(Image.open(f"{BIN}/wall.png").convert("RGB").resize((W, H))).astype(float)
g = json.load(open(f"{BIN}/geometry.json")); NICHE = g["niche"]

# ── the hero bottle's datum: neck axis, shoulder line, body width, from the base-vs-wall difference ────────────────
def base_datum():
    d = np.abs(base - wall).sum(axis=2); X0, X1 = 840, 1090
    m = d[:, X0:X1] > 120; ext = {}
    for y in range(300, 820):
        xs = np.where(m[y])[0]
        if len(xs) >= 3: ext[y] = (X0 + int(xs.min()), X0 + int(xs.max()) + 1)
    wid = {y: x1 - x0 for y, (x0, x1) in ext.items()}
    body_w = float(np.median([w for w in wid.values() if w > 100]))
    body_rows = [y for y, w in wid.items() if w >= 0.95 * body_w]
    shoulder = min(y for y, w in wid.items() if w >= 0.7 * body_w)
    bottom = max(body_rows); cx = float(np.median([(ext[y][0] + ext[y][1]) / 2 for y in body_rows]))
    neck = [y for y, w in wid.items() if 30 <= w <= 0.6 * body_w and y < shoulder and y > shoulder - 120]
    return dict(body_w=body_w, shoulder=shoulder, bottom=bottom, cx=cx, neck_top=min(neck), neck_w=float(np.median([wid[y] for y in neck])))
B = base_datum(); log("base datum", B)

# ── PSD reading: body / tube / closure / beside ──────────────────────────────────────────────────────────────────────
def read_psd(path):
    psd = PSDImage.open(path); facts = []
    for l in psd:
        if l.kind != "pixel" or not l.visible or l.name == "Background": continue
        im = l.topil()
        if im is None or im.mode != "RGBA": continue
        a = np.asarray(im)[..., 3]; ys, xs = np.where(a > 8)
        if not len(ys): continue
        fill = float(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].mean() / 255)
        facts.append(dict(name=l.name, im=im, left=l.left, top=l.top, a=a, fill=fill, box=(l.left + int(xs.min()), l.top + int(ys.min()), l.left + int(xs.max()) + 1, l.top + int(ys.max()) + 1)))
    body = max([f for f in facts if f["fill"] >= 0.5], key=lambda f: f["box"][3] - f["box"][1])   # tube layers are taller but sparse
    a = body["a"]; wid = {}
    for y in range(a.shape[0]):
        xs = np.where(a[y] > 8)[0]
        if len(xs) >= 3: wid[y] = (int(xs.min()), int(xs.max()) + 1)
    bw = float(np.median([x1 - x0 for x0, x1 in wid.values() if x1 - x0 > 100]))
    body_rows = [y for y, (x0, x1) in wid.items() if x1 - x0 >= 0.95 * bw]
    shoulder = body["top"] + min(y for y, (x0, x1) in wid.items() if x1 - x0 >= 0.7 * bw)
    cx = body["left"] + float(np.median([(wid[y][0] + wid[y][1]) / 2 for y in body_rows]))
    neck = [y for y, (x0, x1) in wid.items() if 30 <= x1 - x0 <= 0.6 * bw and body["top"] + y < shoulder]
    datum = dict(body_w=bw, shoulder=shoulder, bottom=body["top"] + max(body_rows), cx=cx, neck_top=body["top"] + min(neck), neck_w=float(np.median([wid[y][1] - wid[y][0] for y in neck])))
    tube, closure, beside = None, [], []
    for f in facts:
        if f is body: continue
        x0, y0, x1, y1 = f["box"]; fcx = (x0 + x1) / 2
        if x1 < cx - 0.3 * bw or x0 > cx + 0.3 * bw: beside.append(f)
        elif y0 >= shoulder - 30 and (x1 - x0) < 0.5 * bw: tube = f
        else: closure.append(f)
    return dict(path=path, datum=datum, body=body, tube=tube, closure=closure, beside=beside)

def kind(sku):
    return ("Tsl" if "Tsl" in sku else "AnSp" if "AnSp" in sku else "Spry" if "Spry" in sku else "Drp" if "Drp" in sku
            else "Rdcr" if "Rdcr" in sku else "LB" if sku.startswith("LB") else "other")
files = {}
for fn in sorted(os.listdir(MASTER)):
    m = re.match(r"^\d+\.\s*([A-Za-z0-9]+)", fn)
    if not fn.lower().endswith(".psd") or not m: continue
    files.setdefault(m.group(1), []).append(os.path.join(MASTER, fn))

# ── transform (PSD → hero): premultiplied resize, anchor (cx, shoulder) ──────────────────────────────────────────────
def place(f, s, pd, k=1.0, dy=0.0, dx=0.0):
    """layer f (PSD coords) → full-frame (rgb, a) in hero space under the similarity that maps the PSD body onto the base body;
    k = extra scale of this layer about its own top-left (used for the bulb ball, whose top-left is its nozzle-anchored origin)"""
    rgba = np.asarray(f["im"]).astype(np.float32); a = rgba[..., 3:4] / 255.0; a[a < 6 / 255] = 0; pre = rgba[..., :3] * a
    s = s * k
    nw, nh = max(1, int(round(rgba.shape[1] * s))), max(1, int(round(rgba.shape[0] * s)))
    ch = [np.asarray(Image.fromarray(pre[..., i]).resize((nw, nh), Image.LANCZOS)) for i in range(3)]
    aa = np.asarray(Image.fromarray(a[..., 0]).resize((nw, nh), Image.LANCZOS)); aa = np.clip(aa, 0, 1)
    rgb = np.dstack(ch) / np.maximum(aa, 1e-4)[..., None]
    s0 = s / k
    px = B["cx"] + (f["left"] - pd["cx"]) * s0 + dx; py = B["shoulder"] + (f["top"] - pd["shoulder"]) * s0 + dy
    x0, y0 = int(round(px)), int(round(py))
    RGB, A = np.zeros((H, W, 3)), np.zeros((H, W))
    sx0, sy0 = max(0, -x0), max(0, -y0); dx0, dy0 = max(0, x0), max(0, y0)
    w_, h_ = min(nw - sx0, W - dx0), min(nh - sy0, H - dy0)
    if w_ > 0 and h_ > 0:
        RGB[dy0:dy0 + h_, dx0:dx0 + w_] = np.clip(rgb[sy0:sy0 + h_, sx0:sx0 + w_], 0, 255); A[dy0:dy0 + h_, dx0:dx0 + w_] = aa[sy0:sy0 + h_, sx0:sx0 + w_]
    return RGB, A

def over(top_rgb, top_a, bot_rgb, bot_a):
    A = top_a + bot_a * (1 - top_a)
    RGB = (top_rgb * top_a[..., None] + bot_rgb * (bot_a * (1 - top_a))[..., None]) / np.maximum(A, 1e-6)[..., None]
    return RGB, A

# ── the shared dip tube (gold bulb file), extended up under the collar to the shoulder line ────────────────────────
ref = read_psd(files["GBEmp50AnSpGl"][0]); s_ref = B["body_w"] / ref["datum"]["body_w"]
log("psd datum (AnSpGl)", {k: round(v, 1) for k, v in ref["datum"].items()}, "scale %.4f" % s_ref,
    "neck-top check: psd→%.1f vs base %d; neck_w psd→%.1f vs base %.0f" % (B["shoulder"] + (ref["datum"]["neck_top"] - ref["datum"]["shoulder"]) * s_ref, B["neck_top"], ref["datum"]["neck_w"] * s_ref, B["neck_w"]))
TUBE_RGB, TUBE_A = place(ref["tube"], s_ref, ref["datum"])
ys = np.where(TUBE_A.max(axis=1) > 0.5)[0]; t_top = int(ys.min())
if t_top > B["shoulder"] - 2:
    TUBE_A[B["shoulder"] - 2:t_top] = TUBE_A[t_top]; TUBE_RGB[B["shoulder"] - 2:t_top] = TUBE_RGB[t_top]
if TUBE_WIDTH < 1:                                          # compress the tube about its own centre column
    cols = np.where(TUBE_A.max(axis=0) > 0.05)[0]; x0, x1 = int(cols.min()), int(cols.max()) + 1; c = (x0 + x1) / 2
    nw = max(2, int(round((x1 - x0) * TUBE_WIDTH)))
    A_ = np.asarray(Image.fromarray(TUBE_A[:, x0:x1].astype(np.float32)).resize((nw, H), Image.LANCZOS))
    R_ = np.dstack([np.asarray(Image.fromarray((TUBE_RGB[:, x0:x1, i] * TUBE_A[:, x0:x1]).astype(np.float32)).resize((nw, H), Image.LANCZOS)) for i in range(3)]) / np.maximum(A_, 1e-4)[..., None]
    TUBE_RGB[:] = 0; TUBE_A[:] = 0; nx0 = int(round(c - nw / 2))
    TUBE_A[:, nx0:nx0 + nw] = np.clip(A_, 0, 1); TUBE_RGB[:, nx0:nx0 + nw] = np.clip(R_, 0, 255)
core = np.where(TUBE_A[B["shoulder"] + 60] > 0.5)[0]
log("tube rows %d..%d (extended from %d), core width %d px" % (B["shoulder"] - 2, int(ys.max()), t_top, len(core)))

def split_bulb(f, pd):
    """antique sprayer layer → (ball scaled by BULB_SCALE about its nozzle, fitting + collar untouched)"""
    a = f["a"].astype(np.float32) / 255; bw = pd["body_w"]; cx_l = pd["cx"] - f["left"]
    colsum = (a > 0.3).sum(axis=0)
    ball_c = int(np.argmax(colsum[: int(cx_l - 0.25 * bw)]))
    lo, hi = ball_c, int(cx_l - 0.12 * bw); waist = lo + int(np.argmin(colsum[lo:hi]))
    rows = np.where(a[:, waist] > 0.3)[0]; wy = float(rows.mean()) if len(rows) else a.shape[0] / 2
    rgba = np.asarray(f["im"]); ball = rgba[:, :waist].copy(); rest = rgba.copy(); rest[:, :waist, 3] = 0
    k = BULB_SCALE; bi = Image.fromarray(ball, "RGBA")
    ball_f = dict(name=f["name"] + "/ball", im=bi, left=f["left"] + waist * (1 - k), top=f["top"] + wy * (1 - k), a=ball[..., 3], fill=f["fill"], box=f["box"])
    rest_f = dict(f, im=Image.fromarray(rest, "RGBA"))
    return ball_f, rest_f, waist, wy

def harmonise(rgb): return np.clip(rgb * TINT * GAIN, 0, 255)

# ── pick one PSD per SKU: the shorter closure (exposed head; the overcap-on twin is taller) ────────────────────────
ORDER = {"AnSp": ["Gl", "MtSl", "Blk", "Wht", "Red", "Pnk", "Lvn", "IvyGl", "IvySl"],
         "LB": ["WhtClOvrCp", "LtnShnGl", "LtnShnSl", "LtnShnBlk", "LtnMtGl", "LtnMtSl", "LtnCu", "LtnClOvrCap"],
         "Spry": ["ShnGl", "ShnSl", "ShnBlk", "MtGl", "MtSl", "Cu"],
         "Rdcr": ["ShnGl", "ShnSl", "ShnBlk", "MtSl", "Wht", "BlkLthr", "BrwnLthr", "LBrwnLthr", "IvyLthr", "PnkLthr", "ShnGl", "MtSlTall", "ShnBlkTall"]}
def rank(sku):
    k = kind(sku); tail = re.sub(r"^(GB|LB)Emp50(AnSp|Spry|Rdcr)?", "", sku)
    lst = ORDER.get(k, []); return (SEQUENCE.index(k) if k in SEQUENCE else 99, lst.index(tail) if tail in lst else 50, sku)
todo = sorted([s for s in files if kind(s) in SEQUENCE], key=rank)

manifest = []; collar_w = []
Image.open(f"{BIN}/base.png").convert("RGB").save(f"{OUT}/base.webp", "WEBP", quality=90)
for sku in todo:
    k = kind(sku); cands = [read_psd(p) for p in files[sku]]
    cands = [c for c in cands if c["closure"]]
    if not cands: log(f"{sku}: no closure layer — skipped"); continue
    c = min(cands, key=lambda c: -min(f["box"][1] for f in c["closure"]))        # lowest closure top = shortest = exposed head
    s = B["body_w"] / c["datum"]["body_w"]
    layers = []                                                  # (fact, extra scale)
    for f in c["closure"]:
        if k == "AnSp":
            ball, rest, waist, wy = split_bulb(f, c["datum"]); layers += [(ball, BULB_SCALE), (rest, 1.0)]
            log(f"   bulb split at waist x={waist} y={wy:.0f} (layer px)")
        else: layers.append((f, 1.0))
    # seat: measure the collar bottom at the neck axis with everything at dy=0, then shift so it sits on shoulder + SEAT
    CR, CA = np.zeros((H, W, 3)), np.zeros((H, W))
    for f, kk in layers:
        r, a = place(f, s, c["datum"], kk); CR, CA = over(r, a, CR, CA)
    axis = CA[:, int(B["cx"]) - 8: int(B["cx"]) + 8].max(axis=1); solid = np.where(axis[: B["shoulder"] + 40] > 0.5)[0]
    bottom = int(solid.max()); dy = (B["shoulder"] + SEAT) - bottom
    centres = []
    for yy in range(bottom - 24, bottom - 3):                     # the collar band: centre it on the neck axis
        xs = np.where(CA[yy] > 0.5)[0]
        if len(xs): centres.append((xs.min() + xs.max()) / 2)
    dx = int(round(B["cx"] - float(np.median(centres)))) if centres else 0
    CR, CA = np.zeros((H, W, 3)), np.zeros((H, W))
    for f, kk in layers:
        r, a = place(f, s, c["datum"], kk, dy, dx); CR, CA = over(r, a, CR, CA)
    xs = np.where(CA[B["shoulder"] - 4] > 0.5)[0]; collar_w.append(int(xs.max() - xs.min() + 1))
    RGB, A = np.zeros((H, W, 3)), np.zeros((H, W))
    if k in ("AnSp", "LB", "Spry"): RGB, A = TUBE_RGB.copy(), TUBE_A.copy()
    RGB, A = over(CR, CA, RGB, A)
    A[:NICHE[1]] = 0; A[NICHE[3]:] = 0; A[:, :NICHE[0]] = 0; A[:, NICHE[2]:] = 0
    A[A < 1 / 255] = 0
    RGB = harmonise(RGB); RGB = np.where(A[..., None] > 0, RGB, base)
    comp = base * (1 - A[..., None]) + RGB * A[..., None]
    Image.fromarray(comp.round().astype(np.uint8)).save(f"{OUT}/frame-{sku}.png")
    ys, xs = np.where(A > 0)
    y0, y1, x0, x1 = max(int(ys.min()) - 4, 0), min(int(ys.max()) + 5, H), max(int(xs.min()) - 4, 0), min(int(xs.max()) + 5, W)
    Image.fromarray(np.dstack([RGB[y0:y1, x0:x1], A[y0:y1, x0:x1] * 255]).round().astype(np.uint8), "RGBA").save(f"{OUT}/patch-{sku}.webp", "WEBP", lossless=True)
    manifest.append((sku, {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}))
    log(f"{sku}: {os.path.basename(c['path'])}  scale {s:.4f}  seat {dy:+d}px  centre {dx:+d}px  collar {collar_w[-1]}px  patch {x1-x0}×{y1-y0}" + ("  (+overcap beside dropped)" if c["beside"] else ""))
Image.open(f"{BIN}/base.png").convert("RGB").save(f"{OUT}/frame-BARE.png")
if "BARE" in SEQUENCE: manifest.append(("BARE", None))

# ── labels, manifest, previews ─────────────────────────────────────────────────────────────────────────────────────
COL = [(r"IvyGl", "ivory & gold"), (r"IvySl", "ivory & silver"), (r"MtSl", "matte silver"), (r"MtGl", "matte gold"), (r"ShnBlk", "shiny black"), (r"ShnGl", "shiny gold"), (r"ShnSl", "shiny silver"),
       (r"LBrwnLthr", "light brown leather"), (r"BlkLthr", "black leather"), (r"BrwnLthr", "brown leather"), (r"IvyLthr", "ivory leather"), (r"PnkLthr", "pink leather"),
       (r"Blk", "black"), (r"Wht", "white"), (r"Red", "red"), (r"Pnk", "pink"), (r"Lvn", "lavender"), (r"Cu", "copper"), (r"Gl", "gold"), (r"Sl", "silver"), (r"Cl", "clear")]
def label(sku):
    if sku == "BARE": return "Bare bottle · 18-415 neck"
    k = kind(sku); tail = re.sub(r"^(GB|LB)Emp50", "", sku)
    name = {"AnSp": "Antique sprayer", "LB": "Lotion pump", "Spry": "Fine-mist sprayer", "Rdcr": "Tall reducer" if "Tall" in tail else "Reducer"}[k]
    tail = re.sub(r"AnSp|Spry|Rdcr|Ltn|Tall|OvrCp|OvrCap", "", tail)
    col = next((l for p_, l in COL if re.search(p_, tail)), None)
    return f"{name} · {col}" if col else name
ORDER_K = {k: i for i, k in enumerate(SEQUENCE)}
manifest.sort(key=lambda t: (ORDER_K.get("BARE" if t[0] == "BARE" else kind(t[0]), 9), rank(t[0]) if t[0] != "BARE" else (0, 0, "")))
frames = []
for sku, pbox in manifest:
    Image.open(f"{OUT}/frame-{sku}.png").convert("RGB").save(f"{OUT}/frame-{sku}.webp", "WEBP", quality=85)
    e = {"sku": sku, "src": f"/assets/hero/{SET}/frame-{sku}.webp", "label": label(sku), "tube": sku != "BARE" and kind(sku) in ("AnSp", "LB", "Spry")}
    if pbox: e["patch"] = {"src": f"/assets/hero/{SET}/patch-{sku}.webp", **pbox}
    frames.append(e)
# HOLD rects (stage px): regions every closure covers opaquely — the component keeps the old patch there while the rest crossfades,
# so the bare threads never show and the shared tube never pulses. neck = narrowest collar minus a margin; tube = the shared tube column.
hw = min(collar_w) // 2 - 1
tcols = np.where(TUBE_A.max(axis=0) > 0.05)[0]; trows = np.where(TUBE_A.max(axis=1) > 0.05)[0]
hold = {"neck": {"x": int(B["cx"]) - hw, "y": B["neck_top"] - 2, "w": 2 * hw, "h": B["shoulder"] + SEAT + 2 - (B["neck_top"] - 2)},
        "tube": {"x": int(tcols.min()) - 1, "y": B["shoulder"] + SEAT + 2, "w": int(tcols.max() - tcols.min()) + 3, "h": int(trows.max()) + 2 - (B["shoulder"] + SEAT + 2)}}
log("hold rects", hold, "(collar widths %d..%d)" % (min(collar_w), max(collar_w)))
json.dump({"base": f"/assets/hero/{SET}/base.webp", "width": W, "height": H, "builtAt": int(time.time()), "hold": hold, "frames": frames}, open(f"{OUT}/manifest.json", "w"), indent=1)
json.dump({"niche": NICHE, "plaster": g.get("plaster"), "body": g.get("body"), "datum": B}, open(f"{OUT}/geometry.json", "w"))

try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
except Exception: font = ImageFont.load_default()
n = NICHE; cells = []
for e in frames:
    im = Image.open(f"{OUT}/frame-{e['sku']}.png").convert("RGB").crop((n[0] - 10, n[1] - 10, n[2] + 10, n[3] + 10)); im = im.resize((int(im.width * 300 / im.height), 300))
    c = Image.new("RGB", (im.width, 320), "#141210"); c.paste(im, (0, 0)); ImageDraw.Draw(c).text((4, 302), e["sku"], fill="#e8e2d6", font=font); cells.append(c)
cols = 7; rows_ = (len(cells) + cols - 1) // cols; cw, ch = cells[0].width + 8, 328
sheet = Image.new("RGB", (cols * cw + 8, rows_ * ch + 8), "#141210")
for i, c in enumerate(cells): sheet.paste(c, (8 + (i % cols) * cw, 8 + (i // cols) * ch))
sheet.save(f"{OUT}/_kit-preview.jpg", quality=88)
strip = []
for e in frames:
    im = Image.open(f"{OUT}/frame-{e['sku']}.png").convert("RGB").crop((int(B["cx"]) - 110, B["shoulder"] - 150, int(B["cx"]) + 110, B["shoulder"] + 60)).resize((220 * 2, 210 * 2))
    d = ImageDraw.Draw(im); d.line((0, 300, 440, 300), fill=(255, 0, 0), width=1); d.text((4, 4), e["sku"], fill=(200, 0, 0), font=font); strip.append(im)
cols = 9; rows_ = (len(strip) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 444, rows_ * 424), "#141210")
for i, c in enumerate(strip): sheet.paste(c, ((i % cols) * 444, (i // cols) * 424))
sheet.save(f"{OUT}/_collars.jpg", quality=88)
log("DONE", len(frames), "frames →", OUT)
