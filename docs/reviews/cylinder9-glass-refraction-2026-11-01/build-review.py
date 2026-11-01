from pathlib import Path
from PIL import Image
from statistics import median, mean
import json, hashlib, shutil, math
root=Path.cwd();name='cylinder9-glass-refraction-2026-11-01';doc=root/'docs/reviews'/name;pub=root/'public/reviews'/name
pub.mkdir(parents=True,exist_ok=True)
drive='https://drive.google.com/drive/folders/1vTAxvhlt3h7RQTyyY14voRPjrr1sZFky'
files=[('before','Before · leveled rim v02',root/'docs/reviews/cylinder9-rim-level-2026-11-01/BB_Cylinder_9ml_17-415_Clear_BODY_Sunburst-Level-Rim-v02_REVIEW_2026-11-01.png','before-v02.png'),('after','New · glass refraction v03',root/'output/imagegen'/name/'cylinder9-clear-refraction-v03.png','BB_Cylinder_9ml_17-415_Clear_BODY_Sunburst-Refraction-v03_REVIEW_2026-11-01.png')]
data=[]
for role,label,path,dest in files:
 shutil.copy2(path,doc/dest);shutil.copy2(path,pub/dest);im=Image.open(path);a=im.getchannel('A');b=a.point(lambda x:255 if x>=128 else 0).getbbox();w=b[2]-b[0];h=b[3]-b[1];rows=[]
 for x in range(round(b[0]+w*.25),round(b[0]+w*.75)):
  ys=[y for y in range(max(0,b[1]-15),min(im.height-3,b[1]+50)) if all(a.getpixel((x,y+j))>=192 for j in range(3))]
  if ys:rows.append((x,ys[0]))
 xm=sum(x for x,y in rows)/len(rows);ym=sum(y for x,y in rows)/len(rows);slope=sum((x-xm)*(y-ym) for x,y in rows)/sum((x-xm)**2 for x,y in rows);n=max(1,len(rows)//5)
 hp=(43.5*1971/1619)*im.height/h;wp=hp*1.1*im.width/im.height
 values=[a.getpixel((x,y)) for x in range(300,440) for y in range(700,1700)];core={'bounds':[300,700,440,1700],'meanAlpha':mean(values),'medianAlpha':median(values)}
 data.append({'role':role,'label':label,'file':dest,'size':list(im.size),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'alphaBounds128':b,'centralBodyAlpha':core,'rimAngleDegrees':math.degrees(math.atan(slope)),'rightMinusLeftMedianY':median(y for x,y in rows[-n:])-median(y for x,y in rows[:n]),'centralRimYRange':[min(y for x,y in rows),max(y for x,y in rows)],'outlineAspectDriftFromV02Pct':((w/h)/(514/1894)-1)*100,'fullPlacement':{'width':wp,'left':50-wp*(b[0]+b[2])/2/im.width,'top':91-hp*b[3]/im.height}})
shutil.copy2(root/'output/imagegen'/name/'prompt.txt',doc/'prompt.txt')
shutil.copy2(root/'docs/reviews/cylinder9-sunburst-2026-11-01/glass-material-reference.png',doc/'glass-material-reference.png')
measurement={'images':data,'method':'Read-only alpha-bound and rim-edge diagnostics; alpha >=128 for outline. First three consecutive alpha>=192 pixels per column over central half of body bounds for the top-edge fit. These are image diagnostics, not dimensional certification.','generator':'gpt-image-2.5-sunburst via imagegen skill CLI','generationCount':1,'seconds':21.6,'nativeResolutionIncreased':False,'pixelIdenticalOutsideMaterialEdit':False,'sourceScale':{'shoulderToBasePct':43.5,'baselinePct':91},'status':'review candidate: sharper reflections; alpha fringe and configurator transparency remain unresolved','assignmentChanged':False}
(doc/'measurements.json').write_text(json.dumps(measurement,indent=2)+'\n');(pub/'data.json').write_text(json.dumps(measurement,indent=2)+'\n')
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>9 ml Cylinder | Clear glass comparison</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ef;color:#252525;font:15px/1.5 system-ui,sans-serif}main{max-width:1320px;margin:auto;padding:26px}h1{font-size:30px;line-height:1.2;font-weight:500}h2{font-size:18px;font-weight:500;margin:8px 0 14px}.eyebrow{font-size:11px;letter-spacing:.14em;color:#8c6b3a}p{max-width:920px}a{color:#35564c}button{font:inherit;padding:9px 14px;border:1px solid #ccc;background:white;cursor:pointer;margin:6px 8px 12px 0}button[aria-pressed=true]{background:#252525;color:white}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{border:1px solid #d6cfc2;background:#f5f3ef;padding:14px;min-width:0}.zoom{position:relative;aspect-ratio:640/650;overflow:hidden;background:#f5f3ef}.zoom img{position:absolute;max-width:none;height:auto}.dark .zoom,.dark .stage{background:#292929}.stage{position:relative;aspect-ratio:10/11;overflow:hidden;background:#f5f3ef}.stage img{position:absolute;max-width:none;height:auto}.baseline{position:absolute;left:8%;right:8%;top:91%;height:1px;background:#cfc5b4}.note{padding:15px 18px;background:#eae5da;border-left:3px solid #a7834c;margin:22px 0}summary{cursor:pointer;margin:22px 0 10px}small{color:#626262}.tiny{font-size:13px}footer{font-size:12px;margin-top:25px;color:#666}@media(max-width:700px){main{padding:15px}.pair{grid-template-columns:1fr}h1{font-size:25px}}
</style><main><div class="eyebrow">BEST BOTTLES / CYLINDER 9 ML / 17-415 / REVIEW</div><h1>Clearer glass, sharper refraction</h1><p>Compare the previous leveled-rim bottle with the new material pass. Inspect the threads, shoulder, cylindrical reflections and base. Both are native 743 × 2116 PNGs, shown at the same magnification.</p><nav aria-label="Comparison detail"><button data-view="neck" aria-pressed="true">Neck &amp; shoulder</button><button data-view="barrel" aria-pressed="false">Body</button><button data-view="base" aria-pressed="false">Base</button><button id="dark" aria-pressed="false">Dark background</button></nav><div class="pair" id="material-closeup"></div><div class="note"><strong>New material candidate, not an approved master.</strong><p>The reflections and base detail are more defined. The rim remains visually level, with a 1 px median difference between sides. Overall opaque-outline aspect changed by −0.96% from v02, so this is not a pixel-exact geometry match.</p><p>Rough transparency edges remain visible, especially on dark backgrounds. The new body is more transparent; fitments viewed through it still need a separate compositing check. Product pages and the builder retain their current masters.</p></div><details><summary>Compare complete bottles at the shared scale</summary><div class="pair" id="bodies"></div></details><p><a href="../cylinder9-rim-level-2026-11-01/index.html">Previous rim correction</a> · <a href="DRIVE_URL">Labeled Drive folder</a></p><footer>One GPT 2.5 Sunburst material edit using the previous bottle for shape and the supplied clear-glass photograph for material only. Native output preserved without raster sharpening, retouching or stretching. No resolution increase, merge or deployment.</footer></main><script>
const views={neck:{x:60,y:80,w:640,h:650},barrel:{x:60,y:800,w:640,h:650},base:{x:60,y:1490,w:640,h:650}};let selected='neck';function view(name){selected=name;const v=views[name];for(const el of document.querySelectorAll('.zoom')){const im=el.querySelector('img');el.style.aspectRatio=v.w+'/'+v.h;im.style.width=(743/v.w*100)+'%';im.style.left=(-v.x/v.w*100)+'%';im.style.top=(-v.y/v.h*100)+'%';im.alt=im.dataset.label+' '+name;}for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===name));}fetch('data.json').then(r=>{if(!r.ok)throw Error('Image manifest unavailable');return r.json()}).then(d=>{for(const x of d.images){const card=document.createElement('section');card.className='card';const h=document.createElement('h2');h.textContent=x.label;const z=document.createElement('div');z.className='zoom';const im=document.createElement('img');im.src=x.file;im.dataset.label=x.label;z.append(im);const a=document.createElement('a');a.href=x.file;a.target='_blank';a.textContent='Open native PNG';card.append(h,z,a);document.querySelector('#material-closeup').append(card);const full=document.createElement('section');full.className='card';const title=document.createElement('h2');title.textContent=x.label;const stage=document.createElement('div');stage.className='stage';const foot=document.createElement('span');foot.className='baseline';const image=document.createElement('img');image.src=x.file;image.alt=x.label+' full bottle';for(const [k,v] of Object.entries(x.fullPlacement))image.style[k]=v+'%';stage.append(foot,image);full.append(title,stage);document.querySelector('#bodies').append(full)}view(selected)}).catch(e=>{document.querySelector('#material-closeup').textContent=e.message;throw e});for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>view(b.dataset.view);document.querySelector('#dark').onclick=e=>{const on=document.body.classList.toggle('dark');e.target.setAttribute('aria-pressed',String(on));e.target.textContent=on?'Catalog background':'Dark background'};
</script></html>'''.replace('DRIVE_URL',drive)
(pub/'index.html').write_text(html)
runtime=doc/'runtime/public/reviews'/name;runtime.mkdir(parents=True,exist_ok=True)
for p in pub.iterdir():shutil.copy2(p,runtime/p.name)
(doc/'README.md').write_text('''# Cylinder 9 ml glass-refraction revision v03

