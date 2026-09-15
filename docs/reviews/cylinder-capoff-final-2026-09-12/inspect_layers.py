from pathlib import Path
import importlib.util,json,hashlib
import numpy as np
from PIL import Image,ImageDraw
from psd_tools import PSDImage
ROOT=Path.cwd();OUT=ROOT/'docs/reviews/cylinder-capoff-final-2026-09-12';MASTER=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
s=importlib.util.spec_from_file_location('plategeo',ROOT/'scripts/asset-ledger/prepare-boston-plates.py');geo=importlib.util.module_from_spec(s);s.loader.exec_module(geo)
a=json.loads((ROOT/'data/asset-ledger/cylinder-approved-capoff-sources.json').read_text());output=[];tiles=[]
for r in a['entries']:
 v=next(v for v in r['views'] if v['role']=='off');file=MASTER/v['path'];assert hashlib.sha256(file.read_bytes()).hexdigest()==v['sourceSha256']
 im=Image.open(ROOT/'docs/reviews/cylinder-capoff-recovery-2026-09-12'/v['preview']);g=geo.measure(im)
 psd=PSDImage.open(file);layers=[]
 for i,l in enumerate(psd):
  if not l.is_visible():continue
  if l.left>g['right']+1 and l.top>g['topY']+(g['baseY']-g['topY'])*.4 and l.bottom>=g['baseY']-psd.height*.08:
   row={'index':i,'name':l.name,'kind':l.kind,'opacity':l.opacity,'blend':str(l.blend_mode),'bounds':list(l.bbox)};layers.append(row)
   if l.topil() is None:continue
   tile=Image.new('RGB',(250,330),'#f5f3ef');draw=ImageDraw.Draw(tile);draw.text((8,8),r['sku'],fill='black');draw.text((8,25),'layer '+str(i)+' '+l.kind,fill='black');part=l.topil().convert('RGBA');part.thumbnail((218,270));tile.paste(part,((250-part.width)//2,50),part);tiles.append(tile)
 output.append({'sku':r['sku'],'sourceSha256':v['sourceSha256'],'sourcePath':v['path'],'glass':g,'capCandidates':layers})
print('Candidate distribution', {i:sum(len(r['capCandidates'])==i for r in output) for i in range(4)})
for start in range(0,len(tiles),15):
 page=Image.new('RGB',(1250,990),'white')
 for i,tile in enumerate(tiles[start:start+15]):page.paste(tile,((i%5)*250,(i//5)*330))
 page.save(OUT/('loose-cap-layers-'+str(start//15+1)+'.png'))
(OUT/'layer-audit.json').write_text(json.dumps(output,indent=2)+'\n')
