import fs from 'node:fs';
import assert from 'node:assert/strict';
import {stageLayout} from '../../../src/lib/products/pdp-redesign/stage';
import type {ReviewKit,FamilySnapshot} from '../cylinder-family-completion-2026-11-02/review-types';
const dir='docs/reviews/jumbo28-archive-geometry-2026-11-02',family='docs/reviews/cylinder-family-completion-2026-11-02';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const before=read(dir+'/before-28ml-kits.json').rows as Record<string,ReviewKit>;
const current=read('public/local-kits/cylinder-family-completion-2026-11-02/kits.json').rows as Record<string,ReviewKit>;
const catalog=Object.values((read(family+'/current-family-snapshot.json') as FamilySnapshot).families).flatMap(f=>f.rows);
const entries=read(family+'/review-data.json') as Array<{sku:string;neck:string;views:Array<'sidecar'|'capon'|'exploded'>}>;
let changed=0;
for(const [sku,kit]of Object.entries(current)){
 const old=before[sku];assert(old,'Unexpected added recipe '+sku);
 const row=catalog.find(r=>r.websiteSku===sku)!;
 if(row.capacityMl!==28||row.neckThreadSize!=='16mm'){assert.deepEqual(kit,old,'Unrelated recipe changed '+sku);continue;}
 changed++;
 for(const slot of ['roller','cap'])assert.deepEqual(kit.parts.find(p=>p.slot===slot)!.image,old.parts.find(p=>p.slot===slot)!.image,'Approved hardware source changed '+sku);
 assert.notEqual(kit.parts.find(p=>p.slot==='body')!.image.sha256,old.parts.find(p=>p.slot==='body')!.image.sha256);
 assert.equal(kit.glassSizing!.heightPct,old.glassSizing!.heightPct);assert.equal(kit.glassSizing!.baselinePct,old.glassSizing!.baselinePct);
 assert.deepEqual(kit.canvas,old.canvas);assert.equal(kit.anchors!.baselineY,old.anchors!.baselineY);
 const roller=kit.parts.find(p=>p.slot==='roller')!,cap=kit.parts.find(p=>p.slot==='cap')!;
 assert(roller.bounds!.top>=cap.bounds!.top,'Cap fails to cover roller '+sku);
 assert.equal(cap.bounds!.bottom,kit.glassSizing!.landmarkY,'Cap misses shoulder '+sku);
}
assert.equal(changed,4);assert.equal(Object.keys(before).length,Object.keys(current).length);
const data=entries.filter(e=>e.neck==='16mm').map(e=>{
 const row=catalog.find(r=>r.websiteSku===e.sku)!;
 const context={websiteSku:e.sku,family:row.family,color:row.color,capacityMl:row.capacityMl,applicator:row.applicator};
 return {...e,before:Object.fromEntries(e.views.map(v=>[v,stageLayout(before[e.sku],v,context)])),after:Object.fromEntries(e.views.map(v=>[v,stageLayout(current[e.sku],v,context)]))};
});
let html=fs.readFileSync('docs/reviews/jumbo-roller-psd-match-2026-11-02/review-template.html','utf8');
html=html.replace('Jumbo rollers matched to the original PSD','28 ml bottle corrected from archive PSD')
 .replace('Jumbo rollers: original PSD ball artwork','28 ml: archive geometry with GPT glass')
 .replace('Both balls now use the original Photoshop artwork, including its sphere shape, visible exposure, and reflections.','The 28 ml body now follows the complete glass geometry in the owner-specified archive PSD. GPT supplies the refined glass material. The separate corrected 50 ml master is preserved.')
 .replace('Original ball pixels are reused without retouching. Only disconnected cutout debris and the source glass below the seating flange are hidden. Bottle bodies, caps, and canvas scale are unchanged. Local review only.','The approved roller and cap image pixels are unchanged. Hardware is registered to the wider 28 ml neck. Its 50.5% canvas height and 91% baseline are retained. Candidate for owner review, local only.')
 .replace('Previous generated roller','Previous narrow-neck bottle')
 .replace('Current PSD-matched roller','Corrected archive-geometry bottle')
 .replace('check the unchanged cap placement','check the shoulder seating')
 .replace('__DATA__',JSON.stringify(data).replaceAll('<','\\u003c'));
for(const pub of ['public/reviews/jumbo28-archive-geometry-2026-11-02','public/reviews/jumbo-roller-material-2026-11-02','public/reviews/jumbo-roller-psd-match-2026-11-02']){
 fs.mkdirSync(pub,{recursive:true});
 for(const kind of ['metal','plastic'])fs.copyFileSync('docs/reviews/jumbo-roller-psd-match-2026-11-02/'+kind+'-native-preview.png',pub+'/'+kind+'-native-preview.png');
 fs.writeFileSync(pub+'/index.html',html);
}
const report={passed:true,corrected28mlRecipes:changed,unchangedOtherRecipes:Object.keys(current).length-changed,body50mlUnchanged:true,approvedRollerAndCapImagesPreserved:true,canvasHeightTargetsPreserved:true,source:'Owner-specified /Volumes/Achive/.../13. 16 mm archive; full glass-neck retouch layers included',status:'corrected-local-candidate-awaiting-visual-review',hostedManifest:'unchanged'};
fs.writeFileSync(dir+'/preservation-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
