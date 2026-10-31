from pathlib import Path
from psd_tools import PSDImage
import json,hashlib
root=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master');out=Path(__file__).resolve().parents[1]/'source-review';out.mkdir(exist_ok=True)
files=list((root/'17. Additional Bottles').glob('GBSpry[34]ml*.psd'))
files+=list((root/'5.  13-415 Bottles/2. Clear 5ml Cylinder/1. Clear 5ml Cly (Uncapped) PSD ').glob('1. GBCyl5BlkSht.psd'))
files+=list((root/'5.  13-415 Bottles/3. Blue 5ml Cylinder/1. Blue 5ml Cyl (Uncapped) PSD').glob('1. GBCylBlu5BlkSht.psd'))
rows=[]
for i,path in enumerate(files):
 p=PSDImage.open(path);img=p.topil();img.thumbnail((650,850));img.save(out/f'{i:02d}-merged.png');layers=[]
 for j,l in enumerate(p):
  layers.append({'index':j,'name':l.name,'bbox':list(l.bbox),'visible':l.visible,'opacity':l.opacity,'blend':str(l.blend_mode)})
  if l.width>10 and l.height>10 and not l.is_group():
   image=l.topil();image.thumbnail((350,700));image.save(out/f'{i:02d}-layer-{j:02d}.png')
 rows.append({'index':i,'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':list(p.size),'layers':layers});print(i,path.name,layers,flush=True)
(out/'sources.json').write_text(json.dumps(rows,indent=2))
