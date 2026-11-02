import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const dir='docs/reviews/vial3-swatches-builder-2026-11-02',out='public/local-kits/vial3-swatches-builder-2026-11-02';
fs.mkdirSync(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={method:'Cut out the existing approved released photographs without regenerating, stretching or recoloring their body pixels.',assets:[],sourceConflicts:['The current blue source describes 5/8 dram but its capacity table says 2 ml while the existing catalog route says 3 ml. Capacity records are unchanged.','Green legacy height is 29 mm; the approved 2026-09-25 caliper scale uses 27 mm. Preserve that approved canvas scale; no new measurements are asserted.','A blue/white source exists but has no active catalog/Shopify variant. It is not made orderable by this image repair.']};
async function asset(bytes,name,lineage){
 const raw=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const encoded=await sharp(bytes).webp({lossless:true,effort:6}).toBuffer();
 const decoded=await sharp(encoded).ensureAlpha().raw().toBuffer();
 let alphaDifferences=0,visibleColorDifferences=0;
 for(let i=0;i<decoded.length;i+=4){if(decoded[i+3]!==raw.data[i+3])alphaDifferences++;if(decoded[i+3]&&[0,1,2].some(c=>decoded[i+c]!==raw.data[i+c]))visibleColorDifferences++;}
 assert.equal(alphaDifferences,0);assert.equal(visibleColorDifferences,0);
 const hash=sha(encoded),file=name+'.'+hash.slice(0,12)+'.webp';fs.writeFileSync(out+'/'+file,encoded);
 const bounds={left:raw.info.width,top:raw.info.height,right:0,bottom:0};
 for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>=32){bounds.left=Math.min(bounds.left,x);bounds.top=Math.min(bounds.top,y);bounds.right=Math.max(bounds.right,x+1);bounds.bottom=Math.max(bounds.bottom,y+1);}
 const result={image:{url:'/'+out.slice('public/'.length)+'/'+file,key:file,sha256:hash,bytes:encoded.length,width:raw.info.width,height:raw.info.height},bounds};
 report.assets.push({...result,...lineage,alphaDifferences,visibleColorDifferences});return result;
}
async function cutout(source,name,region,mode){
 const bytes=fs.readFileSync(source),raw=await sharp(bytes).extract(region).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const rgba=Buffer.from(raw.data);let left=raw.info.width,right=-1,top=raw.info.height,bottom=-1;
 for(let y=0;y<raw.info.height;y++){
  let l=raw.info.width,r=-1;
  for(let x=0;x<raw.info.width;x++){
   const i=(y*raw.info.width+x)*4,hi=Math.max(...raw.data.subarray(i,i+3)),lo=Math.min(...raw.data.subarray(i,i+3));
   const foreground=mode==='body'?(hi-lo>22||hi<80):hi<135;
   if(foreground){l=Math.min(l,x);r=Math.max(r,x);}
  }
  for(let x=0;x<raw.info.width;x++)rgba[(y*raw.info.width+x)*4+3]=x>=l&&x<=r?255:0;
  if(r>=l){left=Math.min(left,l);right=Math.max(right,r);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 }
 assert(right>left&&bottom>top,'Missing source silhouette');
 // Only alpha changes. Every RGB pixel remains the approved source pixel.
 const cropped=await sharp(rgba,{raw:raw.info}).extract({left,top,width:right-left+1,height:bottom-top+1}).png().toBuffer();
 return asset(cropped,name,{sourceFile:source,sourceSha256:sha(bytes),sourceRegion:{left:region.left+left,top:region.top+top,width:right-left+1,height:bottom-top+1},originalRgbChanged:0,role:mode});
}
const sources={
 Green:'public/images/catalog/vials-approved-2026-09-25/GBVGreen2o4BlackCapSht.d703a6db23d6.webp',
 Blue:'public/images/catalog/vials-approved-2026-09-25/GBVBlu1o9BlackCapSht.ecc1de43a5fe.webp',
};
const bodies={};
for(const [color,source]of Object.entries(sources))bodies[color]=await cutout(source,'body-'+color.toLowerCase(),{left:430,top:880,width:350,height:685},'body');
const black=await cutout(sources.Green,'cap-black',{left:780,top:1350,width:290,height:206},'cap');
const white=await asset(fs.readFileSync(dir+'/sources/white-cap-native.png'),'cap-white',JSON.parse(fs.readFileSync(dir+'/sources/white-cap-lineage.json')));
const catalog=JSON.parse(fs.readFileSync(dir+'/catalog-snapshot.json')).rows;
const rows={},definitions={GBVGreen2o4BlackCapSht:['Green','Black'],GBVGreen2o4WhtCapSht:['Green','White'],GBVBlu1o9BlackCapSht:['Blue','Black']};
function part(slot,art,x,y,scale,variant){
 const b=art.bounds;
 return {slot,variantKey:variant,componentId:null,zOrder:slot==='body'?0:1,explodeIndex:slot==='body'?0:1,
  assembled:{x:0,y:0},exploded:{dx:0,dy:slot==='body'?0:-210},image:art.image,image2x:null,mask:null,
  box:{x,y,width:art.image.width*scale,height:art.image.height*scale},
  bounds:{left:x+b.left*scale,top:y+b.top*scale,right:x+b.right*scale,bottom:y+b.bottom*scale},
  derivation:slot==='body'?'reviewed-photo-cutout':'source-cap-cutout'};
}
for(const [sku,[color,finish]]of Object.entries(definitions)){
 const row=catalog.find(row=>row.websiteSku===sku);assert(row&&row.color===color&&row.neckThreadSize==='13-425');
 const body=bodies[color],scale=700/(body.bounds.bottom-body.bounds.top),axis=500,foot=1000,seat=300;
 const glass=part('body',body,axis-(body.bounds.left+body.bounds.right)/2*scale,foot-body.bounds.bottom*scale,scale,color.toLowerCase());
 const shoulder=seat+body.image.height*scale*.275;
 const capArt=finish==='Black'?black:white;
 const capScale=(body.bounds.right-body.bounds.left)*scale*1.025/(capArt.bounds.right-capArt.bounds.left);
 const cap=part('cap',capArt,axis-(capArt.bounds.left+capArt.bounds.right)/2*capScale,shoulder-capArt.bounds.bottom*capScale,capScale,finish.toLowerCase());
 rows[sku]={sku,familyId:row.productGroupSlug,canvas:{width:1000,height:1100},anchors:{axisX:axis,neckAxisX:axis,seatY:shoulder,baselineY:foot},
  parts:[glass,cap],plateSha256:'',three:null,conflicts:[],completeness:'full',glassSizing:{heightPct:31.04,baselinePct:91}};
}
assert.equal(rows.GBVGreen2o4BlackCapSht.parts[0].image.sha256,rows.GBVGreen2o4WhtCapSht.parts[0].image.sha256);
fs.writeFileSync(out+'/kits.json',JSON.stringify({rows,defaultPdpSkus:Object.keys(rows)},null,2)+'\n');
report.configurations=Object.keys(rows);report.singleBodyPerGlass=true;report.publication='Local review candidate; hosted approved manifest unchanged';
fs.writeFileSync(dir+'/asset-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({configurations:Object.keys(rows).length,assets:report.assets.length,singleBodyPerGlass:true,lossless:true}));
