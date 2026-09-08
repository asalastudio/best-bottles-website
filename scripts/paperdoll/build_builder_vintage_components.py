"""Export the three unavailable vintage mechanisms from exact original PSDs."""
import json, hashlib
from pathlib import Path
from psd_tools import PSDImage
ROOT = Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
REPO = Path(__file__).resolve().parents[2]
manifest_path = REPO/'src/lib/bottle-builder/component-cutouts.generated.json'
manifest = json.loads(manifest_path.read_text())
for sku, filename in [('AnSp18-415Lvn','23. Ansp18-415Lvn.psd'), ('AnSp18-415IvyGl','28. Ansp18-415IvyGl.psd'), ('AnSp18-415Red','31. Ansp18-415Red.psd')]:
    path = ROOT/'20. Caps/9. 18-415 Ansp '/filename
    psd = PSDImage.open(path)
    assert len(psd) == 3
    # Layer 0 is background; layer 1 is the separate dip tube. Preserve layer 2.
    im = psd[2].composite()
    im = im.crop(im.getchannel('A').getbbox())
    im.thumbnail((500,500))
    dest = REPO/'public/images/bottle-builder/components'/(sku+'.png')
    im.save(dest)
    manifest[sku] = {'url':'/images/bottle-builder/components/'+dest.name,'width':im.width,'height':im.height,
        'source':str(path.relative_to(ROOT)),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'layer':psd[2].name,'layerIndex':2,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
