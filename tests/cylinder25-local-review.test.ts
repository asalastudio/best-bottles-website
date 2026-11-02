import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { availableViews, effectiveView, stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
const rows=JSON.parse(readFileSync('public/local-kits/cylinder25-18415-2026-11-01/kits.json','utf8')).rows as Record<string,KitLike>;
const catalog=JSON.parse(readFileSync('docs/reviews/cylinder25-18415-2026-11-01/current-catalog.json','utf8')).configurations as Array<{id:string;fitment:string}>;
describe('25 ml 18-415 local pilot',()=>{
 it('uses one recovered glass and the locked 46.5% shoulder target for all 36 technically prepared configurations',()=>{
  expect(Object.keys(rows)).toHaveLength(36);
  const body=new Set(Object.values(rows).map(k=>JSON.stringify(((p)=>({image:p?.image,bounds:p?.bounds,box:p?.box}))(k.parts.find(p=>p.slot==='body')))));expect(body.size).toBe(1);
  for(const c of catalog.filter(c=>rows[c.id])){const k=rows[c.id];expect(k.register?.bodyId).toBe('cylinder-25ml-18-415');expect(k.glassSizing?.heightPct).toBe(46.5);expect(k.glassSizing?.baselinePct).toBe(91);
   const context={websiteSku:c.id,family:'Cylinder',capacityMl:25,color:'Clear',applicator:c.fitment};
   const layouts=[...new Set(availableViews(k,context).map(v=>effectiveView(v,k,context)))].map(v=>stageLayout(k,v,context)!);
   for(const layout of layouts){expect(layout.frame,c.id).toEqual(layouts[0].frame);expect(layout.parts.find(p=>p.slot==='body'),c.id).toEqual(layouts[0].parts.find(p=>p.slot==='body'));}
  }
 });
 it('keeps exactly one connected fluid mechanism in every sprayer and lotion-pump view',()=>{
  for(const c of catalog.filter(c=>['Fine Mist Sprayer','Lotion Pump'].includes(c.fitment))){
   const k=rows[c.id],context={websiteSku:c.id,family:'Cylinder',capacityMl:25,color:'Clear',applicator:c.fitment};
   for(const view of ['sidecar','capon','exploded'] as const){const l=stageLayout(k,view,context)!;const head=l.parts.find(p=>p.slot==='sprayer'||p.slot==='pump')!,tube=l.parts.filter(p=>p.slot==='diptube');expect(tube,c.id).toHaveLength(1);expect(tube[0].dxPct).toBe(head.dxPct);expect(tube[0].dyPct).toBe(head.dyPct);
    const native=k.parts.find(p=>p.slot==='diptube'&&(!p.views||p.views.includes(view)))!;expect(native.bounds.bottom).toBeLessThan(k.parts.find(p=>p.slot==='body')!.bounds.bottom);expect(tube[0].opacity).toBe(view==='exploded'?undefined:.62);
   }
  }
 });
 it('retains assembled-only reducer states when a separate insert has not been recovered',()=>{
  for(const c of catalog.filter(c=>c.fitment==='Reducer')){const k=rows[c.id],ctx={applicator:'Reducer'};expect(availableViews(k,ctx)).toEqual(['capon']);expect(effectiveView('exploded',k,ctx)).toBe('capon');}
 });
});
