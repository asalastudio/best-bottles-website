#!/usr/bin/env python3
"""Prepare reviewed Cylinder master views without changing approved/indexed plates.

Exact catalog/source records select the jobs. Existing approved cap-on geometry is
the presentation reference, not a new shared bare-glass height lock. Outputs are
immutable local review candidates; this script cannot approve or publish them.
"""
import datetime
import hashlib
import importlib.util
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage

ROOT = Path(__file__).resolve().parents[2]
MASTER = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master').resolve()
ID = 'cylinder-capoff-final-2026-09-12'
REVIEW = ROOT / 'docs/reviews' / ID
RECOVERY = ROOT / 'docs/reviews/cylinder-capoff-recovery-2026-09-12'
DEST = ROOT / 'public/images/cylinder-plate-candidates'
APPROVALS = ROOT / 'data/asset-ledger/cylinder-approved-capoff-sources.json'
PROTECTED = [ROOT / 'data/asset-ledger/family-plate-decisions/cylinder.json',
             ROOT / 'data/asset-ledger/family-plate-sheets/cylinder.json',
             ROOT / 'data/asset-ledger/bottle-standards.json', APPROVALS]
spec = importlib.util.spec_from_file_location('plate_geometry', ROOT / 'scripts/asset-ledger/prepare-boston-plates.py')
geo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geo)


def read(file):
    return json.loads(file.read_text())


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def checked(file, expected, base):
    file = file.resolve()
    if not file.is_relative_to(base.resolve()) or digest(file.read_bytes()) != expected:
        raise ValueError(f'Changed or out-of-scope evidence: {file}')
    return file


def source_image(view):
    checked(MASTER / view['path'], view['sourceSha256'], MASTER)
    file = checked(RECOVERY / view['preview'], view['previewSha256'], RECOVERY)
    im = geo.white(Image.open(file))
    if im.size != (view['width'], view['height']):
        raise ValueError('Reviewed preview dimensions changed')
    return im


def current_image(view):
    file = checked(ROOT / 'public' / view['url'].lstrip('/'), view['sha256'], ROOT / 'public/images/plate-contact-sheets')
    im = geo.white(Image.open(file))
    if im.size != geo.CANVAS:
        raise ValueError('Unexpected approved plate canvas')
    return im


def save(im):
    buffer = io.BytesIO()
    im.save(buffer, format='WEBP', lossless=True, method=3)
    raw = buffer.getvalue()
    h = digest(raw)
    file = DEST / (h + '.webp')
    if file.exists():
        checked(file, h, DEST)
    else:
        file.write_bytes(raw)
    return {'url': '/images/cylinder-plate-candidates/' + file.name,
            'sha256': h, 'width': im.width, 'height': im.height}


def prepare(view, role, target, recipe):
    im = source_image(view)
    g = geo.measure(im)
    scale = target['width'] / g['width']
    x = target['centerX'] - g['centerX'] * scale
    y = target['baseY'] - g['baseY'] * scale
    after = geo.transformed(im, scale, x, y)
    layer_record = None
    if recipe:
        if role != 'off' or recipe['sourceSha256'] != view['sourceSha256'] or recipe['sourcePath'] != view['path']:
            raise ValueError('Inspected loose-cap recipe does not match the approved source')
        psd = PSDImage.open(MASTER / view['path'])
        layer = psd[recipe['capLayerIndex']]
        if list(layer.bbox) != recipe['capLayerBounds'] or not layer.is_visible() or layer.kind != 'pixel':
            raise ValueError('Inspected original loose-cap layer changed')
        merged = geo.white(psd.composite(ignore_preview=True, color=1.0, alpha=1.0))
        delta = np.abs(np.asarray(merged).astype(float) - np.asarray(im).astype(float))
        if delta.max() > 2:
            raise ValueError(f"Original PSD layer reconstruction differs: {delta.max()}")
        base = geo.white(psd.composite(ignore_preview=True, color=1.0, alpha=1.0,
                        layer_filter=lambda item: item.is_visible() and item is not layer))
        after = geo.transformed(base, scale, x, y).convert('RGBA')
        cap = layer.topil().convert('RGBA')
        cm = geo.measure_cap(cap)
        capx = target['centerX'] + target['width'] / 2 + 24 - cm['left'] * scale
        capy = target['baseY'] - cm['baseY'] * scale
        capframe = cap.transform(geo.CANVAS, Image.Transform.AFFINE,
                   (1 / scale, 0, -capx / scale, 0, 1 / scale, -capy / scale), Image.Resampling.BICUBIC)
        after.alpha_composite(capframe)
        after = after.convert('RGB')
        layer_record = {**recipe, 'scale': scale, 'x': capx, 'y': capy,
                        'reconstructionMaxError': float(delta.max()),
                        'method': 'Original verified loose-cap layer translated next to the original assembly at identical uniform scale; no shadow processing.'}
    bounds = geo.ink_bounds(after)
    measured = geo.measure(after)
    errors = {key: round(abs(measured[key] - target[key]), 3) for key in ['width', 'baseY', 'centerX']}
    holds = []
    if min(bounds[0], bounds[1]) < 12 or bounds[2] > 988 or bounds[3] > 1088:
        holds.append(role + ': safe margin needs correction')
    if max(errors.values()) > 3:
        holds.append(role + ': body registration needs correction')
    return {**save(after), 'label': 'Cap on' if role == 'on' else 'Cap off',
            'role': role, 'status': 'pending', 'source': view,
            'transform': {'scale': scale, 'x': x, 'y': y}, 'layers': layer_record,
            'checks': {'bounds': bounds, 'body': measured, 'registrationErrors': errors}}, holds


