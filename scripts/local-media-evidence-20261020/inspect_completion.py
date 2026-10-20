from pathlib import Path
from psd_tools import PSDImage
from PIL import Image,ImageDraw
import json,hashlib,numpy as np
R=Path('/private/tmp/best-bottles-empire-alpha-20261019');O=R/'output/empire-completion-pilot';rows=json.loads((O/'psd-inventory.json').read_text());chosen=[]
for row in rows:
 p=Path(row['path']);n=int(p.name.split('.')[0]);size=50 if '50ml/' in str(p) else 100
 if n not in ([13,15,19,23,29,59,57,56] if size==50 else [13,15,19,23,29,56,51,52]):continue
 psd=PSDImage.open(p);im=list(psd)[2].composite();im.save(O/(p.stem+'-tube.png'))
 a=np.array(im)[:,:,3];ys=np.flatnonzero((a>10).any(axis=1));runs=np.split(ys,np.where(np.diff(ys)>1)[0]+1)
 print(p.name,'tube',im.size,'runs',[(int(r[0]),int(r[-1])) for r in runs], 'rgba',hashlib.sha256(im.tobytes()).hexdigest()[:12])
 if 'Wht' in p.name:
  list(psd)[3].composite().save(O/(p.stem+'-hardware.png'))
 chosen.append((p.stem,im))
canvas=Image.new('RGB',(len(chosen)*150,950),'#e9e6de');d=ImageDraw.Draw(canvas)
for i,(name,im) in enumerate(chosen):
 im.thumbnail((140,850));canvas.paste(im,(i*150,70),im);d.text((i*150+3,5),name.replace(' ','\n',1).replace('GBEmp','').replace('LBEmp',''),fill='black')
canvas.save(O/'source-tubes-contact.png')
