import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { builderBodyIdentity,type CatalogRow } from '../../../src/lib/bottle-builder/model';
import { stageLayout } from '../../../src/lib/products/pdp-redesign/stage';
import { displayDerivativeUrl } from '../../../src/lib/products/display-derivative';
import type { ReviewKit as KitLike, FamilySnapshot, InventoryGroup, ProfileCrosswalk, ReviewHold, RecoveredMaster, MasterReview } from './review-types';
const dir='docs/reviews/cylinder-family-completion-2026-11-02',pub='public/reviews/cylinder-family-completion-2026-11-02';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const snapshot=read(dir+'/current-family-snapshot.json') as FamilySnapshot,scope=read(dir+'/inventory-before.json') as {groups:InventoryGroup[];glassRows:number;standalonePlasticRows:string[];physicalProfileCrosswalk?:ProfileCrosswalk};
const crosswalk=read(dir+'/physical-profile-crosswalk.json') as ProfileCrosswalk;
function physicalIdentity(row: CatalogRow) {
    const original=builderBodyIdentity(row),alias=crosswalk.aliases.find(entry=>entry.websiteSku===row.websiteSku);
    if (!alias) return original;
    assert.equal(row.graceSku,alias.graceSku);assert.equal(row.capacityMl,alias.sourceCapacityMl);assert.equal(original.bodyId,alias.sourceProfile);
    return {...original,bodyId:alias.targetProfile};
}
for(const alias of crosswalk.aliases){
    const from=scope.groups.find(group=>group.profile===alias.sourceProfile),to=scope.groups.find(group=>group.profile===alias.targetProfile);
    assert(to,'Missing reconciled 25 ml profile');
    if(from){to.rows=[...new Set([...to.rows,...from.rows])];scope.groups=scope.groups.filter(group=>group!==from);}
}
scope.physicalProfileCrosswalk=crosswalk;
fs.writeFileSync(dir+'/inventory-reconciled.json',JSON.stringify(scope,null,2)+'\n');
const catalog=Object.values(snapshot.families).flatMap(f=>f.rows) as CatalogRow[];
const prepared=read('public/local-kits/cylinder-family-completion-2026-11-02/kits.json');
const approved=read('src/lib/paper-doll/approved-kits.generated.json');
const raw=read(dir+'/register-kits-before.json').kits;
const reg=read(dir+'/registration.json');
const entries=read(dir+'/review-data.json');
const library=read('docs/reviews/cylinder-master-materials-2026-10-31/family-inventory.json').rows as RecoveredMaster[];
const media=read(dir+'/source-media.json');
fs.mkdirSync(pub,{recursive:true});fs.mkdirSync(dir+'/masters',{recursive:true});
const held: Array<{sku?: string;profile?: string;bodyId?: string;reason: string;detail?: string}> = (reg.held as ReviewHold[]).map(hold=>crosswalk.aliases.some(alias=>alias.websiteSku===hold.sku)?{...hold,bodyId:'cylinder-25ml-18-415',reason:'25ml-catalog-alias-and-artwork-reconciliation',detail:'Jordan confirmed this 30 ml catalog entry is the 25 ml. It uses the shared 25 ml body master in this inventory. Its legacy metal-top/base artwork and catalog metadata still need reconciliation before replacing the complete live assembly.'}:hold);
const masters:MasterReview[]=[];
for(const group of scope.groups){
    const matches=catalog.filter(row=>physicalIdentity(row).bodyId+'|'+row.color===group.key);
    const candidate=matches.map(r=>prepared.rows[r.websiteSku!]).find(Boolean) as KitLike|undefined;
    const existing=matches.map(r=>approved.rows[r.websiteSku!]).find(Boolean) as KitLike|undefined;
    const kit=candidate??existing??matches.map(r=>raw[r.websiteSku!]).find(Boolean) as KitLike|undefined;
    const source=library.find(r=>r.bodyId===kit?.register?.bodyId&&r.glass===group.glass);
    const body=kit?.parts.find(p=>p.slot==='body');
    let sha256:string|null=null,masterFile:string|null=null;
    if(body){
        const url=body.image.url;
        let bytes:Buffer;
        if(url.startsWith('/'))bytes=fs.readFileSync('public'+url);
        else if(media[url])bytes=fs.readFileSync(media[url].file);
        else {const response=await fetch(url);assert(response.ok,'Master HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());}
        sha256=hash(bytes);
        if(body.image.sha256)assert.equal(sha256,body.image.sha256,'Master bytes no longer match '+group.key);
        const ext=url.split('?')[0].endsWith('.svg')?'svg':url.split('?')[0].endsWith('.webp')?'webp':'png';
        masterFile=dir+'/masters/'+group.profile.replaceAll('|','-').replaceAll(' ','-').toLowerCase()+'-'+group.glass.toLowerCase().replaceAll(' ','-')+'.'+sha256.slice(0,12)+'.'+ext;
        fs.writeFileSync(masterFile,bytes);
    } else if(group.capacityMl!==30){
        const recovered=library.find(r=>r.bodyId===group.profile.split('|').slice(0,2).join('-')&&r.glass===group.glass);
        if(recovered?.sourceAvailable){sha256=recovered.fileSha256;masterFile=recovered.sourceFile;}
    }
    const approvedSkus=matches.filter(r=>approved.rows[r.websiteSku!]).map(r=>r.websiteSku!);
    const candidateSkus=matches.filter(r=>prepared.rows[r.websiteSku!]).map(r=>r.websiteSku!);
    const unresolved=matches.filter(r=>!approved.rows[r.websiteSku!]&&!prepared.rows[r.websiteSku!]);
    for(const r of unresolved){if(!held.some(h=>h.sku===r.websiteSku))held.push({sku:r.websiteSku,profile:group.profile,reason:'source-reconciliation',detail:group.capacityMl===6?'This source row says Clear/N/A, while its item description is a short shiny black cap. Retain its exact identity for reconciliation.':'Master is recovered; component assembly is still being checked.'});}
    const context=kit?{websiteSku:kit.sku,family:matches[0].family!,color:group.glass,capacityMl:group.capacityMl,applicator:null}:null;
    const layout=kit&&body?stageLayout({...kit,parts:[body]},'sidecar',context!):null;
    const m={key:group.key,profile:group.profile,label:group.capacityMl+' ml · '+group.neck+' · '+group.glass,capacityMl:group.capacityMl,neck:group.neck,glass:group.glass,
        status:candidate?'candidate for visual review':existing?'existing approved master':body?'source recovered, assembly pending':'standalone body pending',
        configurations:matches.length,approvedSkus,candidateSkus,heldSkus:unresolved.map(r=>r.websiteSku!),
        sourceUrl:body?.image.url??null,sha256,masterFile,scale:kit?.glassSizing??source?.scale??null,
        layout,reviewSku:candidateSkus[0]??null,
        preservation:'Original sources retained. Distinct capacity/profile/color/neck combinations never share stretched bodies.'};
    masters.push(m);
}
const registry={capturedAt:snapshot.capturedAt,scope:'Current orderable Cylinder plus regrouped Tulip; not an all-history completeness claim',catalogRows:catalog.length,glassRows:scope.glassRows,
    masterSets:masters.length,bodySourceRecovered:masters.filter(m=>m.sha256).length,approvedRecipeCount:masters.reduce((n,m)=>n+m.approvedSkus.length,0),candidateRecipeCount:entries.length,
    standalonePlastic:scope.standalonePlasticRows,physicalProfileCrosswalk:crosswalk,historicalSourceOutsideCurrentCatalog:library.filter(r=>r.capacityMl===5.5).map(r=>({plateKey:r.plateKey,sha256:r.fileSha256,state:'source-preserved, absent from current orderable family query'})),
    masters:masters.map(master=>Object.fromEntries(Object.entries(master).filter(([key])=>key!=="layout"))),held,publication:'New candidates are local only, not added to approved hosted manifest.'};
fs.writeFileSync(dir+'/master-registry.json',JSON.stringify(registry,null,2)+'\n');
fs.copyFileSync(dir+'/master-registry.json',pub+'/master-registry.json');
const csvRows=[['websiteSku','physicalProfile','catalogCapacityMl','physicalCapacityMl','glass','neck','fitment','finish','reviewState','masterSha256','productUrl','holdReason']];
for(const row of catalog.filter(r=>r.category==='Glass Bottle')){
    const identity=physicalIdentity(row),m=masters.find(m=>m.key===identity.bodyId+'|'+row.color)!;
    const hold=held.find(h=>h.sku===row.websiteSku);
    csvRows.push([row.websiteSku!,identity.bodyId,String(row.capacityMl),String(m.capacityMl),row.color!,row.neckThreadSize!,row.applicator??'Unspecified',row.capColor??'',prepared.rows[row.websiteSku!]?'candidate':approved.rows[row.websiteSku!]?'existing-approved':'held',m.sha256??'',
        'http://localhost:3010/products/'+row.productGroupSlug+'?sku='+row.websiteSku+(prepared.rows[row.websiteSku!]?'&assetPreview=gpt13':''),hold?.detail??hold?.reason??'']);
}
const csv=csvRows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
fs.writeFileSync(dir+'/configuration-checklist.csv',csv);fs.writeFileSync(pub+'/configuration-checklist.csv',csv);
const displaySources: Record<string, string> = {};
for (const entry of entries) for (const collection of [entry.before, entry.after]) for (const layout of Object.values(collection ?? {}) as Array<{parts: Array<{url: string}>}>) for (const part of layout.parts) displaySources[part.url] = displayDerivativeUrl(part.url, 640) ?? part.url;
for (const master of masters) for (const part of master.layout?.parts ?? []) displaySources[part.url] = displayDerivativeUrl(part.url, 640) ?? part.url;
const data={scope,entries,masters,held,displaySources};
const html=fs.readFileSync(dir+'/review-template.html','utf8').replace('__DATA__',JSON.stringify(data).replaceAll('<','\\u003c'));
fs.writeFileSync(pub+'/index.html',html);
console.log(JSON.stringify({masterSets:masters.length,recovered:registry.bodySourceRecovered,candidateRecipes:entries.length,existingApproved:registry.approvedRecipeCount,held:held.length}));
