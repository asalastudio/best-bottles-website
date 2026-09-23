"""Verify unchanged native composites and show corrected photographic component roles."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

parser = argparse.ArgumentParser()
parser.add_argument('--asset-cache', type=Path, required=True)
args = parser.parse_args()
root = Path('data/repairs/four-family-components-2026-09-22')
snapshot = json.loads((root / 'production-before.json').read_text())
after = json.loads((root / 'local-kits.json').read_text())['rows']
out = Path('output/four-family-component-cleanup')
out.mkdir(parents=True, exist_ok=True)

def asset(url, expected=None):
    file = args.asset_cache / (hashlib.sha256(url.encode()).hexdigest() + '.webp')
    raw = file.read_bytes()
    if expected and hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Source bytes changed: ' + url)
    return Image.open(file).convert('RGBA')

def composite(kit):
    size = (kit['canvas']['width'], kit['canvas']['height'])
    result = Image.new('RGBA', size, 'white')
    alpha = Image.new('L', size)
    for part in sorted(kit['parts'], key=lambda p: p['zOrder']):
        im = asset(part['image']['url'], part['image']['sha256'])
        assert im.size == size
        assert part['assembled'] == {'x': 0, 'y': 0}
        result.alpha_composite(im)
        alpha = ImageChops.lighter(alpha, im.getchannel('A'))
    return result, alpha

def thumbnail(im, size):
    im = im.copy()
    im.thumbnail(size, Image.Resampling.LANCZOS)
    return im

metrics = []
sheet = Image.new('RGB', (1440, len(after) * 220 + 80), '#F5F3EF')
draw = ImageDraw.Draw(sheet)
draw.text((20, 15), 'PDP + BUILD YOUR BOTTLE | Circle component repair', fill='black')
draw.text((20, 40), 'Existing photographic kits, not hero regeneration. Glass and integrated sprayer now have correct roles.', fill='black')
for i, (sku, kit) in enumerate(after.items()):
    before = snapshot['kits'][sku]
    old, _ = composite(before)
    new, alpha = composite(kit)
    assert old.tobytes() == new.tobytes(), sku + ': assembled pixels changed'
    plate = asset(snapshot['plates'][sku]['image'], kit['plateSha256'])
    white = Image.new('RGBA', plate.size, 'white')
    white.alpha_composite(plate)
    red, green, blue = white.convert('RGB').split()
    dark = ImageChops.invert(ImageChops.darker(ImageChops.darker(red, green), blue)).point(lambda x: 255 if x > 10 else 0)
    mask = ImageChops.lighter(alpha.point(lambda x: 255 if x > 16 else 0), dark)
    mae = sum(ImageStat.Stat(ImageChops.difference(new.convert('RGB'), white.convert('RGB')), mask).mean) / 3
    assert mae <= 6, f'{sku}: native composite error {mae}'
    parts = []
    for p in kit['parts']:
        a = asset(p['image']['url'], p['image']['sha256']).getchannel('A')
        transparent = a.histogram()[0] / (a.width * a.height)
        bbox = a.getbbox()
        clipped = not bbox or min(bbox[0], bbox[1]) <= 0 or bbox[2] >= a.width or bbox[3] >= a.height
        assert transparent >= .05 and not clipped, sku + ': alpha/clipping gate'
        parts.append({'slot': p['slot'], 'sha256': p['image']['sha256'], 'transparentFraction': transparent, 'clipped': clipped})
    metrics.append({'sku': sku, 'nativeCompositeMae255': mae, 'assembledPixelsChanged': 0, 'parts': parts, 'anchors': kit['anchors']})
    y = 80 + i * 220
    draw.text((20, y + 8), sku, fill='black')
    draw.text((20, y + 32), f'Plate parity: {mae:.2f} / 255', fill='black')
    draw.text((20, y + 54), f'Glass baseline: {kit["anchors"]["baselineY"]} px', fill='black')
    draw.text((20, y + 76), 'Assembled pixels unchanged', fill='black')
    images = [('Assembled', new)] + [(p['slot'], asset(p['image']['url'])) for p in sorted(kit['parts'], key=lambda p: p['slot'] != 'body')]
    for j, (name, im) in enumerate(images):
        x = 340 + j * 240
        draw.text((x, y), name, fill='black')
        if name != 'Assembled':
            im = im.crop(im.getchannel('A').getbbox())
        thumb = thumbnail(im, (220, 190))
        sheet.paste(thumb, (x + (220-thumb.width)//2, y + 22 + (190-thumb.height)//2), thumb)
sheet.save(out / 'circle-component-repair-sheet.jpg', quality=90)
(out / 'native-kit-checks.json').write_text(json.dumps({'scope': 'metadata repair only', 'checks': metrics}, indent=2) + '\n')
print(f'{len(metrics)} kits: unchanged assembled pixels; all native composite and alpha gates pass.')
