import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir='docs/reviews/vial3-swatches-builder-2026-11-02',prefix='/local-kits/vial3-swatches-builder-2026-11-02';
const delivery='src/lib/products/review-display-images.generated.json';
const manifest=JSON.parse(fs.readFileSync(delivery));
const {rows}=JSON.parse(fs.readFileSync('public'+prefix+'/kits.json'));
const assets=new Map(Object.values(rows).flatMap(kit=>kit.parts.map(part=>[part.image.url,part.image])));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={assets:{}};
for(const [url,image]of assets){
 const bytes=fs.readFileSync('public'+url);assert.equal(sha(bytes),image.sha256);
 const folder='public'+prefix+'/display/'+image.sha256;fs.mkdirSync(folder,{recursive:true});
 const sizes={},widths={};
 for(const width of [128,256,640,1200]){
  const resized=sharp(bytes).resize({width,withoutEnlargement:true}).ensureAlpha();
  const ref=await resized.clone().raw().toBuffer();
  const encoded=await resized.clone().webp({lossless:true,effort:6}).toBuffer();
  const decoded=await sharp(encoded).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let alphaDifferences=0,visibleColorDifferences=0;
  for(let i=0;i<ref.length;i+=4){
   if(ref[i+3]!==decoded.data[i+3])alphaDifferences++;
   if(ref[i+3]&&[0,1,2].some(channel=>ref[i+channel]!==decoded.data[i+channel]))visibleColorDifferences++;
  }
  // Lossless WebP may discard unused RGB underneath alpha zero. Compare every
  // alpha value and every visible RGB value, as in the shared display builder.
  assert.equal(alphaDifferences,0);assert.equal(visibleColorDifferences,0);
  const hash=sha(encoded),file=folder+'/'+width+'.'+hash.slice(0,12)+'.webp';fs.writeFileSync(file,encoded);
  sizes[width]='/'+file.slice('public/'.length);widths[width]=decoded.info.width;
  report.assets[url]??={sourceBytes:bytes.length,derivatives:{}};
  report.assets[url].derivatives[width]={url:sizes[width],bytes:encoded.length,width:decoded.info.width,height:decoded.info.height,sha256:hash,alphaDifferences,visibleColorDifferences};
 }
 manifest.sources[url]=sizes;manifest.pixelWidths[url]=widths;
}
manifest.version=sha(Buffer.from(JSON.stringify({sources:manifest.sources,pixelWidths:manifest.pixelWidths}))).slice(0,16);
report.losslessPixelComparisons=assets.size*4;
report.totalSourceBytes=Object.values(report.assets).reduce((n,a)=>n+a.sourceBytes,0);
report.total128Bytes=Object.values(report.assets).reduce((n,a)=>n+a.derivatives[128].bytes,0);
report.preservedOtherDeliverySources=Object.keys(manifest.sources).filter(url=>!url.startsWith(prefix)).length;
fs.writeFileSync(delivery,JSON.stringify(manifest)+'\n');
fs.writeFileSync(dir+'/display-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sources:assets.size,losslessPixelComparisons:report.losslessPixelComparisons,totalSourceBytes:report.totalSourceBytes,total128Bytes:report.total128Bytes}));
