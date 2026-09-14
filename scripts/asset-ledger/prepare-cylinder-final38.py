#!/usr/bin/env python3
"""Prepare Cylinder's remaining exact-SKU plates; never approve or publish.

Original PSDs are read only from the master. Approved legacy fronts are retained
with their true provenance, never mislabeled as Photoshop sources. The review
packet is immutable once created and all outputs are content addressed.
"""
import datetime
import argparse
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
ID = 'cylinder-final38-2026-09-13'
REVIEW = ROOT / 'docs/reviews' / ID
AUDIT = ROOT / 'docs/reviews/cylinder-remaining-closure-audit-2026-09-13'
RECOVERY = ROOT / 'docs/reviews/cylinder-capoff-recovery-2026-09-12'
PRIOR = ROOT / 'docs/reviews/cylinder-capoff-final-2026-09-12'
DEST = ROOT / 'public/images/cylinder-plate-candidates'
spec = importlib.util.spec_from_file_location('plate_geo', ROOT / 'scripts/asset-ledger/prepare-boston-plates.py')
geo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geo)


def read(p):
    return json.loads(p.read_text())


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def checked(p, digest, base):
    p = p.resolve()
    if not p.is_relative_to(base.resolve()) or sha(p.read_bytes()) != digest:
        raise ValueError(f'Changed or out-of-scope evidence: {p}')
    return p


def current(v):
    return geo.white(Image.open(checked(ROOT / 'public' / v['url'].lstrip('/'), v['sha256'], ROOT / 'public/images')))


def save(im, role, source, transform=None):
    b = io.BytesIO()
    im.save(b, format='WEBP', lossless=True, method=3)
    raw = b.getvalue(); digest = sha(raw); p = DEST / (digest + '.webp')
    if p.exists():
        checked(p, digest, DEST)
    else:
        p.write_bytes(raw)
    return {'label': 'Cap on' if role == 'on' else 'Cap off', 'role': role,
            'url': '/images/cylinder-plate-candidates/' + p.name, 'sha256': digest,
            'width': im.width, 'height': im.height, 'source': source,
            'transform': transform, 'bounds': geo.ink_bounds(im)}


