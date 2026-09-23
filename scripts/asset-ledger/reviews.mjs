import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');

// Decisions belong to bytes AND an asset kind. A newer card never inherits a
// different image's approval, even if its SKU happens to be the same.
export function currentReview(cards) {
  const sorted = [...cards].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.collection.localeCompare(a.collection));
  const current = sorted[0];
  if (!current) return undefined;
  const same = sorted.filter(c => c.sha256 === current.sha256 && c.bytesVerified);
  const decision = same.flatMap(c => c.decisions).sort((a,b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
  return { ...current, rendered: cards.length, collections: [...new Set(cards.map(c=>c.collection))],
    decision: current.bytesVerified ? decision : undefined,
    status: !current.bytesVerified ? 'evidence-missing' : decision?.status ?? 'pending',
    history: cards.map(({collection, sha256, createdAt, bytesVerified}) => ({collection, sha256, createdAt, bytesVerified})) };
}

export function readReviews(roots, mapping) {
  const byKind = {hero:new Map(), plate:new Map(), kit:new Map()};
  const unmatchedSkus = new Set();
  const audit = {unclassified:[], superseded:[], invalidAssets:[], orphanDecisions:[], roots:[]};
  const seen = new Set();
  for (const root of roots) {
    const real = realpathSync(root); if (seen.has(real)) continue; seen.add(real);
    let collections=0, rows=0, decisions=0;
    for (const id of readdirSync(real).sort()) {
      const dir=path.join(real,id); if (!existsSync(path.join(dir,'collection.json'))) continue;
      const col=read(path.join(dir,'collection.json')); const data=read(path.join(dir,'data.json'));
      const fb=existsSync(path.join(dir,'feedback.json')) ? read(path.join(dir,'feedback.json')) : {};
      collections++;rows+=data.length;decisions+=Object.keys(fb.decisions??{}).length;
      const spec=mapping[id];
      if (!spec || !byKind[spec.kind] || spec.title !== col.title) {for(const row of data)if(row.sku)unmatchedSkus.add(row.sku); audit.unclassified.push({collection:id,root:real,rows:data.length,reason:'Explicit asset type or matching collection title required'});continue;}
      if(spec.supersededBy){audit.superseded.push({collection:id,by:spec.supersededBy,rows:data.length});continue;}
      for(const d of Object.values(fb.decisions??{})) if(!data.some(r=>r.sku===d.sku && r.assetSha256===d.assetSha256)) audit.orphanDecisions.push({collection:id,sku:d.sku,sha256:d.assetSha256});
      for(const row of data){
        const file=path.join(dir,'assets',path.basename(row.url??''));
        const bytesVerified=!!row.assetSha256 && existsSync(file) && hash(file)===row.assetSha256;
        if(!bytesVerified)audit.invalidAssets.push({kind:spec.kind,collection:id,sku:row.sku,sha256:row.assetSha256});
        const ds=Object.values(fb.decisions??{}).filter(d=>d.sku===row.sku && d.assetSha256===row.assetSha256).map(d=>({status:d.status,sha256:d.assetSha256,collection:id,updatedAt:d.updatedAt,notes:d.notes?.trim()||undefined,targetHeight:d.targetHeight?.heightPercent}));
        const card={collection:id,createdAt:col.createdAt??'',sha256:row.assetSha256,plateSha256:row.plateSha256,bytesVerified,decisions:ds};
        byKind[spec.kind].set(row.sku,[...(byKind[spec.kind].get(row.sku)??[]),card]);
      }
    }
    audit.roots.push({path:real,collections,rows,decisions});
  }
  for(const kind of Object.keys(byKind)) for(const [sku,cards] of byKind[kind])byKind[kind].set(sku,currentReview(cards));
  return {review:byKind,audit,unmatchedSkus};
}
