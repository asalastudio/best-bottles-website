"""User-approved whole-frame transforms and global highlight grading; no object masks.
Originals remain untouched. Work from originals once, never from prior exports.
"""
import json,hashlib
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path('output/cylinder-hover-batch-02'); OUT=ROOT/'normalized';OUT.mkdir(exist_ok=True)
rows=json.load(open(ROOT/'geometry-anchors.json'))
W,H=2080,2288; BASE=round(H*.91); CENTER=W/2
patches=[(.05,.05),(.45,.05),(.85,.05),(.05,.3),(.85,.3),(.05,.65),(.85,.65)]
target=np.array([245.,243.,239.]);report=[]
def patchmean(a):
    return np.array([a[round(H*y):round(H*y)+100,round(W*x):round(W*x)+100].mean((0,1)) for x,y in patches])
for i,r in enumerate(rows):
    # The cobalt trio uses the approved-looking roller body's reference dimensions.
    ref={'width':r['targetWidth'],'bodyHeight':r['targetBodyHeight']}
    for state in ['off','on']:
        
        if state not in r: continue
        m=r[state];im=Image.open(m['source']).convert('RGB')
        sx=ref['width']/m['width'];sy=ref['bodyHeight']/m['bodyHeight']
        nw=round(W*sx);nh=round(H*sy)
        x=round(CENTER-m['center']/1196*nw);y=round(BASE-m['base']/1315*nh)
        # Single high quality resample of entire original. Edge extension uses existing
        # frame-edge pixels, never pasted background rectangles or subject cutouts.
        a=np.asarray(im.resize((nw,nh),Image.Resampling.LANCZOS))
        pl,pt=max(x,0),max(y,0);pr,pb=max(W-x-nw,0),max(H-y-nh,0)
        a=np.pad(a,((pt,pb),(pl,pr),(0,0)),mode='edge')
        xx=max(-x,0);yy=max(-y,0);a=a[yy:yy+H,xx:xx+W].astype(np.float32)
        original=patchmean(a);delta=target-original.mean(0)
        # Global, luminance-dependent highlight grade. Same formula for every pixel;
        # saturated bottle colors and dark details stay unchanged. No spatial masking.
        graded=np.empty_like(a)
        for channel in range(3):
            anchor=float(original.mean(0)[channel])
            low,high=target[channel]-10,min(254.9,target[channel]+10)
            samples=np.concatenate([a[round(H*y):round(H*y)+100,round(W*x):round(W*x)+100,channel].ravel() for x,y in patches])
            for _ in range(18):
                mid=(low+high)/2
                mean=np.interp(samples,[0,150,anchor,255],[0,150,mid,255]).mean()
                if mean<target[channel]:low=mid
                else:high=mid
            graded[:,:,channel]=np.interp(a[:,:,channel],[0,150,anchor,255],[0,150,(low+high)/2,255])
        graded=np.rint(graded).astype(np.uint8)
        p=OUT/f"{r['sku']}-{state}.png";Image.fromarray(graded).save(p)
        actual=patchmean(graded)
        report.append({'sku':r['sku'],'state':state,'source':m['source'],'output':str(p),'scaleX':sx,'scaleY':sy,'translation':[x,y],'bodyWidthPx':ref['width']/1196*W,'bodyHeightPx':ref['bodyHeight']/1315*H,'baselinePx':BASE,'centerPx':CENTER,'gradeRGB':delta.tolist(),'backgroundMeanRGB':actual.mean(0).tolist(),'backgroundPatchRGB':actual.tolist(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
json.dump({'method':'whole-image scale/translation, source-edge extension, global highlight grade; no cutouts, no regeneration','userAuthorized':True,'canvas':[W,H],'baseline':BASE,'rows':report},open(ROOT/'normalization-report.json','w'),indent=2)
print('Prepared',len(report),'normalized images; max background mean channel error:',max(abs(np.array(r['backgroundMeanRGB'])-target).max() for r in report))
