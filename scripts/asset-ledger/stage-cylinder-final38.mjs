// Prepare immutable, exact-byte release assets and a read-only catalog preflight.
// No upload, index mutation, approval creation, or publication happens here.
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../../convex/_generated/api.js';
import {readCylinderFinalPlates} from './cylinder-final-plates.mjs';
import {livePlates,remoteHash} from './plate-contact-sheet.mjs';

const root=process.cwd(),folder='docs/reviews/cylinder-final38-2026-09-13';
const out=path.join(root,'dist/paper-doll/cylinder-final38-2026-09-13');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const name of ['approved-lock.json','ship-authorization.json']){
    try{await access(path.join(root,folder,name));throw Error('Locked releases are immutable. Do not restage.');}catch(e){if(e.code!=='ENOENT')throw e;}
}
const sheet=await readCylinderFinalPlates(root),ledger=await read(path.join(root,'src/lib/asset-ledger/ledger.json'));
if(sheet.alignmentFailures||sheet.rows.length!==38)throw Error('Incomplete prepared pair checks.');
if(!process.env.NEXT_PUBLIC_CONVEX_URL)process.loadEnvFile(path.join(root,'.env.local'));
if(process.env.NEXT_PUBLIC_CONVEX_URL!=='https://helpful-elephant-638.convex.cloud')throw Error('This release preflight is scoped to the local development catalog.');
const client=new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const families=await client.query(api.productPlates.families,{});
const ids=[...new Set(sheet.rows.map(r=>ledger.rows.find(p=>p.productRecord&&p.sku===r.sku).plate.familyId))];
const all=await livePlates(root,ids),identities=[];
for(const id of ids)if(!families.some(f=>f.familyId===id))throw Error('Missing existing family metadata.');
const selected=sheet.rows.map(r=>r.sku);
const presence=await client.query(api.productPlates.productPresence,{skus:selected});
for(let i=0;i<sheet.rows.length;i+=4)await Promise.all(sheet.rows.slice(i,i+4).map(async r=>{
    if(presence[r.sku]?.count!==1||presence[r.sku].graceSku!==r.graceSku)throw Error('Exact SKU is missing or ambiguous: '+r.sku);
    const found=await client.query(api.products.lookupSku,{sku:r.sku});
    if(found.product.websiteSku!==r.sku||found.product.productGroupId!==r.productGroupId)throw Error('Product identity changed.');
    const current=all.get(r.sku);
    if(current.image!==r.before[0].sourceUrl||await remoteHash(current.image)!==r.referenceSha256)throw Error('Indexed reference changed: '+r.sku);
    identities.push({sku:r.sku,productId:found.product._id,productGroupId:r.productGroupId,graceSku:r.graceSku});
}));
await mkdir(out,{recursive:true});
const rows=[];
for(const r of sheet.rows){
    const current=ledger.rows.find(p=>p.productRecord&&p.sku===r.sku);const assets={};
    for(const v of r.views){
        const p=path.join(root,'public',v.url);const bytes=await readFile(p);if(hash(bytes)!==v.sha256)throw Error('View changed.');
        const m=await sharp(bytes).metadata();if(m.format!=='webp'||m.width!==1000||m.height!==1100)throw Error('Invalid candidate image.');
        const key=`plates/${current.plate.familyId}/${r.sku}/${v.sha256}.front-${v.role}-1000x1100.webp`;
        const dest=path.join(out,key);await mkdir(path.dirname(dest),{recursive:true});
        try{const old=await readFile(dest);if(hash(old)!==v.sha256)throw Error('Immutable staged asset changed.');}catch(e){if(e.code!=='ENOENT')throw e;await copyFile(p,dest);}
        const source=r.sources.find(s=>s.role===v.role)||(v.source?.sourcePath?v.source:null)||r.sources.find(s=>s.kind==='master-psd'&&s.sourcePath===current.plate.sourcePath);
        const sourcePath=v.role==='on'&&v.sha256===r.referenceSha256?current.plate.sourcePath:source?.sourcePath||v.source?.path||v.source?.sourceUrl;
        if(!sourcePath)throw Error('Unresolved source lineage: '+r.sku+' '+v.role);
        const legacy=/^https?:/.test(sourcePath);
        const a={key,storeKey:key,sha256:v.sha256,bytes:bytes.length,width:1000,height:1100,
            sourceLibrary:legacy?'verified-original-legacy':'master',sourceRelPath:sourcePath,
            sourceSha256:legacy?null:source?.sourceSha256||v.source?.sourceSha256,
            sourceEvidence:r.sources,reviewBinding:r.binding};
        const role=v.role==='on'?'plate':'plateCapOff';assets[role]=a;assets[v.role==='on'?'thumb':'thumbCapOff']={...a};
    }
    rows.push({websiteSku:r.sku,graceSku:r.graceSku,productGroupId:r.productGroupId,familyId:current.plate.familyId,
        familyName:families.find(f=>f.familyId===current.plate.familyId)?.name||current.plate.familyId,...assets,
        publishable:sheet.status==='approved',blockReasons:sheet.status==='approved'?[]:['Final batch approval and source acceptance pending.'],
        baselineViews:r.before,pairCheck:r.pairCheck,reviewBinding:r.binding});
}
const manifest={release:'Cylinder final plate release 2026-09-13',builder:{name:'stage-cylinder-final38.mjs',version:'1.0.0'},
    generatedAt:new Date().toISOString(),reviewPacketSha256:sheet.token,approvalStatus:sheet.status,
    publicationAuthorized:false,counts:{rows:38,capOff:38,families:ids.length},rows,
    thumbnailPolicy:'Exact approved full-resolution raster reused. No additional image bytes.',
    releaseInstructions:'After batch approval, restage. Record Jordan release-specific ship bound to this manifest. Publish only to the verified development catalog with --replace --preserve-family-metadata; verify all 76 hosted view hashes and register exact approval bindings.'};
await writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const preflight={at:new Date().toISOString(),deployment:process.env.NEXT_PUBLIC_CONVEX_URL,reviewPacketSha256:sheet.token,
    manifestSha256:hash(await readFile(path.join(out,'manifest.json'))),rows:38,views:76,ambiguousSkus:0,
    identities,families:families.filter(f=>ids.includes(f.familyId)),familyRows:[...all.values()],
    approvalStatus:sheet.status,publicationAuthorized:false};
await writeFile(path.join(root,folder,'release-preflight.json'),JSON.stringify(preflight,null,2)+'\n');
console.log(JSON.stringify({rows:38,views:76,families:ids.length,ambiguousSkus:0,approvalStatus:sheet.status,publicationAuthorized:false}));
