"""Restore omitted metal rollers from each exact SKU's original uncapped PSD.

Read-only input: a captured {kits: [...]} catalog audit. Original glass and cap
assets remain unchanged. Uniform source registration follows the body bounds.
"""
from pathlib import Path
import argparse, hashlib, json, re
from psd_tools import PSDImage
from PIL import Image

ROOT = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
REPO = Path(__file__).resolve().parents[2]

def build(snapshot):
    kits = {k['sku']: k for k in json.loads(Path(snapshot).read_text())['kits'] if k}
    out = REPO / 'public/images/bottle-builder/rollers'
    out.mkdir(parents=True, exist_ok=True)
    manifest, review = {}, []
    for source in sorted(ROOT.rglob('*.psd')):
        sku = re.sub(r'^\d+\.\s*', '', source.stem)
        if not re.fullmatch(r'GBTallCyl(?:Frst)?9MtlRoll\w+', sku) or 'uncapped' not in str(source).lower():
            continue
        kit = kits.get(sku)
        if not kit or any(p['slot'] == 'roller' for p in kit['parts']):
            continue
        psd = PSDImage.open(source)
        layers = list(psd)
        # All 18 reviewed exact sources: background, roller, bottle and detached cap.
        assert len(layers) == 4
        roller = layers[1]
        body = max(layers[2:], key=lambda layer: layer.height)
        assert roller.top < body.top and roller.bottom < body.top + body.height / 4
        registered = next(p for p in kit['parts'] if p['slot'] == 'body')
        bounds = registered['bounds']
        scale = (bounds['bottom'] - bounds['top']) / body.height
        assert abs(scale * body.width - (bounds['right'] - bounds['left'])) < 3
        ox = (bounds['left'] + bounds['right']) / 2 - (body.left + body.right) / 2 * scale
        oy = bounds['bottom'] - body.bottom * scale
        canvas = Image.new('RGBA', psd.size)
        canvas.alpha_composite(roller.composite(), (roller.left, roller.top))
        canvas = canvas.transform((kit['canvas']['width'], kit['canvas']['height']), Image.Transform.AFFINE,
            (1 / scale, 0, -ox / scale, 0, 1 / scale, -oy / scale), Image.Resampling.BICUBIC)
        path = out / (sku + '.webp')
        canvas.save(path, 'WEBP', lossless=True)
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        part = {**registered, 'slot': 'roller', 'zOrder': registered['zOrder'] - .5,
            'bounds': dict(zip(['left', 'top', 'right', 'bottom'], canvas.getbbox())),
            'image': {**registered['image'], 'url': '/images/bottle-builder/rollers/' + path.name,
                'sha256': sha, 'key': 'builder/rollers/' + path.name, 'bytes': path.stat().st_size}}
        manifest[sku] = {'bodySha256': registered['image']['sha256'], 'part': part}
        review.append({'sku': sku, 'source': str(source.relative_to(ROOT)),
            'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'layer': 1,
            'bodyLayer': layers.index(body), 'scale': scale, 'offset': [ox, oy], 'outputSha256': sha})
    (REPO / 'src/lib/bottle-builder/rollers.generated.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (REPO / 'data/paper-doll/builder-roller-source-review.json').write_text(json.dumps(review, indent=2) + '\n')
    print('Restored', len(manifest), 'exact metal roller layers')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot')
    build(parser.parse_args().snapshot)
