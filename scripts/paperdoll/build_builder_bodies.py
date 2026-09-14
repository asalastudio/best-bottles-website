#!/usr/bin/env python3
"""Bare-body builder media for every plated body, from reviewed master PSD layers.

A body key is family|capacityMl|color|neck. Its bare-glass image is one visible
pixel layer of one exact master PSD — never generated geometry, never a
flattened product photograph. Sources come from, in order:
  1. the Circle media already reviewed (src/lib/bottle-builder/circle-bodies.generated.json);
  2. the 2026-09-07/08 paired-kit recipes reviewed by Jordan and Codex
     (data/paper-doll/*-paired-kit-recipes.json: onSourceSha256 + onBodyLayer);
  3. otherwise a CANDIDATE: the layer of a representative capped master PSD whose
     alpha footprint sits on the bottle axis and reaches the canvas baseline. A
     candidate is written to the review set only, never to the reviewed file,
     until Jordan approves it on the contact sheet.

    /opt/homebrew/bin/python3 scripts/paperdoll/build_builder_bodies.py [--review-only]

Writes public/images/bottle-builder/bodies/<key>.webp, src/lib/bottle-builder/bodies.generated.json
(reviewed keys only), data/paper-doll/builder-bodies-source-review.json (every key,
with lineage and status) and a contact sheet under public/reviews/builder-bodies-2026-09-14/.
"""
import argparse, hashlib, json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from psd_tools import PSDImage

ROOT = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
REPO = Path(__file__).resolve().parents[2]
OUT = REPO / 'public/images/bottle-builder/bodies'; OUT.mkdir(parents=True, exist_ok=True)
REVIEW_DIR = REPO / 'public/reviews/builder-bodies-2026-09-14'; REVIEW_DIR.mkdir(parents=True, exist_ok=True)
DATA = REPO / 'data/paper-doll'

snapshot = {r['sku']: r for r in json.loads((REPO / 'data/asset-ledger/builder-catalog-snapshot.json').read_text())['rows']}
ledger = json.loads((REPO / 'src/lib/asset-ledger/ledger.json').read_text())['platePlan']['rows']
inventory = json.loads((DATA / 'inventory.json').read_text())['files']
by_sha = {f['sha256']: f for f in inventory}
master_psd = [f for f in inventory if f['library'] == 'master' and f['ext'] == 'psd']
circle = json.loads((REPO / 'src/lib/bottle-builder/circle-bodies.generated.json').read_text())

def profile_of(r):
    slug = r.get('productGroupSlug') or ''; marker = f"-{r['capacityMl']}ml-"
    return slug.split(marker)[0] if marker in slug else None

# a family+capacity that holds two moulds (Footed vs Tall Rectangle 10 ml) is keyed by profile
_profiles = {}
for r in snapshot.values():
    if r.get('neck') and re.search(r'bottle|vial', r.get('category') or '', re.I) and profile_of(r):
        _profiles.setdefault(f"{r['family']}|{r['capacityMl']}|{r['color']}|{r['neck']}", set()).add(profile_of(r))
SPLIT = {k for k, v in _profiles.items() if len(v) > 1}

def key_of(sku):
    r = snapshot.get(sku)
    if not r or not r.get('neck'): return None
    fam = f"{r['family']}|{r['capacityMl']}|{r['color']}|{r['neck']}"
    if fam in SPLIT:
        p = profile_of(r)
        return f"{p}|{r['capacityMl']}|{r['color']}|{r['neck']}" if p else None
    return fam

# which body keys carry plates (the builder can only show bodies whose assemblies exist)
plated = {}
for r in ledger:
    k = key_of(r['sku'])
    if not k or re.search(r'Component|Gift|Packaging|Tool|Internal', k): continue
    plated.setdefault(k, {'complete': 0, 'total': 0, 'skus': []})
    plated[k]['total'] += 1
    if r['stage'] == 'complete': plated[k]['complete'] += 1; plated[k]['skus'].append(r['sku'])
keys = sorted(k for k, v in plated.items() if v['complete'] >= 3)

# reviewed sources from the paired-kit recipes: one per key, the most-reviewed SKU first
reviewed = {}
for f in sorted(DATA.glob('*-paired-kit-recipes.json')):
    for row in json.loads(f.read_text())['rows']:
        k = key_of(row['websiteSku']); src = by_sha.get(row['onSourceSha256'])
        if not k or not src or k in reviewed: continue
        reviewed[k] = {'sku': row['websiteSku'], 'relPath': src['relPath'], 'sha256': row['onSourceSha256'], 'layer': row['onBodyLayer'],
                       'evidence': f"{f.name}: {row['evidence']}", 'reviewedBy': row.get('reviewedBy')}

def largest_island(im):
    """Keep the connected alpha region of the glass; disconnected retouch cards
    (white patches saved into the same layer) are dropped and counted."""
    from scipy import ndimage
    im = im.convert('RGBA'); a = np.asarray(im.getchannel('A')) > 8
    labels, n = ndimage.label(a)
    if n <= 1: return im, 0
    sizes = ndimage.sum(a, labels, range(1, n + 1)); keep = int(np.argmax(sizes)) + 1
    mask = labels == keep
    arr = np.asarray(im).copy(); arr[..., 3] = np.where(mask, arr[..., 3], 0)
    return Image.fromarray(arr, 'RGBA'), int(n - 1)

