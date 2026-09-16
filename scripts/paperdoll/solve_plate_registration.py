#!/usr/bin/env python3
"""Recover a plate's PSD→canvas placement from the published plate itself.

A plate is the master PSD's flattened composite placed on the 1000×1100 canvas
by one uniform scale and a translation. When the batch that rendered a plate
kept no registration file, the placement is solved from the ink boxes of the
composite and the plate, and proven by the same parity gate the kit
extractor applies (mean |Δ| over ink ≤ 6/255). Rows that fail stay unsolved.

    python3 scripts/paperdoll/solve_plate_registration.py --batch BATCH --from-batch REFERENCE_BATCH [--sku SKU]*
Copies REFERENCE_BATCH's registration files into BATCH and adds a solved session
for every row whose plate hash is not registered there.
"""
import argparse, json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image
from psd_tools import PSDImage
sys.path.insert(0, str(Path(__file__).resolve().parent))
from family_batch import MASTER
from build_master_kits import parity

ap = argparse.ArgumentParser(); ap.add_argument('--batch', type=Path, required=True); ap.add_argument('--from-batch', type=Path, required=True); ap.add_argument('--sku', action='append'); ap.add_argument('--fine', action='store_true'); args = ap.parse_args()
manifest = json.load(open(args.batch / 'plates/manifest.json'))
def ink_bbox(rgb):
    m = np.asarray(rgb.convert('RGB')).min(axis=2) < 245
    ys, xs = np.nonzero(m); return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
solved = []; failed = []
for row in manifest['rows']:
    if args.sku and row['websiteSku'] not in args.sku: continue
    fam_dir = args.batch / 'plates' / row['familyId']; fam_dir.mkdir(parents=True, exist_ok=True)
    reg_name = f"_registration-{row['body']}.json"; src_reg = args.from_batch / 'plates' / row['familyId'] / reg_name; dst_reg = fam_dir / reg_name
    if not dst_reg.exists():
        if src_reg.exists(): shutil.copy(src_reg, dst_reg)
        else:
            # no rendering batch ever kept a registration for this body: start one; the
            # baseline is the plate's own ink bottom (the foot), everything else is solved
            plate0 = Image.open(args.batch / 'plates' / row['plate']['key']).convert('RGB')
            json.dump({'familyId': row['familyId'], 'body': row['body'], 'reference': None, 'template': None, 'sessions': [], 'plates': {},
                       'scale': 1.0, 'baseOut': int(ink_bbox(plate0)[3]), 'note': 'created by solve_plate_registration.py from the published plate'}, open(dst_reg, 'w'), indent=1)
    reg = json.load(open(dst_reg)); key = f"{row['websiteSku']}.front-on"
    if row.get('registrationSource') != 'solved-from-plate': continue
    psd = PSDImage.open(MASTER / row['plate']['sourceRelPath'])
    try: comp = psd.composite(force=True, ignore_preview=True).convert('RGBA')
    except Exception as e:
        # a source this tool cannot flatten (vector shapes without a rasteriser, an
        # unsupported adjustment): record it and move on rather than lose the batch
        failed.append({'sku': row['websiteSku'], 'error': f'{type(e).__name__}: {str(e)[:80]}'}); continue
    flat = Image.new('RGBA', comp.size, 'white'); flat.alpha_composite(comp)
    plate = Image.open(args.batch / 'plates' / row['plate']['key']).convert('RGB')
    cx0, cy0, cx1, cy1 = ink_bbox(flat); px0, py0, px1, py1 = ink_bbox(plate)
    sx = (px1 - px0) / (cx1 - cx0); sy = (py1 - py0) / (cy1 - cy0); scale = (sx + sy) / 2
    ox = px0 - cx0 * scale; oy = py0 - cy0 * scale
    def place(scale, ox, oy):
        placed = flat.transform((1000, 1100), Image.Transform.AFFINE, (1 / scale, 0, -ox / scale, 0, 1 / scale, -oy / scale), resample=Image.Resampling.BICUBIC)
        # the transform samples outside the composite as transparent; the plate is white there
        canvas = Image.new('RGBA', (1000, 1100), 'white'); canvas.alpha_composite(placed); return canvas
    plate_arr = np.asarray(plate).astype(np.int16)
    def cost(scale, ox, oy):
        a = np.asarray(place(scale, ox, oy).convert('RGB')).astype(np.int16); ink = (a.min(axis=2) < 245) | (plate_arr.min(axis=2) < 245)
        return float(np.abs(a - plate_arr)[ink].mean()) if ink.any() else 1e9
    pg = parity(place(scale, ox, oy), plate)
    if not pg['ok']:
        # clear glass leaves faint ink: the box estimate is only a start. Refine
        # by search on the parity cost, scale ±2 %, offsets ±10 px, then ±1 px.
        best = (cost(scale, ox, oy), scale, ox, oy)
        for sc in np.linspace(scale * 0.98, scale * 1.02, 9):
            for dx in range(-10, 11, 5):
                for dy in range(-10, 11, 5):
                    c = cost(sc, ox + dx, oy + dy)
                    if c < best[0]: best = (c, sc, ox + dx, oy + dy)
        _, scale, ox, oy = best
        for sc in np.linspace(scale * 0.995, scale * 1.005, 5):
            for dx in range(-3, 4):
                for dy in range(-3, 4):
                    c = cost(sc, ox + dx, oy + dy)
                    if c < best[0]: best = (c, sc, ox + dx, oy + dy)
        _, scale, ox, oy = best
        pg = parity(place(scale, ox, oy), plate)
    if not pg['ok'] and args.fine:
        # sub-pixel pass for plates that sit just outside the gate
        best = (cost(scale, ox, oy), scale, ox, oy)
        for sc in np.linspace(scale * 0.997, scale * 1.003, 13):
            for dx in np.arange(-1.5, 1.6, 0.5):
                for dy in np.arange(-1.5, 1.6, 0.5):
                    c = cost(sc, ox + dx, oy + dy)
                    if c < best[0]: best = (c, sc, ox + dx, oy + dy)
        _, scale, ox, oy = best
        pg = parity(place(scale, ox, oy), plate)
    if not pg['ok']:
        failed.append({'sku': row['websiteSku'], 'sx': round(sx, 4), 'sy': round(sy, 4), 'parity': pg}); continue
    session = {'index': len(reg['sessions']), 'reference': f"solved from the published plate {row['plate']['sha256'][:12]} (2026-09-16)", 'shots': 1,
               'bodyWidth': None, 'scaleFactor': scale / reg['scale'], 'worstResidual': pg['mean'], 'rescued': False}
    reg['sessions'].append(session)
    reg['plates'][key] = {'session': session['index'], 'dx': 0, 'dy': 0, 'ox': round(ox, 3), 'oy': round(oy, 3), 'residual': pg['mean'], 'axisOffset': 0, 'solvedFromPlate': True}
    json.dump(reg, open(dst_reg, 'w'), indent=1)
    solved.append({'sku': row['websiteSku'], 'scale': round(float(scale), 4), 'ox': round(ox, 2), 'oy': round(oy, 2), 'parityMean': pg['mean']})
for s in solved: print('solved', s)
for f in failed: print('FAILED', f)
print(f"{len(solved)} solved, {len(failed)} failed")