Jordan requested better clear-glass refraction because v02 read blurry. One high-quality GPT 2.5 Sunburst edit used the leveled-rim v02 as the geometry target and the previously supplied clear 5 ml photograph as a material-only reference. The exact prompt and both inputs are preserved in this package.

Native output is 743 × 2116 RGBA, the same resolution as v02. It is a material edit, not a pixel-resolution upscale. No raster retouching, filters or stretching were applied afterward. The API completed in 21.6 seconds.

Visual result: more defined specular reflections and refracted contours at the threads, shoulder and base. The new image retains a near-level top rim. The median left-to-right rim difference remains 1 px; the fitted upper-edge angle is 0.248° versus 0.143° in v02. Overall opaque-outline aspect changed −0.964% from v02. These alpha-edge diagnostics do not establish exact dimensional compliance.

Remaining issues: rough alpha fringe is visible around the silhouette on dark backgrounds, exact shoulder/neck fit and through-glass fitment compositing must be rechecked before a paper-doll assignment. Center-body mean alpha fell from 252.34 to 113.41 on the 0–255 scale (same 140 × 1000 px sample area), confirming improved transparency but not physical refraction accuracy. This material comparison does not establish final configurator compatibility. This is a REVIEW candidate, not an approved or assigned master.

Originals, the active 5 ml clear/cobalt masters and all 71 active configurations are preserved. No product-page or builder assignment changed.

