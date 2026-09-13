// Release-scoped checks. No catalog or storage mutations.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../../convex/_generated/api.js';
import {livePlates,remoteHash} from './plate-contact-sheet.mjs';
import {retryLedgerRead,timedLedgerFetch} from './read-retry.mjs';

const root=process.cwd(),dir=path.join(root,'docs/reviews/cylinder-final38-2026-09-13');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifestPath=path.join(root,'dist/paper-doll/cylinder-final38-2026-09-13/manifest.json');
const manifest=await read(manifestPath),prior=await read(path.join(dir,'release-preflight.json'));
const after=process.argv.includes('--after');
const packet=await read(path.join(dir,'prepared-v2.json'));
const lock=await read(path.join(dir,'approved-lock.json'));
const authorization=await read(path.join(dir,'ship-authorization.json'));
assert.equal(sha(await readFile(manifestPath)),lock.manifestSha256);
assert.equal(authorization.manifestSha256,lock.manifestSha256);
assert.equal(authorization.publicationAuthorized,true);
assert.equal(authorization.deployment,prior.deployment);
assert.equal(sha(await readFile(path.join(root,lock.approvalFile))),lock.approvalFileSha256);
assert.equal(sha(await readFile(path.join(dir,'prepared-v2.json'))),lock.reviewPacketSha256);
assert.deepEqual(authorization.skus,[...manifest.rows.map(r=>r.websiteSku)].sort());
assert.equal(manifest.rows.length,38);
assert.equal(new Set(manifest.rows.map(r=>r.websiteSku)).size,38);
assert.equal(process.env.NEXT_PUBLIC_CONVEX_URL,prior.deployment);
const client=new ConvexHttpClient(prior.deployment,{fetch:timedLedgerFetch});
const query=(fn,args)=>retryLedgerRead(()=>client.query(fn,args));
const families=await query(api.productPlates.families,{});
for(const f of prior.families)assert.deepEqual(families.find(x=>x.familyId===f.familyId),f,'Family metadata changed');
const allRows=[...await livePlates(root,prior.families.map(f=>f.familyId))].map(([,r])=>r);
const indexed=new Map(allRows.map(r=>[r.websiteSku??r.sku,r]));
const skus=manifest.rows.flatMap(r=>[r.websiteSku,r.graceSku]).filter(Boolean);
const refs=await query(api.productPlates.forSkus,{skus});
assert.deepEqual(refs.conflicts,[]);
const presence=await query(api.productPlates.productPresence,{skus:manifest.rows.map(r=>r.websiteSku)});
const identities=[],assets=[];
for(const r of manifest.rows){
  const current=indexed.get(r.websiteSku),old=prior.familyRows.find(x=>x.sku===r.websiteSku);
  assert.ok(current);assert.equal(presence[r.websiteSku].count,1);
  assert.equal(presence[r.websiteSku].graceSku,r.graceSku);
  const lookup=await query(api.products.lookupSku,{sku:r.websiteSku});
  // lookupSku returns the exact catalog product and its group; no filename identity inference.
  const expected=prior.identities.find(x=>x.sku===r.websiteSku);
  assert.equal(lookup.product._id,expected.productId);
  assert.equal(lookup.product.productGroupId,r.productGroupId);
  assert.equal(lookup.product.websiteSku,r.websiteSku);
  identities.push({sku:r.websiteSku,productId:lookup.product._id,productGroupId:lookup.product.productGroupId});
  if(!after){assert.deepEqual(current,old,'Baseline index changed');
    assert.equal(await retryLedgerRead(()=>remoteHash(current.image)),packet.rows.find(x=>x.sku===r.websiteSku).referenceSha256);
  }else{
    assert.equal(current.familyId,r.familyId);assert.equal(current.sourcePath,r.plate.sourceRelPath);
    assert.deepEqual(current.views,[]);
    for(const [field,key] of [['image','plate'],['imageCapOff','plateCapOff'],['thumb','thumb'],['thumbCapOff','thumbCapOff']]){
      const a=r[key],url=current[field];assert.ok(url);
      assert.equal(new URL(url).pathname,'/'+a.storeKey);
      assert.equal(refs.plates[r.websiteSku][field],url);
      assert.equal(refs.plates[r.graceSku][field],url);
      if(field==='thumb'||field==='thumbCapOff')continue;
      const response=await retryLedgerRead(async()=>{const res=await timedLedgerFetch(url,{cache:'no-store'});assert.equal(res.status,200);return res;});
      const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),a.sha256);assert.equal(bytes.length,a.bytes);
      const meta=await sharp(bytes).metadata();assert.equal(meta.width,1000);assert.equal(meta.height,1100);
      assets.push({sku:r.websiteSku,view:field,url,sha256:a.sha256,bytes:bytes.length,width:meta.width,height:meta.height});
    }
  }
}
if(after){
  const before=await read(path.join(dir,'ship-preflight.json'));
  const released=new Set(manifest.rows.map(r=>r.websiteSku));
  for(const old of before.familyRows.filter(r=>!released.has(r.websiteSku??r.sku)))assert.deepEqual(indexed.get(old.websiteSku??old.sku),old,'Unselected index row changed');
  assert.equal(assets.length,76);
}
const report={verifiedAt:new Date().toISOString(),phase:after?'published':'preflight',deployment:prior.deployment,manifestSha256:sha(await readFile(manifestPath)),authorizationSha256:sha(await readFile(path.join(dir,'ship-authorization.json'))),rows:38,uniqueViewAssets:assets.length,conflicts:refs.conflicts,identities,familiesUnchanged:10,familyRows:allRows,assets};
await writeFile(path.join(dir,after?'published-verification.json':'ship-preflight.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({phase:report.phase,rows:report.rows,uniqueViewAssets:report.uniqueViewAssets,familiesUnchanged:10,conflicts:0}));
