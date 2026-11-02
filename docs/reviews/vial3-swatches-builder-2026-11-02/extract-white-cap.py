"""Export an existing short white cap layer; source PSD is never changed."""
import hashlib
import json
from pathlib import Path
from psd_tools import PSDImage
source=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master/5.  13-415 Bottles/20. GB2o3/1.  Green 2o3 (Uncapped)/2. GBVialGreen2o3WhtCapSht.psd')
out=Path('docs/reviews/vial3-swatches-builder-2026-11-02/sources')
psd=PSDImage.open(source)
layer=psd[2]
assert layer.name=='Layer 3' and layer.bbox==(265,514,447,633)
layer.composite().save(out/'white-cap-native.png')
(out/'white-cap-lineage.json').write_text(json.dumps({'sourceFile':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'layerIndex':2,'layerName':layer.name,'bounds':layer.bbox,'role':'Detached short white cap only; bottle layer is excluded.','crosswalk':'Exact current green and blue vial pages show this short white cap silhouette and the same 13-415CpShortWhite thumbnail, while specifying 13-425 bottle necks. This does not establish thread-wide compatibility.'},indent=2)+'\n')
