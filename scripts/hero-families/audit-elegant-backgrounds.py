import json,csv,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
root=Path.cwd()/'output/imagegen/elegant-2026-09-23';out=root/'background-audit';out.mkdir(exist_ok=True)
manifest=json.loads((root/'active-manifest.json').read_text());aligned=json.loads((root/'aligned-exports.json').read_text())['rows'];bone=np.array([245,243,239]);rows=[]
# Fixed empty-background patches avoid all inspected product silhouettes and floor shadows.
patches={'top_center':(960,32,1120,112),'upper_left':(160,160,320,320),'upper_right':(1760,160,1920,320),'left_edge':(32,800,112,1200),'right_edge':(1968,800,2048,1200)}
for r in aligned:
 p=Path(r['finalPath']);assert hashlib.sha256(p.read_bytes()).hexdigest()==r['finalSha256'];im=Image.open(p).convert('RGB');assert im.size==(2080,2288);a=np.asarray(im,dtype=np.int16);ps={};pool=[]
 for name,(x1,y1,x2,y2) in patches.items():
  px=a[y1:y2,x1:x2].reshape(-1,3);pool.append(px);med=np.median(px,axis=0)
  ps[name]={'medianRgb':med.tolist(),'medianChannelOffset':int(np.max(np.abs(med-bone))),'p95ChannelOffset':float(np.percentile(np.max(np.abs(px-bone),axis=1),95))}
 allpx=np.concatenate(pool);d=np.abs(allpx-bone).max(axis=1);medians=np.array([v['medianRgb'] for v in ps.values()]);worst=max(v['medianChannelOffset'] for v in ps.values());spread=int(np.max(medians.max(axis=0)-medians.min(axis=0)))
 category='close-background' if worst<=3 and np.percentile(d,95)<=4 and spread<=3 else 'review-background'
 rows.append({'sku':r['sku'],'capacityMl':r['capacityMl'],'color':r['catalog']['color'],'path':str(p),'sha256':r['finalSha256'],'worstPatchMedianChannelOffset':worst,'p95ChannelOffset':float(np.percentile(d,95)),'betweenPatchChannelSpread':spread,'medianRgb':np.median(allpx,axis=0).tolist(),'exactBonePct':round(float(np.mean(d==0)*100),2),'category':category,'patches':ps})
rows.sort(key=lambda r:(-r['worstPatchMedianChannelOffset'],-r['p95ChannelOffset'],r['sku']))
missing=[r['sku'] for r in manifest['rows'] if r['sku'] not in {x['sku'] for x in rows}]
report={'target':{'hex':'#F5F3EF','rgb':bone.tolist()},'count':len(rows),'notGenerated':missing,'method':'Five fixed empty-background patches; no bottle, glass, hardware or floor-shadow sampling. Values are 8-bit sRGB channel differences, not perceptual color units. Triage thresholds are conservative working criteria, not user-approved tolerances. Visual inspection on exact bone required.','patches':patches,'closeCriteria':'worst patch median <=3/255; sampled p95 <=4/255; between-patch spread <=3/255','rows':rows}
(out/'audit.json').write_text(json.dumps(report,indent=2)+'\n')
with (out/'audit.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=['sku','capacityMl','color','category','medianRgb','worstPatchMedianChannelOffset','p95ChannelOffset','betweenPatchChannelSpread','exactBonePct']);w.writeheader();w.writerows({k:r[k] for k in w.fieldnames} for r in rows)
font=lambda n:ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',n)
for page in range(0,len(rows),8):
 rr=rows[page:page+8];sheet=Image.new('RGB',(1200,1080),tuple(bone));draw=ImageDraw.Draw(sheet);draw.text((24,14),f'Elegant background audit · {page+1}–{page+len(rr)} of {len(rows)}',font=font(24),fill='#282722');draw.text((24,49),'Exact #F5F3EF surroundings · largest background deviations first · originals unchanged',font=font(16),fill='#282722')
 for i,r in enumerate(rr):
  x=(i%4)*300;y=90+(i//4)*490;im=Image.open(r['path']).convert('RGB');im.thumbnail((260,286),Image.Resampling.LANCZOS);sheet.paste(im,(x+20,y+12));draw.text((x+15,y+313),f"{r['capacityMl']} mL · {r['color']}",font=font(17),fill='#282722');draw.text((x+15,y+342),r['sku'],font=font(12),fill='#282722');draw.text((x+15,y+364),f"Worst median offset: {r['worstPatchMedianChannelOffset']}/255",font=font(15),fill='#282722');draw.text((x+15,y+386),f"P95: {r['p95ChannelOffset']:.0f} · spread: {r['betweenPatchChannelSpread']}",font=font(14),fill='#282722');draw.rectangle((x+15,y+421,x+140,y+461),fill=tuple(bone));draw.rectangle((x+140,y+421,x+265,y+461),fill=tuple(int(v) for v in r['medianRgb']));draw.text((x+18,y+430),'Target',font=font(13),fill='#282722');draw.text((x+145,y+430),'Image median',font=font(13),fill='#282722')
 sheet.save(out/f'page-{page//8+1}.png')
print(json.dumps({'count':len(rows),'missing':missing,'close':sum(r['category']=='close-background' for r in rows),'flagged':[{'sku':r['sku'],'offset':r['worstPatchMedianChannelOffset'],'p95':r['p95ChannelOffset'],'spread':r['betweenPatchChannelSpread'],'rgb':r['medianRgb']} for r in rows if r['category']!='close-background']}))
