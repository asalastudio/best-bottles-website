// Display-only uniform framing and guide overlays. No generation or registry changes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
const root=process.cwd(),out=path.join(root,'output/shoulder-lock-review-2026-09-23');fs.mkdirSync(out,{recursive:true});
const intake=JSON.parse(fs.readFileSync('docs/reviews/next-five-salvage-2026-09-23/intake.json')).rows;
const lockSource='/Users/jordanrichter/Projects/Madison Studio/madison-app/.worktrees/hero-catalog-scale-plan-2026-09-22/src/lib/bestBottlesShoulderLock.ts';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const definitions=[
 ['Boston Round','boston-round',[
  ['GBBstn15BlkCapSht',15,42,152,199,357],['GBBstn1ozBlkCapSht',30,45,156,186,357],['GBBstn2ozBlkCapSht',60,52,176,175,356]]],
 ['Diva','diva',[
  ['GBDiva30SpryMtGl',30,40,164,201,358],['GBDiva46SpryMtGl',46,47,165,175,357],['GBDiva100SpryMtGl',100,57,174,130,357]]],
 ['Sleek','sleek',[
  ['GBSleek5SpryGlMatt',5,33,154,228,358],['GBSleek8SpryGlMatt',8,43,150,191,358],['GBSlk30SpryMtGl',30,47,160,171,358],['GBSlk50SpryMtGl',50,56,160,139,358],['GBSlk100SpryMtGl',100,60.5,167,121,357]]]
];
const textSvg=(w,h,lines)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${lines}</svg>`);
const txt=(x,y,size,s,color='#282722')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" fill="${color}">${s}</text>`;
(async()=>{const report={status:'saved targets applied to existing artwork for scale review; not new renders',canvas:[2080,2288],baselinePct:91,lockSource,lockSourceSha256:hash(lockSource),sourceLandmarkNote:'Visually measured at 360 x 396, uncertainty about 2-3 preview pixels. Final generated images need independent measurement.',generationHeldForUserScaleReview:true,families:[]};
for(const [family,slug,defs] of definitions){let cards=[],rows=[];
for(const [sku,capacity,span,cx,shoulder,base]of defs){const r=intake.find(x=>x.websiteSku===sku);if(!r)throw Error(sku);const src=path.join(root,'public',r.url);if(hash(src)!==r.sha256)throw Error('Source changed '+sku);const meta=await sharp(src).metadata();const s=2288*span/100/((base-shoulder)/396*meta.height),tx=2080*.44-cx/360*meta.width*s,ty=2288*.91-base/396*meta.height*s;
const resized=await sharp(src).resize(Math.round(meta.width*s),Math.round(meta.height*s)).png().toBuffer(),dim=await sharp(resized).metadata();const left=Math.round(tx),top=Math.round(ty),cutX=Math.max(0,-left),cutY=Math.max(0,-top);const frame=path.join(out,sku+'-scale-preview.png');
await sharp({create:{width:2080,height:2288,channels:3,background:'#F5F3EF'}}).composite([{input:await sharp(resized).extract({left:cutX,top:cutY,width:Math.min(dim.width-cutX,2080-Math.max(0,left)),height:Math.min(dim.height-cutY,2288-Math.max(0,top))}).toBuffer(),left:Math.max(0,left),top:Math.max(0,top)}]).png().toFile(frame);
const sy=396*(91-span)/100,by=396*.91;
const guides=textSvg(360,396,`<line x1="0" x2="360" y1="${sy}" y2="${sy}" stroke="#A57B36" stroke-width="1.5" stroke-dasharray="5 4"/><line x1="0" x2="360" y1="${by}" y2="${by}" stroke="#278374" stroke-width="1.5"/>`);
const card=await sharp({create:{width:360,height:492,channels:3,background:'#F5F3EF'}}).composite([{input:await sharp(frame).resize(360,396).toBuffer(),left:0,top:0},{input:guides,left:0,top:0},{input:textSvg(360,96,txt(12,24,20,capacity+' mL · '+span+'% span')+txt(12,47,14,(family==='Diva'?'Cap / glass junction':'Glass shoulder')+' at '+(91-span)+'% down')+txt(12,69,11,sku)+txt(12,89,12,(sku==='GBBstn2ozBlkCapSht'?'Existing capped source; final will have sidecar':'Existing artwork · scale preview'),'#666')),left:0,top:396}]).png().toBuffer();cards.push(card);rows.push({sku,capacityMl:capacity,spanPct:span,upperYPercent:91-span,baselinePct:91,landmark:family==='Diva'?'closure seat at cap/glass junction':'glass shoulder',sourceSha256:r.sha256,sourceUrl:r.url,sourceLandmarks:{cx,shoulder,base,coordinateWidth:360,coordinateHeight:396},transform:{scale:s,x:tx,y:ty},preview:path.relative(root,frame),previewSha256:hash(frame)});
}
const cols=3,height=90+Math.ceil(cards.length/cols)*492,layers=cards.map((input,i)=>({input,left:(i%cols)*360,top:90+Math.floor(i/cols)*492}));layers.push({input:textSvg(1080,90,txt(14,30,27,family+' — shoulder-lock preview')+txt(14,55,16,'Gold: target upper landmark · Teal: fixed 91% glass base')+txt(14,77,14,'Bottles are resized to the saved targets. Existing artwork; no new generation.','#666')),left:0,top:0});const sheet=path.join(out,slug+'-shoulder-locks.png');await sharp({create:{width:1080,height,channels:3,background:'#F5F3EF'}}).composite(layers).png().toFile(sheet);report.families.push({family,rows,sheet:path.relative(root,sheet)});
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Three-family shoulder locks</title><style>body{background:#F5F3EF;color:#282722;max-width:1080px;margin:20px auto;font:16px system-ui}img{width:100%;display:block;margin:20px 0}p{padding:0 15px}</style><p>Saved targets shown on uniformly framed existing artwork. No new generation. Gold = upper landmark; teal = 91% base. Diva uses the cap/glass junction. Boston 60 mL retains its old cap only for this scale preview.</p>${definitions.map(([,s])=>`<img src="${s}-shoulder-locks.png">`).join('')}`);console.log('11 previews across 3 families built; source hashes unchanged; no API calls');})();
