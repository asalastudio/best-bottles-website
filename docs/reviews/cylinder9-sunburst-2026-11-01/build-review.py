from pathlib import Path
from PIL import Image
import json,hashlib,shutil
root=Path.cwd();name='cylinder9-sunburst-2026-11-01';doc=root/'docs/reviews'/name;pub=root/'public/reviews'/name
doc.mkdir(parents=True,exist_ok=True);pub.mkdir(parents=True,exist_ok=True)
previous=root/'docs/reviews/cylinder-master-materials-2026-10-31';builtin=root/'docs/reviews/cylinder9-builtin-material-2026-11-01'
request=json.loads((previous/'request.json').read_text())
outname='BB_Cylinder_9ml_17-415_Clear_BODY_Sunburst-v01_REVIEW_2026-11-01.png'
sources=[('source','Geometry source',previous/'source-cylinder9-clear.png','source-cylinder9-clear.png'),('builtin','Earlier built-in candidate',next(builtin.glob('BB*.png')),'earlier-builtin-candidate.png'),('sunburst','Sunburst candidate v01',root/'output/imagegen'/name/'cylinder9-clear-sunburst-v01.png',outname)]
images=[]
for role,title,path,dest in sources:
 shutil.copy2(path,doc/dest);shutil.copy2(path,pub/dest)
 im=Image.open(path);a=im.getchannel('A');bounds={str(t):list(a.point(lambda x:255 if x>=t else 0).getbbox()) for t in [1,16,64,128,192,254]};b=bounds['128'];w=b[2]-b[0];h=b[3]-b[1]
 height=(43.5*1971/(2096-477))*im.height/h;width=height*1.1*im.width/im.height
 images.append({'role':role,'title':title,'file':dest,'width':im.width,'height':im.height,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'alphaBounds':bounds,'outlineAspectChangePct':((w/h)/(529/1971)-1)*100,'heightRatioToSource':im.height/2192,'placementPct':{'left':50-width*((b[0]+b[2])/2)/im.width,'top':91-height*b[3]/im.height,'width':width,'height':height}})
