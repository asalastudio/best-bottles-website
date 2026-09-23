const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const root=path.resolve('output/imagegen/boston-diva-2026-09-23'),out=path.join(root,process.argv.includes('--raw')?'raw-review':'review');fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const pilots=JSON.parse(fs.readFileSync('output/imagegen/boston-round-2026-09-23/finishing/v1/finished-manifest.json')).rows.map(r=>({...r,family:'Boston Round',material:r.catalog.bottleColor,target:{spanPct:r.target.shoulderPct,upperY:Math.round(2288*(91-r.target.shoulderPct)/100),baseY:2082,landmark:'glass shoulder'},reused:true}));
const finished=!process.argv.includes('--raw')&&fs.existsSync(path.join(root,'finished-manifest.json'))?JSON.parse(fs.readFileSync(path.join(root,'finished-manifest.json'))).rows:[];
const candidates=manifest.rows.map(r=>finished.find(f=>f.sku===r.sku)||r);
const svg=(w,h,b)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${b}</svg>`),escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
(async()=>{
 const rows=[],qa=[];
 for(const r of [...pilots,...candidates]){
  const file=r.finalPath||r.rawOutput;if(!fs.existsSync(file))continue;
  const receipt=JSON.parse(fs.readFileSync(r.rawOutput.replace('.png','.render.json')));
  const expected=r.finalSha256||receipt.outputSha256;if(hash(file)!==expected)throw Error(`Hash mismatch ${r.sku}`);
  const {data:p,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width!==2080||info.height!==2288)throw Error(`Wrong native size ${r.sku}`);
  const patches=[];
  for(const [x0,y0,x1,y1]of [[960,8,1120,64],[160,160,320,320],[1760,160,1920,320],[32,800,112,1200],(r.sku==='GBDiva100AnSpTslGl'?[1968,80,2048,240]:[1968,800,2048,1200])]){
   const cs=[[],[],[]],ds=[];
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const k=(y*2080+x)*3,d=[];for(let c=0;c<3;c++){cs[c].push(p[k+c]);d.push(Math.abs(p[k+c]-[245,243,239][c]));}ds.push(Math.max(...d));}
   cs.forEach(a=>a.sort((a,b)=>a-b));ds.sort((a,b)=>a-b);patches.push({box:[x0,y0,x1,y1],median:cs.map(a=>a[a.length>>1]),p95:ds[Math.floor(ds.length*.95)]});
  }
  const preview=path.join(out,r.sku+'.jpg');await sharp(file).resize(520,572).jpeg({quality:93}).toFile(preview);
  rows.push({...r,selectedPath:file,selectedSha256:expected});qa.push({sku:r.sku,dimensions:[2080,2288],sha256:expected,backgroundPatches:patches,backgroundSamplingNote:r.sku==='GBDiva100AnSpTslGl'?'Right mid-edge patch intersects glass; sampled verified empty upper-right edge instead.':null,backgroundReviewNeeded:patches.some(p=>p.p95>3),geometryReview:'visual and landmark checks required',catalogPublicationHold:r.catalogPublicationHold||null});
 }
 const pages=[];
 for(const family of ['Boston Round','Diva'])for(const capacity of family==='Diva'?[30,46,100]:[15,30,60]){
  const group=rows.filter(r=>r.family===family&&r.capacityMl===capacity).sort((a,b)=>a.catalog.bottleColor.localeCompare(b.catalog.bottleColor)||a.sku.localeCompare(b.sku));if(!group.length)continue;
  const columns=3,cw=360,ch=465,width=1080,height=88+Math.ceil(group.length/columns)*ch;
  for(const guided of [false,true]){
   const layers=[{input:svg(width,88,`<text x="18" y="31" font-family="Arial" font-size="26">${family} · ${capacity} mL · ${group.length} heroes</text><text x="18" y="59" font-family="Arial" font-size="16">${guided?'Gold: target upper landmark · teal: 91% glass base':'Sunburst 2.5 · native 2080 × 2288 · bone #F5F3EF'} · Review candidates</text>`),left:0,top:0}];
   for(const [i,r]of group.entries()){
    const left=i%columns*cw,top=88+Math.floor(i/columns)*ch;
    layers.push({input:await sharp(r.selectedPath).resize(360,396).png().toBuffer(),left,top});
    if(guided)layers.push({input:svg(360,396,`<line x1="0" x2="360" y1="${r.target.upperY/2288*396}" y2="${r.target.upperY/2288*396}" stroke="#a57b36" stroke-dasharray="5 4"/><line x1="0" x2="360" y1="360.36" y2="360.36" stroke="#278374"/>`),left,top});
    layers.push({input:svg(360,69,`<text x="10" y="21" font-family="Arial" font-size="15">${escape(r.catalog.bottleColor)} · span ${r.target.spanPct}%${r.reused?' · pilot':''}</text><text x="10" y="43" font-family="Arial" font-size="11">${escape(r.sku)}</text>${r.catalogPublicationHold?'<text x="10" y="61" font-family="Arial" font-size="10" fill="#975323">Catalog association requires reconciliation</text>':''}`),left,top:top+396});
   }
   const name=`${family.toLowerCase().replaceAll(' ','-')}-${capacity}ml-${guided?'guided':'clean'}.jpg`;
   await sharp({create:{width,height,channels:3,background:'#F5F3EF'}}).composite(layers).jpeg({quality:95}).toFile(path.join(out,name));if(!guided)pages.push(name);
  }
 }
 fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify({count:rows.length,expectedTotal:50,rows:qa},null,2)+'\n');
 fs.writeFileSync(path.join(out,'selected-manifest.json'),JSON.stringify({status:'rendered-candidates-not-published',rows},null,2)+'\n');
 fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Boston Round and Diva review</title><style>body{background:#F5F3EF;color:#292824;font:16px system-ui;margin:24px auto;max-width:1080px}img{display:block;max-width:100%;margin:18px 0}a{color:inherit}</style><h1>Boston Round + Diva</h1><p>${rows.length}/50 hero images · review candidates · not published</p>${pages.map(p=>`<a href="${p.replace('clean','guided')}">View shoulder and base guides</a><img src="${p}">`).join('')}`);
 console.log(JSON.stringify({checked:rows.length,pages,backgroundFlags:qa.filter(q=>q.backgroundReviewNeeded).map(q=>({sku:q.sku,p95:q.backgroundPatches.map(p=>p.p95)}))}));
})();
