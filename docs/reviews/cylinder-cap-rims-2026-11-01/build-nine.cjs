const fs=require('fs'),sharp=require('sharp'),crypto=require('crypto'),assert=require('assert/strict');
const dir='docs/reviews/cylinder-cap-rims-2026-11-01',out='public/local-kits/cylinder-cap-rims-2026-11-01';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const library=JSON.parse(fs.readFileSync(dir+'/before-9-kits.json')),index=JSON.parse(fs.readFileSync(dir+'/before-9-index.json'));
 const ids=[...new Set(Object.values(library.rows).flatMap(k=>k.parts.filter(p=>p.slot==='cap').map(p=>p.componentId)))];
 const assets={};
 for(const id of ids){
  const source=dir+'/sources/'+id+'-original-full.png',m=await sharp(source).metadata();
  const generated={'CMP-ROC-SGLD-17415':['tall-gold',[40,60,948,1438]],'CMP-ROC-SSLV-17415':['tall-silver',[42,53,941,1444]]}[id];
  let pixels;
  if(generated){
   const [key,[left,top,width,height]]=generated;
   const mask=await sharp(source).resize(m.width*3,m.height*3).extractChannel('alpha').toBuffer();
   const rgb=await sharp(dir+'/sources/'+key+'-generated.png').extract({left,top,width,height}).removeAlpha().resize(m.width*3,m.height*3,{fit:'fill'}).toBuffer();
   pixels=sharp(rgb).joinChannel(mask);
  }else pixels=sharp(source);
  const factor=generated?3:1,pad=4*factor;
  const bytes=await pixels.extend({top:pad,bottom:pad,left:pad,right:pad,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const sha256=hash(bytes),file=id+'.'+sha256.slice(0,12)+'.png';fs.writeFileSync(out+'/'+file,bytes);
  assets[id]={image:{url:'/local-kits/cylinder-cap-rims-2026-11-01/'+file,key:'',width:(m.width+8)*factor,height:(m.height+8)*factor,bytes:bytes.length,sha256},originalWidth:m.width,originalHeight:m.height,source,method:generated?'Approved GPT metal registered to the complete original 17-415 cap silhouette':'Complete original Photoshop layer, with transparent safety padding'};
 }
 const changed=[];
 for(const[sku,kit]of Object.entries(library.rows)){
  const cap=kit.parts.find(p=>p.slot==='cap');if(!cap)continue;
  const original=structuredClone(cap),a=assets[cap.componentId];
  const w=cap.bounds.right-cap.bounds.left,scale=w/a.originalWidth,bottom=cap.bounds.bottom,top=bottom-scale*a.originalHeight;
  cap.image=a.image;cap.image2x=null;
  cap.bounds={left:original.bounds.left,right:original.bounds.right,top,bottom};
  cap.box={x:cap.bounds.left-4*scale,y:top-4*scale,width:(a.originalWidth+8)*scale,height:(a.originalHeight+8)*scale};
  assert.equal(cap.bounds.bottom,original.bounds.bottom);assert.equal(cap.bounds.left,original.bounds.left);assert.equal(cap.bounds.right,original.bounds.right);
  changed.push({sku,id:cap.componentId,beforeBounds:original.bounds,afterBounds:cap.bounds});
 }
 library.version=hash(JSON.stringify(library.rows)).slice(0,12);index.version=library.version;
 fs.writeFileSync('public/local-kits/cylinder9-masters-2026-11-01/kits.json',JSON.stringify(library,null,2)+'\n');fs.writeFileSync('src/lib/products/cylinder9-master-index.json',JSON.stringify(index,null,2)+'\n');
 fs.writeFileSync(dir+'/registration-9.json',JSON.stringify({version:library.version,assets,changed,status:'Local review. Cap width, centerline and bottom seating retained; complete source aspect restores top silhouette. Bodies and roller inserts unchanged.'},null,2)+'\n');
 console.log(JSON.stringify({count:changed.length,finishes:ids.length,version:library.version}));
})().catch(e=>{console.error(e);process.exit(1)});
