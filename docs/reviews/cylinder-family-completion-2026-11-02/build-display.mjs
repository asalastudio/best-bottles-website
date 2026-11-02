import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir='docs/reviews/cylinder-family-completion-2026-11-02',out='public/local-kits/cylinder-family-completion-2026-11-02/display';
const kits=JSON.parse(fs.readFileSync('public/local-kits/cylinder-family-completion-2026-11-02/kits.json')).rows;
const sha=b=>createHash('sha256').update(b).digest('hex');
const assets=new Map();
for(const kit of Object.values(kits))for(const part of kit.parts)for(const image of [part.image,part.detached?.image].filter(Boolean))if(image.url.startsWith('/local-kits/'))assets.set(image.url,image);
const sources={},pixelWidths={},report={assets:{}};
for(const [url,image] of assets){
 const bytes=fs.readFileSync('public'+url),hash=sha(bytes);if(image.sha256&&hash!==image.sha256)throw Error('Changed source '+url);
 const folder=out+'/'+hash;fs.mkdirSync(folder,{recursive:true});const derivatives={};sources[url]={};pixelWidths[url]={};
 for(const width of [128,256,640,1200]){
  const pipeline=sharp(bytes).resize({width,withoutEnlargement:true}).ensureAlpha();
  const reference=await pipeline.clone().raw().toBuffer({resolveWithObject:true});
  const encoded=await pipeline.clone().webp({lossless:true,effort:6,alphaQuality:100}).toBuffer();
  const decoded=await sharp(encoded).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let alphaDifferences=0,visibleColorDifferences=0;
  for(let i=0;i<reference.data.length;i+=4){if(reference.data[i+3]!==decoded.data[i+3])alphaDifferences++;if(reference.data[i+3]&&[0,1,2].some(c=>reference.data[i+c]!==decoded.data[i+c]))visibleColorDifferences++;}
  if(alphaDifferences||visibleColorDifferences)throw Error('Lossless encode changed '+url);
  const hash=sha(encoded),file=folder+'/'+width+'.'+hash.slice(0,12)+'.webp';fs.writeFileSync(file,encoded);
  sources[url][width]='/'+file.slice('public/'.length);pixelWidths[url][width]=decoded.info.width;
  derivatives[width]={url:sources[url][width],sha256:hash,bytes:encoded.length,width:decoded.info.width,height:decoded.info.height,alphaDifferences,visibleColorDifferences};
 }
 report.assets[url]={sourceSha256:hash,sourceBytes:bytes.length,derivatives};
}
const entries=Object.values(report.assets);report.summary={sources:entries.length,sourceBytes:entries.reduce((n,e)=>n+e.sourceBytes,0),displayBytes:Object.fromEntries([128,256,640,1200].map(w=>[w,entries.reduce((n,e)=>n+e.derivatives[w].bytes,0)])),losslessChecksPassed:true,publication:'Local review delivery copies only; source masters unchanged'};
fs.writeFileSync(dir+'/display-verification.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync('src/lib/products/review-display-images.generated.json',JSON.stringify({version:sha(Buffer.from(JSON.stringify({sources,pixelWidths}))).slice(0,16),sources,pixelWidths})+'\n');
console.log(JSON.stringify(report.summary));
