#!/usr/bin/env python3
"""Part map for a family batch from layer geometry, applicator-aware.

Roles are assigned from each visible layer's size and position relative to the
body, and recorded with evidence (size, position, how many masters share the
pixels). Hidden layers are excluded. A visible twin body under the body is
excluded with its twin named; the plate parity gate proves it contributed
nothing. Bodies photographed on a white studio ground get a matte request,
never for clear or frosted glass.

Slots: body · diptube (tall, narrow, inside the body) · roller (small, in the
neck) · pipette (tall narrow, droppers) · fitment (dropper top, one fused part)
· sprayer (bulb sprayer assembly, tassel included when fused) · pump (lotion or
spray pump assembly) · cap (closure).

    python3 scripts/paperdoll/family_part_map.py --batch BATCH --reviewer "…"  →  BATCH/part-map.json
"""
import argparse, json, hashlib, sys
from collections import Counter
from pathlib import Path
from psd_tools import PSDImage
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_master_kits import layer_inventory
from family_batch import MASTER
from matte import white_ground_fraction

ap = argparse.ArgumentParser(); ap.add_argument('--batch', type=Path, required=True); ap.add_argument('--reviewer', required=True); args = ap.parse_args()
plates = json.load(open(args.batch / 'plates/manifest.json'))['rows']
_snap = json.load(open(args.batch / 'input/convex-snapshot.json')); snapshot = {p['websiteSku']: p for p in _snap['products']}
inventories = {}; errors = {}
for r in plates:
    rel = r['plate']['sourceRelPath']
    try:
        psd = PSDImage.open(MASTER / rel); inventories[r['websiteSku']] = (rel, hashlib.sha256((MASTER / rel).read_bytes()).hexdigest(), layer_inventory(psd), psd)
    except Exception as e: errors[r['websiteSku']] = str(e)[:100]
share = Counter(l['pixelHash'] for _, _, layers, _ in inventories.values() for l in layers if not l['background'])
def area(l): x0, y0, x1, y1 = l['bounds']; return (x1 - x0) * (y1 - y0)
def desc(l): x0, y0, x1, y1 = l['bounds']; return f"layer {l['index']} '{l['name']}' {x1-x0}×{y1-y0} at ({x0},{y0}), identical pixels in {share[l['pixelHash']]} master(s)"
maps = {}; notes = []
for sku, (rel, sha, layers, psd) in inventories.items():
    fg = [l for l in layers if not l['background'] and not l.get('adjustment')]
    visible = [l for l in fg if l.get('visible', True)]
    exclude = {str(l['index']): f"hidden in Photoshop: {desc(l)}" for l in fg if not l.get('visible', True)}
    if not visible: notes.append(f"{sku}: no visible layers"); continue
    app = (snapshot.get(sku, {}).get('applicator') or '')
    # the body is the layer that owns the foot: the bottom-centre of the union of all
    # visible pixel layers (a tassel hangs beside the bottle and can be larger than it)
    pix = [l for l in visible if l.get('kind', 'pixel') == 'pixel']
    ux0 = min(l['bounds'][0] for l in pix); ux1 = max(l['bounds'][2] for l in pix); uy1 = max(l['bounds'][3] for l in pix)
    foot = [l for l in pix if l['bounds'][3] >= uy1 - 0.02 * psd.height and l['bounds'][0] <= (ux0 + ux1) / 2 <= l['bounds'][2]]
    body = max(foot or pix, key=area); bx0, by0, bx1, by1 = body['bounds']; bw, bh = bx1 - bx0, by1 - by0
    parts = {'body': [body['index']]}; evidence = [f"body: {desc(body)} (owns the foot at the bottom centre)"]
    for l in visible:
        if l is body: continue
        x0, y0, x1, y1 = l['bounds']; w, h = x1 - x0, y1 - y0
        if l.get('kind') == 'shape':
            # vector retouch strokes on the glass belong with the body
            parts['body'].append(l['index']); evidence.append(f"body (vector retouch stroke): {desc(l)}"); continue
        if area(l) >= 0.6 * area(body) and h >= 0.8 * bh:
            exclude[str(l['index'])] = f"unused twin body left under the body layer: {desc(l)}; covered by layer {body['index']}, plate parity proves it"; continue
        inside = x0 >= bx0 - 5 and x1 <= bx1 + 5 and y0 >= by0 - 5 and y1 <= by1 + 5
        if h > 0.45 * bh and w < 0.35 * bw and inside: slot = 'diptube' if 'Dropper' not in app else 'pipette'
        elif h > 0.45 * bh and w < 0.35 * bw: slot = 'pipette' if 'Dropper' in app else 'diptube'
        elif h <= 0.22 * bh and w <= 0.55 * bw and y0 >= by0 and y1 <= by0 + 0.35 * bh: slot = 'roller'
        elif 'Dropper' in app: slot = 'fitment'
        elif 'Vintage' in app or 'Antique' in app or 'Bulb' in app: slot = 'sprayer'
        elif 'Pump' in app: slot = 'pump'
        else: slot = 'cap'
        parts.setdefault(slot, []).append(l['index']); evidence.append(f"{slot}: {desc(l)}")
    matte = {}
    all_layers = list(psd.descendants()); body_layer = all_layers[body['index']]
    body_im = psd.composite(force=True, ignore_preview=True, alpha=0.0, color=1.0, layer_filter=lambda x, b=body_layer: x.is_group() or x is b)
    wf = white_ground_fraction(body_im)
    if wf > 0.15:
        color = snapshot.get(sku, {}).get('color') or ''
        if color in ('Clear', 'Frosted', ''): notes.append(f"{sku}: white ground on {color or 'unknown'} glass ({wf:.0%}) — left alone, needs eyes")
        else: matte['body'] = 'white-ground'; evidence.append(f"body carries the white studio ground ({wf:.0%} of its border): matte requested")
    maps[sku] = {'sourceSha256': sha, 'reviewedBy': args.reviewer, 'evidence': '; '.join(evidence), 'parts': parts, 'exclude': exclude, 'matte': matte}
out = args.batch / 'part-map.json'; out.write_text(json.dumps(maps, indent=1))
print(f"{len(maps)} part maps → {out}; {len(errors)} sources refused")
print(Counter(tuple(sorted(m['parts'])) for m in maps.values()))
for k, v in errors.items(): print('REFUSED', k, v)
for n in notes: print('NOTE', n)