def pair_check(views, target):
    if len(views) < 2:
        return None
    images = [np.asarray(current(v), dtype=float) for v in views]
    half = target['width'] * .44
    box = [int(target['centerX'] - half), int(target['topY'] + (target['baseY'] - target['topY']) * .55),
           int(target['centerX'] + half), int(target['baseY'] - 10)]
    x0, y0, x1, y1 = box
    error = float(np.abs(images[0][y0:y1, x0:x1] - images[1][y0:y1, x0:x1]).mean())
    return {'bodyMeanError': round(error, 4), 'region': box, 'limit': 12, 'passed': error <= 12}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--revision', type=int, default=1)
    args = parser.parse_args()
    REVIEW.mkdir(exist_ok=True); DEST.mkdir(exist_ok=True)
    protected_paths = [ROOT / 'data/asset-ledger/family-plate-decisions/cylinder.json',
                       ROOT / 'data/asset-ledger/family-plate-sheets/cylinder.json',
                       ROOT / 'data/asset-ledger/bottle-standards.json',
                       ROOT / 'data/asset-ledger/cylinder-capoff-final-decisions.json',
                       PRIOR / 'prepared.json', PRIOR / 'ship-completion.json']
    protected = {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in protected_paths}
    ledger = read(ROOT / 'src/lib/asset-ledger/ledger.json')
    scope = read(AUDIT / 'audit.json')['rows']
    catalog = {r['sku']: r for r in ledger['rows'] if r['productRecord'] and r['family'] == 'Cylinder' and not r['plate'].get('scopeExclusion')}
    cards = {r['sku']: r for r in read(protected_paths[1])['rows']}
    sprayers = {r['sku']: r for r in read(AUDIT / 'recovered-sprayer-pairs.json')['rows']}
    sprayer_approval = read(AUDIT / 'source-approval.json')
    checked(AUDIT / 'recovered-sprayer-pairs.json', sprayer_approval['sourcePairManifestSha256'], AUDIT)
    sprayer_views = {(r['sku'], r['view']): r for r in sprayer_approval['views']}
    old_candidates = {r['sku']: r for r in read(PRIOR / 'prepared.json')['rows']}
    old_decisions = {r['sku']: r for r in read(protected_paths[3])['entries']}
    source_approvals = {r['sku']: r for r in read(ROOT / 'data/asset-ledger/cylinder-approved-capoff-sources.json')['entries']}
    legacy_media = read(REVIEW / 'legacy-media.json')['rows']
    bare = read(REVIEW / 'bare-glass-inspection.json')
    # Explicit body crosswalk for these 24 catalog records, independently reviewed
    # against exact legacy pages. It is not inferred from a SKU or cap filename.
    bodies = {(5, 'Clear'): bare[0], (5, 'Cobalt Blue'): bare[1], (9, 'Clear'): bare[2], (9, 'Frosted'): bare[3]}
    rows = []
    for entry in scope:
        sku = entry['sku']; row = catalog[sku]; card = cards[sku]; front = card['views'][0]
        before = card['views']; ref = current(front)
        if row['plate']['sha256'] != front['sha256'] or row['plate'].get('appearanceApproval', {}).get('sha256') != front['sha256']:
            raise ValueError('Current approved reference changed: ' + sku)
        target = geo.measure(ref); views = []; holds = []; notes = []; sources = []
        kind = entry['classification']
        if kind == 'Plain short cap':
            body = bodies[(row['capacityMl'], row['color'])]
            path = checked(MASTER / body['path'], body['sha256'], MASTER)
            psd = PSDImage.open(path); layer = psd[1]
            glass = geo.white(layer.composite() if layer.kind == 'group' else layer.topil())
            measured = geo.measure(glass)
            scale = target['width'] / measured['width']
            x = target['centerX'] - measured['centerX'] * scale
            y = target['baseY'] - measured['baseY'] * scale
            source = {'kind': 'master-psd-bare-glass', 'sourcePath': body['path'], 'sourceSha256': body['sha256'],
                      'layerIndex': 1, 'layerName': layer.name, 'layerBounds': list(layer.bbox),
                      'productGroupId': row['productGroupId'], 'measurement': measured}
            views = [{**front, 'role': 'on', 'retainedApproved': True,
                      'source': {'kind': 'retained-approved-legacy-raster', 'sourceUrl': row['plate']['sourcePath']}},
                     save(geo.transformed(glass, scale, x, y), 'off', source, {'scale': scale, 'x': x, 'y': y})]
            notes.append('Original photographed bare glass only. No cap, roller, neck or shadow was fabricated. The approved finish stays on the retained cap-on image.')
            notes.append('The front is a verified legacy raster, not a master-PSD render; the existing master-only completion gate remains explicit until this source exception is accepted.')
            holds.append('Accept retained exact legacy front provenance or supply its exact master finish source.')
            sources.append(source)
        elif kind == 'Sprayer':
            source_images = {}
            for role in ['on', 'off']:
                v = sprayer_views[(sku, role)]
                checked(MASTER / v['masterPath'], v['masterSha256'], MASTER)
                image = geo.white(Image.open(checked(AUDIT / v['preview'], v['previewSha256'], AUDIT)))
                source_images[role] = image
                sources.append({'role': role, 'kind': 'master-psd', 'sourcePath': v['masterPath'], 'sourceSha256': v['masterSha256'], 'previewSha256': v['previewSha256'], 'sourceApproval': str((AUDIT / 'source-approval.json').relative_to(ROOT))})
            if row['capacityMl'] == 30:
                # Disconnected clear-glass pixels caused the old component ruler
                # to measure the metal cap alone. Explicit bottle ROIs measure the
                # entire photographed assembly; no image pixels are masked/edited.
                sb = geo.ink_bounds(source_images['on'].crop((2350, 0, 3200, 4000)))
                tb = geo.ink_bounds(ref.crop((300, 0, 610, 1100)))
                sb[0] += 2350; sb[2] += 2350; tb[0] += 300; tb[2] += 300
                scale = (tb[3] - tb[1]) / (sb[3] - sb[1])
                x = (tb[0] + tb[2]) / 2 - (sb[0] + sb[2]) / 2 * scale
                y = tb[3] - sb[3] * scale
                target = {'width': tb[2]-tb[0]+1, 'baseY': tb[3], 'topY': tb[1], 'centerX': (tb[0]+tb[2])/2}
                for role in ['on', 'off']:
                    views.append(save(geo.transformed(source_images[role], scale, x, y), role,
                                      next(s for s in sources if s['role'] == role), {'scale': scale, 'x': x, 'y': y, 'measurementRoi': [2350, 0, 3200, 4000]}))
            else:
                views.append({**front, 'role': 'on', 'retainedApproved': True, 'source': sources[0]})
                image = source_images['off']; measured = geo.measure(image)
                scale = target['width'] / measured['width']; x = target['centerX'] - measured['centerX'] * scale; y = target['baseY'] - measured['baseY'] * scale
                views.append(save(geo.transformed(image, scale, x, y), 'off', sources[1], {'scale': scale, 'x': x, 'y': y}))
            notes.append('Approved original sprayer pair. Pump and loose cover remain exactly as photographed; one uniform photo transform.')
        elif kind == 'Roller':
            old = old_candidates[sku]
            proposed = {v['role']: v for v in old['proposed']}
            views = [{**proposed.get('on', front), 'role': 'on'}, {**proposed['off'], 'role': 'off'}] if 'off' in proposed else []
            if not views:
                approved = next(v for v in source_approvals[sku]['views'] if v['role'] == 'off')
                checked(MASTER / approved['path'], approved['sourceSha256'], MASTER)
                image = geo.white(Image.open(checked(RECOVERY / approved['preview'], approved['previewSha256'], RECOVERY)))
                measured = geo.measure(image); scale = target['width'] / measured['width']; x = target['centerX'] - measured['centerX'] * scale; y = target['baseY'] - measured['baseY'] * scale
                source = {'kind': 'master-psd', 'sourcePath': approved['path'], 'sourceSha256': approved['sourceSha256'], 'sourceApprovalBinding': source_approvals[sku]['binding']}
                views = [{**front, 'role': 'on'}, save(geo.transformed(image, scale, x, y), 'off', source, {'scale': scale, 'x': x, 'y': y})]
                sources.append(source)
            for v in source_approvals[sku]['views']:
                checked(MASTER / v['path'], v['sourceSha256'], MASTER)
                sources.append({'kind': 'master-psd', 'sourcePath': v['path'], 'sourceSha256': v['sourceSha256']})
            previous_sha = {v['sha256'] for v in old_decisions[sku]['views']} | {front['sha256']}
            if all(v['sha256'] in previous_sha for v in views):
                notes.append('Final image bytes already approved in the previous Cylinder comparison. No repeat appearance review is needed.')
            peers = [r for r in catalog.values() if r['productGroupId'] == row['productGroupId'] and r['plate'].get('complete')]
            notes.append('Historical diagnostic: 157 px was compared against a 150 px mixed baseline. Exact approved tall-9 mL peers now measure 154–156 px. This review checks unchanged glass against original source, not a new height lock.')
            target['approvedPeers'] = [{'sku': p['sku'], 'sha256': p['plate']['sha256'], 'bodyWidth': p['plate']['bodyWidth']} for p in peers]
        elif kind == 'Flip top':
            # These three exact galleries were visually inspected in legacy-views-4.jpg:
            # enlarged_pics exposes the opening with the original cap beside it.
            exposed = next(m for m in legacy_media if m['sku'] == sku and '/enlarged_pics/' in m['url'])
            image = geo.white(Image.open(checked(ROOT / exposed['file'], exposed['sha256'], REVIEW)))
            measured = geo.measure(image)
            scale = target['width'] / measured['width']; x = target['centerX'] - measured['centerX'] * scale; y = target['baseY'] - measured['baseY'] * scale
            source = {'kind': 'exact-legacy-raster', 'sourceUrl': exposed['url'], 'sourceSha256': exposed['sha256'],
                      'sourceFile': exposed['file'], 'sourceDimensions': [exposed['width'], exposed['height']],
                      'pageUrl': exposed['pageUrl'], 'pageHtmlSha256': exposed['pageHtmlSha256']}
            views = [{**front, 'role': 'on', 'retainedApproved': True, 'source': {'kind': 'retained-approved-legacy-raster', 'sourceUrl': row['plate']['sourcePath']}},
                     save(geo.transformed(image, scale, x, y), 'off', source, {'scale': scale, 'x': x, 'y': y})]
            sources.append(source)
            notes.append('Genuine photographed opening and loose flip-top cap from the exact product page. Original 360 × 480 raster uniformly fitted; no reconstructed neck, cap or shadow. Resolution is limited by the original photograph.')
            if sku == 'PbNat16ozFlpWh':
                notes.append('Legacy identifies natural-color plastic; the catalog currently calls it Clear. Exact SKU is confirmed; this wording correction is recorded separately.')
            holds.append('Exact master source unresolved; approve verified original legacy raster as source exception or provide the matching master.')
        else:
            raise ValueError('Unclassified scope row: ' + sku)
        media = [m for m in legacy_media if m['sku'] == sku]
        if kind in ['Plain short cap', 'Flip top']:
            if not media:
                holds.append('Exact legacy product evidence missing.')
            for m in media:
                checked(ROOT / m['file'], m['sha256'], REVIEW)
        for v in views:
            im = current(v); b = geo.ink_bounds(im)
            if b[0] < 12 or b[1] < 12 or b[2] > 988 or b[3] > 1088:
                holds.append(v['role'] + ': unsafe image margins')
        pair = pair_check(views, target)
        if pair and not pair['passed']:
            holds.append('Glass body alignment exceeds 12/255; correction required.')
        r = {k: row.get(k) for k in ['sku', 'graceSku', 'productGroupId', 'groupSlug', 'itemName', 'capacityMl', 'color', 'capColor', 'applicator']}
        r.update({'classification': kind, 'before': before, 'views': views, 'sources': sources, 'legacyEvidence': media,
                  'referenceSha256': front['sha256'], 'target': target, 'pairCheck': pair, 'holds': holds,
                  'technicalReady': not holds, 'notes': notes, 'status': 'pending',
                  'publicationAuthorized': False})
        r['binding'] = sha(json.dumps({'sku': sku, 'productGroupId': row['productGroupId'], 'views': views, 'sources': sources, 'target': target}, sort_keys=True).encode())
        rows.append(r)
        print(sku, 'pair', pair['bodyMeanError'] if pair else '-', 'holds:', '; '.join(holds) or 'none', flush=True)
    for name, digest in protected.items():
        checked(ROOT / name, digest, ROOT)
    result = {'schemaVersion': 1, 'revision': args.revision, 'id': ID, 'family': 'Cylinder', 'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'ledgerAt': ledger['generatedAt'], 'ledgerBefore': ledger['platePlan']['counts'],
              'familyBefore': next(f for f in ledger['platePlan']['families'] if f['family'] == 'Cylinder'),
              'protectedFileHashes': protected, 'canvas': [1000, 1100], 'rows': rows,
              'publicationAuthorized': False, 'summary': {'total': len(rows), 'technicalReady': sum(r['technicalReady'] for r in rows),
              'newViewFiles': len({v['sha256'] for r in rows for v in r['views']} - {v['sha256'] for r in rows for v in r['before']}),
              'held': sum(not r['technicalReady'] for r in rows)}}
    output = REVIEW / ('prepared.json' if args.revision == 1 else f'prepared-v{args.revision}.json')
    if output.exists():
        if [r['binding'] for r in read(output)['rows']] != [r['binding'] for r in rows]:
            raise ValueError('Existing review packet differs; prepare a new revision.')
    else:
        output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result['summary']))


if __name__ == '__main__':
    main()
