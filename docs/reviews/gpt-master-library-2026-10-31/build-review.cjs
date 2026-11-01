const fs=require('fs');
const out='outputs/catalog-model-repair-2026-10-31/gpt-master-library',pub='public/reviews/gpt-master-library-2026-10-31',doc='docs/reviews/gpt-master-library-2026-10-31';
for(const d of [pub,doc])fs.mkdirSync(d,{recursive:true});
const read=f=>JSON.parse(fs.readFileSync(f)),write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n');
const masters=read(out+'/masters.json'),summary=read(out+'/summary.json'),policy=read(out+'/scale-policy.json'),register=read(out+'/register-snapshot.json').register;
const plates=new Map(register.flatMap(r=>r.plates.map(p=>[p.plateKey,p])));
const provenance=new Map(read('data/register/bodies/bodies-measurements.json').map(r=>[r.plateKey,r]));
const review=read(doc+'/review-decisions.json'),preferred=new Map(review.preferredCandidates.map(r=>[r.plateKey,r]));
for(const m of masters){
 const source=provenance.get(m.plateKey),decision=preferred.get(m.plateKey);
 if(decision && (decision.fileSha256!==m.verification.fileSha256 || decision.sourceSha256!==m.sha256))throw new Error('Preferred source changed: '+m.plateKey);
 m.renderPass=source?.render?.pass??'unrecorded';
 m.sourceRole=source?.source?.role??'';
 m.processedSourceFile=source?.file??'';
 m.visualReview={
  decision:decision?'preferred-candidate':m.plateKey==='cream-jar-20ml-40mm|White'?'held-wrong-source':'individual-review',
  label:decision?'Preferred candidate: preserve this version':m.plateKey==='cream-jar-20ml-40mm|White'?'Held: wrong source body':'Individual visual review pending',
  evidence:decision?.evidence??'No current individual visual acceptance recorded.',
  protectedReference:Boolean(decision),
  finalVisualApproval:false,
  assemblyVerified:false
 };
}

