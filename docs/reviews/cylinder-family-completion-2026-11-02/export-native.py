from pathlib import Path
import json, hashlib
from PIL import Image,ImageDraw
from psd_tools import PSDImage
base=Path('docs/reviews/cylinder-family-completion-2026-11-02')
root=Path('/Users/jordanrichter/Projects/Asala/Clients/Nemat-International/BB-PSD-Files-Master')
records=[];previews=[]
files=[
('28-metal-black','13. 16 mm/2. 28ml  Uncapped/1. GBCyl28MtlRollBlk.psd'),
('28-plastic-white','13. 16 mm/2. 28ml  Uncapped/4.  GBCyl28RollWht.psd'),
('50-metal-black','13. 16 mm/4. 50ml Uncapped/3. GBCyl50MtlRollBlk.psd'),
('50-plastic-white','13. 16 mm/4. 50ml Uncapped/2. GBCyl50RollWht.psd'),
('30-classic-silver','18. Perfume Glass Bottles with Metal Decoration/GBSpry1ozSl.psd')]
for slug,rel in files:
    src=root/rel;psd=PSDImage.open(src)
    source={'file':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'canvas':psd.size,'layers':[]}
    for i,l in enumerate(psd.descendants()):
        if l.name in ['Background','Layer 0'] or l.kind!='pixel':continue
        im=l.topil()
        if im is None:continue
        file=base/'sources'/(slug+'-layer-'+str(i)+'.png');im.save(file)
        source['layers'].append({'index':i,'name':l.name,'bbox':l.bbox,'visible':l.visible,'opacity':l.opacity,'file':str(file),'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'size':im.size,'alphaBounds':im.getbbox()})
        previews.append((slug+' L'+str(i),im.convert('RGBA')))
    records.append(source)
json.dump(records,open(base/'native-layer-exports.json','w'),indent=2)
w,h=250,410;sheet=Image.new('RGB',(w*6,h*((len(previews)+5)//6)),'#f5f3ef');d=ImageDraw.Draw(sheet)
for i,(label,im) in enumerate(previews):
    x,y=i%6*w,i//6*h;im.thumbnail((w-20,h-40),Image.Resampling.LANCZOS)
    sheet.paste(im,(x+(w-im.width)//2,y+30),im);d.text((x+5,y+5),label,fill='#111111')
sheet.save(base/'native-layers-contact.png')
print(json.dumps({'files':len(records),'layers':len(previews)}))
