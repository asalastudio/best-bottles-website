#!/usr/bin/env python3
"""Create a local CSV and visual review from a family batch; never publish it."""
import argparse
import base64
import csv
import hashlib
import html
import json
from collections import Counter
from pathlib import Path

from PIL import Image


def load(path):
    return json.loads(path.read_text())


def safe_asset(root, key):
    path = (root / key).resolve(strict=True)
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f"Asset escapes the batch: {key}")
    return path


def verify_asset(root, asset):
    path = safe_asset(root, asset['key'])
    payload = path.read_bytes()
    if len(payload) != asset['bytes'] or hashlib.sha256(payload).hexdigest() != asset['sha256']:
        raise ValueError(f"Asset bytes changed: {asset['key']}")
    with Image.open(path) as im:
        im.load()
        if im.format != 'WEBP' or im.size != (asset['width'], asset['height']):
            raise ValueError(f"Invalid image dimensions or format: {asset['key']}")
    return path


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--batch', type=Path, required=True)
    args = ap.parse_args()
    batch = args.batch.resolve()
    xref = load(batch / 'input/xref.json')
    catalog = load(batch / 'input/convex-snapshot.json')
    plates = load(batch / 'plates/manifest.json')
    kits = load(batch / 'kits/manifest.json')
    if kits.get('partial'):
        raise ValueError('A sample kit run cannot represent family coverage')
    audit = load(batch / 'input/kit-audit.json')
    by_sku = {p['websiteSku']: p for p in catalog['products']}
    plate_by_sku = {r['websiteSku']: r for r in plates['rows']}
    kit_by_sku = {r['sku']: r for r in kits['rows']}
    audit_by_sku = {r['websiteSku']: r for r in audit['results']}
    rows, cards, checks = [], [], []
    for x in sorted(xref['products'], key=lambda r: (r.get('familyId') or '', r['websiteSku'])):
        sku = x['websiteSku']
        p = by_sku[sku]
        plate = plate_by_sku.get(sku, {})
        kit = kit_by_sku.get(sku, {})
        plate_ok = bool(x['publishable'] and plate.get('publishable'))
        reasons = list(x['blockReasons']) + plate.get('blockReasons', [])
        if x['kitApplicability'] == 'notApplicable':
            kit_status = 'Not required — standalone product'
        elif kit.get('status') == 'candidate':
            kit_status = 'Local candidate — review required'
        elif not plate_ok:
            kit_status = 'Held with plate'
        else:
            kit_status = 'Component layer review required'
        if kit.get('reason'):
            reasons.append(kit['reason'])
        thumb = ''
        if plate_ok:
            for role in ('plate', 'thumb', 'plateCapOff', 'thumbCapOff'):
                if plate.get(role):
                    path = verify_asset(batch / 'plates', plate[role])
                    checks.append({'sku': sku, 'role': role, 'key': plate[role]['key'], 'passed': True})
                    if role == 'thumb':
                        thumb = 'data:image/webp;base64,' + base64.b64encode(path.read_bytes()).decode()
        row = {
            'websiteSku': sku, 'convexRecordId': p['_id'], 'graceSku': p.get('graceSku'),
            'familyId': x['familyId'], 'capacityMl': p.get('capacityMl'),
            'bottleColor': p.get('color'), 'neck': p.get('neckThreadSize'),
            'applicator': p.get('applicator'), 'componentColor': p.get('capColor'),
            'plateStatus': 'Local candidate' if plate_ok else 'Held', 'kitStatus': kit_status,
            'layerAuditHint': audit_by_sku.get(sku, {}).get('completeness', ''),
            'sourcePath': (plate.get('plate') or {}).get('sourceRelPath', ''),
            'sourceSha256': (plate.get('plate') or {}).get('sourceSha256', ''),
            'plateSha256': (plate.get('plate') or {}).get('sha256', ''),
            'notes': ' | '.join(dict.fromkeys(reasons)),
        }
        rows.append(row)
        esc = lambda text: html.escape(str(text or ''))
        image = f'<img loading="lazy" src="{thumb}" alt="{esc(sku)}">' if thumb else '<div class="missing">Source held</div>'
        search = ' '.join(str(v or '') for v in row.values()).lower()
        cards.append(f'''<article data-search="{esc(search)}" data-state="{'candidate' if plate_ok else 'held'}">
          {image}<div><h2>{esc(sku)}</h2><p>{esc(row['familyId'])}</p>
          <p>{esc(row['applicator'])} · {esc(row['componentColor'])}</p>
          <p><b>Plate:</b> {esc(row['plateStatus'])}<br><b>Kit:</b> {esc(kit_status)}</p>
          <details><summary>Evidence and exceptions</summary><p>{esc(row['notes']) or 'Automated plate checks passed; final review remains.'}</p>
          <p>{esc(row['sourcePath'])}</p><p>Convex: {esc(p['_id'])}</p></details></div></article>''')
    output = batch / 'review'
    output.mkdir(exist_ok=True)
    with (output / 'cylinder-sku-status.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    held = [r for r in rows if r['plateStatus'] == 'Held']
    with (output / 'plate-exceptions.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(held)
    counts = {'catalogRecords': len(rows), 'plateCandidates': len(rows) - len(held),
              'plateHeld': len(held), 'kitCandidates': kits['counts'].get('candidate', 0),
              'standaloneKitNotRequired': sum(x['kitApplicability'] == 'notApplicable' for x in xref['products']),
              'decodedPlateAssets': len(checks), 'publishedByThisBatch': 0}
    evidence = {'counts': counts, 'catalogGeneratedAt': catalog.get('generatedAt'),
                'deployment': catalog.get('deployment'),
                'inputHashes': {name: hashlib.sha256((batch / name).read_bytes()).hexdigest() for name in
                                ('input/convex-snapshot.json', 'input/xref.json', 'plates/manifest.json', 'kits/manifest.json')},
                'plateChecks': checks, 'kitReasons': dict(Counter(k.get('reason') for k in kits['rows'] if k.get('reason')))}
    (output / 'verification.json').write_text(json.dumps(evidence, indent=2))
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cylinder · master source review</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ef;color:#252824;font:15px/1.55 system-ui,sans-serif}main{max-width:1320px;margin:auto;padding:36px 24px}
h1{font-size:36px;letter-spacing:-1px;margin:4px 0 12px}header>p{max-width:850px;color:#555f57}.eyebrow{font-size:12px;letter-spacing:2px;text-transform:uppercase}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.stat{background:#fff;border:1px solid #deddd6;padding:16px 24px;flex:1;min-width:150px}.stat b{display:block;font-size:30px}
.toolbar{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}input,select{font:inherit;padding:12px;border:1px solid #aaa;background:white;border-radius:4px}input{flex:1;min-width:180px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:14px}article{display:flex;background:white;border:1px solid #ddded7;padding:16px;gap:14px;overflow:hidden}article img,.missing{width:100px;height:150px;object-fit:contain;flex-shrink:0}.missing{display:grid;place-items:center;background:#f2eadd;color:#75592b;font-size:12px}article>div:last-child{min-width:0}h2{font-size:15px;margin:0;overflow-wrap:anywhere}article p{font-size:13px;margin:8px 0;overflow-wrap:anywhere;color:#4a534e}summary{font-size:12px;cursor:pointer;color:#315a4e}a{color:#315a4e}#count{margin-left:auto}article[hidden]{display:none}@media(max-width:430px){main{padding:20px 12px}.grid{grid-template-columns:1fr}h1{font-size:29px}article img,.missing{width:75px}}
</style><main><header><div class="eyebrow">Best Bottles · local review · September 4, 2026</div><h1>Cylinder plates &amp; kits</h1>
<p>Every Cylinder record in this production snapshot is listed below. A plate candidate has passed source and alignment checks. It is not a published asset. Kit layer counts are only extraction hints; they do not prove correct exposed components or interchangeable parts. Product labels below are current catalog values, not approved replacement names.</p>
<p>Plastic flip-top bottles require finished plates. Component kits and threaded connections are not required for those standalone products.</p></header>
<div class="stats">__STATS__</div><p><a href="cylinder-sku-status.csv" download>Download all SKU statuses</a> · <a href="plate-exceptions.csv" download>Download plate exceptions</a></p>
<div class="toolbar"><input id="search" aria-label="Search catalog" placeholder="Search SKU, capacity, color, or exception"><select id="state" aria-label="Plate status"><option value="">All products</option value="held">Held plates</option value="candidate">Plate candidates</option></select><span id="count" aria-live="polite"></span></div>
<div class="grid">__CARDS__</div></main><script>
const cards=[...document.querySelectorAll('article')],search=document.getElementById('search'),state=document.getElementById('state');function filter(){let n=0;for(const c of cards){const show=c.dataset.search.includes(search.value.toLowerCase())&&(!state.value||c.dataset.state===state.value);c.hidden=!show;if(show)n++}document.getElementById('count').textContent=n+' products';}search.addEventListener('input',filter);state.addEventListener('change',filter);filter();
</script></html>'''
    stats = ''.join(f'<div class="stat"><b>{counts[key]}</b>{label}</div>' for key, label in
                    [('catalogRecords', 'Products in scope'), ('plateCandidates', 'Local plate candidates'),
                     ('plateHeld', 'Plates held'), ('kitCandidates', 'Local kit candidates')])
    (output / 'index.html').write_text(page.replace('__STATS__', stats).replace('__CARDS__', '\n'.join(cards)))
    print(json.dumps(counts, indent=2))


if __name__ == '__main__':
    main()
