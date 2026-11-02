const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const read=p=>JSON.parse(fs.readFileSync(p));
const manifestFile='src/lib/paper-doll/approved-kits.generated.json',indexFile='src/lib/paper-doll/approved-kit-index.json';
const manifest=read(manifestFile),before=structuredClone(manifest),plan=read('docs/reviews/hosted-masters-tulip-2026-11-01/upload-plan.json');
const assets=new Map();
for(const source of plan.sources){const original=read(source.file).rows;for(const sku of source.selected){const hosted=manifest.rows[sku];assert.equal(original[sku].parts.length,hosted.parts.length);original[sku].parts.forEach((part,i)=>assets.set(part.image.url,hosted.parts[i].image));}}
const selected=read('docs/reviews/tulip-pour-reconciliation-2026-11-01/kits.json').rows,changes=[];
for(const [sku,source]of Object.entries(selected)){
 const k=structuredClone(source),reference=manifest.rows[sku.startsWith('GBTulipAmb5')?'GBTulipAmb5SpryBlkSh':'GBTulip6SpryBlkSh'];
 for(const p of k.parts){const image=assets.get(p.image.url);if(image)p.image=structuredClone(image);else assert.ok(p.image.url.startsWith('https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/'),'unmapped source '+p.image.url);}
 assert.deepEqual(k.parts.find(p=>p.slot==='body'),reference.parts.find(p=>p.slot==='body'));
 assert.deepEqual(k.glassSizing,reference.glassSizing);
 manifest.rows[sku]=k;changes.push({sku,bodyUrl:k.parts.find(p=>p.slot==='body').image.url,bodyHash:k.parts.find(p=>p.slot==='body').image.sha256,capSource:k.parts.find(p=>p.slot==='cap').image.url});
}
for(const [sku,k] of Object.entries(before.rows))assert.deepEqual(manifest.rows[sku],k);
const version=crypto.createHash('sha256').update(JSON.stringify(manifest.rows)).digest('hex').slice(0,16);manifest.version=version;
const index=read(indexFile);index.version=version;index.skus=Object.keys(manifest.rows).sort();
assert.equal(index.skus.length,290);
fs.writeFileSync(manifestFile,JSON.stringify(manifest)+'\n');fs.writeFileSync(indexFile,JSON.stringify(index)+'\n');
fs.writeFileSync('docs/reviews/tulip-pour-reconciliation-2026-11-01/shared-master-receipt.json',JSON.stringify({version,beforeCount:Object.keys(before.rows).length,afterCount:index.skus.length,added:changes,existingRecipesPreserved:true,newImageBytes:0,source:'Existing approved Tulip body masters and approved shared 13-415 cap images. Jordan requested exact hero/PDP/body unification on 2026-11-01.',publication:'Connected in source for hosted preview; no production deployment or merge in this step.'},null,2)+'\n');
console.log('Connected 19 Tulip pour variants to the same hosted body and sizing as sprayers; preserved all 271 existing recipes');