def save(im, name):
    im = im.convert('RGBA'); box = im.getchannel('A').getbbox()
    if not box: raise ValueError('empty layer')
    im = im.crop(box); im.thumbnail((1000, 1200), Image.Resampling.LANCZOS)
    path = OUT / f'{name}.webp'; im.save(path, 'WEBP', lossless=True)
    return {'url': f'/images/bottle-builder/bodies/{path.name}', 'width': im.width, 'height': im.height, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}

def layer_stats(psd):
    # indices follow enumerate(psd.descendants()), the order the reviewed recipes use
    W, H = psd.width, psd.height; out = []
    for i, l in enumerate(psd.descendants()):
        if l.is_group() or not l.is_visible(): out.append(None); continue
        im = l.composite()
        if im is None: out.append(None); continue
        a = np.asarray(im.convert('RGBA').getchannel('A'))
        ys, xs = np.nonzero(a > 8)
        if not len(xs): out.append(None); continue
        # composite() is layer-local: translate into canvas coordinates
        ox, oy = int(l.left), int(l.top)
        l0, r0, t0, b0 = ox + int(xs.min()), ox + int(xs.max()), oy + int(ys.min()), oy + int(ys.max())
        cx = (l0 + r0) / 2
        background = (r0 - l0 + 1) * (b0 - t0 + 1) >= 0.97 * W * H and (a > 8).mean() > 0.97
        out.append({'index': i, 'name': l.name, 'bbox': [l0, t0, r0, b0], 'area': int((a > 8).sum()), 'axisOffset': abs(cx - W / 2) / W,
                    'fill': float((a > 8).sum()) / max(1, (r0 - l0 + 1) * (b0 - t0 + 1)),
                    'reachesBottom': b0 >= 0.80 * H, 'background': bool(background), 'image': im})
    return out

def candidate_for(k):
    """Representative capped PSD: prefer a cap-only or reducer SKU with the fewest layers."""
    skus = plated[k]['skus']
    pool = []
    for sku in skus:
        stem = re.sub(r'[^a-z0-9]', '', sku.lower())
        for f in master_psd:
            if re.sub(r'[^a-z0-9]', '', f['stem'].lower()) != stem: continue
            if 'uncapped' in f['relPath'].lower() or 'tassel' in f['relPath'].lower(): continue
            pool.append((0 if re.search(r'Cap|Sht|Rdcr', sku) else 1, f['layerCount'], f))
    if not pool: return None
    pool.sort(key=lambda t: (t[0], t[1], t[2]['relPath']))
    seen = set(); last = None
    for _, _, f in pool:
        if f['sha256'] in seen: continue
        seen.add(f['sha256'])
        if len(seen) > 6: break
        psd = PSDImage.open(ROOT / f['relPath']); stats = layer_stats(psd)
        fg = [s for s in stats if s and not s['background']]
        last = {'relPath': f['relPath'], 'sha256': f['sha256'], 'stats': stats, 'pick': None}
        if not fg: continue
        # the glass is the on-axis layer that stands lowest (the foot), is tall
        # (a cap is short) and is a clean cut-out (a rotated retouch patch leaves
        # a sparse bounding box)
        floor = max(s['bbox'][3] for s in fg); top = min(s['bbox'][1] for s in fg)
        # in a capped source the closure is the highest layer; the glass starts below it
        body = [s for s in fg if s['axisOffset'] < 0.08 and s['bbox'][3] >= floor - 0.02 * psd.height
                and (s['bbox'][3] - s['bbox'][1]) >= 0.6 * (floor - top) and s['bbox'][1] > top + 0.03 * (floor - top)]
        if not body: continue
        body.sort(key=lambda s: -s['area'])
        return {'relPath': f['relPath'], 'sha256': f['sha256'], 'stats': stats, 'pick': body[0]['index']}
    return last

