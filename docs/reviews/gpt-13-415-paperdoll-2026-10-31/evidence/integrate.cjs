const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
const out=path.resolve('outputs/catalog-model-repair-2026-10-31/13-415-gpt-paperdoll'),pub=path.resolve('public/local-kits/gpt-13-415-2026-10-31'),urlBase='/local-kits/gpt-13-415-2026-10-31/';
const before=JSON.parse(fs.readFileSync(out+'/kits-before.json')),snapshot=JSON.parse(fs.readFileSync(out+'/snapshot.json')),hist=JSON.parse(fs.readFileSync('outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview/historical-ai-body-masters.json'));
const quality=JSON.parse(fs.readFileSync('public/reviews/cylinder5-new-masters-2026-10-31/quality-v3.json'));const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const partsCache=new Map(),sources=[];fs.mkdirSync(pub,{recursive:true});
async function localImage(file,label){const bytes=fs.readFileSync(file),hash=sha(bytes),m=await sharp(bytes).metadata(),name=label+'.'+hash.slice(0,12)+'.png';fs.copyFileSync(file,pub+'/'+name);sources.push({label,source:file,sha256:hash,url:urlBase+name});return {url:urlBase+name,key:name,sha256:hash,bytes:bytes.length,width:m.width,height:m.height};}
function bounds(box){return {left:box.x,top:box.y,right:box.x+box.width,bottom:box.y+box.height}}
function newPart(slot,image,box,z,componentId,views){return {slot,variantKey:null,zOrder:z,explodeIndex:slot==='body'?0:1,box,bounds:bounds(box),assembled:{x:0,y:0},exploded:{dx:0,dy:0},image,image2x:null,mask:null,derivation:'psd-layer',componentId,...(views?{views}:{})}}
async function main(){
 const rolls={};for(const kind of ['metal','plastic']){const name='roller-'+kind;rolls[kind]={meta:JSON.parse(fs.readFileSync(out+'/renders/'+name+'.json')),image:await localImage(out+'/renders/'+name+'.png',name)}}
 const templates={};for(const p of snapshot.products.filter(p=>p.family==='Sleek'&&p.capacityMl===5&&p.applicator==='Fine Mist Sprayer')){const k=before[p.websiteSku];for(const part of k.parts.filter(p=>['sprayer','overcap'].includes(p.slot)))templates[part.componentId+':'+part.slot]={part,anchors:k.anchors};}
 const rows={},changes=[],holds=[];
 for(const [sku,original] of Object.entries(before)){
  const k=structuredClone(original),p=snapshot.products.find(p=>p.websiteSku===sku),group=snapshot.groups.find(g=>g._id===p.productGroupId);
  let b=k.parts.find(p=>p.slot==='body');const bodyKey=k.register.plateKey;
  let bodyStatus='recovered GPT master',master=hist.find(h=>h.plateKey===bodyKey);
  if(k.register.bodyId==='cylinder-5ml-13-415'){
   const color=k.register.glass==='Clear'?'clear':'cobalt',m=quality.colors[color];
   if(!partsCache.has(bodyKey))partsCache.set(bodyKey,await localImage(m.file,'cylinder5-'+color+'-candidate-v3'));
   const scale=(b.bounds.bottom-b.bounds.top)/(m.bottom-m.top);
   b.image=partsCache.get(bodyKey);b.box={x:k.anchors.axisX-m.axis*scale,y:b.bounds.top-m.top*scale,width:m.imageWidth*scale,height:m.imageHeight*scale};
   bodyStatus='GPT revision 3 candidate; appearance approval pending';
  }else if(master){
   if(!partsCache.has(bodyKey))partsCache.set(bodyKey,await localImage(master.localPath,bodyKey.toLowerCase().replace(/[^a-z0-9-]/g,'-')));
   const scale=(b.bounds.bottom-k.anchors.seatY)/(master.anchors.baselineY-master.anchors.seatY);
   b.image=partsCache.get(bodyKey);b.box={x:k.anchors.axisX-master.anchors.axisX*scale,y:k.anchors.seatY-master.anchors.seatY*scale,width:master.width*scale,height:master.height*scale};
   // Preserve the existing approved scale target; its landmark follows this master's recorded shoulder.
   if(k.glassSizing)k.glassSizing.landmarkY=b.box.y+(master.anchors.shoulderY??master.anchors.seatY)*scale;
  }else{holds.push({sku,reason:'No recovered body master for '+bodyKey});continue;}
  if(k.register.bodyId==='circle-15ml-13-415'&&master){const target=JSON.parse(fs.readFileSync('src/lib/register/catalog-scale.generated.json'))[k.register.bodyId];k.glassSizing={heightPct:target.targetPct,baselinePct:target.baselinePct,landmarkY:b.box.y+master.anchors.shoulderY*b.box.height/master.height,source:target.source+'; opt-in sprayer-only clearance test, catalog readiness hold unchanged'};}
  // One source body and its exact placement per glass; only component parts move.
  b.zOrder=1;
  const oldRollers=k.parts.filter(p=>p.slot==='roller');
  if(oldRollers.length){
   const kind=oldRollers.some(p=>p.componentId?.includes('Mtl'))?'metal':'plastic',r=rolls[kind],m=r.meta,scale=k.anchors.pxPerMm/m.sourcePxPerMm;
   const box={x:k.anchors.axisX+(m.crop[0]-m.axis)*scale,y:k.anchors.seatY+(m.crop[1]-m.seat)*scale,width:r.image.width*scale,height:r.image.height*scale};
   k.parts=k.parts.filter(p=>p.slot!=='roller');
   const roller=newPart('roller',r.image,box,0,oldRollers[0].componentId);
   k.parts.push({...roller,views:['sidecar','capon']},{...roller,zOrder:4,views:['exploded']});
  }
  const head=k.parts.find(p=>p.slot==='sprayer');
  if(head){
   k.parts=k.parts.filter(p=>p.slot!=='diptube');
   for(const part of k.parts.filter(p=>['sprayer','overcap'].includes(p.slot))){
    const t=templates[part.componentId+':'+part.slot];if(!t)throw Error('Missing selected PSD reference '+part.componentId);
    const scale=k.anchors.pxPerMm/t.anchors.pxPerMm;
    part.image=structuredClone(t.part.image);part.box={x:k.anchors.axisX+(t.part.box.x-t.anchors.axisX)*scale,y:k.anchors.seatY+(t.part.box.y-t.anchors.seatY)*scale,width:t.part.box.width*scale,height:t.part.box.height*scale};part.bounds=bounds(part.box);part.zOrder=part.slot==='sprayer'?3:5;
   }
   const name='mechanism-'+k.register.bodyId+'-v1',m=JSON.parse(fs.readFileSync(out+'/renders/'+name+'.json'));
   if(!partsCache.has(name))partsCache.set(name,await localImage(out+'/renders/'+name+'.png',name));
   const image=partsCache.get(name),scale=k.anchors.pxPerMm/25,box={x:k.anchors.axisX+(m.crop[0]-m.axis)*scale,y:b.bounds.bottom+(m.crop[1]-m.baseline)*scale,width:image.width*scale,height:image.height*scale};
   const tube=newPart('diptube',image,box,2,head.componentId);
   k.parts.push({...tube,views:['sidecar','capon'],opacity:k.register.glass==='Frosted'?.22:k.register.glass==='Amber'?.42:k.register.glass==='Cobalt Blue'?.15:.62},{...tube,views:['exploded']});
  }
  // Existing shared stage layout computes group moves and body frame.
  rows[sku]=k;changes.push({sku,slug:group.slug,bodyId:k.register.bodyId,glass:k.register.glass,capacityMl:p.capacityMl,applicator:p.applicator,capColor:p.capColor,bodyStatus,bodyUrl:b.image.url,bodySha256:b.image.sha256,bodyTargetPct:k.glassSizing?.heightPct,baselinePct:k.glassSizing?.baselinePct,sprayer:head?.componentId??null,tube:head?'1.1 mm OD, 0.7 mm bore, body-specific length; inferred visual dimensions':null,roller:oldRollers.length?'Existing Blender ball plus full plug; mesh preserved':null,url:'/products/'+group.slug+'?sku='+encodeURIComponent(sku)+'&assetPreview=gpt13'});
 }
 const result={rows,defaultPdpSkus:[]};fs.writeFileSync(pub+'/kits.json',JSON.stringify(result,null,2));fs.writeFileSync(out+'/kits-after.json',JSON.stringify(rows,null,2));fs.writeFileSync(out+'/changes.json',JSON.stringify({createdAt:new Date().toISOString(),changes,holds,sources,missingGroups:snapshot.details.filter(d=>!d.variants.length).map(d=>d.group.slug),notes:['Local opt-in review only; no production mutation.','Pillar legacy route contains 17-415 but current catalog and register identify 13-415. Kept existing route, flagged identity review.','No lotion-pump assembly is listed for the current 5 ml groups.','Clear-glass compositing approximates refraction; this is a fixed-view layer renderer.']},null,2));console.log(rows&&Object.keys(rows).length,'kits;',sources.length,'assets;',holds.length,'holds');
}
main().catch(e=>{console.error(e);process.exit(1)});