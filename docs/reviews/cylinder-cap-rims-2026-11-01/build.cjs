const fs=require('fs'),sharp=require('sharp'),crypto=require('crypto'),assert=require('assert/strict');
const dir='docs/reviews/cylinder-cap-rims-2026-11-01',out='public/local-kits/cylinder-cap-rims-2026-11-01';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const specs=[
 {key:'tall-gold',id:'CMP-CAP-SGLD-13-415-01',ids:['CMP-CAP-SGLD-13-415-01','CMP-ROC-SGLD-13415'],crop:[40,60,948,1438]},
 {key:'tall-silver',id:'CMP-CAP-SLV-13-415-01',ids:['CMP-CAP-SLV-13-415-01','CMP-ROC-SSLV-13415'],crop:[42,53,941,1444]},
 {key:'short-gold',id:'CMP-CLS-SHGD-S-13-415',ids:['CMP-CLS-SHGD-S-13-415'],crop:[27,45,1158,1231]},
 {key:'short-silver',id:'CMP-CLS-SHSL-S-13-415-02',ids:['CMP-CLS-SHSL-S-13-415-02'],crop:[36,70,1139,1175]}
];
(async()=>{
 const assets={};for(const s of specs){
  const original='docs/reviews/cylinder5-rollers-pour-2026-11-01/sources/'+s.id+'.png',meta=await sharp(original).metadata(),w=meta.width*3,h=meta.height*3;
  // Registration derivative: retain the exact source silhouette and contact bounds.
  // Generated RGB supplies the revised metal material; original alpha removes detached exterior speckles.
  const mask=await sharp(original).resize(w,h).extractChannel('alpha').toBuffer();
  const [left,top,width,height]=s.crop;
  const rgb=await sharp(dir+'/sources/'+s.key+'-generated.png').extract({left,top,width,height}).removeAlpha().resize(w,h,{fit:'fill'}).toBuffer();
  const bytes=await sharp(rgb).joinChannel(mask).extend({top:12,bottom:12,left:12,right:12,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const name=s.key+'.'+sha(bytes).slice(0,12)+'.png';fs.writeFileSync(out+'/'+name,bytes);
  assets[s.key]={file:name,url:'/local-kits/cylinder-cap-rims-2026-11-01/'+name,sha256:sha(bytes),bytes:bytes.length,width:w+24,height:h+24,originalWidth:meta.width,originalHeight:meta.height,crop:s.crop};
 }
 const library=JSON.parse(fs.readFileSync(dir+'/before-5-kits.json')),index=JSON.parse(fs.readFileSync(dir+'/before-5-index.json')),changed=[];
 for(const [sku,k]of Object.entries(library.rows)){const cap=k.parts.find(p=>p.slot==='cap'),spec=specs.find(s=>s.ids.includes(cap?.componentId));if(!spec)continue;const a=assets[spec.key],old=structuredClone(cap),sx=old.box.width/a.originalWidth,sy=old.box.height/a.originalHeight;
  cap.image={url:a.url,key:'',sha256:a.sha256,bytes:a.bytes,width:a.width,height:a.height};cap.image2x=null;
  cap.box={x:old.box.x-4*sx,y:old.box.y-4*sy,width:old.box.width+8*sx,height:old.box.height+8*sy};
  assert.deepEqual(cap.bounds,old.bounds);changed.push({sku,key:spec.key,id:cap.componentId,bounds:cap.bounds});
 }
 library.version=sha(JSON.stringify(library.rows)).slice(0,12);index.version=library.version;
 fs.writeFileSync('public/local-kits/cylinder5-masters-2026-11-01/kits.json',JSON.stringify(library,null,2)+'\n');fs.writeFileSync('src/lib/products/cylinder5-master-index.json',JSON.stringify(index,null,2)+'\n');
 fs.writeFileSync(dir+'/registration-5.json',JSON.stringify({assets,changed,version:library.version,method:'Generated metal surface registered to the existing cap alpha silhouette. Existing cap bounds, seat, body, roller and scale are unchanged. Padding is transparent and included in the image box.'},null,2)+'\n');console.log('Registered',changed.length,'5 ml cap configurations',library.version);
})().catch(e=>{console.error(e);process.exit(1)});
