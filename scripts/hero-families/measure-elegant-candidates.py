"""Read-only edge diagnostics for generated Elegant images; human review required."""
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks
ROOT=Path('output/imagegen/elegant-2026-09-23')
manifest=json.loads((ROOT/('active-manifest.json' if (ROOT/'active-manifest.json').exists() else 'manifest.json')).read_text())
out=ROOT/'measurement-review';out.mkdir(exist_ok=True)
rows=[]
for r in manifest['rows']:
 p=Path(r['rawOutput'])
 if not p.with_suffix('.render.json').exists():continue
 im=Image.open(p).convert('RGB');a=np.asarray(im,dtype=float);g=a.mean(axis=2)
 target=r['target'];span=2288*target['shoulderPct']/100;sy=2288*(91-target['shoulderPct'])/100;fy=2082.08
 aspect={15:1.358,30:1.381,60:1.253,100:1.517}[r['capacityMl']]
 width=span/aspect;cx=2080*target['bodyCenterXPct']/100
 mid=round((sy+fy)/2)
 dx=np.abs(np.diff(g[mid-60:mid+60],axis=1)).mean(axis=0)
 def edge(center):
  lo=max(0,round(center-100));hi=min(2078,round(center+100));return lo+int(np.argmax(gaussian_filter1d(dx[lo:hi],2)))
 left,right=edge(cx-width/2),edge(cx+width/2);cx=(left+right)/2
 # Omit closure center and glass edges; sample shoulder wings and lower body.
 xx=list(range(round(left+.14*(right-left)),round(left+.32*(right-left))))+list(range(round(left+.68*(right-left)),round(left+.86*(right-left))))
 dy=np.abs(np.diff(g[:,xx],axis=0)).mean(axis=1)
 smooth=gaussian_filter1d(dy,2)
 def peaks(center,window):
  lo=max(0,round(center-window));hi=min(2286,round(center+window));ps,_=find_peaks(smooth[lo:hi],distance=8,prominence=.15)
  return sorted([{'y':int(v+lo),'strength':round(float(smooth[v+lo]),3)} for v in ps],key=lambda x:x['strength'],reverse=True)[:8]
 shoulderPeaks=peaks(sy,150);footPeaks=peaks(fy,150)
 # Outer boundary precedes internal glass refraction at the shoulder; the glass
 # foot follows the inner cavity. Keep alternatives visible for manual checking.
 shoulder=min(p['y'] for p in shoulderPeaks if p['strength']>=shoulderPeaks[0]['strength']*.35) if shoulderPeaks else round(sy)
 foot=max(p['y'] for p in footPeaks if p['strength']>=footPeaks[0]['strength']*.4) if footPeaks else round(fy)
 rr={'sku':r['sku'],'bodyLeft':left,'bodyRight':right,'centerX':cx,'candidateShoulderY':shoulder,'candidateFootY':foot,'shoulderPeaks':shoulderPeaks,'footPeaks':footPeaks,'status':'unverified-candidates-not-locks'};rows.append(rr)
 # Full-scene small view, plus 1:1 vertical-coordinate crops around both landmarks.
 canvas=Image.new('RGB',(960,660),(245,243,239));preview=im.resize((520,572));canvas.paste(preview,(0,40));d=ImageDraw.Draw(canvas)
 d.text((8,8),r['sku'],fill=(0,0,0))
 for y,color in [(shoulder,(180,130,30)),(foot,(0,130,110))]:d.line((0,40+y/4,520,40+y/4),fill=color,width=2)
 for offset,(center,points) in enumerate([(sy,shoulderPeaks),(fy,footPeaks)]):
  top=round(center-140);bottom=round(center+140);x0=max(0,round(cx-200));crop=im.crop((x0,top,x0+400,bottom));canvas.paste(crop,(550,40+offset*300));dd=ImageDraw.Draw(canvas)
  for yy in range((top//20+1)*20,bottom,20):dd.line((550,40+offset*300+yy-top,950,40+offset*300+yy-top),fill=(170,180,180));dd.text((552,40+offset*300+yy-top),str(yy),fill=(0,60,60))
 canvas.save(out/(r['sku']+'.jpg'),quality=94)
(ROOT/'candidate-landmarks.json').write_text(json.dumps(rows,indent=2)+'\n')
print('Unverified measurement candidates:',len(rows))
