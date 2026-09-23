// Register whole photographs using visually checked native glass landmarks.
// Preserves native bytes and never changes catalog selection or publication.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve('output/imagegen/elegant-2026-09-23');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'active-manifest.json')));
const measurements=JSON.parse(fs.readFileSync(path.join(root,'verified-native-landmarks.json')));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const out=path.join(root,'aligned');fs.mkdirSync(out,{recursive:true});const rows=[];
 for(const m of measurements){
  const r=manifest.rows.find(r=>r.sku===m.sku);
  if(!r||m.measurementStatus!=='visually-checked-native-shoulder-and-glass-foot')throw Error('Unverified '+m.sku);
  const record=JSON.parse(fs.readFileSync(r.rawOutput.replace(/\.png$/,'.render.json')));
  if(hash(r.rawOutput)!==m.nativeSha256||record.outputSha256!==m.nativeSha256)throw Error('Changed native '+m.sku);
  const meta=await sharp(r.rawOutput).metadata();if(meta.width!==2080||meta.height!==2288)throw Error('Dimensions '+m.sku);
  const span=2288*r.target.shoulderPct/100,scale=span/(m.glassFootY-m.glassShoulderY),y=2082.08-scale*m.glassFootY,b=m.artworkBounds;
  if(scale*(b[2]-b[0])>2032)throw Error('Artwork too wide '+m.sku);
  const x=Math.min(Math.max((1-scale)*m.centerX,24-scale*b[0]),2056-scale*b[2]);
  const bounds=[scale*b[0]+x,scale*b[1]+y,scale*b[2]+x,scale*b[3]+y];
  if(bounds[1]<24||bounds[3]>2264)throw Error('Vertical crop '+m.sku);
  const finalPath=path.join(out,m.sku+'-2080x2288.png'),data=fs.readFileSync(r.rawOutput).toString('base64');
  await sharp(Buffer.from(`<svg width="2080" height="2288" xmlns="http://www.w3.org/2000/svg"><rect width="2080" height="2288" fill="#F5F3EF"/><image href="data:image/png;base64,${data}" width="2080" height="2288" transform="translate(${x} ${y}) scale(${scale})"/></svg>`)).png().toFile(finalPath);
  rows.push({sku:r.sku,capacityMl:r.capacityMl,catalog:r.catalog,target:r.target,nativePath:r.rawOutput,nativeSha256:m.nativeSha256,finalPath,finalSha256:hash(finalPath),dimensions:[2080,2288],transform:{scale,x,y},glassShoulderY:2082.08-span,glassFootY:2082.08,measurementUncertaintyPx:m.uncertaintyPx*scale,transformedArtworkBounds:bounds,status:'aligned-awaiting-user-review'});
 }
 fs.writeFileSync(path.join(root,'aligned-exports.json'),JSON.stringify({status:'measured-alignment-user-review-pending',rows},null,2)+'\n');
 console.log(JSON.stringify({aligned:rows.length,total:manifest.rows.length,scaleRange:[Math.min(...rows.map(r=>r.transform.scale)),Math.max(...rows.map(r=>r.transform.scale))]}));
})().catch(e=>{console.error(e);process.exitCode=1});
