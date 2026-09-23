// Align independently reviewed native renders as complete assemblies.
// No body/component warping, recoloring, background removal or new API calls.
const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const root=path.resolve('output/imagegen/boston-diva-2026-09-23'),out=path.join(root,'aligned');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))),marks=JSON.parse(fs.readFileSync(path.join(root,'landmarks.json')));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{const rows=[];
for(const r of manifest.rows){
 const m=marks.rows[r.sku];if(!m||!fs.existsSync(r.rawOutput))continue;
 const receipt=JSON.parse(fs.readFileSync(r.rawOutput.replace('.png','.render.json')));if(hash(r.rawOutput)!==receipt.outputSha256)throw Error(`Source hash ${r.sku}`);
 const s=(r.target.baseY-r.target.upperY)/((m.base-m.upper)/396*2288);
 if(s<.6||s>1.5)throw Error(`Review exceptional scale ${r.sku}: ${s}`);
 const hasSidecar=/Roll|BlkCap|Spry|Ltn/.test(r.sku),cx=m.targetCxPct?m.targetCxPct/100:r.sku.includes('Tsl')?.70:r.sku.includes('AnSp')?.56:hasSidecar?.44:.5;
 const targetX=2080*cx,top=Math.round(r.target.baseY-m.base/396*2288*s),left=Math.round(targetX-m.cx/360*2080*s);
 const resized=await sharp(r.rawOutput).resize(Math.round(2080*s),Math.round(2288*s),{kernel:'lanczos3'}).toBuffer(),meta=await sharp(resized).metadata();
 const cutL=Math.max(0,-left),cutT=Math.max(0,-top),destL=Math.max(0,left),destT=Math.max(0,top);
 const width=Math.min(meta.width-cutL,2080-destL),height=Math.min(meta.height-cutT,2288-destT);
 const final=path.join(out,r.sku+'-2080x2288.png');
 await sharp({create:{width:2080,height:2288,channels:3,background:'#F5F3EF'}}).composite([{input:await sharp(resized).extract({left:cutL,top:cutT,width,height}).toBuffer(),left:destL,top:destT}]).png().toFile(final);
 const {data:p,info}=await sharp(final).removeAlpha().raw().toBuffer({resolveWithObject:true});let edgeHits=0;
 for(let y=0;y<2288;y++)for(let x=0;x<2080;x++){if(x>=24&&x<2056&&y>=24&&y<2264)continue;const k=(y*2080+x)*3;if(Math.max(...[245,243,239].map((v,c)=>Math.abs(p[k+c]-v)))>30)edgeHits++;}
 if(edgeHits>50)throw Error(`Possible content clipping ${r.sku}: ${edgeHits} edge pixels`);
 rows.push({...r,finalPath:final,finalSha256:hash(final),sourceRenderSha256:receipt.outputSha256,alignment:{sourceLandmarks:m,coordinateWidth:360,coordinateHeight:396,sourceMeasurementUncertaintyPx:marks.uncertaintyPreviewPx,uniformScale:s,left,top,bodyCenterXPct:cx*100,edgeHits,method:'Whole-assembly uniform resampling and translation onto 2080x2288 bone canvas. Product proportions, hardware relationship and source shadows preserved.'},status:'aligned-review-candidate-not-published'});
}
fs.writeFileSync(path.join(root,'finished-manifest.json'),JSON.stringify({status:'review-candidates-not-published',nativeGeneratedSize:[2080,2288],finalCanvas:[2080,2288],landmarkMethod:marks.method,rows},null,2)+'\n');console.log(`Aligned ${rows.length}/47`);
})();
