import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
const read=(file:string)=>JSON.parse(readFileSync(file,'utf8')).rows as Record<string,KitLike>;
const small=read('public/local-kits/small-sprayers-2026-10-31/kits.json');
const before=read('docs/reviews/small-sprayer-rims-2026-11-01/before-kits.json');
const tulip=read('public/local-kits/tulip-rollers-2026-11-01/kits.json');
const approved=read('docs/reviews/tulip-rollers-2026-11-01/approved-body-references.json');
describe('small glass rims and Tulip roller seating',()=>{
 it('preserves the four small-sprayer frames and all hardware while replacing only glass pixels',()=>{
  expect(Object.keys(small)).toHaveLength(4);
  for(const [sku,k] of Object.entries(small)){
   expect(k.anchors).toEqual(before[sku].anchors);expect(k.glassSizing).toEqual(before[sku].glassSizing);
   expect(k.parts.filter(p=>p.slot!=='body')).toEqual(before[sku].parts.filter(p=>p.slot!=='body'));
   const b=k.parts.find(p=>p.slot==='body')!,old=before[sku].parts.find(p=>p.slot==='body')!;
   expect(b.box).toEqual(old.box);expect(b.bounds).toEqual(old.bounds);expect(b.image.url).toContain('/small-sprayer-rims-2026-11-01/');
  }
 });
 it('uses one glass image across black and white sprayers of each size',()=>{
  expect(small.GBSpry3mlClBlk.parts[0].image).toEqual(small.GBSpry3mlClWht.parts[0].image);
  expect(small.GBSpry4mlClBlk.parts[0].image).toEqual(small.GBSpry4mlClWh.parts[0].image);
 });
 it('shares approved Tulip glass, level roller masters and one front-lip datum across all 36 configurations',()=>{
  expect(Object.keys(tulip)).toHaveLength(36);
  for(const [sku,k] of Object.entries(tulip)){
   const ref=approved[sku.includes('Amb5')?'GBTulipAmb5SpryBlkSh':'GBTulip6SpryBlkSh'];
   expect(k.parts.find(p=>p.slot==='body')).toEqual(ref.parts.find(p=>p.slot==='body'));
   expect(k.anchors).toEqual(ref.anchors);expect(k.glassSizing).toEqual(ref.glassSizing);
   const rs=k.parts.filter(p=>p.slot==='roller');expect(rs).toHaveLength(1);const r=rs[0],s=r.box!.width/r.image.width;
   expect(r.box!.height/r.image.height).toBeCloseTo(s,8);
   expect(r.box!.y+760*s).toBeCloseTo(k.anchors.seatY+8,8);
   expect((r.bounds.left+r.bounds.right)/2).toBeCloseTo(k.anchors.axisX,8);
   expect(r.image.url).toContain(sku.includes('MtlRoll')?'roller-metal.':'roller-plastic.');
   expect(r.zOrder).toBeLessThan(k.parts.find(p=>p.slot==='body')!.zOrder);
   const c=k.parts.find(p=>p.slot==='cap')!;
   expect(c.bounds.bottom).toBeCloseTo(k.glassSizing!.landmarkY!+16.3,8);
   expect(c.bounds.top).toBeLessThan(r.bounds.top);expect(c.bounds.bottom).toBeGreaterThan(r.bounds.bottom);
  }
 });
 it('keeps the bottle fixed and all parts in frame across every corrected view',()=>{
  for(const k of Object.values({...small,...tulip})){
   const views=(['sidecar','capon','exploded'] as const).map(v=>stageLayout(k,v,{family:k.sku.includes('Tulip')?'Tulip':'Cylinder',websiteSku:k.sku,applicator:k.sku.includes('Roll')?(k.sku.includes('MtlRoll')?'Metal Roller Ball':'Plastic Roller Ball'):'Fine Mist Sprayer'})!);
   for(const l of views){expect(l.frame).toEqual(views[0].frame);expect(l.parts.find(p=>p.slot==='body')).toEqual(views[0].parts.find(p=>p.slot==='body'));
    for(const p of l.parts){const orig=k.parts.find(x=>x.slot===p.slot&&x.image.url===p.url)!;const dx=p.dxPct/100*k.canvas.width,dy=p.dyPct/100*k.canvas.height;
     const x=(v:number)=>l.frame.x+(v+dx)/k.canvas.width*100*l.frame.scale,y=(v:number)=>l.frame.y+(v+dy)/k.canvas.height*100*l.frame.scale;
     expect(x(orig.bounds.left)).toBeGreaterThanOrEqual(0);expect(x(orig.bounds.right)).toBeLessThanOrEqual(100);expect(y(orig.bounds.top)).toBeGreaterThanOrEqual(0);expect(y(orig.bounds.bottom)).toBeLessThanOrEqual(100);
    }
   }
  }
 });
});
