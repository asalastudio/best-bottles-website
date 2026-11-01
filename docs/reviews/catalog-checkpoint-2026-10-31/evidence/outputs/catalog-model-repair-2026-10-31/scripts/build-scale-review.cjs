const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../..'),dir=path.join(root,'outputs/catalog-model-repair-2026-10-31/reports/catalog-scale'),dest=path.join(root,'public/reviews/glass-body-overview-2026-10-31');
const read=f=>JSON.parse(fs.readFileSync(f));
const policy=read(path.join(dir,'scale-policy.json')),registered=read(path.join(root,'outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview/registered-body-masters.json'));
const readiness=read(path.join(root,'src/lib/register/catalog-scale-readiness.generated.json')),before=read(path.join(dir,'stage-before.json')).rows,after=read(path.join(dir,'stage-production-after.json')).rows,checks=read(path.join(dir,'stability-production.json'));
const local=read(path.join(root,'public/local-kits/vial-2ml-source-2026-10-31/kits.json'));
const all=read(path.join(dir,'stability-all-targets.json'));
const production=read(path.join(dir,'register-payload-precise-raccoon-123.json')).payload.plates;
const historical=read(path.join(root,'outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview/historical-ai-body-masters.json'));
const rows=registered.map(original=>{
 const live=production[original.plateKey];
 const p=live?{...original,...live,image:{...original.image,url:live.url,width:live.width,height:live.height,sha256:live.url.split('/').pop().replace(/\.png$/,'')}}:original;
 const recovered=historical.find(h=>h.plateKey===p.plateKey&&h.sha256===p.image.sha256);
 const productionChanged=live&&live.url!==original.image.url;
 if(productionChanged&&!recovered)throw new Error('Production master not recovered: '+p.plateKey);
 if(productionChanged){p.fileSha256=recovered.fileSha256;fs.copyFileSync(recovered.localPath,path.join(dest,'masters',p.fileSha256+'.png'));}
 const provenance=live?'Production register, verified October 31':'Recovered development register; not resolved in production SKU audit';
 const t=policy.rows.find(r=>r.bodyId===p.bodyId),record=before.find(r=>r.plateKey===p.plateKey),current=after.find(r=>r.sku===record?.sku);
 const rim=t.landmark==='full-glass'||t.landmark==='full-product'||t.landmark==='closure-seat'&&/Ground|Plug|snap/i.test(t.neck);
 let geom={width:p.image.width,height:p.image.height,axis:p.anchors.axisX,foot:p.anchors.baselineY,landmark:rim?p.anchors.seatY:p.anchors.shoulderY};
 let url='masters/'+p.fileSha256+'.png',note=productionChanged?'Production uses this earlier approved GPT master. The different development Blender master remains in the archive.':null,method=!productionChanged&&p.source?.library?.includes('Blender')?'Blender':'GPT image generation';
 if(p.bodyId==='vial-2ml-8-425'&&p.glass==='Clear'){
  const k=local.rows.GBVialClr2mlWhtCap,b=k.parts.find(r=>r.slot==='body');url=b.image.url;geom={width:k.canvas.width,height:k.canvas.height,axis:k.anchors.axisX,foot:b.bounds.bottom,landmark:b.bounds.top};note='Uses today’s corrected local vial; older rejected master is retained in the archive.';method='Corrected GPT body + original cap';
 }
 const scale=t.targetPct/100*1100/(geom.foot-geom.landmark);
 const placement={width:geom.width*scale/1000*100,height:geom.height*scale/1100*100,left:50-geom.axis*scale/1000*100,top:91-geom.foot*scale/1100*100};
 const state=p.bodyId==='vial-2ml-8-425'&&p.glass==='Clear'?'ready':readiness[p.bodyId]?.status??'unverified';
 const clipCount=new Set(all.clips.filter(r=>r.bodyId===p.bodyId).map(r=>r.sku)).size;
 return {...t,provenance,glass:p.glass,plateKey:p.plateKey,method,url,geom,placement,state,note,clipCount,before:record?{sku:record.sku,...record.views.sidecar}:null,after:current?current.views.sidecar:null};
});
const data={policy,rows,checks:{configurations:checks.configurations,mismatches:checks.mismatches.length,clips:checks.clips.length},coverage:{records:2485,resolved:2088,notResolved:397,enabled:906,held:1182,readyBodies:22,heldBodies:20}};
fs.writeFileSync(path.join(dest,'scale-review.json'),JSON.stringify(data,null,2));
fs.copyFileSync(path.join(dir,'body-scale-targets.csv'),path.join(dest,'body-scale-targets.csv'));
const html=fs.readFileSync(path.join(__dirname,'scale-review.html'),'utf8').replace('/*__DATA__*/','const DATA='+JSON.stringify(data).replace(/</g,'\\u003c')+';');fs.writeFileSync(path.join(dest,'scale.html'),html);
for(const file of [path.join(dest,'index.html'),path.join(__dirname,'master-gallery.html')]){let h=fs.readFileSync(file,'utf8');if(!h.includes('href="scale.html"'))h=h.replace('<div class="tools" id="tabs">','<div class="strip"><a href="scale.html"><strong>Open the approved scale check and stage-stability review →</strong></a></div><div class="tools" id="tabs">');fs.writeFileSync(file,h)}
console.log(JSON.stringify({plates:rows.length,bodyTargets:policy.rows.length,review:path.join(dest,'scale.html')}));
