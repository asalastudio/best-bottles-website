import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,realpath,open,unlink,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {livePlates} from './plate-contact-sheet.mjs';
import {plateIdentityFingerprint} from './plate-scope.mjs';

const ID='four-family-plates-2026-09-13';
const packetPath=`docs/reviews/${ID}/prepared.json`;
const decisionsPath=`data/asset-ledger/${ID}-decisions.json`;
const MASTER='/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const fields=['graceSku','family','capacityMl','color','applicator','capColor','productGroupId'];
const same=(a,b)=>fields.every(k=>(a[k]??null)===(b[k]??null));

export function validateFourFamilyDecision(sheet,input){
    if(sheet.draft)throw Error('All four family checks must finish before approval.');
    if(input.token!==sheet.token||input.revision!==sheet.revision)throw Error('This review changed. Reload before saving.');
    if(input.visualApproved!==true)throw Error('Confirm that you reviewed the prepared plate images.');
    if(typeof input.duplicatesConfirmed!=='boolean')throw Error('Invalid duplicate scope decision.');
    const exceptions=input.exceptions;
    if(!exceptions||typeof exceptions!=='object'||Array.isArray(exceptions))throw Error('Invalid exception list.');
    const ready=sheet.rows.filter(r=>r.status==='ready');
    if(!ready.length)throw Error('No eligible plates in this packet.');
    for(const [sku,note] of Object.entries(exceptions)){
        if(!ready.some(r=>r.sku===sku)||typeof note!=='string'||!note.trim()||note.length>2000)throw Error('Each flagged eligible image needs a short note.');
    }
    const entries=ready.map(r=>({sku:r.sku,recordId:r.recordId,productGroupId:r.productGroupId,binding:r.binding,
        views:r.views.map(({role,url,sha256})=>({role,url,sha256})),status:Object.hasOwn(exceptions,r.sku)?'changes_requested':'approved',
        notes:exceptions[r.sku]??'',publicationAuthorized:false}));
    if(!entries.some(r=>r.status==='approved'))throw Error('No unflagged eligible plates to approve.');
    return entries;
}

export async function readFourFamilyPlates(root,{master=MASTER}={}){
    const raw=await readFile(path.join(root,packetPath)),data=JSON.parse(raw),token=hash(raw);
    if(data.id!==ID||data.schemaVersion!==1||data.publicationAuthorized!==false)throw Error('Invalid preparation packet.');
    if(new Set(data.rows.map(r=>r.sku)).size!==data.rows.length)throw Error('Duplicate review identity.');
    let feedback;try{feedback=await json(path.join(root,decisionsPath));}catch(e){if(e.code!=='ENOENT')throw e;feedback={revision:0,history:[]};}
    const ledger=await json(path.join(root,'src/lib/asset-ledger/ledger.json'));
    // Once a named release has been published and independently verified, the
    // live plate hash is expected to be the approved view hash rather than the
    // packet's pre-release reference hash. Keep the workbench readable after
    // that transition while still requiring the verification to match the
    // immutable manifest and explicit ship authorization.
    let publishedRelease=null;
    try{
        const verification=await json(path.join(root,`docs/reviews/${ID}/published-verification.json`));
        const authorization=await json(path.join(root,`docs/reviews/${ID}/ship-authorization.json`));
        const manifestPath=path.join(root,`dist/paper-doll/${ID}-release/manifest.json`);
        const manifestSha=hash(await readFile(manifestPath));
        if(verification.phase==='published'&&verification.failures?.length===0&&verification.rows===637&&
            verification.manifestSha256===manifestSha&&authorization.publicationAuthorized===true&&authorization.manifestSha256===manifestSha)
            publishedRelease=verification;
    }catch{ /* pending or incomplete releases retain the pre-release guard */ }
    const cache=new Map();
    async function verify(file,expected,base){
        const [resolved,boundary]=await Promise.all([realpath(file),realpath(base)]);
        if(!resolved.startsWith(boundary+path.sep)||!/^[a-f0-9]{64}$/.test(expected??''))throw Error('Invalid review asset boundary or fingerprint.');
        if(!cache.has(resolved))cache.set(resolved,hash(await readFile(resolved)));
        if(cache.get(resolved)!==expected)throw Error('Image or source bytes changed. Prepare a new review.');
    }
    for(const row of data.rows){
        if(!row.inCatalog)continue;
        const matches=ledger.rows.filter(r=>r.productRecord&&r.sku===row.sku);
        if(matches.length!==1||!same(row,matches[0]))throw Error('Catalog identity changed for '+row.sku+'.');
        const indexedSha=matches[0].plate.sha256??null;
        const approvedSha=row.views.find(v=>v.role==='on')?.sha256??null;
        const releaseVerified=publishedRelease?.verifiedSkus?.includes(row.sku)&&indexedSha===approvedSha;
        if(indexedSha!==(row.referenceSha256??null)&&!releaseVerified)throw Error('The indexed reference changed for '+row.sku+'.');
        for(const v of [...row.before,...row.views]){
            if(!new RegExp(`^/images/${ID}/[a-f0-9]{64}\\.webp$`).test(v.url)||!v.url.includes(v.sha256))throw Error('Invalid local plate URL.');
            await verify(path.join(root,'public',v.url),v.sha256,path.join(root,'public/images',ID));
        }
        for(const s of row.sources){
            if(s.kind!=='master-psd')throw Error('New plates require master PSD lineage.');
            await verify(path.join(master,s.sourcePath),s.sourceSha256,master);
        }
        for(const e of row.legacyEvidence){
            await verify(path.join(root,e.file),e.sha256,path.join(root,`docs/reviews/${ID}/evidence`));
            const html=await readFile(path.join(root,e.file),'utf8');
            if(!new RegExp(`<h1[^>]*>\\s*${row.sku.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')}\\s*</h1>`, 'i').test(html))throw Error('The source page no longer proves this exact SKU.');
        }
        if(row.status==='ready'&&(!row.views.length||row.technicalHolds.length||!row.productGroupId||!row.sources.length))throw Error('An ineligible row entered the approval batch.');
    }
    const decision=feedback.history.findLast(d=>d.token===token);
    return {...data,token,revision:feedback.revision,status:decision?'approved':'pending',approvedCount:decision?.entries.filter(e=>e.status==='approved').length??0};
}

