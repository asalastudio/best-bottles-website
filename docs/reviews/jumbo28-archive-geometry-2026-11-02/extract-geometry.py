"""Export complete 28 ml geometry from the owner-specified archive, read-only."""
import hashlib
import json
from pathlib import Path
from psd_tools import PSDImage

SOURCE = Path('/Volumes/Achive/Client Work/Nemat-International/BB-PSD-Files-Master/13. 16 mm/2. 28ml  Uncapped/4.  GBCyl28RollWht.psd')
OUT = Path('docs/reviews/jumbo28-archive-geometry-2026-11-02/sources')
OUT.mkdir(parents=True, exist_ok=True)
psd = PSDImage.open(SOURCE)
psd.composite().save(OUT / '28ml-complete-archive-reference.png')
indices = [1, 2, 4]
selected = {id(psd[index]) for index in indices}
assembly = psd.composite(viewport=(180, 240, 660, 1830), force=True, alpha=0.0,
                         layer_filter=lambda layer: id(layer) in selected)
assembly.save(OUT / '28ml-archive-assembly.png')
psd.composite(viewport=(190, 580, 650, 970), force=True, alpha=0.0,
              layer_filter=lambda layer: id(layer) in selected).save(OUT / '28ml-neck-inspection.png')
viewport = (199, 713, 644, 1828)
glass = psd.composite(viewport=viewport, force=True, alpha=0.0,
                     layer_filter=lambda layer: id(layer) in selected)
glass.save(OUT / '28ml-complete-glass-geometry-guide.png')
(OUT / 'source-lineage.json').write_text(json.dumps({
    'sourceFile': str(SOURCE), 'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'includedLayers': [{'index': i, 'name': psd[i].name, 'bounds': psd[i].bbox} for i in indices],
    'glassViewport': viewport, 'glassImageSize': glass.size,
    'dimensionReference': {'heightWithoutCapMm': 81, 'diameterMm': 31, 'neckFinish': '16mm'},
    'identity': '28 ml only. GBCyl28RollWht is the PSD alias for the existing GBCyl1ozRollWht reference.',
    'method': 'Original archive pixels composited unchanged. Full body plus glass-neck retouch layers; original PSD remains unchanged.'
}, indent=2) + '\n')
print(json.dumps({'source': str(SOURCE), 'layers': indices, 'assemblySize': assembly.size}))
