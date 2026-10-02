"""Proof sheets for r3: (1) per target body, the r2 sized hero (what Jordan reviewed) vs r3 sized (target applied), same zoom, with the measured
glass-top % and his number; (2) the four re-rendered heroes, old vs new. usage: proof_r3.py <scratch>"""
import json, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__)); from measure_hero import measure
S = sys.argv[1]; R2 = f"{S}/heroes/public/sunburst-all-heroes-latest-2026-09-09-r2/sunburst-latest"; OUT = f"{S}/heroes/out"
report = {r["body"]: r for r in json.load(open(f"{S}/heroes/targets-report.json"))}; sizing = json.load(open(f"{OUT}/sizing.json"))
def tile(p, label, w=300):
    im = Image.open(p).convert("RGB"); d = ImageDraw.Draw(im); d.line([(0, 1562), (1560, 1562)], fill=(220, 40, 40), width=3)
    im = im.resize((w, int(w * 1716 / 1560))); t = Image.new("RGB", (w, im.height + 30), (255, 255, 255)); t.paste(im, (0, 30)); ImageDraw.Draw(t).text((3, 3), label[:60], fill=(0, 0, 0)); ImageDraw.Draw(t).text((3, 15), label[60:120], fill=(0, 0, 0)); return t
rows = []
for body, r in sorted(report.items()):
    members = [s for s, z in sizing.items() if z.get("group") == body and os.path.exists(f"{R2}/{s}.png")]
    pct = sorted(set(x["pct"] for x in r["from_skus"])); tiles = []
    for s in members[:6]:
        m2 = measure(f"{R2}/{s}.png"); m3 = measure(f"{OUT}/{s}.sized.png"); g2 = (m2["base"] - m2["glass_top"]) / 1716 * 100; g3 = (m3["base"] - m3["glass_top"]) / 1716 * 100
        tiles.append(tile(f"{R2}/{s}.png", f"{s} r2 glass-top {g2:.1f}%")); tiles.append(tile(f"{OUT}/{s}.sized.png", f"{s} r3 glass-top {g3:.1f}% (target {pct})"))
    W = sum(t.width for t in tiles) + 6 * len(tiles); H = max(t.height for t in tiles) + 24
    row = Image.new("RGB", (W, H), (235, 235, 235)); ImageDraw.Draw(row).text((4, 4), f"BODY {body}: Jordan's target {pct}% glass top — set on {', '.join(x['sku'] for x in r['from_skus'])}{' — CONFLICT, median used' if r['conflict'] else ''}; {len(members)} heroes in this body", fill=(0, 0, 0)); x = 0
    for t in tiles: row.paste(t, (x, 24)); x += t.width + 6
    rows.append(row)
W = max(r.width for r in rows); sheet = Image.new("RGB", (W, sum(r.height for r in rows)), (225, 225, 225)); y = 0
for r in rows: sheet.paste(r, (0, y)); y += r.height
sheet.save(f"{S}/heroes/r3-targets-proof.png"); print("targets proof", sheet.size)
tiles = []
for sku in [j["sku"] for j in json.load(open(f"{S}/missing/jobs-recolour.json"))]:
    tiles.append(tile(f"{R2}/{sku}.png", f"{sku} BEFORE (clear ref)", 360)); tiles.append(tile(f"{OUT}/{sku}.sized.png", f"{sku} AFTER (colour ref / rebuilt base), sized", 360))
W = sum(t.width for t in tiles) + 6 * len(tiles); sheet = Image.new("RGB", (W, tiles[0].height), (235, 235, 235)); x = 0
for t in tiles: sheet.paste(t, (x, 0)); x += t.width + 6
sheet.save(f"{S}/heroes/r3-recolour-proof.png"); print("recolour proof", sheet.size)
