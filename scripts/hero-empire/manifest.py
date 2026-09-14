"""Order frames (sprayers → tassels → droppers → reducers → overcap), label them, write webp + manifest + review sheet."""
import re, json, glob, os
from PIL import Image, ImageDraw, ImageFont
KIND = [(r"AnSpTsl","Antique sprayer · tassel"),(r"AnSp","Antique sprayer"),(r"Drp","Glass dropper"),(r"RdcrMtSlTall","Tall reducer · matte silver"),(r"RdcrShnBlkTall","Tall reducer · shiny black"),(r"Rdcr","Reducer"),(r"OvrCp","Overcap")]
COL = [(r"IvyGl","ivory & gold"),(r"IvySl","ivory & silver"),(r"MtSl","matte silver"),(r"ShnBlk","shiny black"),(r"ShnGl","shiny gold"),(r"ShnSl","shiny silver"),(r"LBrwnLthr","light brown leather"),(r"BlkLthr","black leather"),(r"BrwnLthr","brown leather"),(r"IvyLthr","ivory leather"),(r"PnkLthr","pink leather"),(r"Blk","black"),(r"Wht","white"),(r"Red","red"),(r"Pnk","pink"),(r"Lvn","lavender"),(r"Cu","copper"),(r"Gl","gold"),(r"Sl","silver")]
def label(sku):
    tail = re.sub(r"^[GL]BEmp50", "", sku)
    kind = next((l for p, l in KIND if re.search(p, tail)), "Closure")
    rest = re.sub(r"Tsl|AnSp|Drp|Rdcr|Tall|OvrCp|Cl", "", tail)
    col = next((l for p, l in COL if re.search(p, rest)), None)
    return f"{kind} · {col}" if col and "·" not in kind else kind
rank = lambda s: (1 if "AnSpTsl" in s else 0 if "AnSp" in s else 2 if "Drp" in s else 3 if "Rdcr" in s else 4)
frames = sorted([os.path.basename(p)[6:-4] for p in glob.glob("public/assets/hero/frames/frame-*.png")], key=lambda s: (rank(s), s))
manifest = []
for sku in frames:
    im = Image.open(f"public/assets/hero/frames/frame-{sku}.png").convert("RGB")
    im.save(f"public/assets/hero/frames/frame-{sku}.webp", "WEBP", quality=85)
    manifest.append({"sku": sku, "src": f"/assets/hero/frames/frame-{sku}.webp", "label": label(sku)})
json.dump(manifest, open("public/assets/hero/frames/manifest.json", "w"), indent=1)
# review sheet: niche crops of every frame
try: font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 13)
except Exception: font = ImageFont.load_default()
cells = []
for f in manifest:
    im = Image.open(f"public/assets/hero/frames/frame-{f['sku']}.png").convert("RGB").crop((800, 100, 1230, 820)).resize((180, 301))
    c = Image.new("RGB", (180, 322), "#1b1917"); c.paste(im, (0, 0)); ImageDraw.Draw(c).text((3, 304), f["label"][:30], fill="#e8e2d6", font=font); cells.append(c)
cols = 9; rows = (len(cells) + cols - 1) // cols; pad = 8
sheet = Image.new("RGB", (cols * 180 + (cols + 1) * pad, rows * 322 + (rows + 1) * pad), "#141210")
for i, c in enumerate(cells): sheet.paste(c, (pad + (i % cols) * (180 + pad), pad + (i // cols) * (322 + pad)))
sheet.save("public/assets/hero/frames/_review-frames.jpg", quality=86)
print(len(manifest), "frames;", "sheet", sheet.size); print([f["label"] for f in manifest][:8])
