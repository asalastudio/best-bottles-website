"""Local, deterministic preparation. No credentials, network, uploads or database writes."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVIEW = ROOT / 'docs/reviews/production-media-release-2026-10-20'
OUT = ROOT / 'src/lib/media-release'

def read(path):
    return json.loads(path.read_text())

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

plan = read(REVIEW / 'release-plan.json')
rows = [r for r in plan['rows'] if r['batch'] in ['1-empire-canary', '2-empire-remaining', '3-round78-sprays']]
assert len(rows) == 26 and len({r['websiteSku'] for r in rows}) == 26
skus = {r['websiteSku'] for r in rows}
captured = read(REVIEW / 'captured-assemblies.json')
assets = [a for a in plan['localAssets'] if skus.intersection(a['usedBySkus'])]
def local_paths(value):
    if isinstance(value, dict):
        return set().union(*(local_paths(v) for v in value.values()))
    if isinstance(value, list):
        return set().union(*(local_paths(v) for v in value))
    return {value} if isinstance(value, str) and value.startswith('/local-media/') else set()
known = {a['url'] for a in assets}
for sku in sorted(skus):
    for url in sorted(local_paths(captured[sku])):
        if url not in known:
            path = ROOT / 'public' / url.lstrip('/')
            data = path.read_bytes()
            assets.append({'path': str(path.relative_to(ROOT)), 'url': url, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'usedBySkus': sorted(s for s in skus if url in local_paths(captured[s]))})
            known.add(url)
remote_hashes = {}
for name in ['local-empire-completion-provenance.json', 'local-round78-completion-provenance.json']:
    for row in read(ROOT / 'src/lib/products' / name):
        assert row['websiteSku'] in skus
        for layer in row['layers']:
            if layer['url'].startswith('https://'):
                assert remote_hashes.get(layer['url'], layer['sha256']) == layer['sha256']
                remote_hashes[layer['url']] = layer['sha256']
for url, sha in sorted(remote_hashes.items()):
    path = ROOT / 'output/media-release-source-cache' / (sha + '.png')
    if not path.exists():
        candidates = sorted((ROOT / 'public/media-releases').glob('*/' + sha + '.png'))
        assert candidates, 'Run verify-assets.mjs --remote to recover approved remote bytes first'
        path = candidates[0]
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == sha
    assets.append({'path': str(path.relative_to(ROOT)), 'url': url, 'sha256': sha, 'bytes': len(data), 'usedBySkus': sorted(sku for sku in skus if url in canonical(captured[sku]))})
assets.sort(key=lambda a: a['url'])
revision = 'empire-round26-' + digest({'rows': rows, 'assets': [{k: v for k, v in a.items() if k != 'path'} for a in assets]})[:12]
asset_map = {}
for asset in assets:
    source = ROOT / asset['path']
    data = source.read_bytes()
    assert hashlib.sha256(data).hexdigest() == asset['sha256'], source
    url = f'/media-releases/{revision}/{asset["sha256"]}{source.suffix}'
    target = ROOT / 'public' / url.lstrip('/')
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        assert target.read_bytes() == data, f'Immutable asset already differs: {target}'
    else:
        target.write_bytes(data)
    asset_map[asset['url']] = url

heroes = {}
for path in (ROOT / 'src/lib/products').glob('local-*-catalog-hero*.json'):
    value = read(path)
    for hero in value if isinstance(value, list) else [value]:
        if hero['websiteSku'] in skus:
            assert hero['websiteSku'] not in heroes
            heroes[hero['websiteSku']] = hero
assert set(heroes) == skus

# Only media-specific source data enters the runtime guard. No commerce rows.
empire = read(ROOT / 'tests/fixtures/local-media-20261020/empire-baseline.json')['register']
round_sources = [read(ROOT / f'output/round78-spray-completion/{env}-snapshot.json')['register'] for env in ['production', 'development']]
def source_for(payload, grace):
    assembly = payload['assemblies'][grace]
    return {
        'assembly': assembly,
        'plate': payload['plates'].get(assembly['plateKey']),
        'body': payload['bodies'].get(assembly['bodyId']),
        'components': {p['componentId']: payload['components'].get(p['componentId']) for p in assembly['parts']},
    }

entries = []
recipes = {}
remote = set()
def rewrite(value):
    if isinstance(value, dict):
        return {k: rewrite(v) for k, v in value.items()}
    if isinstance(value, list):
        return [rewrite(v) for v in value]
    if isinstance(value, str):
        if value.startswith('https://'):
            remote.add(value)
        if value.startswith('/local-media/'):
            assert value in asset_map, value
        return asset_map.get(value, value)
    return value

for row in rows:
    sku = row['websiteSku']
    kit = captured[sku]
    assert digest(kit) == row['assemblySha256'], sku
    sources = [source_for(s, row['graceSku']) for s in ([empire] if row['group'] == 'empire' else round_sources)]
    sources = list({canonical(s): s for s in sources}.values())
    recipes[sku] = {'kit': rewrite(kit), 'sources': sources}
    entries.append({'websiteSku': sku, 'graceSku': row['graceSku'], 'stage': 'canary' if row['batch'].startswith('1-') else 'empire' if row['group'] == 'empire' else 'round',
                    'hero': rewrite(heroes[sku]), 'bodyImage': {k: v for k, v in rewrite(next(p['image'] for p in kit['parts'] if p['slot'] == 'body')).items() if k in ['url', 'width', 'height']}, 'approvedAssemblySha256': row['assemblySha256']})
manifest = {'revision': revision, 'defaultMode': 'off', 'productionApproved': False, 'entries': entries, 'assetMap': asset_map}
write(OUT / 'manifest.json', manifest)
write(OUT / 'recipes.json', recipes)
write(ROOT / 'docs/reviews/empire-round-release-prep-2026-10-20/asset-inventory.json', {
    'revision': revision, 'skuCount': len(rows), 'localAssetCount': len(assets), 'bytes': sum(a['bytes'] for a in assets),
    'assets': [{'source': a['url'], 'releaseUrl': asset_map[a['url']], 'sha256': a['sha256'], 'bytes': a['bytes']} for a in assets],
    'existingRemoteUrls': sorted(remote), 'remoteDeliveryReverified': False, 'note': 'Verification is recorded separately in remote-asset-verification.json. Every image is served by the preview app itself.',
})
print(json.dumps({'revision': revision, 'skus': len(rows), 'assets': len(assets), 'bytes': sum(a['bytes'] for a in assets), 'existingRemoteUrls': len(remote)}))
