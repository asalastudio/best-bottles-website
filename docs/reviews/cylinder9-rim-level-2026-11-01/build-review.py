from pathlib import Path
from PIL import Image
from statistics import median
import json,hashlib,shutil,math
root=Path.cwd();name='cylinder9-rim-level-2026-11-01';doc=root/'docs/reviews'/name;pub=root/'public/reviews'/name
doc.mkdir(parents=True,exist_ok=True);pub.mkdir(parents=True,exist_ok=True)
files=[('before','Before · Sunburst v01',root/'docs/reviews/cylinder9-sunburst-2026-11-01/BB_Cylinder_9ml_17-415_Clear_BODY_Sunburst-v01_REVIEW_2026-11-01.png','before-v01.png'),('after','After · level-rim v02',root/'output/imagegen'/name/'cylinder9-clear-rim-level-v02.png','BB_Cylinder_9ml_17-415_Clear_BODY_Sunburst-Level-Rim-v02_REVIEW_2026-11-01.png')]
data=[]
for role,label,path,dest in files:
 shutil.copy2(path,doc/dest);shutil.copy2(path,pub/dest);im=Image.open(path);a=im.getchannel('A');b=a.point(lambda x:255 if x>=128 else 0).getbbox();w=b[2]-b[0];h=b[3]-b[1];rows=[]
 for x in range(round(b[0]+w*.25),round(b[0]+w*.75)):
  ys=[y for y in range(max(0,b[1]-15),min(im.height-3,b[1]+50)) if all(a.getpixel((x,y+j))>=192 for j in range(3))]
  if ys:rows.append((x,ys[0]))
 xm=sum(x for x,y in rows)/len(rows);ym=sum(y for x,y in rows)/len(rows);slope=sum((x-xm)*(y-ym) for x,y in rows)/sum((x-xm)**2 for x,y in rows);n=max(1,len(rows)//5)
 hp=(43.5*1971/1619)*im.height/h;wp=hp*1.1*im.width/im.height
 data.append({'role':role,'label':label,'file':dest,'size':list(im.size),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'alphaBounds128':b,'rimAngleDegrees':math.degrees(math.atan(slope)),'rightMinusLeftMedianY':median(y for x,y in rows[-n:])-median(y for x,y in rows[:n]),'centralRimYRange':[min(y for x,y in rows),max(y for x,y in rows)],'outlineAspectDriftFromV01Pct':((w/h)/(511/1887)-1)*100,'fullPlacement':{'width':wp,'height':hp,'left':50-wp*(b[0]+b[2])/2/im.width,'top':91-hp*b[3]/im.height}})
shutil.copy2(root/'output/imagegen'/name/'prompt.txt',doc/'prompt.txt')
measurement={'images':data,'method':'Find first three consecutive alpha>=192 pixels per column over the central half of the opaque body bounds. Fit a line through the upper rim and compare medians of the outer fifths. This is an edge-level diagnostic, not dimensional certification.','generator':'gpt-image-2.5-sunburst via imagegen skill CLI','generationCount':1,'seconds':20.2,'sourceScale':{'shoulderToBasePct':43.5,'baselinePct':91},'pixelIdenticalOutsideRim':False,'status':'rim improved; complete asset remains in review due to alpha fringe and material/fit checks','assignmentChanged':False}
(doc/'measurements.json').write_text(json.dumps(measurement,indent=2)+'\n');(pub/'data.json').write_text(json.dumps(measurement,indent=2)+'\n')
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>9 ml Cylinder | Level rim comparison</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ef;color:#252525;font:15px/1.5 system-ui,sans-serif}main{max-width:1160px;margin:auto;padding:26px}h1{font-size:30px;font-weight:500}h2{font-size:18px;font-weight:500;margin:10px 0}.eyebrow{font-size:11px;letter-spacing:.15em;color:#8c6b3a}p{max-width:920px}a{color:#35564c}button{font:inherit;padding:9px 14px;border:1px solid #ccc;background:white;cursor:pointer;margin:6px 8px 12px 0}button[aria-pressed=true]{background:#252525;color:white}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{border:1px solid #d6cfc2;background:#f5f3ef;padding:16px}.zoom{position:relative;aspect-ratio:460/435;overflow:hidden;background:#f5f3ef}.zoom img{position:absolute;max-width:none;width:161.521739%;height:auto;left:-30.434783%;top:-19.540230%}.guide{display:none;position:absolute;top:7.586207%;left:4%;right:4%;height:1px;border-top:1px dashed #b75e28;z-index:2}.guided .guide{display:block}.dark .zoom,.dark .stage{background:#292929}.stage{position:relative;aspect-ratio:10/11;overflow:hidden;background:#f5f3ef}.stage img{position:absolute;max-width:none}.baseline{position:absolute;left:8%;right:8%;top:91%;height:1px;background:#cfc5b4}.note{padding:15px 18px;background:#eae5da;border-left:3px solid #a7834c;margin:22px 0}summary{cursor:pointer;margin:22px 0 10px}small{color:#626262}footer{font-size:12px;margin-top:25px;color:#666}@media(max-width:700px){main{padding:15px}.pair{grid-template-columns:1fr}h1{font-size:25px}}
</style><main><div class="eyebrow">BEST BOTTLES / CYLINDER 9 ML / 17-415</div><h1>The top rim, leveled</h1><p>One targeted Sunburst edit makes the upper lip flatter and more even. Compare the necks below at the same image scale. The thread helix remains separate from the horizontal top lip.</p><button id="guide" aria-pressed="false">Show level guide</button><button id="dark" aria-pressed="false">Dark background</button><div class="pair" id="rim-closeup"></div><div class="note"><strong>Rim correction improved.</strong><p>The measured left-to-right edge difference is now 1 pixel, down from 3 pixels. The fitted edge tilt is about 0.14°, down from 0.97°. The overall outline aspect changed by +0.22% from v01.</p><p>The original is preserved. The generated image is not pixel-identical outside the rim, and existing alpha fringe remains. This revision has no product-page or builder assignment yet.</p></div><details><summary>Compare complete bottles at the shared scale</summary><div class="pair" id="bodies"></div></details><p><a href="../cylinder9-sunburst-2026-11-01/index.html">Original material comparison</a> · <a href="DRIVE_URL">Labeled Drive folder</a></p><footer>Native PNGs preserved without raster retouching or stretching. Exact prompt and edge measurements accompany the files. No merge, deployment or active-master replacement.</footer></main><script>
fetch('data.json').then(r=>r.json()).then(d=>{for(const x of d.images){const card=document.createElement('section');card.className='card';const h=document.createElement('h2');h.textContent=x.label;const z=document.createElement('div');z.className='zoom';const im=document.createElement('img');im.src=x.file;im.alt=x.label+' neck';const line=document.createElement('span');line.className='guide';z.append(im,line);card.append(h,z);document.querySelector('#rim-closeup').append(card);const full=document.createElement('section');full.className='card';const title=document.createElement('h2');title.textContent=x.label;const stage=document.createElement('div');stage.className='stage';const foot=document.createElement('span');foot.className='baseline';const image=document.createElement('img');image.src=x.file;image.alt=x.label+' bottle';for(const [k,v] of Object.entries(x.fullPlacement))image.style[k]=v+'%';stage.append(foot,image);const a=document.createElement('a');a.href=x.file;a.target='_blank';a.textContent='Open native PNG';full.append(title,stage,a);document.querySelector('#bodies').append(full)}});document.querySelector('#guide').onclick=e=>{const on=document.body.classList.toggle('guided');e.target.setAttribute('aria-pressed',String(on));e.target.textContent=on?'Hide level guide':'Show level guide'};document.querySelector('#dark').onclick=e=>{const on=document.body.classList.toggle('dark');e.target.setAttribute('aria-pressed',String(on));e.target.textContent=on?'Catalog background':'Dark background'};
</script></html>'''
html=html.replace('DRIVE_URL','https://drive.google.com/drive/folders/1Ytrfo7QxC6FpxbUOEDRsKb0QeWqp3V7H');(pub/'index.html').write_text(html)
runtime=doc/'runtime/public/reviews'/name;runtime.mkdir(parents=True,exist_ok=True)
for p in pub.iterdir():shutil.copy2(p,runtime/p.name)
(doc/'README.md').write_text('''# Cylinder 9 ml level-rim revision v02

One high-quality GPT 2.5 Sunburst edit corrected the top lip after Jordan flagged its downward slope toward the left. The input was the full native Sunburst v01 PNG. The attached screenshot identified the defect; it was not uploaded to the API. The exact instruction is in prompt.txt.

The generated v02 is 743 × 2116 px. The upper-edge diagnostic improved from a 3 px left-to-right median difference to 1 px, and fitted tilt from 0.973° to 0.143°. Overall opaque-outline aspect changed +0.215% from v01. The rim looks more level in the close-up. The native output is preserved and no pixel edit or geometric stretch was applied afterward.

The model changed pixels outside the requested rim. The original and both generated versions are retained. Residual alpha fringe remains, and material/fit approval is still pending. No product-page or builder assignment changed.

The full-bottle comparison uses the source's approved 43.5% shoulder-to-base target and 91% baseline with uniform scaling. The neck comparison is a CSS viewport on both native images at identical image scale.

Local review: http://localhost:3010/reviews/cylinder9-rim-level-2026-11-01/index.html

Drive: https://drive.google.com/drive/folders/1Ytrfo7QxC6FpxbUOEDRsKb0QeWqp3V7H

Restore: node docs/reviews/cylinder9-rim-level-2026-11-01/restore.mjs --apply

No merge, deployment, database change or live media replacement.
''')
shutil.copy2(root/'docs/reviews/cylinder9-sunburst-2026-11-01/restore.mjs',doc/'restore.mjs')
ignore=root/'.gitignore';text=ignore.read_text()
for line in ['/public/reviews/'+name+'/', '/output/imagegen/'+name+'/']:
 if line not in text:text+='\n'+line+'\n'
ignore.write_text(text)
b=root/'docs/reviews/family-master-library-2026-11-01/BATCHES.md';text=b.read_text();row='| 2026-11-01 Cylinder 9 ml level-rim v02 | 1 clear body revision | Top edge leveled; full asset remains in review, no active assignment | [Level-rim batch](https://drive.google.com/drive/folders/1Ytrfo7QxC6FpxbUOEDRsKb0QeWqp3V7H) |\n'
if row not in text:text=text.replace('\nApproved files remain separate.',row+'\nApproved files remain separate.');b.write_text(text)
print(json.dumps(measurement))