def main():
    REVIEW.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    protected = {str(p.relative_to(ROOT)): digest(p.read_bytes()) for p in PROTECTED}
    ledger = read(ROOT / 'src/lib/asset-ledger/ledger.json')
    approvals = read(APPROVALS)
    audit = read(RECOVERY / 'source-audit.json')
    audit_by_sku = {r['sku']: r for r in audit['rows']}
    cards = {r['sku']: r for r in read(PROTECTED[1])['rows']}
    recipes = {r['sku']: r for r in read(REVIEW / 'verified-cap-layers.json')}
    catalog = {}
    for row in ledger['rows']:
        if row['productRecord'] and row['family'] == 'Cylinder' and not row['plate'].get('scopeExclusion'):
            if row['sku'] in catalog:
                raise ValueError('Ambiguous exact catalog SKU')
            catalog[row['sku']] = row
    results = []
    for entry in approvals['entries']:
        sku = entry['sku']
        row, card, old = catalog[sku], cards[sku], audit_by_sku[sku]
        if entry['status'] != 'approved' or entry['scope'] != 'original-master-source-views':
            raise ValueError('Missing original source approval')
        source_binding = digest(json.dumps({'sku': sku, 'groupId': entry['productGroupId'],
                                           'views': entry['views']}, sort_keys=True).encode())
        if source_binding != entry['binding']:
            raise ValueError('Original source approval binding changed')
        if entry['productGroupId'] != row['productGroupId'] or card['productGroupId'] != row['productGroupId']:
            raise ValueError('Catalog/source identity changed')
        front = card['views'][0]
        approval = row['plate'].get('appearanceApproval') or {}
        if approval.get('status') != 'approved' or approval.get('sha256') != front['sha256'] or row['plate']['sha256'] != front['sha256']:
            raise ValueError('Approved reference plate changed')
        if front['sha256'] != old['approvedCapOnSha256']:
            raise ValueError('Reference plate differs from the reviewed source audit')
        target = geo.measure(current_image(front))
        sources = {v['role']: v for v in entry['views']}
        # Validate even a retained source; its review binding is part of this packet.
        for view in sources.values():
            source_image(view)
        proposed, holds = [], []
        if row['plate'].get('legacySource') and 'on' in sources:
            view, flags = prepare(sources['on'], 'on', target, None)
            proposed.append(view)
            holds.extend(flags)
        if not row['plate'].get('capOff'):
            view, flags = prepare(sources['off'], 'off', target, recipes.get(sku))
            proposed.append(view)
            holds.extend(flags)
        for view in card['views']:
            current_image(view)
        if row['plate'].get('legacySource') and 'on' not in sources:
            holds.append('Master cap-on source still needs reconciliation')
        if row['plate'].get('sizeHold'):
            holds.append('Historical size finding remains separate from appearance approval')
        packet = {'sku': sku, 'productGroupId': row['productGroupId'],
                  'sourceApprovalBinding': entry['binding'], 'referenceSha256': front['sha256'],
                  'views': [{'role': v['role'], 'sha256': v['sha256']} for v in proposed]}
        result = {key: row.get(key) for key in ['sku', 'graceSku', 'productGroupId', 'groupSlug',
                  'itemName', 'capacityMl', 'color', 'capColor', 'applicator']}
        result.update({'sourceApprovalBinding': entry['binding'],
                       'binding': digest(json.dumps(packet, sort_keys=True, separators=(',', ':')).encode()),
                       'before': card['views'], 'proposed': proposed, 'target': target,
                       'holds': holds, 'status': 'pending' if proposed else 'retained',
                       'technicalStatus': 'held' if holds else 'prepared-for-review',
                       'existingPlateState': row['plate']['state'],
                       'presentationBasis': 'Body width, bottom and center of this exact approved cap-on plate; no new shared glass-height lock.'})
        results.append(result)
        print(sku, len(proposed), 'new views;', ', '.join(holds) or 'registration passed', flush=True)
    prepared = {r['sku'] for r in results}
    remaining = [r for r in audit['rows'] if r['sku'] not in prepared]
    for name, expected in protected.items():
        checked(ROOT / name, expected, ROOT)
    summary = {'sourceSets': len(results), 'newCapOff': sum(v['role'] == 'off' for r in results for v in r['proposed']),
               'newMasterCapOn': sum(v['role'] == 'on' for r in results for v in r['proposed']),
               'retainedExistingPairs': sum(not r['proposed'] for r in results),
               'preparedRowsWithoutTechnicalFlags': sum(bool(r['proposed']) and not r['holds'] for r in results),
               'preparedRowsWithTechnicalFlags': sum(bool(r['proposed']) and bool(r['holds']) for r in results),
               'remainingSourceRows': len(remaining)}
    manifest = {'schemaVersion': 1, 'id': ID, 'family': 'Cylinder',
                'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'ledgerAt': ledger['generatedAt'], 'canvas': {'width': 1000, 'height': 1100},
                'publicationAuthorized': False, 'approvalStatus': 'pending-new-image-bytes',
                'protectedFileHashes': protected, 'ledgerBefore': ledger['platePlan']['counts'],
                'familyBefore': next(f for f in ledger['platePlan']['families'] if f['family'] == 'Cylinder'),
                'summary': summary, 'rows': results, 'remaining': remaining}
    file = REVIEW / 'prepared.json'
    if file.exists():
        previous = read(file)
        if [r['binding'] for r in previous['rows']] != [r['binding'] for r in results]:
            raise ValueError('Changed render needs a new review revision; previous packet preserved')
        print('Identical candidate bindings verified; original review packet preserved')
    else:
        file.write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
