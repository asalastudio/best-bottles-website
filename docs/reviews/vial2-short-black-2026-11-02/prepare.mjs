import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir='docs/reviews/vial2-short-black-2026-11-02',out='public/local-kits/vial2-short-black-2026-11-02';
fs.mkdirSync(out,{recursive:true});const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const white=structuredClone(read('public/local-kits/catalog-followups-2026-10-31/kits.json').rows.GBVialAmb1o5WhtCapSht);
const donor=read(dir+'/legacy-kits-before.json').GBVAmb1DrmBlackCapSht;
const source=structuredClone(donor.parts.find(p=>p.slot==='cap'));
const rows={GBVialAmb1o5WhtCapSht:white};
for(const part of white.parts){
 const bytes=fs.readFileSync('public'+part.image.url);assert.equal(sha(bytes),part.image.sha256);
 const file=part.slot+'.'+sha(bytes).slice(0,12)+'.'+part.image.url.split('.').at(-1);
 fs.writeFileSync(out+'/'+file,bytes);part.image={...part.image,url:'/local-kits/vial2-short-black-2026-11-02/'+file};
}
const response=await fetch(source.image.url);assert(response.ok);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),source.image.sha256);
const file='black-cap.'+sha(bytes).slice(0,12)+'.webp';fs.writeFileSync(out+'/'+file,bytes);
const whiteCap=white.parts.find(p=>p.slot==='cap'),axis=white.anchors.axisX,bottom=whiteCap.bounds.bottom;
const b=source.bounds,s=(whiteCap.bounds.right-whiteCap.bounds.left)/(b.right-b.left);
const cap={...source,variantKey:'black',image:{...source.image,url:'/local-kits/vial2-short-black-2026-11-02/'+file},
 box:{x:axis-(b.left+b.right)/2*s,y:bottom-b.bottom*s,width:source.image.width*s,height:source.image.height*s},
 bounds:{left:axis-(b.right-b.left)*s/2,right:axis+(b.right-b.left)*s/2,top:bottom-(b.bottom-b.top)*s,bottom},exploded:{dx:0,dy:-180}};
const black={...structuredClone(white),sku:'GBVAmb1o5BlackCapSht',parts:[structuredClone(white.parts.find(p=>p.slot==='body')),cap]};
rows[black.sku]=black;
assert.deepEqual(white.parts.find(p=>p.slot==='body'),black.parts.find(p=>p.slot==='body'));
assert.equal((cap.bounds.left+cap.bounds.right)/2,axis);assert.equal(cap.bounds.bottom,whiteCap.bounds.bottom);
const result={version:sha(Buffer.from(JSON.stringify(rows))).slice(0,16),rows,defaultPdpSkus:Object.keys(rows)};
fs.writeFileSync(out+'/kits.json',JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(dir+'/registration.json',JSON.stringify({status:'local-review',skus:Object.keys(rows),bodySha256:white.parts.find(p=>p.slot==='body').image.sha256,
 bodyUnchanged:true,glassSizing:white.glassSizing,blackCapSourceSku:donor.sku,blackCapSourceSha256:source.image.sha256,uniformCapScale:s,
 capCenterX:axis,capBottomY:bottom,scope:'Only the short 22 mm-high, 16 mm-diameter, 13-425 amber vial. Separate slender 8-425 vial untouched.'},null,2)+'\n');
console.log(JSON.stringify({skus:Object.keys(rows),sameBody:true,capCentered:true}));
