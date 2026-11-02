import fs from 'node:fs';
import assert from 'node:assert/strict';
import {stageLayout} from '../../../src/lib/products/pdp-redesign/stage';
import type {ReviewKit,FamilySnapshot} from '../cylinder-family-completion-2026-11-02/review-types';
const dir='docs/reviews/jumbo-body-reference-2026-11-02',family='docs/reviews/cylinder-family-completion-2026-11-02';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const before=read(dir+'/before-body-correction-kits.json').rows as Record<string,ReviewKit>;
const current=read('public/local-kits/cylinder-family-completion-2026-11-02/kits.json').rows as Record<string,ReviewKit>;
const catalog=Object.values((read(family+'/current-family-snapshot.json') as FamilySnapshot).families).flatMap(f=>f.rows);
const entries=read(family+'/review-data.json') as Array<{sku:string;neck:string;views:Array<'sidecar'|'capon'|'exploded'>}>;
let changed=0;
for(const [sku,kit]of Object.entries(current)){
 const row=catalog.find(r=>r.websiteSku===sku)!;
 if(row.capacityMl!==50||row.neckThreadSize!=='16mm'){assert.deepEqual(kit,before[sku],'Unrelated recipe changed '+sku);continue;}
 changed++;
 for(const slot of ['roller','cap'])assert.deepEqual(kit.parts.find(p=>p.slot===slot)!.image,before[sku].parts.find(p=>p.slot===slot)!.image,'Approved hardware source changed '+sku);
 assert.notEqual(kit.parts.find(p=>p.slot==='body')!.image.sha256,before[sku].parts.find(p=>p.slot==='body')!.image.sha256);
 assert.equal(kit.glassSizing!.heightPct,before[sku].glassSizing!.heightPct);
 assert.equal(kit.glassSizing!.baselinePct,before[sku].glassSizing!.baselinePct);
 assert.deepEqual(kit.canvas,before[sku].canvas);
 assert.equal(kit.anchors!.baselineY,before[sku].anchors!.baselineY);
 const roller=kit.parts.find(p=>p.slot==='roller')!,cap=kit.parts.find(p=>p.slot==='cap')!;
 assert(roller.bounds!.top>=cap.bounds!.top,'Cap fails to cover the roller '+sku);
}
assert.equal(changed,4);
const data=entries.filter(e=>e.neck==='16mm').map(e=>{
 const row=catalog.find(r=>r.websiteSku===e.sku)!;
 const context={websiteSku:e.sku,family:row.family,color:row.color,capacityMl:row.capacityMl,applicator:row.applicator};
 return {...e,before:Object.fromEntries(e.views.map(v=>[v,stageLayout(before[e.sku],v,context)])),after:Object.fromEntries(e.views.map(v=>[v,stageLayout(current[e.sku],v,context)]))};
});
const base=fs.readFileSync('public/reviews/jumbo-roller-material-2026-11-02/index.html','utf8');
const html=base.replace('Jumbo rollers: original geometry, refined metal','Jumbo rollers: 50 ml bottle corrected')
 .replace('The roller material is approved; the bottle shown has been rejected for correction.','The corrected 50 ml body now uses the complete PSD glass outline and wider neck. It is a new local candidate; the roller material remains approved.')
 .replace('Bottle assignment under review.','50 ml correction ready for review.')
 .replace('Bottle bodies, caps, and canvas scale are unchanged. Local review only.','The 50 ml glass body and hardware registration are corrected. The 28 ml body and approved roller/cap images are unchanged. Canvas height targets are preserved. Local review only.')
 .replace('Previous PSD material','Previous narrow-neck bottle')
 .replace('Original geometry with refined material','Corrected complete-PSD bottle')
 .replace(/(<script id="data" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(data).replaceAll('<','\\u003c')+b);
for(const pub of ['public/reviews/jumbo50-body-reference-2026-11-02','public/reviews/jumbo-roller-material-2026-11-02','public/reviews/jumbo-roller-psd-match-2026-11-02']){
 fs.mkdirSync(pub,{recursive:true});
 for(const kind of ['metal','plastic'])fs.copyFileSync('docs/reviews/jumbo-roller-psd-match-2026-11-02/'+kind+'-native-preview.png',pub+'/'+kind+'-native-preview.png');
 fs.writeFileSync(pub+'/index.html',html);
}
const report={passed:true,corrected50mlRecipes:changed,unchangedOtherRecipes:Object.keys(current).length-changed,body28mlUnchanged:true,approvedRollerAndCapImagesPreserved:true,canvasHeightTargetsPreserved:true,
 source:'Owner supplied complete GBCyl50RollBlk PSD/reference. Glass neck pixels in retouch/roller layers are included.',status:'corrected-local-candidate-awaiting-visual-review',hostedManifest:'unchanged'};
fs.writeFileSync(dir+'/preservation-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
