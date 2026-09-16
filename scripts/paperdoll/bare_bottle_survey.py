#!/usr/bin/env python3
"""Survey the side-view / uncapped folders of both PSD libraries for bare-glass
bottles with an empty neck, for the families whose front photographs carry an
insert. Renders the largest visible layer of every PSD in those folders onto
one sheet per library, labelled with library, path, layer and size.

    python3 scripts/paperdoll/bare_bottle_survey.py --out public/reviews/<dir>
"""
import argparse, re, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from psd_tools import PSDImage
import numpy as np
LIBS = {'master': Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master'),
        'original': Path('/Users/jordanrichter/Projects/Clients/Nemat-International/Best-Bottles-Original-Photoshop-Sources')}
FAMILIES = re.compile(r'elegant|circle|round|empire|diva|sleek|slim|grace|diamond|cylind|flair|square|tulip|royal|rect', re.I)
FOLDER = re.compile(r'sideview|side view|aerial|uncapped', re.I)
ap = argparse.ArgumentParser(); ap.add_argument('--out', type=Path, required=True); args = ap.parse_args(); args.out.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 11)
index = []
for lib, root in LIBS.items():
    files = sorted(p for p in root.rglob('*.psd') if FOLDER.search(str(p.relative_to(root))) and FAMILIES.search(str(p.relative_to(root))) and not re.search(r'tassel', str(p), re.I))
    tiles = []
    for p in files:
        try:
            psd = PSDImage.open(p); best = None
            for i, l in enumerate(psd.descendants()):
                if l.is_group() or l.kind != 'pixel' or not l.is_visible(): continue
                im = l.topil()
                if im is None: continue
                a = np.asarray(im.convert('RGBA').getchannel('A')) > 8
                if not a.any(): continue
                full = im.width * im.height >= 0.97 * psd.width * psd.height and a.mean() > 0.97
                if full: continue
                area = int(a.sum())
                if best is None or area > best[0]: best = (area, i, l.name, im.convert('RGBA'))
            if best is None: continue
            area, i, name, im = best; box = im.getchannel('A').getbbox(); im = im.crop(box)
            tiles.append((str(p.relative_to(root)), i, name, im, len(list(psd.descendants()))))
            index.append({'library': lib, 'path': str(p.relative_to(root)), 'layer': i, 'layerName': name, 'layers': len(list(psd.descendants())), 'size': [im.width, im.height]})
        except Exception as e:
            index.append({'library': lib, 'path': str(p.relative_to(root)), 'error': str(e)[:80]})
    W, H = 200, 300; cols = 9; rows = max(1, (len(tiles) + cols - 1) // cols)
    sheet = Image.new('RGB', (W * cols, H * rows + 30), (245, 243, 239)); d = ImageDraw.Draw(sheet)
    d.text((8, 8), f"{lib}: {len(tiles)} bare-bottle candidates in side-view / uncapped folders — largest visible layer of each PSD", fill=(30, 30, 30), font=font)
    for k, (rel, i, name, im, n) in enumerate(tiles):
        t = im.copy(); t.thumbnail((W - 12, H - 60)); x, y = (k % cols) * W, 30 + (k // cols) * H
        sheet.paste(t, (x + (W - t.width) // 2, y + 4), t)
        parts = rel.split('/'); d.text((x + 4, y + H - 52), parts[-1][:30], fill=(20, 20, 20), font=font)
        d.text((x + 4, y + H - 38), ('/'.join(parts[-3:-1]))[:34], fill=(100, 100, 100), font=font)
        d.text((x + 4, y + H - 24), f"layer {i} of {n} · {im.width}×{im.height}", fill=(110, 60, 60), font=font)
    sheet.save(args.out / f'bare-bottles-{lib}.jpg', quality=82); print(lib, len(files), 'files', len(tiles), 'tiles', sheet.size)
(args.out / 'bare-bottles-index.json').write_text(json.dumps(index, indent=1))
