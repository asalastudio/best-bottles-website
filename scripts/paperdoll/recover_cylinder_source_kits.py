#!/usr/bin/env python3
"""Recover review-only component kits from exact source PSDs.

Requires an explicit source-hash/layer recipe and a catalog snapshot. Originals
are read only. Outputs can be staged with local-kit-overlay.mjs; no publishing.
The Desktop copies differ from the project master: do not substitute one root
for the other or discard their source lineage.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from psd_tools import PSDImage

from build_paired_psd_kits import validate_body_pair
from build_master_kits import parity


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def inventory(psd, permitted_opacity):
    result = {}
    for i, layer in enumerate(psd.descendants()):
        if not layer.is_visible():
            continue
        if layer.is_group():
            assert layer.opacity == 255 and layer.blend_mode.value == b'pass' and not layer.has_mask()
            continue
        assert layer.kind == 'pixel' and layer.blend_mode.value == b'norm' and not layer.has_mask()
        assert layer.opacity == permitted_opacity.get(str(i), 255), (i, layer.opacity)
        im = layer.topil()
        result[i] = {'index': i, 'bounds': list(layer.bbox), 'background': i == 0,
            'pixelHash': hashlib.sha256(str((im.size, im.mode)).encode()+im.tobytes()).hexdigest()}
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--recipes', type=Path, required=True)
    ap.add_argument('--catalog', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args()
    recipes = json.loads(args.recipes.read_text())
    store_prefix = recipes.get('storePrefix', 'kits/cylinder-component-recovery-2026-09-22')
    catalog = {p['websiteSku']: p for p in json.loads(args.catalog.read_text())}
    dest = args.out / 'kits'
    (dest / 'parts').mkdir(parents=True, exist_ok=True)
    rows, tiles = [], []
    for recipe in recipes['rows']:
        sku = recipe['sku']
        product = catalog[sku]
        assert all(product[k] == v for k, v in recipe['identity'].items()), sku
        psds, inventories = {}, {}
        for side in ['on', 'off']:
            source = recipe[side]
            assert digest(source['path']) == source['sha256'], 'Source changed: ' + sku
            psds[side] = PSDImage.open(source['path'])
            inventories[side] = inventory(psds[side], source.get('reviewedOpacity', {}))
        on_body = inventories['on'][recipe['onBody']]
        off_body = inventories['off'][recipe['offBody']]
        transparent_rgb_only = False
        retouch_metrics = None
        if on_body['pixelHash'] != off_body['pixelHash'] and recipe.get('reviewedTransparentRgbDifference'):
            a, b = [np.asarray(list(psds[side].descendants())[recipe[side+'Body']].topil().convert('RGBA'))
                    for side in ['on', 'off']]
            assert a.shape == b.shape and np.array_equal(a[:, :, 3], b[:, :, 3])
            visible = (a[:, :, 3] > 0) | (b[:, :, 3] > 0)
            assert np.array_equal(a[visible], b[visible]), 'Visible body pixels differ: ' + sku
            transparent_rgb_only = True
        if on_body['pixelHash'] != off_body['pixelHash'] and recipe.get('reviewedBodyRetouchDifference'):
            # Reviewed paired masters can contain slight edge retouching. Keep
            # the selected on-body intact, require equal dimensions, and bound
            # both alpha silhouette agreement and the actual pixel difference.
            a, b = [np.asarray(list(psds[side].descendants())[recipe[side+'Body']].topil().convert('RGBA'))
                    for side in ['on', 'off']]
            assert a.shape == b.shape, 'Body geometry dimensions differ: ' + sku
            ma, mb = a[:, :, 3] > 32, b[:, :, 3] > 32
            overlap = float((ma & mb).sum() / (ma | mb).sum())
            error = float(np.abs(a.astype(float)-b.astype(float)).mean())
            reviewed = recipe['reviewedBodyRetouchDifference']
            assert overlap >= max(.99, reviewed['minAlphaIoU']) and error <= min(2, reviewed['maxMeanError']), 'Body retouch exceeds review: ' + sku
            retouch_metrics = {'alphaIoU': overlap, 'meanError': error}
        dx, dy = validate_body_pair(on_body, off_body, allow_retouch_difference=transparent_rgb_only or retouch_metrics is not None)
        x0, y0, x1, y1 = on_body['bounds']
        scale = recipe['bodyWidth'] / (x1 - x0)
        axis_x = recipe.get('axisX', 500)
        ox, oy = axis_x - (x0 + x1) * scale / 2, recipe['baselineY'] - y1 * scale
        transform = (1/scale, 0, -ox/scale, 0, 1/scale, -oy/scale)
        parts, evidence = [], []
        for z, spec in enumerate(recipe['parts']):
            source = Image.new('RGBA', psds['on'].size)
            for ref in spec['layers']:
                side, index = ref['source'], ref['index']
                info = inventories[side][index]
                assert not info['background']
                layer = list(psds[side].descendants())[index]
                x, y = (dx, dy) if side == 'off' else (0, 0)
                pixels = layer.topil().convert('RGBA')
                # A few masters include white Photoshop cleanup polygons
                # outside the photographed part. Recipes may exclude ONLY
                # those white pixels outside a visually reviewed product box.
                # Never remove highlights inside the product or nonwhite ink.
                if 'reviewedProductBox' in ref:
                    box = ref['reviewedProductBox']
                    arr = np.array(pixels)
                    outside = np.ones(arr.shape[:2], dtype=bool)
                    outside[box[1]:box[3], box[0]:box[2]] = False
                    removed = outside & (arr[:, :, 3] > 0)
                    assert np.all(arr[:, :, :3][removed] >= 245), 'Product ink outside reviewed box: ' + sku
                    arr[outside, 3] = 0
                    pixels = Image.fromarray(arr)
                if layer.opacity != 255:
                    pixels.putalpha(pixels.getchannel('A').point(lambda a: round(a*layer.opacity/255)))
                source.alpha_composite(pixels, (layer.left+x, layer.top+y))
                evidence.append({'slot': spec['slot'], 'source': side, 'index': index, 'pixelHash': info['pixelHash']})
            im = source.transform((1000, 1100), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC)
            bounds = im.getbbox()
            assert bounds and min(bounds[:2]) >= 2 and bounds[2] <= 998 and bounds[3] <= 1098, (sku, spec['slot'], bounds)
            alpha = np.asarray(im.getchannel('A'))
            assert float((alpha == 0).mean()) >= .05
            temporary = dest / 'parts' / (sku + '.' + spec['slot'] + '.webp')
            im.save(temporary, 'WEBP', lossless=True)
            sha = digest(temporary)
            name = sha + '.' + spec['slot'] + '.webp'
            target = temporary.with_name(name)
            temporary.replace(target)
            parts.append({'slot': spec['slot'], 'variantKey': None, 'zOrder': z, 'explodeIndex': z,
                'bounds': dict(zip(['left', 'top', 'right', 'bottom'], bounds)),
                'assembled': {'x': 0, 'y': 0}, 'exploded': {'dx': 0, 'dy': 0 if spec['slot'] == 'body' else -110*z},
                'image': 'parts/' + name, 'storeKey': store_prefix + '/' + name,
                'sha256': sha, 'bytes': target.stat().st_size, 'width': 1000, 'height': 1100, 'derivation': 'psd-layer'})
        on, off = Image.new('RGBA', (1000, 1100), 'white'), Image.new('RGBA', (1000, 1100), 'white')
        for part in parts:
            im = Image.open(dest / part['image']).convert('RGBA')
            on.alpha_composite(im)
            if part['slot'] != 'overcap':
                off.alpha_composite(im)
            else:
                b = part['bounds']
                body = next(p['bounds'] for p in parts if p['slot'] == 'body')
                side_x, side_y = round(body['right']+24-b['left']), round(recipe['baselineY']-b['bottom'])
                assert b['right']+side_x <= 998 and b['left']+side_x >= 2
                assert b['top']+side_y >= 2 and b['bottom']+side_y <= 1098
                off.alpha_composite(im, (side_x, side_y))
        plate = dest / (sku + '.front-on.webp')
        source_on = psds['on'].topil().convert('RGBA').transform((1000, 1100), Image.Transform.AFFINE,
                                                               transform, Image.Resampling.BICUBIC)
        expected = Image.new('RGBA', (1000, 1100), 'white')
        expected.alpha_composite(source_on)
        parity_gate = parity(on, expected)
        assert parity_gate['ok'], (sku, 'Source composite differs', parity_gate)
        on.convert('RGB').save(plate, 'WEBP', lossless=True)
        off.convert('RGB').save(dest / (sku + '.front-off.webp'), 'WEBP', lossless=True)
        body = next(p['bounds'] for p in parts if p['slot'] == 'body')
        rows.append({'status': 'candidate', 'publishable': False, 'sku': sku, 'websiteSku': sku,
            'graceSku': product['graceSku'], 'familyId': recipe['familyId'], 'completeness': 'full',
            'canvas': {'width': 1000, 'height': 1100}, 'anchors': {'axisX': axis_x, 'neckAxisX': axis_x,
                'seatY': body['top'], 'baselineY': body['bottom'], 'pxPerMm': None},
            'parts': parts, 'three': None, 'plateSha256': digest(plate), 'source': recipe,
            'layerEvidence': evidence, 'transform': {'scale': scale, 'x': ox, 'y': oy},
            'gates': {'bodyVisiblePixelsIdenticalAcrossPair': on_body['pixelHash'] == off_body['pixelHash'] or transparent_rgb_only,
                'reviewedBodyRetouchDifference': retouch_metrics,
                'ignoredOnlyZeroAlphaRgbDifference': transparent_rgb_only, 'alphaAndCanvas': True,
                'sourceParity': parity_gate},
            'notes': ['Native source pixels; body and all hardware receive one uniform transform.',
                'Off-canvas Photoshop scrap is clipped by its original PSD canvas.',
                'Review candidates only. No hero, hosted index, catalog, or inventory changes.']})
        tile = Image.new('RGB', (400, 485), '#f5f3ef')
        preview = off.convert('RGB').resize((400, 440), Image.Resampling.LANCZOS)
        tile.paste(preview, (0, 0))
        ImageDraw.Draw(tile).text((10, 455), sku, fill='black')
        tiles.append(tile)
    sheet = Image.new('RGB', (1200, 485*((len(tiles)+2)//3)), '#eee9df')
    for i, tile in enumerate(tiles):
        sheet.paste(tile, (i%3*400, i//3*485))
    sheet.save(args.out / 'sheet.jpg', quality=94)
    (dest / 'manifest.json').write_text(json.dumps({'rows': rows}, indent=2)+'\n')
    print(f'{len(rows)} review kits recovered; no remote writes')


if __name__ == '__main__':
    main()
