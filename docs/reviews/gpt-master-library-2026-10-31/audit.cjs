const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp'),{ConvexHttpClient}=require('convex/browser');
const root=process.cwd(),out=path.join(root,'outputs/catalog-model-repair-2026-10-31/gpt-master-library');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8')),save=(name,x)=>fs.writeFileSync(path.join(out,name),JSON.stringify(x,null,2)+'\n');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function pool(rows,fn,n=5){let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<rows.length)await fn(rows[i++])}));}
(async()=>{
fs.mkdirSync(out,{recursive:true});
const hist=read('outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview/historical-ai-body-masters.json');
const old=read('outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview/register-snapshot.json');
require('dotenv').config({path:'.env.local',quiet:true});
const client=new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const ids=new Set();let cursor=null;
do{const p=await client.query('register:listPage',{writeToken:process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN,table:'bodies',cursor,numItems:250});for(const b of p.page)ids.add(b.bodyId);if(p.isDone)break;cursor=p.continueCursor}while(cursor);
const register=[];await pool([...ids],async bodyId=>{const r=await client.query('register:body',{bodyId});if(r)register.push(r)});
register.sort((a,b)=>a.body.bodyId.localeCompare(b.body.bodyId));
const counts=await client.query('register:counts',{});
save('register-snapshot.json',{checkedAt:new Date().toISOString(),readOnly:true,source:'current .env.local NEXT_PUBLIC_CONVEX_URL; no writes',counts,register});
const targets=read('src/lib/register/catalog-scale.generated.json');
const readiness=read('src/lib/register/catalog-scale-readiness.generated.json');
const policy=read('outputs/catalog-model-repair-2026-10-31/reports/catalog-scale/scale-policy.json');
const bodyMap=new Map(register.map(r=>[r.body.bodyId,r]));
const rows=[];
await pool(hist,async h=>{
const p=path.join(root,'outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview/historical-ai',h.sha256+'.png');
let verification={verified:false,path:path.relative(root,p)};
try{const bytes=fs.readFileSync(p);const meta=await sharp(bytes).metadata();const fileHash=digest(bytes);let pixelHash=null;if(fileHash!==h.sha256)pixelHash=digest(await sharp(bytes).ensureAlpha().raw().toBuffer());verification={...verification,verified:fileHash===h.sha256||pixelHash===h.sha256,fileSha256:fileHash,pixelSha256:pixelHash,width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha,bytes:bytes.length};}catch(e){verification.error=e.message}
const b=bodyMap.get(h.bodyId),cur=b?.plates.find(p=>p.plateKey===h.plateKey);
const target=targets[h.bodyId],s=policy.rows.find(r=>r.bodyId===h.bodyId);
const newerCorrection=/^(cylinder-5ml-13-415|vial-2ml-8-425|vial-4ml-13-425|cylinder-(3|3.3|4)ml-12mm)$/.test(h.bodyId);
rows.push({plateKey:h.plateKey,bodyId:h.bodyId,glass:h.glass,family:b?.body.family||h.bodyId,capacityMl:b?.body.capacityMl,neck:b?.body.neck,bodyStatus:b?.body.status,
modelRecorded:h.render?.model,qualityRecorded:h.render?.quality,sourceManifest:'data/register/bodies/bodies-measurements.json',sourcePsd:h.source?.psd,sha256:h.sha256,
anchors:h.anchors,pxPerMm:h.pxPerMm,scale:target||null,scaleIssues:s?.issues||[],scaleReadiness:readiness[h.bodyId]||null,
currentRegisterSource:cur?.source.library||null,currentRegisterSha256:cur?.image.sha256||null,matchesCurrentRegister:cur?.image.sha256===h.sha256,
laterGeometryCorrection:newerCorrection,selection:newerCorrection?'Compare with later measured correction before reuse':cur?.image.sha256===h.sha256?'Matches current body register; assembly QA still required':'Historical master retained; compare with current body before reuse',
bakedBackground:h.bakedOnBone||null,verification,preview:'/reviews/glass-body-overview-2026-10-31/masters/'+h.sha256+'.png'});
});
rows.sort((a,b)=>a.family.localeCompare(b.family)||(a.capacityMl||0)-(b.capacityMl||0)||a.plateKey.localeCompare(b.plateKey));
const hKeys=new Set(rows.map(r=>r.plateKey));
const gaps=register.filter(r=>r.body.category==='Glass Bottle'&&r.body.status==='current').flatMap(r=>r.body.glassVariants.filter(glass=>!hKeys.has(r.body.bodyId+'|'+glass)).map(glass=>({bodyId:r.body.bodyId,glass,representative:r.body.representative,reason:'No exact entry in historical GPT body manifest. Not proof that no source exists; identity/source reconciliation required.'})));
const currentPlates=register.flatMap(r=>r.plates);
const tally=(a,fn)=>a.reduce((o,r)=>{const k=fn(r);o[k]=(o[k]||0)+1;return o},{});
const summary={checkedAt:new Date().toISOString(),readOnly:true,historicalImages:rows.length,historicalDesigns:new Set(rows.map(r=>r.bodyId)).size,verifiedFiles:rows.filter(r=>r.verification.verified).length,bytes:rows.reduce((n,r)=>n+(r.verification.bytes||0),0),recordedModels:tally(rows,r=>r.modelRecorded),matchesCurrentRegister:rows.filter(r=>r.matchesCurrentRegister).length,
registerDesigns:register.length,registerPlates:currentPlates.length,registerSources:tally(currentPlates,p=>p.source.library),historicalWithScaleTarget:rows.filter(r=>r.scale).length,historicalWithAnchors:rows.filter(r=>r.anchors?.baselineY!=null&&r.anchors?.axisX!=null&&r.anchors?.seatY!=null&&r.anchors?.shoulderY!=null).length,unmatchedGlassEntries:gaps.length,unmatchedGlassDesigns:new Set(gaps.map(g=>g.bodyId)).size,
scaleDecision:'September 25 catalog curve fitted from five reference bodies, with approved family exceptions. Foot baseline 91%. Preserve shoulder/full-glass landmark distinctions; no per-cap or per-color camera refit.',
coverageLimit:'Historical manifest coverage is not catalog-wide visual approval or proof of runtime selection. Some register identities and labels require reconciliation. Recent local overrides are separate.',
mediaGapNote:'Offline media-gap-snapshot audited an older product/plate snapshot from a different endpoint, not bare-body masters; its gap count is excluded from this report.'};
save('summary.json',summary);save('masters.json',rows);save('identity-followups.json',gaps);save('scale-policy.json',{confirmedAt:policy.confirmedAt,userDecision:policy.userDecision,curve:policy.curve,baselinePct:91,calibration:policy.curve.calibrationBodies.map(id=>({bodyId:id,...targets[id]}))});
const cols=['bodyId','family','capacityMl','neck','glass','modelRecorded','sha256','matchesCurrentRegister','currentRegisterSource','selection','targetPct','landmark','baselinePct','verified','sourcePsd'];
const csv=[cols,...rows.map(r=>cols.map(c=>r[c]??r.scale?.[c]??r.verification?.[c]??''))].map(a=>a.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n');
fs.writeFileSync(path.join(out,'masters.csv'),csv+'\n');
console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e.message);process.exit(1)});
