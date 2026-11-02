import fs from 'node:fs';
import assert from 'node:assert/strict';
import {stageLayout} from '../../../src/lib/products/pdp-redesign/stage';
import type {ReviewKit,FamilySnapshot} from '../cylinder-family-completion-2026-11-02/review-types';
const dir='docs/reviews/jumbo-roller-material-2026-11-02';
const family='docs/reviews/cylinder-family-completion-2026-11-02';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const before=read(dir+'/before-kits.json').rows as Record<string,ReviewKit>;
const current=read('public/local-kits/cylinder-family-completion-2026-11-02/kits.json').rows as Record<string,ReviewKit>;
const snapshot=read(family+'/current-family-snapshot.json') as FamilySnapshot;
const catalog=Object.values(snapshot.families).flatMap(f=>f.rows);
const geometry=read(dir+'/geometry-verification.json');assert.equal(geometry.alphaDifferences,0);
const entries=read(family+'/review-data.json') as Array<{sku:string;neck:string;views:Array<'sidecar'|'capon'|'exploded'>;after:Record<string,ReturnType<typeof stageLayout>>}>;
let changed=0;
for(const [sku,kit]of Object.entries(current)){
 const old=before[sku];assert(old);
 const metal=kit.parts.find(p=>p.slot==='roller')?.image.url.includes('psd-geometry-studio');
 if(!metal){assert.deepEqual(kit,old,'Unrelated recipe changed '+sku);continue;}
 changed++;
 for(const slot of ['body','cap'])assert.deepEqual(kit.parts.find(p=>p.slot===slot),old.parts.find(p=>p.slot===slot));
 assert.deepEqual(kit.anchors,old.anchors);assert.deepEqual(kit.glassSizing,old.glassSizing);
 const roller=kit.parts.find(p=>p.slot==='roller')!,previous=old.parts.find(p=>p.slot==='roller')!;
 assert.deepEqual(roller.bounds,previous.bounds,'Roller registration shifted '+sku);
 const row=catalog.find(r=>r.websiteSku===sku)!;
 const context={websiteSku:sku,family:row.family,color:row.color,capacityMl:row.capacityMl,applicator:row.applicator};
 for(const view of ['sidecar','capon','exploded']as const){const a=stageLayout(old,view,context)!,b=stageLayout(kit,view,context)!;
  assert.deepEqual(a.frame,b.frame);assert.deepEqual(a.parts.find(p=>p.slot==='body'),b.parts.find(p=>p.slot==='body'));
 }
}
assert.equal(changed,4);
const data=entries.filter(e=>e.neck==='16mm').map(e=>{
 const row=catalog.find(r=>r.websiteSku===e.sku)!;
 const context={websiteSku:e.sku,family:row.family,color:row.color,capacityMl:row.capacityMl,applicator:row.applicator};
 return {...e,before:Object.fromEntries(e.views.map(v=>[v,stageLayout(before[e.sku],v,context)]))};
});
let html=fs.readFileSync('docs/reviews/jumbo-roller-psd-match-2026-11-02/review-template.html','utf8');
if(fs.existsSync(dir+'/OWNER_REVIEW_HOLD.md'))html=html.replace('<main>','<main><p style="padding:12px 16px;border:1px solid #a77a37;background:#fff8eb;color:#54380e"><strong>Bottle assignment under review.</strong> The roller material is approved; the bottle shown has been rejected for correction. <a href="/reviews/jumbo-bottle-source-check-2026-11-02/index.html">Compare the exact original PSD bottles</a>.</p>');
html=html.replace('Jumbo rollers: original PSD ball artwork','Jumbo rollers: original geometry, refined metal')
 .replace('Both balls now use the original Photoshop artwork, including its sphere shape, visible exposure, and reflections.','The original Photoshop outline, ball exposure and single-step housing are locked. The metal uses the approved studio material; plastic retains its PSD artwork.')
 .replace('Metal ball from PSD','Original metal geometry').replace('Plastic ball from PSD','Plastic geometry retained')
 .replace('Original ball pixels are reused without retouching. Only disconnected cutout debris and the source glass below the seating flange are hidden.','The metal material is uniformly registered inside the exact original PSD alpha outline. The generated material does not replace the silhouette.')
 .replace('Previous generated roller','Previous PSD material').replace('Current PSD-matched roller','Original geometry with refined material');
for(const pub of ['public/reviews/jumbo-roller-material-2026-11-02','public/reviews/jumbo-roller-psd-match-2026-11-02']){
 fs.mkdirSync(pub,{recursive:true});
 for(const kind of ['metal','plastic'])fs.copyFileSync('docs/reviews/jumbo-roller-psd-match-2026-11-02/'+kind+'-native-preview.png',pub+'/'+kind+'-native-preview.png');
 fs.writeFileSync(pub+'/index.html',html.replace('__DATA__',JSON.stringify(data).replaceAll('<','\\u003c')));
}
const result={passed:true,changedMetalRecipes:changed,unchangedOtherRecipes:Object.keys(current).length-changed,originalOutlineAlphaDifferences:0,
 originalBodiesCapsAnchorsScaleAndRollerBoundsPreserved:true,materialApproval:'Owner: Thats good',publication:'Local assemblies only; hosted manifest unchanged'};
fs.writeFileSync(dir+'/preservation-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
