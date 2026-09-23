#!/usr/bin/env python3
"""Real bare-glass bodies from the master's Sideviews folders, beside the body
the builder serves today (GPT-edited or missing). For each body key: every
front-facing PSD in the family's Sideviews folder (widest silhouette first),
largest visible layer, cropped, white ground stripped for coloured glass only,
scaled to the current body's height so the two can be compared at one zoom.
Review only — nothing is wired.

    python3 scripts/paperdoll/sideview_body_candidates.py --out public/reviews/builder-bodies-2026-09-14/sideview-bodies.jpg
"""
import argparse, json, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from psd_tools import PSDImage
import numpy as np
M = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
REPO = Path(__file__).resolve().parents[2]
bodies = json.loads((REPO / 'src/lib/bottle-builder/bodies.generated.json').read_text())
review = {b['body']: b for b in json.loads((REPO / 'data/paper-doll/builder-bodies-source-review.json').read_text())['bodies']}
# body key → Sideviews folder (master), by family/capacity/colour
FOLDERS = {
  'Circle|50|Clear|18-415': '2.  18-415 Bottles /4. Circle Glass 50ml/2. Circle 50ml (18-415) Sideviews',
  'Circle|50|Frosted|18-415': '2.  18-415 Bottles /30. Circle (Frosted) Glass 50ml/2. Circle 50ml (18-415) Sideviews',
  'Circle|100|Clear|18-415': '2.  18-415 Bottles /5. Circle Glass Bottle 100ml (clear)/2. Circle 100ml (18415) Sideviews',
  'Circle|100|Frosted|18-415': '2.  18-415 Bottles /6. Circle (frosted) 100ml/2. Circle Frosted 100ml (18-415) Sideviews',
  'Circle|30|Clear|15-415': '15-415 Bottles/2. Circle Clear 30ml - Uncapped/Side Views',
  'Diva|30|Clear|18-415': '2.  18-415 Bottles /23. Diva Clear 30ml/2. Diva 30ml (18-415) Sideviews',
  'Diva|46|Frosted|18-415': '2.  18-415 Bottles /26. Diva 46ml frosted/2. Diva Frst 46 (18415) Sideviews',
  'Diva|100|Clear|18-415': '2.  18-415 Bottles /27. Diva (clear) 100ml/2. Diva 100ml (18415) Sideviews',
  'Elegant|60|Clear|18-415': '2.  18-415 Bottles /17. Elegant 60ml/2. Elegant 60ml (18-415) Sideviews',
  'Elegant|60|Frosted|18-415': '2.  18-415 Bottles /19. Elegant Frosted 60ml/2. Elegant Frst 60ml (18-415) Sideviews',
  'Elegant|100|Clear|18-415': '2.  18-415 Bottles /18. Elegant 100ml/2. Elegant 100ml (18-415) Sideviews',
  'Elegant|100|Frosted|18-415': '2.  18-415 Bottles /20. Elegant Frosted 100ml/2.Elegant Frst 100ml (18-415) Sideviews',
  'Empire|50|Clear|18-415': '2.  18-415 Bottles /21. Empire 50ml/2. Empire 50ml (18-415) Sideviews',
  'Empire|100|Clear|18-415': '2.  18-415 Bottles /22. Empire Bottle 100ml/2. Empire 100ml (18415) Sideviews',
  'Round|128|Clear|18-415': '2.  18-415 Bottles /7. Round (clear) 128ml /2. Round 128ml (18-415) Sideviews',
  'Round|128|Frosted|18-415': '2.  18-415 Bottles /10. Round Frosted 128ml/2. Round Frosted 128ml (18-415) Sideviews',
  'Round|78|Frosted|18-415': '2.  18-415 Bottles /8. Round 78ml Frosted/2. Round Frosted 78ml (18-415) Sideviews',
  'Round|78|Clear|18-415': '2.  18-415 Bottles /9. Round 78ml/2. Round 78 (18-415) Sideview',
  'Sleek|30|Clear|18-415': '2.  18-415 Bottles /11. Sleek 30ml /2. Sleek 30ml(18-415) Sideviews',
  'Sleek|50|Clear|18-415': '2.  18-415 Bottles /12. Sleek 50ml/2. Sleek 50ml (18-415) Sideviews',
  'Sleek|100|Clear|18-415': '2.  18-415 Bottles /13. Sleek 100ml/2. Sleek 100ml (18-415) Sideviews',
  'Slim|50|Clear|18-415': '2.  18-415 Bottles /15. Slim 50ml/2. Slim 50ml (18-415) Sideviews',
  'Grace|55|Clear|18-415': '2.  18-415 Bottles /29. Grace 55 ml/2. Grace 55ml (18415) Sideviews',
  'Diamond|60|Clear|18-415': '2.  18-415 Bottles /28. Diamond 60ml/2. Diamond 60ml (18415) Sideviews',
}
ap = argparse.ArgumentParser(); ap.add_argument('--out', type=Path, required=True); args = ap.parse_args()
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 11); big = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 13)
def largest_layer(psd):
    best = None
    for i, l in enumerate(psd.descendants()):
        if l.is_group() or l.kind != 'pixel' or not l.is_visible(): continue
        im = l.topil()
        if im is None: continue
        a = np.asarray(im.convert('RGBA').getchannel('A')) > 8
        if not a.any() or (im.width * im.height >= 0.97 * psd.width * psd.height and a.mean() > 0.97): continue
        if best is None or a.sum() > best[0]: best = (int(a.sum()), i, l.name, im.convert('RGBA'))
    return best