ap = argparse.ArgumentParser(); ap.add_argument('--review-only', action='store_true'); args = ap.parse_args()
# Jordan's approvals/corrections: an explicit source, or 'candidate: true' to accept the heuristic pick
approved = {e['body']: e for e in json.loads((DATA / 'builder-bodies-approved.json').read_text())['entries']}
sha_of = {f['relPath']: f['sha256'] for f in inventory}
bodies = dict(circle); lineage = []; tiles = []
for k in keys:
    name = re.sub(r'[^a-z0-9]+', '-', k.lower())
    a = approved.get(k)
    if a and not a.get('candidate'):
        psd = PSDImage.open(ROOT / a['path']); layer = list(psd.descendants())[a['layer']]
        cleaned, dropped = largest_island(layer.composite())
        media = None if args.review_only else save(cleaned, name)
        if media: bodies[k] = media
        lineage.append({'body': k, 'status': 'reviewed', 'source': 'jordan-approved', 'path': a['path'], 'sourceSha256': sha_of.get(a['path']),
                        'layerIndex': a['layer'], 'layerName': layer.name, 'retouchIslandsDropped': dropped, 'evidence': a['instruction'], 'asset': media})
        tiles.append((k, 'approved', cleaned, a['path'], a['layer'], layer.name)); continue
    if k in circle:
        lineage.append({'body': k, 'status': 'reviewed', 'source': 'circle-builder-media', 'asset': circle[k]}); continue
    if k in reviewed:
        r = reviewed[k]; psd = PSDImage.open(ROOT / r['relPath']); layer = list(psd.descendants())[r['layer']]
        if not args.review_only:
            media = save(layer.composite(), name); bodies[k] = media
        else: media = None
        lineage.append({'body': k, 'status': 'reviewed', 'source': 'paired-kit-recipe', 'sku': r['sku'], 'path': r['relPath'], 'sourceSha256': r['sha256'],
                        'layerIndex': r['layer'], 'layerName': layer.name, 'evidence': r['evidence'], 'reviewedBy': r['reviewedBy'], 'asset': media})
        tiles.append((k, 'reviewed', layer.composite(), r['relPath'], r['layer'], layer.name)); continue
    c = candidate_for(k)
    if not c or c['pick'] is None:
        lineage.append({'body': k, 'status': 'no-candidate', 'path': c['relPath'] if c else None, 'note': 'no visible on-axis layer reaching the baseline' if c else 'no capped master PSD for any plated SKU'}); continue
    s = c['stats'][c['pick']]
    cleaned, dropped = largest_island(s['image'])
    if a and a.get('candidate'):
        media = None if args.review_only else save(cleaned, name)
        if media: bodies[k] = media
        lineage.append({'body': k, 'status': 'reviewed', 'source': 'jordan-approved candidate', 'path': c['relPath'], 'sourceSha256': c['sha256'], 'layerIndex': c['pick'],
                        'layerName': s['name'], 'retouchIslandsDropped': dropped, 'evidence': a['instruction'], 'asset': media})
        tiles.append((k, 'approved', cleaned, c['relPath'], c['pick'], s['name'])); continue
    lineage.append({'body': k, 'status': 'candidate', 'path': c['relPath'], 'sourceSha256': c['sha256'], 'layerIndex': c['pick'], 'layerName': s['name'],
                    'retouchIslandsDropped': dropped,
                    'layers': [{'index': x['index'], 'name': x['name'], 'bbox': x['bbox'], 'background': x['background']} for x in c['stats'] if x],
                    'note': 'largest on-axis layer reaching the baseline in the representative capped PSD; needs visual approval'})
    tiles.append((k, f"candidate{' · ' + str(dropped) + ' retouch card(s) dropped' if dropped else ''}", cleaned, c['relPath'], c['pick'], s['name']))

if not args.review_only:
    (REPO / 'src/lib/bottle-builder/bodies.generated.json').write_text(json.dumps(dict(sorted(bodies.items())), indent=2) + '\n')
(DATA / 'builder-bodies-source-review.json').write_text(json.dumps({'generatedAt': '2026-09-14', 'note': 'reviewed = written to bodies.generated.json; candidate = review set only', 'bodies': lineage}, indent=2) + '\n')

# contact sheet: every tile at the same scale (1 mm is not known here; tiles share a 520 px height box, bone ground)
TW, TH = 300, 560; cols = 6; rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * TW, rows * TH), (245, 243, 239)); draw = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 13)
except Exception: font = ImageFont.load_default()
for n, (k, status, im, rel, idx, lname) in enumerate(tiles):
    x0, y0 = (n % cols) * TW, (n // cols) * TH
    im = im.convert('RGBA'); box = im.getchannel('A').getbbox(); im = im.crop(box) if box else im
    im.thumbnail((TW - 20, TH - 90), Image.Resampling.LANCZOS)
    sheet.paste(im, (x0 + (TW - im.width) // 2, y0 + 10), im)
    draw.rectangle([x0, y0, x0 + TW - 1, y0 + TH - 1], outline=(200, 195, 188))
    draw.text((x0 + 8, y0 + TH - 72), k, fill=(30, 30, 30), font=font)
    draw.text((x0 + 8, y0 + TH - 54), f"{status} · layer {idx} '{lname}'"[:52], fill=(120, 40, 40) if status.startswith('candidate') else (30, 60, 140) if status == 'approved' else (40, 100, 40), font=font)
    draw.text((x0 + 8, y0 + TH - 36), Path(rel).name[:40], fill=(90, 90, 90), font=font)
sheet.save(REVIEW_DIR / 'bodies-contact-sheet.jpg', quality=88)
counts = {s: sum(1 for l in lineage if l['status'] == s) for s in ['reviewed', 'candidate', 'no-candidate']}
print(json.dumps({'bodyKeys': len(keys), **counts, 'written': len(bodies) if not args.review_only else 0}))
for l in lineage:
    if l['status'] != 'reviewed': print(f"  {l['status']:13} {l['body']:34} {(l.get('path') or '')[:80]} layer={l.get('layerIndex')} {l.get('note','')[:60]}")
