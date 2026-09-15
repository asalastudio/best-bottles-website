import {createHash} from 'node:crypto';

// Exact record dispositions, never a SKU-name filter. Recheck both records on
// every build so reactivation, remapping or an unavailable lookup fails closed.
export const plateIdentityFields=['_id','productId','websiteSku','graceSku','family','category','capacityMl','color','neckThreadSize','applicator','capColor','itemName','productGroupId'];
export const dispositionFields=[...plateIdentityFields,'importSource','productUrl','stockStatus','shopifySellable'];
const project=(record,fields)=>Object.fromEntries(fields.map(key=>[key,record?.[key]??null]));
export const plateIdentityFingerprint=record=>createHash('sha256').update(JSON.stringify(project(record,dispositionFields))).digest('hex');
const sameIdentity=(a,b)=>JSON.stringify(project(a,plateIdentityFields))===JSON.stringify(project(b,plateIdentityFields));
const tagged=(record,status)=>(record.importSource??'').split('|').includes('product_identity_repair_v2:'+status);

export function applyPlateScope(rows,products,manifest,liveRecords){
 if(manifest.version!==1||!Array.isArray(manifest.entries))throw Error('Invalid plate scope register.');
 const audit={excluded:[],held:[],unmatched:[]},seen=new Set();
 const productsFor=sku=>products.filter(p=>p.websiteSku===sku);
 for(const entry of manifest.entries){
  if(!entry.sku||seen.has(entry.sku))throw Error('Duplicate or empty plate scope identity.');
  seen.add(entry.sku);
  const matches=rows.filter(r=>r.productRecord&&r.sku===entry.sku),row=matches[0];
  if(matches.length!==1){audit.unmatched.push({sku:entry.sku,reason:'Recorded catalog row is absent or ambiguous.'});continue;}
  delete row.plate.scopeExclusion;delete row.plate.scopeHold;
  try{
   const original=liveRecords.get(entry.sku),canonical=liveRecords.get(entry.canonicalSku);
   const rawOriginal=productsFor(entry.sku),rawCanonical=productsFor(entry.canonicalSku);
   if(!original||!canonical||rawOriginal.length!==1||rawCanonical.length!==1)throw Error('Both exact catalog records must be available and unique.');
   if(!sameIdentity(original,rawOriginal[0])||!sameIdentity(canonical,rawCanonical[0]))throw Error('Catalog identity changed during verification.');
   if(plateIdentityFingerprint(original)!==entry.recordSha256||plateIdentityFingerprint(canonical)!==entry.canonicalSha256)throw Error('Recorded duplicate or canonical identity changed.');
   if(!tagged(original,'retired')||original.stockStatus!=='Discontinued'||original.shopifySellable!==false||original.productGroupId)throw Error('Retired record is no longer safely outside active catalog scope.');
   if(original._id===canonical._id||!tagged(canonical,'canonical')||!canonical.productGroupId||canonical.stockStatus==='Discontinued')throw Error('The canonical product must remain a distinct active grouped record.');
   if(!(original.productId&&original.productId===canonical.productId)&&original.graceSku!==canonical.websiteSku)throw Error('No exact product ID or recorded alias links these records.');
   const canonicalRows=rows.filter(r=>r.productRecord&&r.sku===entry.canonicalSku);
   if(canonicalRows.length!==1||canonicalRows[0].plate.state==='not-applicable'||manifest.entries.some(e=>e.sku===entry.canonicalSku))throw Error('The canonical bottle must remain counted in the plate queue.');
   if(row.plate.imageUrl)throw Error('This retired copy now has an indexed image; reconcile its scope again.');
   if(entry.reviewedBy!=='Jordan Richter'||!entry.reviewedAt||!entry.decision||!entry.evidence)throw Error('Missing recorded scope decision.');
   row.plate.scopeExclusion={status:'excluded-duplicate',canonicalSku:entry.canonicalSku,canonicalRecordId:canonical._id,canonicalGroupSlug:canonicalRows[0].groupSlug,recordId:original._id,reason:entry.reason,evidence:entry.evidence,reviewedBy:entry.reviewedBy,reviewedAt:entry.reviewedAt,recordSha256:entry.recordSha256,canonicalSha256:entry.canonicalSha256};
   audit.excluded.push({sku:entry.sku,...row.plate.scopeExclusion});
  }catch(error){row.plate.scopeHold='Duplicate scope needs re-verification: '+error.message;audit.held.push({sku:entry.sku,reason:row.plate.scopeHold});}
 }
 return audit;
}
