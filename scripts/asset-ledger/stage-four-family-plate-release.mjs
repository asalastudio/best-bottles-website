// Stage the approved four-family plate batch for a later, release-gated publish.
// This copies exact reviewed bytes, derives the normal thumbnails, and writes
// an immutable hash lock. It never uploads, indexes, or authorizes publication.
import {createHash} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {readFourFamilyPlates} from './four-family-plates.mjs';

const root=process.cwd();
const id='four-family-plates-2026-09-13';
const reviewDir=path.join(root,'docs/reviews',id);
const out=path.join(root,'dist/paper-doll',`${id}-release`);
const packetFile=path.join(reviewDir,'prepared.json');
const decisionsFile=path.join(root,'data/asset-ledger',`${id}-decisions.json`);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const fail=message=>{throw new Error(`stage-four-family-plate-release: ${message}`);};
const safeSku=sku=>{if(!/^[A-Za-z0-9._-]+$/.test(sku))fail(`unsafe SKU ${sku}`);return sku;};
const neck=familyId=>familyId.match(/(\d+-\d+)$/)?.[1]??'';

for(const file of [path.join(reviewDir,'approved-lock.json'),path.join(reviewDir,'ship-authorization.json'),path.join(out,'manifest.json')]){
    try{await access(file);fail(`release is already locked or staged: ${file}`);}catch(e){if(e.code!=='ENOENT')throw e;}
}

const [sheet,ledger,decisions,packetBytes,decisionBytes]=await Promise.all([
    readFourFamilyPlates(root),
    json(path.join(root,'src/lib/asset-ledger/ledger.json')),
    json(decisionsFile),
    readFile(packetFile),
    readFile(decisionsFile),
]);
const packetSha=digest(packetBytes),decisionSha=digest(decisionBytes);
const decision=(decisions.history??[]).findLast(d=>d.token===packetSha);
const ready=sheet.rows.filter(r=>r.status==='ready');
if(sheet.status!=='approved'||!decision||decision.publicationAuthorized!==false)fail('the packet needs a current, non-publishing approval decision.');
const approved=decision.entries?.filter(e=>e.status==='approved'&&e.publicationAuthorized===false)??[];
if(approved.length!==ready.length||new Set(approved.map(e=>e.sku)).size!==ready.length)fail(`expected ${ready.length} unique approved rows, found ${approved.length}.`);
const approvedBySku=new Map(approved.map(e=>[e.sku,e]));
const ledgerBySku=new Map(ledger.rows.filter(r=>r.productRecord).map(r=>[r.sku,r]));
await mkdir(out,{recursive:true});
const rows=[];
for(const reviewRow of ready){
    const saved=approvedBySku.get(reviewRow.sku),current=ledgerBySku.get(reviewRow.sku);
    if(!saved||!current)fail(`approved catalog identity is missing for ${reviewRow.sku}.`);
    if(saved.recordId!==reviewRow.recordId||saved.productGroupId!==reviewRow.productGroupId||saved.binding!==reviewRow.binding)fail(`approval binding changed for ${reviewRow.sku}.`);
    const familyId=current.plate.familyId||reviewRow.familyId;
    if(!familyId)fail(`family identity is missing for ${reviewRow.sku}.`);
    const assets={};
    for(const view of reviewRow.views){
        const source=reviewRow.sources.find(s=>s.role===view.role)||reviewRow.sources[0];
        if(!source?.sourcePath||source.kind!=='master-psd')fail(`master PSD lineage is missing for ${reviewRow.sku} ${view.role}.`);
        const sourceFile=path.join(root,'public',view.url);
        const bytes=await readFile(sourceFile);
        if(digest(bytes)!==view.sha256)fail(`reviewed image bytes changed for ${reviewRow.sku} ${view.role}.`);
        const meta=await sharp(bytes).metadata();
        if(meta.format!=='webp'||meta.width!==1000||meta.height!==1100)fail(`invalid reviewed canvas for ${reviewRow.sku} ${view.role}.`);
        const prefix=`plates/${familyId}/${safeSku(reviewRow.sku)}`;
        const suffix=view.role==='on'?'front-on':'front-off';
        const key=`${prefix}/${view.sha256}.${suffix}-1000x1100.webp`;
        const dest=path.join(out,key);await mkdir(path.dirname(dest),{recursive:true});await copyFile(sourceFile,dest);
        const thumbBytes=await sharp(bytes).resize(240,240,{fit:'contain',background:{r:255,g:255,b:255,alpha:1}}).webp({quality:90}).toBuffer();
        const thumbSha=digest(thumbBytes),thumbKey=`${prefix}/${thumbSha}.${suffix}-240x240.webp`,thumbDest=path.join(out,thumbKey);
        await mkdir(path.dirname(thumbDest),{recursive:true});await writeFile(thumbDest,thumbBytes,{flag:'wx'});
        const asset=(assetKey,assetSha,assetBytes,width,height)=>({key:assetKey,storeKey:assetKey,sha256:assetSha,bytes:assetBytes.length,width,height,
            sourceLibrary:'master',sourceRelPath:source.sourcePath,sourceSha256:source.sourceSha256,sourceEvidence:reviewRow.sources,reviewBinding:reviewRow.binding});
        const full=asset(key,view.sha256,bytes,1000,1100),thumb=asset(thumbKey,thumbSha,thumbBytes,240,240);
        if(view.role==='on'){assets.plate=full;assets.thumb=thumb;}else{assets.plateCapOff=full;assets.thumbCapOff=thumb;}
    }
    if(!assets.plate)fail(`approved row has no cap-on image: ${reviewRow.sku}.`);
    rows.push({websiteSku:reviewRow.sku,graceSku:reviewRow.graceSku,productGroupId:reviewRow.productGroupId,familyId,
        familyName:reviewRow.family,neck:neck(familyId),body:'registered',closure:'Cap',mode:'registered',...assets,
        publishable:true,blockReasons:[],reviewBinding:reviewRow.binding});
}
const groups=new Map();for(const row of rows){const g=groups.get(row.familyId)||{familyId:row.familyId,name:row.familyName,neck:row.neck,rows:0};g.rows++;groups.set(row.familyId,g);}
const manifest={release:'Four-family plate release 2026-09-13',builder:{name:'stage-four-family-plate-release.mjs',version:'1.0.0'},
    generatedAt:new Date().toISOString(),reviewPacketSha256:packetSha,approvalFileSha256:decisionSha,approvalId:decision.id,
    approvalRevision:decisions.revision,approvalStatus:'approved',publicationAuthorized:false,
    canvas:{width:1000,height:1100},counts:{rows:rows.length,groups:groups.size,capOff:rows.filter(r=>r.plateCapOff).length,views:rows.reduce((n,r)=>n+(r.plateCapOff?2:1),0)},
    groups:[...groups.values()],rows,thumbnailPolicy:'Derived 240px thumbnails from the exact approved full-resolution bytes.',
    releaseInstructions:'Publish only after the release-specific ship instruction is recorded; upload, HEAD-verify every hosted object, preserve existing family metadata, then index exact view hashes.'};
