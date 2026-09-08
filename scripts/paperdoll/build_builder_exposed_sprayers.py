"""Extract exact uncapped assemblies from original master PSD layers; no reshaping."""
from pathlib import Path
import json, hashlib, re
from psd_tools import PSDImage
from PIL import Image,ImageDraw
ROOT=Path('/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master')
REPO=Path(__file__).resolve().parents[2]
OUT=REPO/'public/images/bottle-builder/exposed'
OUT.mkdir(exist_ok=True,parents=True)
assemblies=json.loads((REPO/'src/lib/bottle-builder/circle-assemblies.generated.json').read_text())
files=list(ROOT.rglob('*.psd'))
manifest={};review=[]
for sku in assemblies:
 if 'Spry' not in sku:continue
 candidates=[p for p in files if (re.sub(r'^\d+\.\s*','',p.stem)==sku or (sku=='GBCrcl15SprySlSh' and re.sub(r'^\d+\.\s*','',p.stem)=='GBCrcl15SprySlSh copy'))]
 candidates.sort(key=lambda p: ('Uncapped' not in str(p),len(str(p)),str(p)))
 for path in candidates:
  psd=PSDImage.open(path);layers=list(psd)
  if not 4 <= len(layers) <= 7 or any(l.kind!='pixel' for l in layers):continue
  # These sources contain one background, bare bottle, dip tube, sprayer and detached cover.
  if layers[0].bbox!=(0,0,psd.width,psd.height):continue
  body=max(layers[1:],key=lambda l:l.width*l.height)
  caps=[l for l in layers[1:] if l.left>=body.right]
  # Exact reviewed uncapped copper source: detached cover bounds overlap the
  # glass bounds by two transparent edge pixels; retain its original geometry.
  if sku=='GBCrclFrst100SpryCu' and path.name=='54. GBCrclFrst100SpryCu.psd':caps=[layers[3]]
  if len(caps)!=1:continue
  cap=caps[0];mechanisms=[l for l in layers[1:] if l is not body and l is not cap]
  sprayer=min(mechanisms,key=lambda l:l.top)
  if not (sprayer.top<body.top and body.left<sprayer.left<sprayer.right<body.right):continue
  selected=[l for l in layers[1:] if l is not cap]
  canvas=Image.new('RGBA',psd.size)
  for l in selected:canvas.alpha_composite(l.composite(),(l.left,l.top))
  box=canvas.getchannel('A').getbbox();canvas=canvas.crop(box);canvas.thumbnail((1000,1200),Image.Resampling.LANCZOS)
  full=OUT/(sku+'.webp');canvas.save(full,'WEBP',lossless=True)
  mechanism=Image.new('RGBA',(sprayer.width,sprayer.height))
  for l in mechanisms:
   if l.left>=sprayer.left and l.top>=sprayer.top and l.right<=sprayer.right and l.bottom<=sprayer.bottom:
    mechanism.alpha_composite(l.composite(),(l.left-sprayer.left,l.top-sprayer.top))
  mechanism.thumbnail((400,500),Image.Resampling.LANCZOS)
  thumb=OUT/(sku+'-sprayer.webp');mechanism.save(thumb,'WEBP',lossless=True)
  manifest[sku]={'url':'/images/bottle-builder/exposed/'+full.name,'mechanismUrl':'/images/bottle-builder/exposed/'+thumb.name,'width':canvas.width,'height':canvas.height}
  review.append({'sku':sku,'source':str(path.relative_to(ROOT)),'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'assemblyLayers':[layers.index(l) for l in selected],'sprayerLayer':layers.index(sprayer),'excludedCoverLayer':layers.index(cap),'outputSha256':hashlib.sha256(full.read_bytes()).hexdigest()})
  break
(REPO/'src/lib/bottle-builder/exposed-sprayers.generated.json').write_text(json.dumps(manifest,indent=2)+'\n')
(REPO/'data/paper-doll/exposed-sprayer-source-review.json').write_text(json.dumps(review,indent=2)+'\n')
sheet=Image.new('RGB',(1000,((len(manifest)+7)//8)*210),'#eeebe5');draw=ImageDraw.Draw(sheet)
for i,(sku,m) in enumerate(manifest.items()):
 im=Image.open(REPO/'public'/m['url'].lstrip('/'));im.thumbnail((110,175));x=i%8*125;y=i//8*210;sheet.paste(im,(x+(125-im.width)//2,y),im);draw.text((x+2,y+178),sku.replace('GBCrcl',''),fill='black')
sheet.save('/tmp/exposed-sprayers-review.jpg')
print('Exported',len(manifest),'exact sprayer assemblies; missing:',[s for s in assemblies if 'Spry' in s and s not in manifest])
