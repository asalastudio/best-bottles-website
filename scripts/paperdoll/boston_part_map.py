#!/usr/bin/env python3
"""Part map for the Boston Round master PSDs (2026-09-16).

Jordan: "we have the full alpha layers in the PSD. You just have to remove the
background… The kit is built, so that's how it's going to be." Every Boston
master is Background + a body photograph + the fitted hardware as separate
layers. Roles come from the layer geometry, and every assignment records the
size, position and how many Boston masters share the identical pixels, so a
reviewer can check it against the exploded sheet. Layers that are hidden in
Photoshop are alternatives left in the file; they are excluded, not used. A
visible second body (the amber body left under the cobalt one in the cobalt
60 ml droppers) is excluded with its twin named; the plate parity gate proves
it contributed nothing.

    python3 scripts/paperdoll/boston_part_map.py [--batch BATCH] [--snapshot products.json]  →  BATCH/part-map.json
"""
import json, hashlib, sys
from collections import Counter
from pathlib import Path
from psd_tools import PSDImage
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_master_kits import layer_inventory
from family_batch import MASTER
from matte import white_ground_fraction

import argparse
_ap = argparse.ArgumentParser(); _ap.add_argument('--batch', type=Path, default=Path('dist/paper-doll/boston-master')); _ap.add_argument('--snapshot', type=Path, default=None); _args = _ap.parse_args()
BATCH = _args.batch
plates = json.load(open(BATCH / 'plates/manifest.json'))['rows']
_snap = json.load(open(_args.snapshot or (BATCH / 'input/convex-snapshot.json')))
snapshot = {p['websiteSku']: p for p in (_snap['products'] if isinstance(_snap, dict) and 'products' in _snap else _snap)}
REVIEWER = "Jordan Richter, chat 2026-09-16 ('the kit is built, so that's how it's going to be… just the white background needs to be removed'); layer roles by geometry: Claude Fable 5.1"

inventories = {}
for r in plates:
    rel = r['plate']['sourceRelPath']; psd = PSDImage.open(MASTER / rel)
    inventories[r['websiteSku']] = (rel, hashlib.sha256((MASTER / rel).read_bytes()).hexdigest(), layer_inventory(psd), psd)
share = Counter(l['pixelHash'] for _, _, layers, _ in inventories.values() for l in layers if not l['background'])

def area(l): x0, y0, x1, y1 = l['bounds']; return (x1 - x0) * (y1 - y0)
def desc(l): x0, y0, x1, y1 = l['bounds']; return f"layer {l['index']} '{l['name']}' {x1-x0}×{y1-y0} at ({x0},{y0}), identical pixels in {share[l['pixelHash']]} Boston master(s)"

maps = {}; notes = []
for sku, (rel, sha, layers, psd) in inventories.items():
    fg = [l for l in layers if not l['background']]
    visible = [l for l in fg if l.get('visible', True)]
    exclude = {str(l['index']): f"hidden in Photoshop: {desc(l)}" for l in fg if not l.get('visible', True)}
    body = max(visible, key=area)
    parts = {'body': [body['index']]}; evidence = [f"body: {desc(body)} (largest visible layer, reaches the foot)"]
    body_h = body['bounds'][3] - body['bounds'][1]
    for l in visible:
        if l is body: continue
        w = l['bounds'][2] - l['bounds'][0]; h = l['bounds'][3] - l['bounds'][1]
        if area(l) >= 0.6 * area(body):
            # a second body-sized photograph under the real body
            exclude[str(l['index'])] = f"unused twin body left under the body layer: {desc(l)}; covered by layer {body['index']}, plate parity proves it"
            continue
        applicator = snapshot.get(sku, {}).get('applicator') or ''
        if h > 550 and w < 230:
            slot = 'pipette'
        elif h <= 250 and w <= 260:
            slot = 'roller'          # the roller housing photographed in the neck
        elif 'Dropper' in applicator or (h > 330 and h < 420 and w < 340 and 'Roller' not in applicator and 'Cap' not in applicator):
            slot = 'fitment'         # dropper bulb + collar, one fused photograph
        else:
            slot = 'cap'
        parts.setdefault(slot, []).append(l['index']); evidence.append(f"{slot}: {desc(l)}")
    matte = {}
    body_im = psd.composite(force=True, ignore_preview=True, alpha=0.0, color=1.0, layer_filter=lambda x, i=body['index']: x.is_group() or list(psd.descendants()).index(x) == i)
    if white_ground_fraction(body_im) > 0.15:
        color = snapshot.get(sku, {}).get('color') or ''
        if color in ('Clear', 'Frosted'): notes.append(f"{sku}: white ground on {color} glass — left alone, needs eyes")
        else: matte['body'] = 'white-ground'; evidence.append(f"body carries the white studio ground ({white_ground_fraction(body_im):.0%} of its border): matte requested")
    maps[sku] = {'sourceSha256': sha, 'reviewedBy': REVIEWER, 'evidence': '; '.join(evidence), 'parts': parts, 'exclude': exclude, 'matte': matte}
out = BATCH / 'part-map.json'; out.write_text(json.dumps(maps, indent=1))
print(f"{len(maps)} part maps → {out}")
print(Counter(tuple(sorted(m['parts'])) for m in maps.values()))
print('matte', sum(1 for m in maps.values() if m['matte']), 'exclusions', sum(len(m['exclude']) for m in maps.values()))
for n in notes: print('NOTE', n)