const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(out,'manifest.json'),manifestBytes,{flag:'wx'});
const lock={schemaVersion:1,release:manifest.release,approvedAt:decision.at,actor:decision.actor,approvalId:decision.id,
    reviewPacketSha256:packetSha,approvalFile:`data/asset-ledger/${id}-decisions.json`,approvalFileSha256:decisionSha,
    manifestFile:`dist/paper-doll/${id}-release/manifest.json`,manifestSha256:digest(manifestBytes),visualApproved:true,
    publicationAuthorized:false,rows:approved,note:'Immutable approval and exact staged-byte lock. Publication still requires the release-specific ship instruction and hosted verification.'};
await writeFile(path.join(reviewDir,'approved-lock.json'),JSON.stringify(lock,null,2)+'\n',{flag:'wx'});
const deployment=process.env.NEXT_PUBLIC_CONVEX_URL??null;
await writeFile(path.join(reviewDir,'release-preflight.json'),JSON.stringify({generatedAt:new Date().toISOString(),release:manifest.release,
    deployment,reviewPacketSha256:packetSha,approvalFileSha256:decisionSha,manifestSha256:lock.manifestSha256,approvalStatus:'approved',
    publicationAuthorized:false,rows:rows.length,views:manifest.counts.views,capOff:manifest.counts.capOff,families:[...groups.keys()].sort(),
    preserved:sheet.counts.preserved,recordedExceptions:(sheet.counts.hold??0)+(sheet.counts.legacy??0),duplicateDispositionCount:decision.duplicateEntries?.length??0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({release:manifest.release,rows:rows.length,views:manifest.counts.views,capOff:manifest.counts.capOff,
    families:groups.size,preserved:sheet.counts.preserved,recordedExceptions:(sheet.counts.hold??0)+(sheet.counts.legacy??0),
    duplicateDispositionCount:decision.duplicateEntries?.length??0,publicationAuthorized:false}));
