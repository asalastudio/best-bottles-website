#!/usr/bin/env python3
"""Review sheet for a master-kit batch: per SKU the published plate, the kit's
assembled composite (parity with the plate), and the exploded parts, all on a
bone ground so any white ground left in a part shows. Rows in review print
their reason instead.

    python3 scripts/paperdoll/kit_review_sheet.py --batch dist/paper-doll/boston-master --out public/reviews/<dir>/<name>.jpg
"""
import argparse, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser(); ap.add_argument('--batch', type=Path, required=True); ap.add_argument('--out', type=Path, required=True); args = ap.parse_args()
rows = json.load(open(args.batch / 'kits/manifest.json'))['rows']
plates = {r['websiteSku']: r for r in json.load(open(args.batch / 'plates/manifest.json'))['rows']}
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 13); small = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 11)
bone = (245, 243, 239); T = 260; CW = T * 3 + 30; CH = int(T * 1.1) + 70; cols = 3
sheet = Image.new('RGB', (CW * cols, CH * ((len(rows) + cols - 1) // cols) + 40), bone); d = ImageDraw.Draw(sheet)
d.text((10, 10), "Per SKU: published plate (left) · kit reassembled from its parts (middle, parity-gated against the plate) · parts on bone, exploded (right). White ground left in any part would show as a white box.", fill=(30, 30, 30), font=font)
def onto_bone(path):
    im = Image.open(path).convert('RGBA'); im.thumbnail((T, int(T * 1.1)))
    tile = Image.new('RGBA', (T, int(T * 1.1)), bone + (255,)); tile.alpha_composite(im, ((T - im.width) // 2, 0)); return tile
def parts_on_bone(row):
    canvas = Image.new('RGBA', (1000, 1100), bone + (255,))
    for p in row['parts']:
        layer = Image.open(args.batch / 'kits' / p['image']).convert('RGBA')
        canvas.alpha_composite(layer, (p['exploded']['dx'], p['exploded']['dy']))
    canvas.thumbnail((T, int(T * 1.1))); return canvas
for i, r in enumerate(rows):
    x, y = (i % cols) * CW, 40 + (i // cols) * CH
    d.rectangle([x + 4, y + 4, x + CW - 4, y + CH - 4], fill=(255, 255, 255) if r['status'] == 'candidate' else (250, 236, 236), outline=(220, 214, 205))
    sku = r['sku']; pl = plates.get(sku)
    if pl: sheet.paste(onto_bone(args.batch / 'plates' / pl['plate']['key']).convert('RGB'), (x + 8, y + 8))
    if r['status'] == 'candidate':
        kd = args.batch / 'kits' / r['familyId'] / sku
        sheet.paste(onto_bone(kd / 'assembled.webp').convert('RGB'), (x + 8 + T + 7, y + 8))
        sheet.paste(parts_on_bone(r).convert('RGB'), (x + 8 + 2 * (T + 7), y + 8))
        gates = r['gates']; slots = '+'.join(p['slot'] + ('·matte' if p['derivation'] == 'background-matte' else '') for p in r['parts'])
        d.text((x + 10, y + int(T * 1.1) + 14), f"{sku}  ·  {slots}", fill=(30, 30, 30), font=font)
        d.text((x + 10, y + int(T * 1.1) + 32), f"parity mean {gates['parity']['mean']}/255 (gate ≤6) · tail>40 {gates['parity']['tailOver40']} · plate {r['plateSha256'][:10]}", fill=(90, 90, 90), font=small)
    else:
        d.text((x + 10 + T + 7, y + 40), "IN REVIEW", fill=(160, 60, 60), font=font)
        d.text((x + 10, y + int(T * 1.1) + 14), sku, fill=(30, 30, 30), font=font)
        d.text((x + 10, y + int(T * 1.1) + 32), (r.get('reason') or '')[:110], fill=(160, 60, 60), font=small)
args.out.parent.mkdir(parents=True, exist_ok=True); sheet.save(args.out, quality=86); print(args.out, sheet.size)
