"""Read original PSDs and export complete reference/geometry pixels unchanged."""
import hashlib
import json
from pathlib import Path
from psd_tools import PSDImage

BASE = Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master/13. 16 mm')
OUT = Path('docs/reviews/jumbo-body-reference-2026-11-02/sources')
OUT.mkdir(parents=True, exist_ok=True)

for capacity, filename in [(28, '2. 28ml  Uncapped/4.  GBCyl28RollWht.psd'),
                           (50, '4. 50ml Uncapped/1. GBCyl50RollBlk.psd')]:
    source = BASE / filename
    psd = PSDImage.open(source)
    psd.composite().save(OUT / f'{capacity}ml-complete-psd-reference.png')
    if capacity != 50:
        continue
    indices = [1, 3, 4]
    selected = {id(psd[index]) for index in indices}
    viewport = (226, 470, 735, 1821)
    image = psd.composite(viewport=viewport, force=True, alpha=0.0,
                          layer_filter=lambda layer: id(layer) in selected)
    image.save(OUT / '50ml-complete-glass-geometry-guide.png')
    metadata = {
        'sourceFile': str(source), 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'includedLayers': [{'index': index, 'name': psd[index].name, 'bounds': psd[index].bbox}
                           for index in indices],
        'viewport': viewport, 'width': image.width, 'height': image.height,
        'aspect': image.height / image.width,
        'dimensionReference': {'heightWithoutCapMm': 98, 'diameterMm': 37},
        'method': 'Native PSD composite includes glass neck pixels in the roller/retouch layers. Viewport begins below the seating flange. Original pixels and files unchanged.',
    }
    (OUT / '50ml-geometry-guide.json').write_text(json.dumps(metadata, indent=2) + '\n')
