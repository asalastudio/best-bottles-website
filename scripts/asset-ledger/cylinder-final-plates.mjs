import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,open,rename,unlink,realpath} from 'node:fs/promises';
import path from 'node:path';
import {livePlates,remoteHash} from './plate-contact-sheet.mjs';

const MASTER='/Users/jordanrichter/Projects/Clients/Nemat-International/BB-PSD-Files-Master';
const packetPath='docs/reviews/cylinder-final38-2026-09-13/prepared-v2.json';
const decisionPath='data/asset-ledger/cylinder-final38-decisions.json';
const reviewUrl='/reviews/cylinder-final38-2026-09-13/index.html';
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const legacyKinds=new Set(['Plain short cap','Flip top']);

export function validateFinalPlateDecision(sheet,input){
    if(input.token!==sheet.token||input.revision!==sheet.revision)throw Error('This review changed. Reload the sheet before saving.');
    if(input.visualApproved!==true||input.legacySourcesAccepted!==true)throw Error('Review the new image files and explicitly accept the listed original legacy sources.');
    if(sheet.rows.length!==38||new Set(sheet.rows.map(r=>r.sku)).size!==38)throw Error('The exact 38-row batch is incomplete.');
    if(sheet.rows.some(r=>!r.pairCheck?.passed||r.views.length!==2||r.views[0].role!=='on'||r.views[1].role!=='off'))throw Error('A paired-view check remains unresolved.');
    if(sheet.rows.some(r=>r.holds.some(h=>!h.startsWith('Accept retained exact legacy front')&&!h.startsWith('Exact master source unresolved;'))))throw Error('Resolve the technical findings before approval.');
    return sheet.rows.map(r=>({sku:r.sku,productGroupId:r.productGroupId,binding:r.binding,
        views:r.views.map(({role,sha256,url})=>({role,sha256,url})),status:'approved',
        sourceBasis:legacyKinds.has(r.classification)?'accepted-exact-original-legacy-raster':'verified-master-psd',
        sourceDecision:legacyKinds.has(r.classification)?'Jordan explicitly accepted the retained exact original legacy front and, for plastic bottles, the original-resolution legacy cap-off image. No master lineage is claimed.':null,
        publicationAuthorized:false}));
}

