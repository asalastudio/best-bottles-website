from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib,shutil
R=Path('output/cylinder-hover-batch-02');sku='GBCylAmb9MtlRollMattGl';p=Path('public/preview/cylinder-hover-batch-02')/(sku+'-on.png');original=R/(sku+'-on-before-amber-grade.png')
if not original.exists():shutil.copy2(p,original)
im=Image.open(original).convert('RGB');a=np.asarray(im).astype(float);hsv=np.asarray(im.convert('HSV')).astype(float);h=hsv[:,:,0]/255;s=hsv[:,:,1]/255
# Global orange/amber tonal correction. No geometry changes, object cutouts,
# background replacements, or spatial masks. Protect gold-yellow highlights.
def smooth(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
w=smooth((h-.025)/.025)*(1-smooth((h-.10)/.035))*smooth((s-.22)/.22)
b=np.rint(np.clip(a*(1-.13*w[:,:,None]),0,255)).astype('uint8');Image.fromarray(b).save(p);shutil.copy2(p,R/'normalized'/p.name)
report={'sku':sku,'state':'on','method':'Global amber hue-range brightness reduction, maximum 13 percent; no resampling or spatial masking','original':str(original),'output':str(p),'dimensions':im.size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'meanBodyLuminanceBefore':float(a[1150:1900,970:1110].mean()),'meanBodyLuminanceAfter':float(b[1150:1900,970:1110].mean()),'backgroundPatchUnchanged':bool(np.array_equal(a[:300,:300],b[:300,:300]))}
(R/'amber-hover-grade.json').write_text(json.dumps(report,indent=2));m=Path('docs/reviews/cylinder-hover-batch-02-2026-09-05.json');data=json.loads(m.read_text());next(r for r in data['files'] if r['sku']==sku and r['state']=='on')['sha256']=report['sha256'];data['amberHoverRevision']=report;m.write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(report))
html=p.parent/'index.html';t=html.read_text();import re;t=re.sub(sku+r'-on.png(?:\?v=[^\"]+)?',sku+'-on.png?v='+report['sha256'][:10],t);html.write_text(t)