for f in ['prompt.txt','glass-material-reference.png']:shutil.copy2(previous/f,doc/f)
request.update({'date':'2026-11-01','generator':'OpenAI Images edit API through installed imagegen skill CLI','model':'gpt-image-2.5-sunburst','quality':'high','n':1,'requestedSize':'auto','background':'transparent','outputFormat':'png','inputFidelity':'omitted: API rejects this parameter for Sunburst','keyProject':'Asala LLC / Asala - Best Bottles','runtimeAssignment':'unchanged','output':outname})
(doc/'request.json').write_text(json.dumps(request,indent=2)+'\n')
result={'status':'generated-review-candidate','generatedImages':1,'editDurationSeconds':22.3,'attempts':[{'status':400,'reason':'input_fidelity unsupported; rejected before generation'},{'status':'success','input_fidelity':'omitted','output':outname}],'resolutionGain':False,'geometry':'alpha >=128 outline aspect +0.897% at equal height; not a manufacturer fit test','visualReview':['Complete upright bottle, no components baked into the body.','Softer vertical reflections than the source.','Ragged light and colored alpha fringe around the shoulders and barrel; isolated faint alpha outside the bottle.','Near-opaque bright interior needs evaluation with component compositing.','No PDP or builder assignment; no family rollout.'],'cost':'Not returned by bundled CLI; no cost estimate asserted.'}
(doc/'result.json').write_text(json.dumps(result,indent=2)+'\n')
data={'images':images,'scale':request['source']['scale'],'result':result}
(doc/'measurements.json').write_text(json.dumps(data,indent=2)+'\n');(pub/'data.json').write_text(json.dumps(data,indent=2)+'\n')
protected=['public/local-kits/cylinder5-all71-2026-11-01/kits.json','public/local-kits/gpt-13-415-2026-10-31/cylinder5-clear-candidate-v3.3d366e116958.png','public/local-kits/gpt-13-415-2026-10-31/cylinder5-cobalt-candidate-v3.c51b7b6df61f.png']
(doc/'preserved-assets.json').write_text(json.dumps([{'file':p,'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in protected],indent=2)+'\n')
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>9 ml Cylinder | Sunburst glass review</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ef;color:#242424;font:15px/1.55 system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:28px}h1{font-weight:500;font-size:32px;line-height:1.2;margin:12px 0}h2{font-size:19px;font-weight:500}p{max-width:1020px}.eyebrow{font-size:11px;letter-spacing:.13em;color:#8c6b3a;text-transform:uppercase}.note{padding:16px 20px;border-left:3px solid #a7834c;background:#eae5da;margin:24px 0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{border:1px solid #d6d0c4;padding:16px;min-width:0}.stage{position:relative;aspect-ratio:10/11;background:#f5f3ef;overflow:hidden}.stage img{position:absolute;max-width:none}.baseline{position:absolute;top:91%;left:8%;right:8%;height:1px;background:#ccc3b4}.detail{width:100%;height:580px;object-fit:contain;background:#f5f3ef}.checker .stage,.checker .detail{background-color:#fff;background-image:conic-gradient(#d5d5d5 25%,transparent 0 50%,#d5d5d5 0 75%,transparent 0);background-size:24px 24px}.dark .stage,.dark .detail{background:#292929}button{font:inherit;padding:9px 14px;border:1px solid #b9ae9c;background:white;cursor:pointer;margin:0 7px 8px 0}button[aria-pressed=true]{background:#242424;color:#fff}small{font-size:12px;color:#5f6266}a{color:#35564c}summary{cursor:pointer;margin:25px 0 12px}footer{margin-top:25px;color:#636363;font-size:12px}@media(max-width:850px){main{padding:18px}.grid{grid-template-columns:1fr}.detail{height:500px}h1{font-size:27px}}
</style><main><div class="eyebrow">Best Bottles / Cylinder 9 ml / 17-415 / November 1, 2026</div><h1>Sunburst glass material pilot</h1><p>The new Asala key generated one high-quality image with <strong>GPT 2.5 Sunburst</strong>. Compare it with the geometry source and the earlier built-in result at equal visible bottle height.</p><div class="note"><strong>Closer outline. Edge cleanup still required.</strong><p>The Sunburst outline aspect ratio differs by about +0.9%, compared with +5.7% for the built-in candidate. Its reflections are softer, but light and colored fringe remains around the bottle. The output is 743 × 2,117 px, slightly smaller than the 768 × 2,192 source. This is a material edit, with no resolution gain.</p><p>All current product-page and builder masters remain unchanged. This candidate is not approved for shared component use.</p></div><div role="group" aria-label="Comparison background"><button data-bg="" aria-pressed="true">Catalog background</button><button data-bg="checker" aria-pressed="false">Check transparency</button><button data-bg="dark" aria-pressed="false">Dark background</button></div><div class="grid" id="stages"></div><details open><summary>Inspect material and edges</summary><div class="grid" id="details"></div></details><p>The source keeps its approved 43.5% shoulder-to-base scale target and 91% baseline. Candidates use the same overall visible height for comparison, with uniform CSS scaling. Their neck, shoulder and component-fit anchors are not approved. No pixels were stretched or retouched.</p><p><a href="https://drive.google.com/drive/folders/1xnEYqdc7t76QLhX25_fSpNqmerSgt9Ka">Cylinder Sunburst review folder in Drive</a> · <a href="../gpt-master-library-2026-10-31/index.html">Body master library</a></p><footer>One successful generation after a rejected unsupported input_fidelity parameter. Native PNG, inputs, exact prompt and measurements preserved. No production change or catalog-wide rollout.</footer></main><script>
fetch('data.json').then(r=>r.json()).then(d=>{for(const m of d.images){const s=document.createElement('section');s.className='card';const h=document.createElement('h2');h.textContent=m.title;const stage=document.createElement('div');stage.className='stage';const line=document.createElement('div');line.className='baseline';const i=document.createElement('img');i.src=m.file;i.alt=m.title;for(const [k,v] of Object.entries(m.placementPct))i.style[k]=v+'%';stage.append(line,i);const p=document.createElement('p');p.textContent=m.width+' × '+m.height+' px · outline aspect change '+m.outlineAspectChangePct.toFixed(2)+'%';const a=document.createElement('a');a.href=m.file;a.target='_blank';a.textContent='Open native PNG';s.append(h,stage,p,a);document.querySelector('#stages').append(s);const detail=document.createElement('section');const title=document.createElement('h2');title.textContent=m.title;const image=document.createElement('img');image.src=m.file;image.alt=m.title+' detail';image.className='detail';detail.append(title,image);document.querySelector('#details').append(detail)}});document.querySelectorAll('[data-bg]').forEach(b=>b.onclick=()=>{document.body.className=b.dataset.bg;document.querySelectorAll('[data-bg]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
</script></html>'''
(pub/'index.html').write_text(html)
runtime=doc/'runtime/public/reviews'/name;runtime.mkdir(parents=True,exist_ok=True)
for f in pub.iterdir():shutil.copy2(f,runtime/f.name)
(doc/'README.md').write_text('''# Cylinder 9 ml Sunburst material pilot

One high-quality GPT 2.5 Sunburst edit completed on November 1, 2026 using the separate Asala LLC / Asala - Best Bottles pilot key. The two uploaded reference images were explicitly approved earlier. The first request was rejected because this model does not accept input_fidelity. Removing that parameter produced one image in 22.3 seconds. No other images were generated.

The output has softer vertical reflections than the recovered body. At alpha >=128, its outline aspect is 0.897% wider relative to height, compared with 5.656% for the earlier built-in candidate. This bound comparison does not establish manufacturer geometry, thread accuracy or component fit. Light and colored fringe remains around the neck, shoulders, barrel and base. Faint alpha extends beyond the silhouette. Its near-opaque bright interior also needs component-compositing review.

The native output is 743 × 2117, versus the source at 768 × 2192. There is no resolution gain. This is a review candidate, not a completed upscale or an approved replacement.

The comparison uses equal visible bottle height, uniform CSS scaling and the source's approved 43.5% shoulder-to-base target / 91% baseline. No raster was stretched, retouched, recolored or cleaned after generation. Existing PDP/builder masters and all 71 Cylinder 5 ml configurations remain unchanged. No family batch was started.

Local comparison: http://localhost:3010/reviews/cylinder9-sunburst-2026-11-01/index.html

Drive batch: https://drive.google.com/drive/folders/1xnEYqdc7t76QLhX25_fSpNqmerSgt9Ka

Files include the unmodified native PNG, both references, the earlier built-in candidate, exact prompt, request/result metadata and measurements. Browser evidence and a SHA-256 restore manifest accompany the review. Secrets are excluded from this package and from Git.

Restore the local comparison from a fresh checkout:
node docs/reviews/cylinder9-sunburst-2026-11-01/restore.mjs --apply

No merge, deployment, live media update or database mutation.
''')
shutil.copy2(root/'docs/reviews/cylinder5-layer-fidelity-2026-11-01/restore.mjs',doc/'restore.mjs')
ignore=root/'.gitignore';text=ignore.read_text()
for line in ['/public/reviews/'+name+'/', '/output/imagegen/'+name+'/']:
 if line not in text:text+='\n'+line+'\n'
ignore.write_text(text)
batch=root/'docs/reviews/family-master-library-2026-11-01/BATCHES.md';text=batch.read_text()
row='| 2026-11-01 Cylinder 9 ml 17-415 Sunburst v01 | 1 new clear body | Material candidate; +0.9% outline aspect drift, alpha fringe, no resolution gain; no active assignment | [Sunburst batch](https://drive.google.com/drive/folders/1xnEYqdc7t76QLhX25_fSpNqmerSgt9Ka) |\n'
text=text.replace('\nApproved files remain separate.',row+'\nApproved files remain separate.');batch.write_text(text)
print(json.dumps({'doc':str(doc),'public':str(pub),'images':[{'role':x['role'],'width':x['width'],'height':x['height'],'outlineAspectChangePct':x['outlineAspectChangePct']} for x in images]}))
