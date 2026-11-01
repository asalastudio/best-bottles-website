const fs=require('fs'),crypto=require('crypto');
const dir='docs/reviews/cylinder5-rollers-pour-2026-11-01',out='public/local-kits/cylinder5-masters-2026-11-01';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const library=JSON.parse(fs.readFileSync(dir+'/before-kits.json')),index=JSON.parse(fs.readFileSync(dir+'/before-index.json'));
const nine=JSON.parse(fs.readFileSync(dir+'/9ml-reference-kits.json'));
const scope=JSON.parse(fs.readFileSync(dir+'/inventory.json'));
const metrics=JSON.parse(fs.readFileSync(dir+'/cap-metrics.json'));const caps=new Map();
for(const m of metrics){const bytes=fs.readFileSync(m.file),name='cap-'+m.id+'.'+sha(bytes).slice(0,12)+'.png';fs.writeFileSync(out+'/'+name,bytes);caps.set(m.id,{...m,image:{url:'/local-kits/cylinder5-masters-2026-11-01/'+name,key:'',sha256:sha(bytes),bytes:bytes.length,width:m.width,height:m.height}});}
const changes=[];
for(const item of scope){
 const kit=library.rows[item.sku],body=kit.parts.find(p=>p.slot==='body'),oldCap=kit.parts.find(p=>p.slot==='cap'),cap=structuredClone(oldCap),m=caps.get(cap.componentId);
 const scale=cap.box.width/m.width;
 // Preserve each closure design and use one uniform source scale, correcting old rounding only.
 // The short ribbed plastic caps close over the threads, not the shoulder. Do not elongate them.
 const shortPlastic=['CMP-CAP-BLK-S-13-415','CMP-CAP-WHT-S-13-415'].includes(cap.componentId);
 const contactY=shortPlastic?oldCap.bounds.bottom:kit.glassSizing.landmarkY-14;
 const x=kit.anchors.axisX-(m.ink.left+m.ink.right)/2*scale,y=contactY-m.ink.bottom*scale;
 cap.image=m.image;cap.image2x=null;cap.zOrder=3;cap.box={x,y,width:m.width*scale,height:m.height*scale};
 cap.bounds={left:x+m.ink.left*scale,right:x+m.ink.right*scale,top:y+m.ink.top*scale,bottom:contactY};
 let insert;
 if(item.roller){
  const material=item.applicator==='Metal Roller Ball'?'metal':'plastic';
  const ref=Object.values(nine.rows).flatMap(k=>k.parts).find(p=>p.slot==='roller'&&p.image.url.includes('roller-'+material+'.'));
  if(!ref)throw Error('Missing corrected '+material+' source');
  const old=kit.parts.find(p=>p.slot==='roller');
  const s=(old.bounds.right-old.bounds.left)/(908-140),ix=kit.anchors.axisX-(140+908)/2*s,iy=kit.anchors.seatY-760*s;
  insert={...structuredClone(ref),componentId:old.componentId,explodeIndex:0,zOrder:0,box:{x:ix,y:iy,width:ref.image.width*s,height:ref.image.height*s},bounds:{left:ix+140*s,right:ix+908*s,top:iy+118*s,bottom:iy+1351*s},exploded:{dx:0,dy:0}};
  delete insert.views;kit.parts=[insert,body,cap];
 }else{kit.parts=[body,cap];}
 changes.push({sku:item.sku,glass:item.glass,applicator:item.applicator,roller:item.roller,capId:cap.componentId,capBottomBefore:oldCap.bounds.bottom,capBottomAfter:cap.bounds.bottom,capWidthBefore:oldCap.bounds.right-oldCap.bounds.left,capWidthAfter:cap.bounds.right-cap.bounds.left,capSeat:shortPlastic?'Original thread seat retained for short ribbed plastic cap':'Common visible shoulder seat',rollerSeatY:insert?kit.anchors.seatY:null,rollerFlangeWidth:insert?insert.bounds.right-insert.bounds.left:null,rollerSource:insert?.image.url});
}
library.version=sha(JSON.stringify(library.rows)).slice(0,12);index.version=library.version;
fs.writeFileSync(out+'/kits.json',JSON.stringify(library,null,2)+'\n');fs.writeFileSync('src/lib/products/cylinder5-master-index.json',JSON.stringify(index,null,2)+'\n');
fs.writeFileSync(dir+'/registration.json',JSON.stringify({version:library.version,source9mlVersion:nine.version,rollerFlangeSourceY:760,scope:changes,limits:'Reused straight-on generated roller material registered uniformly to the existing 5 ml rim width. Visual component fit, not certified plug dimensions. Original short ribbed plastic caps retain their thread seat; their depth cannot reach the shoulder without exposing the glass rim above the cap.'},null,2)+'\n');
console.log({version:library.version,rollers:changes.filter(x=>x.roller).length,pour:changes.filter(x=>!x.roller).length});