rows = []; index = []
for key, folder in FOLDERS.items():
    d = M / folder
    if not d.exists(): index.append({'body': key, 'error': 'folder missing: ' + folder}); continue
    cands = []
    for p in sorted(d.glob('*.psd')):
        if re.search(r'measur|aerial|top view|depth', p.name, re.I): continue
        try: b = largest_layer(PSDImage.open(p))
        except Exception as e: continue
        if not b: continue
        _, i, name, im = b; im = im.crop(im.getchannel('A').getbbox())
        cands.append((p, i, name, im, im.width / im.height))
    cands.sort(key=lambda c: -c[4])   # widest silhouette = front view for these moulds
    rows.append((key, cands[:3])); index.append({'body': key, 'candidates': [{'path': str(c[0].relative_to(M)), 'layer': c[1], 'layerName': c[2], 'size': [c[3].width, c[3].height]} for c in cands[:3]]})
T = 260; W = 4 * T + 40; H = 330
sheet = Image.new('RGB', (W, H * len(rows) + 40), (245, 243, 239)); d = ImageDraw.Draw(sheet)
d.text((10, 10), "Body today (left, GPT-edited or missing) beside the master's own bare Sideviews layers (up to three, widest silhouette first), scaled to one height. Review only.", fill=(30, 30, 30), font=big)
for r, (key, cands) in enumerate(rows):
    y = 40 + r * H; d.text((10, y + 4), key + ('' if key in bodies else '   — NO BODY TODAY'), fill=(30, 30, 30), font=big)
    cur = Image.open(REPO / 'public' / bodies[key]['url'].lstrip('/')).convert('RGBA') if key in bodies else None
    target_h = H - 60
    if cur:
        t = cur.copy(); t.thumbnail((T - 20, target_h)); sheet.paste(t, (10 + (T - t.width) // 2, y + 24 + (target_h - t.height)), t)
        d.text((10, y + H - 30), 'today: ' + (review.get(key, {}).get('source') or '')[:40], fill=(90, 90, 90), font=font)
    for c, (p, i, name, im, asp) in enumerate(cands):
        x = 10 + (c + 1) * T + 10
        t = im.copy(); t.thumbnail((T - 20, target_h)); sheet.paste(t, (x + (T - t.width) // 2, y + 24 + (target_h - t.height)), t)
        d.text((x, y + H - 44), p.name[:34], fill=(20, 20, 20), font=font); d.text((x, y + H - 30), f"layer {i} · {im.width}×{im.height}", fill=(110, 60, 60), font=font)
args.out.parent.mkdir(parents=True, exist_ok=True); sheet.save(args.out, quality=86)
(args.out.with_suffix('.json')).write_text(json.dumps(index, indent=1)); print(args.out, sheet.size, len(rows), 'keys')