The full-bottle comparison preserves the earlier source's 43.5% shoulder-to-base target and 91% baseline through uniform image scaling to equal overall height. This comparison is not a replacement anchor approval. Close-up views use identical CSS viewports into the native PNGs.

Local review: http://localhost:3010/reviews/cylinder9-glass-refraction-2026-11-01/index.html

Drive: '''+drive+'''

Restore: node docs/reviews/cylinder9-glass-refraction-2026-11-01/restore.mjs --apply

No merge, deployment, database change or live media replacement.
''')
shutil.copy2(root/'docs/reviews/cylinder9-rim-level-2026-11-01/restore.mjs',doc/'restore.mjs')
checks=json.loads((root/'docs/reviews/cylinder9-rim-level-2026-11-01/preserved-assets.json').read_text())
for entry in checks:
 assert hashlib.sha256((root/entry['file']).read_bytes()).hexdigest()==entry['sha256'],entry['file']
(doc/'preserved-assets.json').write_text(json.dumps(checks,indent=2)+'\n')
ignore=root/'.gitignore';text=ignore.read_text()
for line in ['/public/reviews/'+name+'/', '/output/imagegen/'+name+'/']:
 if line not in text:text+='\n'+line+'\n'
ignore.write_text(text)
b=root/'docs/reviews/family-master-library-2026-11-01/BATCHES.md';text=b.read_text();row='| 2026-11-01 Cylinder 9 ml glass-refraction v03 | 1 clear body revision | Sharper material candidate; alpha and fit checks remain, no active assignment | [Glass-refraction batch]('+drive+') |\n'
if row not in text:text=text.replace('\nApproved files remain separate.',row+'\nApproved files remain separate.');b.write_text(text)
print(json.dumps(measurement))
