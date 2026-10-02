"""Package finished heroes for the review library: size, stage a public root (/sunburst-v1/<sku>.png + /prior/<sku>.png), write the manifest,
per-family before/after sheets. usage: package.py <scratch> <collection-id> family [family ...]"""
import json, os, sys, shutil, subprocess, collections
from PIL import Image, ImageDraw
S, cid, *fams = sys.argv[1:]; OUT = f"{S}/heroes/out"; PUB = f"{S}/heroes/public/{cid}"; os.makedirs(f"{PUB}/sunburst-v1", exist_ok=True); os.makedirs(f"{PUB}/prior", exist_ok=True)
subprocess.run(["python3", f"{S}/heroes/size_group.py", S, OUT, "1562"], capture_output=True, text=True); sizing = json.load(open(f"{OUT}/sizing.json"))
subprocess.run(["python3", f"{S}/heroes/shadow_audit.py", S] + fams, capture_output=True, text=True); shadows = json.load(open(f"{S}/heroes/shadow-audit.json")) if os.path.exists(f"{S}/heroes/shadow-audit.json") else {}
rows = []; byfam = collections.defaultdict(list)
for f in sorted(os.listdir(OUT)):
    if not f.endswith(".png.json") or ".2080." in f: continue
    rec = json.load(open(f"{OUT}/{f}")); sku = rec["sku"]
    if fams and rec["family"] not in fams: continue
    src = f"{OUT}/{sku}.sized.png" if os.path.exists(f"{OUT}/{sku}.sized.png") else f"{OUT}/{sku}.png"
    shutil.copy(src, f"{PUB}/sunburst-v1/{sku}.png"); shutil.copy(rec["hero"], f"{PUB}/prior/{sku}.png"); sz = sizing.get(sku, {})
    sh = shadows.get(sku, {}); tassel = "Tassel" in (rec.get("prompt", "") or "") or "Tsl" in sku
    shadow_note = ("shadow audit: not reliable — tassel beside the bottle, judge by eye" if tassel else
                   f"shadow audit: {'conforms' if sh.get('ok') else 'OUTSIDE spec'} — contact {sh.get('contact')}, cast {sh.get('cast_depth')} toward {sh.get('clock')} o'clock, feather {sh.get('feather')}, floating {sh.get('floating')}")
    fp = lambda v, f: (format(v, f) if isinstance(v, (int, float)) else "n/a")
    notes = [f"geometry gate {rec.get('verdict')}: top {fp(rec.get('top_shift', 0), '+d')}px, left {fp(rec.get('left_shift', 0), '+d')}px, base {fp(rec.get('base_shift'), '+d')}px (base/width informational — shadows and old white fills move them)", f"sizing: group {sz.get('group')} scale {sz.get('scale')} base {sz.get('base_from')}→{sz.get('base_to')}", shadow_note] + ([sz["flag"]] if sz.get("flag") else [])
    rows.append(dict(sku=sku, family=rec["family"], url=f"/sunburst-v1/{sku}.png", priorUrl=f"/prior/{sku}.png", title=sku, stage="visual-review", reviewNotes=notes, gate=rec["verdict"], sizing=sz)); byfam[rec["family"]].append(rows[-1])
json.dump(dict(rows=rows), open(f"{PUB}/manifest.json", "w"), indent=1); print(f"manifest: {len(rows)} rows across {dict((k, len(v)) for k, v in byfam.items())}")
for fam, rs in byfam.items():
    tiles = []
    for r in rs:
        a = Image.open(f"{PUB}/prior/{r['sku']}.png").convert("RGB").resize((300, 330)); b = Image.open(f"{PUB}/sunburst-v1/{r['sku']}.png").convert("RGB").resize((300, 330)); tiles.append((r, a, b))
    cols = 4; rowsN = (len(tiles) + cols - 1) // cols; sheet = Image.new("RGB", (cols * 640 + 20, rowsN * 370 + 20), (235, 233, 229)); d = ImageDraw.Draw(sheet)
    for i, (r, a, b) in enumerate(tiles):
        x = 10 + (i % cols) * 640; y = 10 + (i // cols) * 370; sheet.paste(a, (x, y + 30)); sheet.paste(b, (x + 310, y + 30))
        d.text((x, y + 8), f"{r['sku']}  registry | sunburst+sized  {r['gate']}  scale {r['sizing'].get('scale')}{'  REVIEW' if r['sizing'].get('flag') else ''}", fill=(30, 30, 30))
    sheet.save(f"{PUB}/sheet-{fam.replace(' ', '-')}.png"); print("sheet", fam, sheet.size)
