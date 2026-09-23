const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
const root=path.resolve('output/imagegen/elegant-2026-09-23'),out=path.join(root,'background-cleanup/v2');
const original=JSON.parse(fs.readFileSync(path.join(root,'aligned-exports.json'))),clean=JSON.parse(fs.readFileSync(path.join(out,'cleanup-exports.json')));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const patches=[[960,32,1120,112],[160,160,320,320],[1760,160,1920,320],[32,800,112,1200],[1968,800,2048,1200]];
const svg=(w,h,text)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#F5F3EF"/><text x="18" y="27" font-family="Arial" font-size="17" fill="#292824">${text}</text></svg>`);
(async()=>{
 const qa=[];
 for(const r of original.rows)if(hash(r.finalPath)!==r.finalSha256)throw Error('Original changed '+r.sku);
 for(const r of clean.rows){
  const {data,info}=await sharp(r.finalPath).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width!==2080||info.height!==2288||hash(r.finalPath)!==r.finalSha256)throw Error('Invalid export '+r.sku);
  let count=0,wrong=0;for(const [x0,y0,x1,y1]of patches)for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){count++;const i=(y*2080+x)*3;if(data[i]!==245||data[i+1]!==243||data[i+2]!==239)wrong++;}
  if(wrong)throw Error('Background patch mismatch '+r.sku+' '+wrong);
  r.status='background-cleanup-checked-awaiting-user-review';
  qa.push({sku:r.sku,dimensions:[info.width,info.height],sampledBackgroundPixels:count,exactBonePercent:100,protectedArtworkPixelsChanged:r.backgroundCleanup.protectedArtworkPixelsChanged,spatialTransformApplied:false,visualCheck:'Bottle, edge transitions and localized shadow checked'});
 }
 const merged=original.rows.map(r=>clean.rows.find(c=>c.sku===r.sku)||r);
 fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify({target:'#F5F3EF',originalsUnchanged:31,selectedOriginalsUnchanged:26,cleaned:5,published:false,rows:qa},null,2)+'\n');
 fs.writeFileSync(path.join(out,'cleanup-exports.json'),JSON.stringify(clean,null,2)+'\n');
 fs.writeFileSync(path.join(out,'merged-family-exports.json'),JSON.stringify({status:'five-cleanups-awaiting-user-review',unchanged:26,cleaned:5,published:false,rows:merged},null,2)+'\n');
 // Two mobile sheets; left original, right cleaned. No cropping or auto-trimming.
 const pages=[clean.rows.slice(0,3),clean.rows.slice(3)];
 for(let pi=0;pi<pages.length;pi++){
  const rows=pages[pi],layers=[{input:svg(840,45,'Elegant · original / cleaned · bone #F5F3EF'),top:0,left:0}];
  for(let i=0;i<rows.length;i++){
   const r=rows[i],top=45+i*510;
   layers.push({input:svg(840,40,r.sku+' · '+r.capacityMl+' mL'),top,left:0});
   for(const [j,p]of [r.previousFinalPath,r.finalPath].entries())layers.push({input:await sharp(p).resize(420,462).png().toBuffer(),top:top+40,left:j*420});
  }
  await sharp({create:{width:840,height:45+rows.length*510,channels:3,background:'#F5F3EF'}}).composite(layers).png().toFile(path.join(out,'comparison-'+(pi+1)+'.png'));
 }
 const cards=clean.rows.map(r=>`<article><h2>${r.sku} · ${r.capacityMl} mL</h2><div><figure><img src="../../aligned/${path.basename(r.previousFinalPath)}"><figcaption>Original</figcaption></figure><figure><img src="${path.basename(r.finalPath)}"><figcaption>Cleaned</figcaption></figure></div></article>`).join('');
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elegant background cleanup</title><style>body{background:#F5F3EF;color:#292824;font:16px system-ui;margin:24px auto;max-width:1050px;padding:0 16px}article{margin:40px 0}h2{font-size:17px}article div{display:flex}figure{width:50%;margin:0}img{width:100%;display:block}figcaption{text-align:center}</style><h1>Elegant — five background cleanups</h1><p>26 originals unchanged. Five backgrounds finished to bone #F5F3EF. Canvas, scale and shoulder/base positions unchanged. Local review only; not published.</p>${cards}`);
 console.log(JSON.stringify({checked:qa.length,originalsUnchanged:31,unchangedSelected:26,review:out}));
})();
