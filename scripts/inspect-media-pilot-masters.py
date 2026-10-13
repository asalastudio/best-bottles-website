#!/usr/bin/env python3
"""Read-only master inspection; export embedded previews and retain exact source hashes."""
import argparse,hashlib,json
from pathlib import Path
from datetime import datetime,timezone
from psd_tools import PSDImage
p=argparse.ArgumentParser();p.add_argument('--master',required=True,type=Path);p.add_argument('--out',required=True,type=Path);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
patterns={
 'round-clear-exposed':'2.  18-415 Bottles /9. Round 78ml/1. Round 78ml PSD/29. GBRnd78SpryShnSl.psd',
 'round-clear-capped':'2.  18-415 Bottles /9. Round 78ml/1. Round 78ml PSD/30. GBRnd78SpryShnSl.psd',
 'round-frosted-exposed':'2.  18-415 Bottles /8. Round 78ml Frosted/1. Round Frst 78ml Psd/29. GBRndFrst78SpryShnSl.psd',
 'round-frosted-capped':'2.  18-415 Bottles /8. Round 78ml Frosted/1. Round Frst 78ml Psd/30. GBRndFrst78SpryShnSl.psd',
 'tassel-black':'20. Caps/10. 18-415 Ansp Tsl/41. AnspTsl18-415Blk.psd',
 'tassel-ivory':'20. Caps/10. 18-415 Ansp Tsl/37. AnspTsl18-415IvySl.psd',
 'tassel-red':'20. Caps/10. 18-415 Ansp Tsl/40. AnspTsl18-415Red.psd',
 'tassel-white':'20. Caps/10. 18-415 Ansp Tsl/38. AnspTsl18-415Wht.psd',
 'boston15-black-silver-component':'20. Caps/4. 18-400 Droppers/3. DRP18-40015mlShnSlTrimBlkBulb.psd',
}
for key,pattern in [('boston15-amber','2. GBBstnAmb15mlBlkDropperSlTrim.psd'),('boston15-cobalt','2. GBBstnBlu15mlBlkDropperSlTrim.psd')]:
 matches=list(a.master.rglob(pattern));assert len(matches)==1,(key,matches);patterns[key]=str(matches[0].relative_to(a.master))
exports={
 'round-clear-exposed':['Layer 25','Layer 22'],
 'round-clear-capped':['Layer 27'],
 'round-frosted-exposed':['Layer 9'],
 'boston15-black-silver-component':['Layer 8','Layer 3'],
 'tassel-black':['Layer 2','Layer 3'],
}
rows=[]
for key,relative in patterns.items():
 file=a.master/relative
 with file.open('rb') as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
 psd=PSDImage.open(file);image=psd.topil();preview=key+'-embedded.png';image.save(a.out/preview)
 layers=[{'index':i,'name':l.name,'kind':l.kind,'visible':l.visible,'opacity':l.opacity,'blendMode':str(l.blend_mode),'bbox':list(l.bbox),'hasMask':l.has_mask()} for i,l in enumerate(psd.descendants())]
 parts=[]
 for name in exports.get(key,[]):
  found=[l for l in psd.descendants() if l.name==name]
  assert len(found)==1,(key,name)
  layer=found[0];part=layer.composite();assert part is not None,(key,name)
  filename=key+'--'+name.lower().replace(' ','-')+'.png';part.save(a.out/filename)
  parts.append({'layerName':name,'bbox':list(layer.bbox),'file':filename,'width':part.width,'height':part.height,'sha256':hashlib.sha256((a.out/filename).read_bytes()).hexdigest(),'method':'unmodified PSD layer composite; no cleanup, rescaling or registration'})
 rows.append({'parts':parts,'key':key,'relativePath':relative,'sha256':sha,'canvas':list(psd.size),'preview':preview,'layers':layers})
 print(key,list(psd.size),[(l['index'],l['name'],l['visible'],l['bbox']) for l in layers],flush=True)
(a.out/'master-inspection.json').write_text(json.dumps({'inspectedAt':datetime.now(timezone.utc).isoformat(),'masterRoot':str(a.master),'status':'source inspection only; not artwork acceptance','sources':rows},indent=2)+'\n')
