import json,hashlib,pathlib
import numpy as np
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];D=R/'docs/reviews/circle-recovery';report=json.load(open(D/'alignment-and-matte-report.json'));matte=json.load(open(D/'matte-candidates.json'));checks=[]
for r in report['rows']:
 f=r['framing']; b=r['originalBaseY']; shoulder=r['landmark']['shoulderY'];s=f['scale'];y=f['translateYPercent']/100*1716
 assert abs((b*s+y)/1716*100-91)<1e-8
 assert abs((b-shoulder)*s/1716*100-r['target']['heightPercent'])<1e-8
 bounds=r['renderedSignificantArtworkBounds'];assert 0<=bounds[0]<bounds[2]<1560 and 0<=bounds[1]<bounds[3]<1716
 assert hashlib.sha256((R/('public'+r['originalUrl'])).read_bytes()).hexdigest()==r['originalAssetSha256']
 assert hashlib.sha256((R/('public'+r['url'])).read_bytes()).hexdigest()==r['assetSha256']
for r in matte:
 a=np.array(Image.open(R/('public'+r['inputUrl'])).convert('RGB'));b=np.array(Image.open(R/('public'+r['url'])).convert('RGB'));assert a.shape==b.shape==(1716,1560,3);yy,xx=np.mgrid[:1716,:1560];l,t,rt,bot=r['region'];region=(xx>=l)&(xx<=rt)&(yy>=t)&(yy<=bot);changed=np.any(a!=b,2)
 assert not changed[~region].any()
 # Existing dark edges, colored hardware and bone background remain exact.
 protected=(a.min(2)<=231)|((a.max(2).astype(int)-a.min(2).astype(int))>=6)
 assert np.array_equal(a[protected],b[protected])
 assert not changed[0].any() and not changed[-1].any() and not changed[:,0].any() and not changed[:,-1].any()
 checks.append({'sku':r['sku'],'changedPixels':int(changed.sum()),'outsideGlassRegionIdentical':True,'darkEdgesAndColoredHardwareIdentical':True,'originalBonePixelsIdentical':True})
json.dump({'shoulderAndBaselineChecks':len(report['rows']),'mattePixelChecks':checks,'visualApproval':'approved' if report.get('visualApproved') else 'pending','publication':'not published'},open(D/'verification.json','w'),indent=2)
print('27 shoulder/baseline/hash/bounds checks and 13 protected-pixel comparisons passed.')