const preserved=['cylinder-3.3ml-12mm','cylinder-4ml-12mm','cylinder-5ml-13-415','vial-2ml-8-425','vial-4ml-13-425','vial-2ml-13-425','elegant-60ml-18-415','cylinder-9ml-17-415','cylinder-9ml-13-415'];
for(const m of masters){m.preview='/reviews/glass-body-overview-2026-10-31/masters/'+m.verification.fileSha256+'.png';const p=plates.get(m.plateKey);m.registerApproval=p?.anchorStatus??'not registered';m.lockStatus=m.plateKey==='cream-jar-20ml-40mm|White'?'held: wrong source body':preserved.includes(m.bodyId)?'preserve later family correction; historical source locked':p?.anchorStatus==='approved'&&m.matchesCurrentRegister?'historical approved source locked':'source locked; approval reconciliation';}
const aliases=register.flatMap(r=>r.plates.flatMap(p=>{const h=masters.find(h=>h.sha256===p.image.sha256);return h&&h.plateKey!==p.plateKey?[{alias:p.plateKey,canonicalHistoricalKey:h.plateKey,evidence:'Identical current register image hash',sha256:p.image.sha256}]:[]}));
const sourceProof={record:'docs/COMPONENT_REGISTER_BODIES.md',commit:'5ab30ada',date:'2026-09-25',passes:[...new Set(masters.map(m=>m.renderPass))],laterBostonRefinement:'scripts/register/bodies/hero_jobs.py, September 29; per-image pass and role are retained below',intent:'Source-of-truth glass bodies for the catalogue',approval:'data/register/bodies/rulings.json',approvedDate:'2026-09-26',approvalScope:'I approve all the approvable ones; existing holds remain held.'};
const lock={schemaVersion:2,createdAt:new Date().toISOString(),scope:'Recovered source lock and selection policy. Does not change storefront assignments or mark every assembly approved.',decision:'Existing GPT master bodies for the paper-doll architecture first; product page and standalone configurator must resolve the same selected body. Grid migration is separate.',sourceProof,visualReview:review,policy:{identity:['body design','capacity','neck finish','glass color'],scale:policy,canvas:{width:1000,height:1100,background:'#F5F3EF',axisPct:50,baselinePct:91},rules:['One immutable selected image hash per body identity and glass color. No separate body per cap, sprayer or roller.','Keep high-resolution source files; apply uniform scale from the approved shoulder/full-glass landmark to the fixed baseline.','Use the catalog curve fitted to five reference bodies, with family exceptions. Do not round every bottle into five buckets.','One body transform across product page and builder, color variants and assembly views. Fitment offsets may change; body placement does not.','Preserve later measured geometry and accepted local corrections. Older art cannot automatically replace them.','Clear/Swirl historical bodies have a bone-colored interior; do not multiply a second time. Tubes require prepared optical/occlusion layers.','Source-byte verification is separate from assembly visual QA. Preserve readiness holds.']},aliases,rows:masters.map(m=>({plateKey:m.plateKey,bodyId:m.bodyId,glass:m.glass,file:m.verification.path,sourceUrl:m.preview,sha256:m.sha256,fileSha256:m.verification.fileSha256,hashBasis:m.verification.pixelSha256===m.sha256?'decoded RGBA pixels':'file bytes',width:m.verification.width,height:m.verification.height,anchors:m.anchors,pxPerMm:m.pxPerMm,scale:m.scale,modelRecorded:m.modelRecorded,renderPass:m.renderPass,sourceRole:m.sourceRole,processedSourceFile:m.processedSourceFile,visualReview:m.visualReview,sourcePsd:m.sourcePsd,registerApproval:m.registerApproval,lockStatus:m.lockStatus,activeMigration:'not applied by this source audit'}))};
const followups=read(out+'/identity-followups.json').map(g=>({...g,classification:/rectangle-10/.test(g.bodyId)?'Existing GPT master under tall-rectangle identity; same current register hash':/lotion|marble|royal-14|cylinder-30/.test(g.bodyId)?'Documented merged/one-piece source exclusion; separate body needed only if configurator requires it':/pillar-9/.test(g.bodyId)?'Historical mismatch: 17-415 spray vs available 13-415 roll-on; source match pending':'Historical exact-source gap; reconcile identity before new generation'}));
const columns=['plateKey','visualDecision','protectedReference','renderPass','sourceRole','fileSha256','targetPct','landmark','baselinePct','historicalLockStatus','laterGeometryCorrection','sourceUrl'];
const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const reviewCsv=[columns,...masters.map(m=>[m.plateKey,m.visualReview.decision,m.visualReview.protectedReference,m.renderPass,m.sourceRole,m.verification.fileSha256,m.scale.targetPct,m.scale.landmark,m.scale.baselinePct,m.lockStatus,m.laterGeometryCorrection,m.preview])].map(r=>r.map(csvCell).join(',')).join('\n')+'\n';
for(const d of [doc,pub]){write(d+'/review-decisions.json',review);fs.writeFileSync(d+'/visual-review.csv',reviewCsv);}
write(doc+'/recovered-master-lock.json',lock);write(pub+'/masters.json',masters);write(pub+'/summary.json',summary);write(pub+'/scale-policy.json',policy);write(pub+'/identity-followups.json',followups);
for(const f of ['summary.json','masters.csv','register-snapshot.json','scale-policy.json'])fs.copyFileSync(out+'/'+f,doc+'/'+f);
write(doc+'/identity-followups.json',followups);
fs.copyFileSync('docs/COMPONENT_REGISTER_BODIES.md',doc+'/source-history.md');fs.copyFileSync('data/register/bodies/rulings.json',doc+'/historical-rulings.json');
fs.writeFileSync(doc+'/README.md',[
'# Recovered GPT body master library','',
'Jordan chose existing GPT body masters for the paper-doll architecture on October 31, 2026. Product pages and standalone builder must share the same selected master. The product grid is a later migration.','',
'## Current visual selection','',
'Jordan preferred the Boston Round family and the clear Apothecary 118 ml. The ten affected source files are pinned as preferred candidates. Family-level praise is not approval of every color or assembled configuration. All other bodies remain individually reviewable; the white 20 ml cream jar remains held for the wrong source.','',
'The gallery shows processed registered body layers. The nine Boston Round plates record a later hero-reference material pass, documented in scripts/register/bodies/hero_jobs.py. Other plates include earlier passes. A recorded GPT model and old approval do not prove that the displayed version meets today\'s glass-quality bar. Raw-versus-processed and later-upscale recovery remains open.','',
'review-decisions.json preserves Jordan\'s feedback, exact image hashes and acceptance checks. visual-review.csv provides one row per body/color. No preferred reference or later accepted repair is replaced automatically.','',
'## Verified recovery','',
'The September 25 record established source-of-truth bodies; the saved manifest also contains later material passes. All 109 saved color images across 71 designs were rehashed. All have registration anchors and an approved-family or curve-derived display target. The historical manifest records GPT Image 2.5 Sunburst, quality high. These are bare bodies, separate from assembled heroes.','',
'The configured registry has 110 plates: 101 marked GPT and 9 Blender. 100 historical plate keys still match their registered hashes. One extra current GPT key uses the same Rectangle 10 ml source under an alias. This read-only registry snapshot does not prove which asset every rendered product page selects.','',
'## Size contract','',
'Target percent = 3.5314 × bare-glass height in mm ^ 0.5868, then the approved family override. The curve was fitted from five reference bottles; it is not five discrete sizes. Keep a 10:11 canvas, foot at 91%, and a centered axis. Shoulder and full-glass targets measure different spans.','',
'Cylinder 5 ml stays at 36.5% shoulder-to-foot; 2 ml 8-425 vial at 40.24% full glass; 4 ml 13-425 vial at 51.74% full glass. Product page and builder use the same transform across component variations.','',
'## Source lock and migration boundary','',
'recovered-master-lock.json pins original image hashes, anchors, sizing policy, provenance and holds. It does not activate a storefront rollback. The 5/9 ml cylinders, 3.3/4 ml sprayers, 2/4 ml vials and Elegant 60 ml must be reconciled with later local repairs before selection. White 20 ml cream jar remains held: wrong source body. The newest 5 ml material candidates remain review candidates.','',
'identity-followups.json lists 12 current glass/color entries without an exact historical key. These include merged standalone sources, a verified Rectangle alias, old naming differences and unresolved matches. This is not a claim of 12 missing images.','',
'## Files','',
'Gallery: http://localhost:3010/reviews/gpt-master-library-2026-10-31/index.html','',
'Originals: outputs/catalog-model-repair-2026-10-31/reports/glass-body-overview/historical-ai/<source-sha256>.png','',
'Gallery copies: public/reviews/glass-body-overview-2026-10-31/masters/<file-sha256>.png','',
'Read-only audit: outputs/catalog-model-repair-2026-10-31/gpt-master-library/audit.cjs','',
'No generation, source deletion, database write, merge or deployment occurred. The older offline SKU media-gap snapshot is excluded from body coverage totals.'
].join('\n')+'\n');
fs.copyFileSync(out+'/gallery-template.html',pub+'/index.html');fs.copyFileSync(pub+'/index.html',doc+'/index.html');
fs.copyFileSync(out+'/masters.csv',pub+'/masters.csv');fs.copyFileSync(doc+'/recovered-master-lock.json',pub+'/recovered-master-lock.json');
write(doc+'/gallery-data.json',{masters,policy,summary,followups});
console.log(JSON.stringify({gallery:pub,lock:doc+'/recovered-master-lock.json',rows:masters.length,visualStatuses:masters.reduce((o,r)=>(o[r.visualReview.decision]=(o[r.visualReview.decision]||0)+1,o),{}),statuses:masters.reduce((o,r)=>(o[r.lockStatus]=(o[r.lockStatus]||0)+1,o),{}),aliases},null,2));