export async function readCylinderFinalPlates(root,{master=MASTER}={}){
    const raw=await readFile(path.join(root,packetPath));const data=JSON.parse(raw);const token=hash(raw);
    let decisions;try{decisions=await json(path.join(root,decisionPath));}catch(e){if(e.code!=='ENOENT')throw e;decisions={revision:0,history:[]};}
    const ledger=await json(path.join(root,'src/lib/asset-ledger/ledger.json'));
    const cache=new Map();
    async function check(file,expected,base){
        const resolved=await realpath(file),allowed=await realpath(base);
        if(!resolved.startsWith(allowed+path.sep))throw Error('Source is outside its approved directory.');
        if(!cache.has(resolved))cache.set(resolved,hash(await readFile(resolved)));
        if(cache.get(resolved)!==expected)throw Error('An image or original source changed. Prepare a new review.');
    }
    const legacyPages=await json(path.join(root,'docs/reviews/cylinder-final38-2026-09-13/legacy-products.json'));
    const pages=[...legacyPages.pages];
    for(const i of [1,2,3])pages.push(await json(path.join(root,`docs/reviews/cylinder-final38-2026-09-13/legacy-refresh-${i}.json`)));
    for(const row of data.rows){
        const matches=ledger.rows.filter(r=>r.productRecord&&r.family==='Cylinder'&&r.sku===row.sku&&!r.plate.scopeExclusion);
        const current=matches[0];
        if(matches.length!==1||['productGroupId','capacityMl','color','applicator','capColor','graceSku'].some(k=>current[k]!==row[k]))throw Error('Catalog identity changed for '+row.sku+'.');
        if(current.plate.sha256!==row.referenceSha256)throw Error('The indexed reference changed for '+row.sku+'. Prepare a new review.');
        for(const v of [...row.before,...row.views])await check(path.join(root,'public',v.url),v.sha256,path.join(root,'public/images'));
        for(const s of row.sources){
            if(s.kind?.startsWith('master-psd'))await check(path.join(master,s.sourcePath),s.sourceSha256,master);
            else if(s.kind==='exact-legacy-raster')await check(path.join(root,s.sourceFile),s.sourceSha256,path.join(root,'docs/reviews/cylinder-final38-2026-09-13'));
            else throw Error('Unrecognized original-source type.');
        }
        for(const evidence of row.legacyEvidence){
            await check(path.join(root,evidence.file),evidence.sha256,path.join(root,'docs/reviews/cylinder-final38-2026-09-13'));
            const page=pages.find(p=>hash(p.html)===evidence.pageHtmlSha256);
            if(!page||page.markdown.match(/^# (.+)$/m)?.[1]?.trim()!==row.sku||!page.html.includes(evidence.url))throw Error('Exact legacy product/image evidence changed.');
        }
    }
    const currentDecision=decisions.history.findLast(d=>d.token===token);
    const approved=currentDecision?.entries?.length===data.rows.length&&data.rows.every(r=>currentDecision.entries.some(d=>d.sku===r.sku&&d.binding===r.binding&&d.status==='approved'));
    return {...data,token,revision:decisions.revision,status:approved?'approved':'pending',reviewUrl,
        preparedPairs:data.rows.length,legacySourceDecisions:data.rows.filter(r=>legacyKinds.has(r.classification)).length,
        alignmentFailures:data.rows.filter(r=>!r.pairCheck?.passed).length};
}

export async function saveCylinderFinalPlates(root,input,services={}){
    const file=path.join(root,decisionPath),lock=file+'.lock';let fd;
    try{fd=await open(lock,'wx');}catch{throw Error('Another review is saving. Try again.');}
    try{
        const sheet=await readCylinderFinalPlates(root,services);const entries=validateFinalPlateDecision(sheet,input);
        const ledger=await json(path.join(root,'src/lib/asset-ledger/ledger.json'));
        const ids=[...new Set(sheet.rows.map(r=>ledger.rows.find(p=>p.sku===r.sku&&p.productRecord).plate.familyId))];
        const live=await (services.livePlates??livePlates)(root,ids);
        for(let i=0;i<sheet.rows.length;i+=4)await Promise.all(sheet.rows.slice(i,i+4).map(async row=>{
            const plate=live.get(row.sku);if(!plate||plate.image!==row.before[0].sourceUrl)throw Error('The live plate changed after preparation: '+row.sku);
            if(await (services.remoteHash??remoteHash)(plate.image)!==row.referenceSha256)throw Error('Served reference bytes changed: '+row.sku);
        }));
        // Recheck files after the network reads to close the stale-tab window.
        const checked=await readCylinderFinalPlates(root,services);
        if(checked.token!==sheet.token||checked.revision!==sheet.revision)throw Error('The review changed while checking. Reload.');
        let previous;try{previous=await json(file);}catch(e){if(e.code!=='ENOENT')throw e;previous={revision:0,history:[]};}
        const decision={id:randomUUID(),at:new Date().toISOString(),actor:'Jordan · explicit local batch approval',token:sheet.token,
            visualApproved:true,legacySourcesAccepted:true,entries,publicationAuthorized:false};
        const next={revision:previous.revision+1,history:[...previous.history,decision]};
        const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(next,null,2)+'\n');await rename(temp,file);
        return readCylinderFinalPlates(root,services);
    }finally{await fd.close();await unlink(lock);}
}

// Preparation accounting only. It cannot clear holds, transfer approval, or
// turn an unindexed candidate into a completed catalog plate.
export async function applyCylinderFinalPreparation(root,rows){
    let sheet;try{sheet=await readCylinderFinalPlates(root);}catch(e){if(e.code==='ENOENT')return null;return {state:'invalid',error:e.message};}
    for(const r of sheet.rows){const current=rows.find(p=>p.productRecord&&p.sku===r.sku&&p.productGroupId===r.productGroupId);
        if(current)current.plate.finalPreparation={reviewUrl,token:sheet.token,binding:r.binding,status:sheet.status,
            paired:true,alignmentPassed:r.pairCheck.passed,sourceDecisionRequired:legacyKinds.has(r.classification)&&sheet.status!=='approved',
            sourceKind:legacyKinds.has(r.classification)?'verified-original-legacy-raster':'master-psd',
            views:r.views.map(({url,sha256,label})=>({url,sha256,label}))};}
    return {state:sheet.status,preparedPairs:sheet.preparedPairs,legacySourceDecisions:sheet.legacySourceDecisions,
        alignmentFailures:sheet.alignmentFailures,reviewUrl,token:sheet.token};
}