async function liveCatalog(root){
    if(!process.env.NEXT_PUBLIC_CONVEX_URL)process.loadEnvFile(path.join(root,'.env.local'));
    const {ConvexHttpClient}=await import('convex/browser');const {api}=await import('../../convex/_generated/api.js');
    const c=new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL),products=[];let cursor=null;
    for(;;){const p=await c.query(api.products.getAllForPlates,{limit:1000,cursor});products.push(...p.page);if(p.isDone)break;cursor=p.continueCursor;}
    return {products,lookup:async sku=>(await c.query(api.products.lookupSku,{sku}))?.product};
}

export async function saveFourFamilyPlates(root,input,services={}){
    const file=path.join(root,decisionsPath),lock=file+'.lock';await mkdir(path.dirname(file),{recursive:true});let fd;
    try{fd=await open(lock,'wx');}catch{throw Error('Another review is saving. Reload and try again.');}
    try{
        const sheet=await readFourFamilyPlates(root,services),entries=validateFourFamilyDecision(sheet,input);
        const live=await (services.catalog??liveCatalog)(root);
        for(const row of sheet.rows.filter(r=>r.status==='ready')){
            const matches=live.products.filter(p=>p.websiteSku===row.sku);
            if(matches.length!==1||matches[0]._id!==row.recordId||!same(matches[0],row))throw Error('Live catalog identity changed for '+row.sku+'.');
        }
        const plated=await (services.plates??livePlates)(root,[...new Set(sheet.rows.filter(r=>r.status==='ready').map(r=>r.familyId).filter(Boolean))]);
        for(const row of sheet.rows.filter(r=>r.status==='ready'))if((plated.get(row.sku)?.image??null)!==(row.before.find(v=>v.role==='on')?.sourceUrl??null))throw Error('Live reference changed for '+row.sku+'.');
        const duplicateEntries=[];
        if(input.duplicatesConfirmed){
            const proposals=sheet.rows.filter(r=>r.status==='duplicate');
            for(let i=0;i<proposals.length;i+=8)await Promise.all(proposals.slice(i,i+8).map(async row=>{
                const {record,canonical}=row.duplicateProposal;
                const [a,b]=await Promise.all([live.lookup(record.websiteSku),live.lookup(canonical.websiteSku)]);
                if(plateIdentityFingerprint(a)!==plateIdentityFingerprint(record)||plateIdentityFingerprint(b)!==plateIdentityFingerprint(canonical))throw Error('A duplicate record changed after preparation.');
                if(!a.importSource?.split('|').includes('product_identity_repair_v2:retired')||a.stockStatus!=='Discontinued'||a.shopifySellable!==false||a.productGroupId||
                    !b.importSource?.split('|').includes('product_identity_repair_v2:canonical')||!b.productGroupId||a._id===b._id||a.productId!==b.productId)throw Error('The proposed duplicate relationship is no longer valid.');
                duplicateEntries.push({sku:row.sku,canonicalSku:canonical.websiteSku,recordSha256:plateIdentityFingerprint(a),canonicalSha256:plateIdentityFingerprint(b),reviewedBy:'Jordan Richter',status:'approved-scope-disposition'});
            }));
        }
        const checked=await readFourFamilyPlates(root,services);
        if(checked.token!==sheet.token||checked.revision!==sheet.revision)throw Error('The packet changed while verifying. Reload.');
        let previous;try{previous=await json(file);}catch(e){if(e.code!=='ENOENT')throw e;previous={revision:0,history:[]};}
        const decision={id:randomUUID(),at:new Date().toISOString(),actor:'Jordan Richter · explicit local batch approval',token:sheet.token,entries,duplicateEntries,publicationAuthorized:false};
        const temp=file+'.tmp-'+randomUUID();await writeFile(temp,JSON.stringify({revision:previous.revision+1,history:[...previous.history,decision]},null,2)+'\n');await rename(temp,file);
        return {...checked,revision:previous.revision+1,status:'approved',approvedCount:entries.filter(r=>r.status==='approved').length};
    }finally{await fd?.close();await unlink(lock).catch(()=>{});}
}
