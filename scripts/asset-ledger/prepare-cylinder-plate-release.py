#!/usr/bin/env python3
"""Stage exact approved Cylinder pairs for a read-only publisher dry run."""
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MASTER = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master').resolve()
REVIEW = ROOT / 'docs/reviews/cylinder-capoff-final-2026-09-12'
OUT = ROOT / 'dist/paper-doll/cylinder-approved-release-2026-09-12'
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    if (REVIEW / 'ship-authorization.json').exists():
        raise ValueError('This release is authorized and immutable. Use verify-cylinder-plate-release.mjs; do not restage approved bytes.')
    candidate = read(REVIEW / 'prepared.json')
    approved = read(ROOT / 'data/asset-ledger/cylinder-capoff-final-decisions.json')
    technical = read(REVIEW / 'technical-review.json')
    packet_sha = sha(REVIEW / 'prepared.json')
    if approved['reviewPacketSha256'] != packet_sha or technical['reviewPacketSha256'] != packet_sha:
        raise ValueError('The approved review packet changed')
    decisions = {r['sku']: r for r in approved['entries']}
    checks = {r['sku']: r for r in technical['rows']}
    sources = {r['sku']: r for r in read(ROOT / 'data/asset-ledger/cylinder-approved-capoff-sources.json')['entries']}
    ledger = {r['sku']: r for r in read(ROOT / 'src/lib/asset-ledger/ledger.json')['rows'] if r['productRecord']}
    catalog = {r['websiteSku']: r for r in read(ROOT / 'dist/paper-doll/catalog-plates-2026-09-12/catalog.json')['products'] if r.get('websiteSku')}
    for file, expected in candidate['protectedFileHashes'].items():
        if sha(ROOT / file) != expected:
            raise ValueError('Protected source, plate approval or standard changed')
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for r in candidate['rows']:
        decision, check, current, product = decisions[r['sku']], checks[r['sku']], ledger[r['sku']], catalog[r['sku']]
        if decision['status'] != 'approved' or decision['binding'] != r['binding'] or check['binding'] != r['binding']:
            raise ValueError('Approval or technical binding changed')
        if not check['eligible']:
            continue
        if current['productGroupId'] != r['productGroupId'] or product['productGroupId'] != r['productGroupId'] or current['family'] != 'Cylinder':
            raise ValueError('Exact catalog identity changed')
        if current['plate']['sha256'] != r['before'][0]['sha256']:
            raise ValueError('Approved baseline plate changed')
        proposed = {v['role']: v for v in r['proposed']}
        master = {v['role']: v for v in sources[r['sku']]['views']}
        front = proposed.get('on', r['before'][0])
        off = proposed['off']
        if 'on' not in proposed and (MASTER / current['plate']['sourcePath']).resolve() != (MASTER / master['on']['path']).resolve():
            raise ValueError('Retained plate is not indexed to the exact approved master')
        family = current['plate']['familyId']
        assets = {}
        for role, view, source in [('plate', front, master['on']), ('plateCapOff', off, master['off'])]:
            file = ROOT / 'public' / view['url'].lstrip('/')
            if sha(file) != view['sha256']:
                raise ValueError('Approved image bytes changed')
            if view in r['proposed'] and view['sha256'] not in {v['sha256'] for v in decision['views']}:
                raise ValueError('Missing exact-byte visual approval')
            original = (MASTER / source['path']).resolve()
            if not original.is_relative_to(MASTER) or sha(original) != source['sourceSha256']:
                raise ValueError('Original master changed')
            suffix = 'front-on' if role == 'plate' else 'front-off'
            key = f"plates/{family}/{r['sku']}/{view['sha256']}.{suffix}-1000x1100.webp"
            dest = OUT / key
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists() and sha(dest) != view['sha256']:
                raise ValueError('Immutable release asset changed')
            if not dest.exists():
                shutil.copy2(file, dest)
            with Image.open(dest) as im:
                if im.size != (1000, 1100) or im.format != 'WEBP':
                    raise ValueError('Invalid release image')
            asset = {'key': key, 'storeKey': key, 'sha256': view['sha256'], 'bytes': dest.stat().st_size,
                     'width': 1000, 'height': 1100, 'sourceLibrary': 'master',
                     'sourceRelPath': source['path'], 'sourceSha256': source['sourceSha256'],
                     'sourceStateEvidence': 'explicit reviewed source and visual inspection'}
            assets[role] = asset
            # Reuse the exact approved raster for small previews; no new thumbnail
            # image bytes are created or silently assigned visual approval.
            assets['thumb' if role == 'plate' else 'thumbCapOff'] = dict(asset)
        rows.append({'websiteSku': r['sku'], 'graceSku': current['graceSku'],
                     'productGroupId': r['productGroupId'], 'familyId': family,
                     'familyName': f"Cylinder {r['capacityMl']} mL — {r['color']}",
                     'neck': product.get('neckThreadSize') or '', **assets,
                     'publishable': True, 'blockReasons': [], 'reviewBinding': r['binding'],
                     'pairCheck': check['pairCheck'], 'baselineViews': r['before']})
    if len(rows) != technical['summary']['releaseCandidates']:
        raise ValueError('Release scope differs from the technical review')
    manifest = {'generatedAt': datetime.now(timezone.utc).isoformat(),
                'builder': {'name': 'prepare-cylinder-plate-release.py', 'version': '1.0.0'},
                'canvas': {'width': 1000, 'height': 1100}, 'rows': rows,
                'counts': {'rows': len(rows), 'groups': len({r['familyId'] for r in rows}), 'capOff': len(rows)},
                'reviewPacketSha256': packet_sha, 'approvalFileSha256': sha(ROOT / 'data/asset-ledger/cylinder-capoff-final-decisions.json'),
                'technicalReviewSha256': sha(REVIEW / 'technical-review.json'),
                'publicationAuthorized': False, 'release': 'Cylinder paired plates 2026-09-12',
                'thumbnailPolicy': 'Small previews reference the exact approved full-resolution raster. No new image files.'}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'manifest': str(OUT / 'manifest.json'), **manifest['counts'], 'publicationAuthorized': False}, indent=2))


if __name__ == '__main__':
    main()
