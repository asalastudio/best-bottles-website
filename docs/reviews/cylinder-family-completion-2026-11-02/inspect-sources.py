"""Read-only source inspection; exports preserve native PSD layer pixels."""
from pathlib import Path
import json, hashlib
from PIL import Image, ImageDraw
from psd_tools import PSDImage

base = Path('docs/reviews/cylinder-family-completion-2026-11-02')
out = base / 'sources'
out.mkdir(exist_ok=True)
library = json.loads(Path('docs/reviews/cylinder-master-materials-2026-10-31/family-inventory.json').read_text())['rows']
master_rows = [r for r in library if r['capacityMl'] in [25,28,30,50,100]]
records, previews = [], []
for r in master_rows:
    if not r['sourceAvailable']: continue
    src = Path(r['sourceFile'])
    raw = src.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == r['fileSha256']
    im = Image.open(src).convert('RGBA')
    records.append({'kind':'body','plateKey':r['plateKey'],'file':str(src),'sha256':r['fileSha256'],'size':im.size,'alphaBounds':im.getbbox(),'anchors':r['anchors'],'scale':r['scale']})
    previews.append((r['plateKey'], im))
for src in sorted(Path('public/images/register/tubes').glob('cylinder-*ml-18-415-clear-*')):
    if not any(src.name.startswith('cylinder-'+str(n)+'ml') for n in [50,100]): continue
    raw=src.read_bytes(); im=Image.open(src).convert('RGBA')
    records.append({'kind':'old-tube','file':str(src),'sha256':hashlib.sha256(raw).hexdigest(),'size':im.size,'alphaBounds':im.getbbox()})
    if 'exploded' not in src.name and 'tassel' not in src.name: previews.append((src.stem,im))
root = Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master')
selected = [root/'13. 16 mm/2. 28ml  Uncapped/1. GBCyl28MtlRollBlk.psd',root/'13. 16 mm/4. 50ml Uncapped/3. GBCyl50MtlRollBlk.psd', root/'18. Perfume Glass Bottles with Metal Decoration/GBSpry1ozSl.psd']
for src in selected:
    psd=PSDImage.open(src)
    record={'kind':'psd','file':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'size':psd.size,'layers':[]}
    for i,layer in enumerate(psd.descendants()):
        record['layers'].append({'index':i,'name':layer.name,'kind':layer.kind,'visible':layer.visible,'bbox':layer.bbox})
    slug='psd-'+('28ml' if '28ml' in str(src) else '50ml' if '50ml' in str(src) else '30ml')
    im=psd.composite(); im.save(out/(slug+'-composite.png'))
    previews.append((slug,im.convert('RGBA')))
    records.append(record)
json.dump(records,open(base/'source-inspection.json','w'),indent=2)
w,h=260,600
sheet=Image.new('RGB',(w*6,h*((len(previews)+5)//6)), '#f5f3ef');d=ImageDraw.Draw(sheet)
for i,(label,im) in enumerate(previews):
    x,y=i%6*w,i//6*h
    im.thumbnail((w-30,h-70),Image.Resampling.LANCZOS)
    sheet.paste(im,(x+(w-im.width)//2,y+48),im)
    d.text((x+6,y+5),label[:34],fill='#111111')
    d.text((x+6,y+23),label[34:68],fill='#333333')
sheet.save(base/'sources-contact.png')
print(json.dumps({'sources':len(records),'previews':len(previews)}))
