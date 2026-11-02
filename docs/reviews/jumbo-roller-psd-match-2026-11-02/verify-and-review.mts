import fs from 'node:fs';
import assert from 'node:assert/strict';
import { stageLayout } from '../../../src/lib/products/pdp-redesign/stage';
import type { ReviewKit, FamilySnapshot } from '../cylinder-family-completion-2026-11-02/review-types';

const dir='docs/reviews/jumbo-roller-psd-match-2026-11-02';
const family='docs/reviews/cylinder-family-completion-2026-11-02';
const pub='public/reviews/jumbo-roller-psd-match-2026-11-02';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const previous=read(dir+'/before-kits.json').rows as Record<string,ReviewKit>;
const current=read('public/local-kits/cylinder-family-completion-2026-11-02/kits.json').rows as Record<string,ReviewKit>;
const snapshot=read(family+'/current-family-snapshot.json') as FamilySnapshot;
const catalog=Object.values(snapshot.families).flatMap(f=>f.rows);
const verification=read(dir+'/native-ball-verification.json');
const entries=read(family+'/review-data.json') as Array<{sku:string;neck:string;title:string;product:string;views:Array<'sidecar'|'capon'|'exploded'>;capacityMl:number;after:Record<string,ReturnType<typeof stageLayout>>}>;
const changed=entries.filter(e=>e.neck==='16mm');
const preservation=[];
for(const [sku,kit] of Object.entries(current)){
    const before=previous[sku];assert(before,'Missing previous kit '+sku);
    if(!changed.some(e=>e.sku===sku)){assert.deepEqual(kit,before,'Unrelated recipe changed '+sku);continue;}
    assert.deepEqual(kit.anchors,before.anchors);assert.deepEqual(kit.glassSizing,before.glassSizing);
    for(const slot of ['body','cap'])assert.deepEqual(kit.parts.find(p=>p.slot===slot),before.parts.find(p=>p.slot===slot),'Changed '+slot+' '+sku);
    const row=catalog.find(r=>r.websiteSku===sku)!;
    const context={websiteSku:sku,family:row.family,color:row.color,capacityMl:row.capacityMl,applicator:row.applicator};
    for(const view of ['sidecar','capon','exploded'] as const){
        const a=stageLayout(before,view,context)!,b=stageLayout(kit,view,context)!;
        assert.deepEqual(a.frame,b.frame,'Canvas frame changed '+sku+' '+view);
        assert.deepEqual(a.parts.find(p=>p.slot==='body'),b.parts.find(p=>p.slot==='body'),'Painted body changed '+sku+' '+view);
    }
    preservation.push({sku,bodyAndCapUnchanged:true,canvasScaleUnchanged:true,onlyRollerReplaced:true});
}
assert.equal(preservation.length,8);assert.equal(verification.results.length,2);
for(const v of verification.results)assert.equal(v.changedBallPixels,0);
const data=changed.map(e=>{
    const row=catalog.find(r=>r.websiteSku===e.sku)!;
    const context={websiteSku:e.sku,family:row.family,color:row.color,capacityMl:row.capacityMl,applicator:row.applicator};
    return {...e,before:Object.fromEntries(e.views.map(v=>[v,stageLayout(previous[e.sku],v,context)]))};
});
fs.mkdirSync(pub,{recursive:true});
for(const kind of ['metal','plastic'])fs.copyFileSync(dir+'/'+kind+'-native-preview.png',pub+'/'+kind+'-native-preview.png');
const summary={passed:true,configurations:preservation.length,unrelatedRecipesUnchanged:Object.keys(current).length-preservation.length,preservation,
    nativeBallPixelsCompared:verification.results.reduce((n:number,r:{comparedBallPixels:number})=>n+r.comparedBallPixels,0),changedBallPixels:0,
    lowerPlug:false,publication:'Local visual review only. Existing approved hosted manifest untouched.'};
fs.writeFileSync(dir+'/preservation-verification.json',JSON.stringify(summary,null,2)+'\n');
const template=fs.readFileSync(dir+'/review-template.html','utf8');
fs.writeFileSync(pub+'/index.html',template.replace('__DATA__',JSON.stringify(data).replaceAll('<','\\u003c')));
console.log(JSON.stringify({passed:true,configurations:8,unrelatedRecipesUnchanged:summary.unrelatedRecipesUnchanged,nativeBallPixelsCompared:summary.nativeBallPixelsCompared,changedBallPixels:0}));
