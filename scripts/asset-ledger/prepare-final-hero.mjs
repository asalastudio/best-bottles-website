import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {readStandards} from './standard-review.mjs';
import {standardBinding} from './final-image-review.mjs';
import importer from '../../tools/hero-review/import.cjs';

// Explicitly authorized complete-photo sizing. No segmentation, generated pixels,
// selective component movement, shadow masks, shadow reconstruction or retouching.
const root=process.cwd();
const value=name=>process.argv[process.argv.indexOf('--'+name)+1];
const standardId=value('standard'),collection=value('collection');
if(!process.argv.includes('--whole-image-resize-authorized'))throw Error('Whole-image resize authorization is required.');
if(!/^boston-round-standard-30ml$/.test(standardId??'')||!/^boston-30ml-final-[a-z0-9-]+$/.test(collection??''))throw Error('This preparation is scoped to the reviewed 30 mL Boston reference.');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const {document,standards}=await readStandards(root),s=standards.find(s=>s.id===standardId),p=s?.appearancePreview;
if(!p?.ready)throw Error(p?.reason??'A verified locked standard is required.');
const ledger=await read('src/lib/asset-ledger/ledger.json');
const products=ledger.rows.filter(r=>r.productRecord&&r.sku===p.source.sku);
if(products.length!==1)throw Error('Reconcile the exact SKU.');
const product=products[0],group=ledger.groupRows.find(g=>g.id===product.productGroupId);
if(product.family!==s.family||product.capacityMl!==s.capacityMl||!group?.skus.includes(product.sku)||!s.productGroupIds.includes(group.id))throw Error('Catalog identity or physical membership differs.');
const indexFile='data/asset-ledger/final-image-candidates.json';
let index;try{index=await read(indexFile);}catch(e){if(e.code!=='ENOENT')throw e;index={schemaVersion:1,candidates:[]};}
if(index.candidates.some(c=>c.standardId===s.id))throw Error('An existing candidate is preserved. Prepare an explicit new revision.');
try{await access(path.join(root,'hero-reviews',collection));throw Error('Collection already exists.');}catch(e){if(e.code!=='ENOENT')throw e;}
const original=await readFile(path.join(root,'public',p.source.url));
if(sha(original)!==p.source.sha256)throw Error('Source bytes changed.');
const {width,height}=p.canvas;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}"><image width="${width}" height="${height}" transform="matrix(${p.scale} 0 0 ${p.scale} ${p.translateX} ${p.translateY})" xlink:href="data:image/png;base64,${original.toString('base64')}"/></svg>`;
const bytes=await sharp(Buffer.from(svg)).removeAlpha().png().toBuffer(),outputSha=sha(bytes);
const meta=await sharp(bytes).metadata();if(meta.width!==width||meta.height!==height)throw Error('Wrong output canvas.');
const raw=await sharp(original).removeAlpha().raw().toBuffer({resolveWithObject:true});
const bounds={left:width,top:height,right:0,bottom:0};
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const i=(y*width+x)*raw.info.channels;
 if(Math.max(Math.abs(raw.data[i]-245),Math.abs(raw.data[i+1]-243),Math.abs(raw.data[i+2]-239))>10){bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);}
}
const transformed={left:bounds.left*p.scale+p.translateX,right:bounds.right*p.scale+p.translateX,top:bounds.top*p.scale+p.translateY,bottom:bounds.bottom*p.scale+p.translateY};
if(transformed.left<0||transformed.top<0||transformed.right>=width||transformed.bottom>=height)throw Error('Original artwork would clip.');
const current=(await read('data/asset-ledger/bottle-standards.json')).standards.find(x=>x.id===s.id);
if(standardBinding(current)!==standardBinding(document.standards.find(x=>x.id===s.id)))throw Error('Standard changed during preparation.');
const relative=`/images/bottle-standards/final-candidates/${outputSha}.png`;
await mkdir(path.dirname(path.join(root,'public',relative)),{recursive:true});
await writeFile(path.join(root,'public',relative),bytes,{flag:'wx'});
const binding=standardBinding(current);
const candidate={standardId:s.id,standardBinding:binding,collection,sku:product.sku,groupId:group.id,
 before:{url:p.source.url,sha256:p.source.sha256},after:{url:relative,sha256:outputSha},
 createdAt:new Date().toISOString(),operation:'uniform-complete-image-transform',
 authorization:'Jordan: sure resize whole image is fine',
 transform:{scale:p.scale,translateX:p.translateX,translateY:p.translateY,canvas:p.canvas},
 verification:{passed:true,outputSha256:outputSha,sourceSha256:p.source.sha256,sourceBounds:bounds,transformedBounds:transformed,
  glassHeightBefore:p.sourceHeight,glassHeightAfter:p.targetHeight,baselinePercent:p.baselinePercent,
  summary:`Original photograph uniformly resized by ${Math.round((p.scale-1)*100)}%. Calibrated glass height ${p.sourceHeight.toFixed(1)} → ${p.targetHeight.toFixed(1)} px. Bottle, cap and existing shadow move together; no regeneration or separate retouching.`,
  limitation:'Glass endpoints retain the approved master-to-appearance calibration. This is a presentation-size check, not new physical metrology or a release approval.'}};
const title=`Boston Round 30 mL — saved final sizing candidate`;
const out=path.join(root,'docs/reviews/boston-glass-standards-2026-09-12');await mkdir(out,{recursive:true});
const manifest=path.join(out,collection+'.json');
await writeFile(manifest,JSON.stringify([{sku:product.sku,family:product.family,capacityMl:product.capacityMl,title:'30 mL Clear Boston Round · original short black cap',url:relative,priorUrl:p.source.url,sourcePreview:s.reference.url,stage:'rework',assetSha256:outputSha,standardBinding:binding,standardId:s.id,reviewNotes:[candidate.verification.summary,'Visual approval only. Release and website verification remain separate.']}],null,2));
importer.importCollection({id:collection,title,manifest,publicRoot:path.join(root,'public')});
const mapping=await read('data/asset-ledger/review-collections.json');
mapping.collections[collection]={kind:'hero',title,evidence:'Exact catalog SKU and group verified; complete-photo sizing of the original approved Sunburst image. New bytes require new visual approval.'};
await writeFile(path.join(root,'data/asset-ledger/review-collections.json'),JSON.stringify(mapping,null,2)+'\n');
index.candidates.push(candidate);await writeFile(path.join(root,indexFile),JSON.stringify(index,null,2)+'\n');
await writeFile(path.join(out,collection+'-verification.json'),JSON.stringify(candidate,null,2)+'\n');
console.log(JSON.stringify({sku:product.sku,collection,sha256:outputSha,url:relative,verification:candidate.verification},null,2));
