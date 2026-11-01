import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
import index from '@/lib/products/cylinder5-master-index.json';
const dir='docs/reviews/cylinder5-rollers-pour-2026-11-01/';
const before=JSON.parse(readFileSync(dir+'before-kits.json','utf8')).rows as Record<string,KitLike>;
const current=JSON.parse(readFileSync(index.kitFile,'utf8')).rows as Record<string,KitLike>;
const items=JSON.parse(readFileSync(dir+'inventory.json','utf8')) as {sku:string;glass:string;applicator:string;roller:string|null}[];
describe('5 ml roller and pour seating',()=>{
 it('preserves all 71 glass masters and every fine-mist kit',()=>{
  expect(items).toHaveLength(56);
  expect(items.filter(i=>i.roller)).toHaveLength(36);
  for(const [sku,k] of Object.entries(current)){
   expect(k.parts.find(p=>p.slot==='body')).toEqual(before[sku].parts.find(p=>p.slot==='body'));
   expect(k.anchors).toEqual(before[sku].anchors);
   expect(k.glassSizing).toEqual(before[sku].glassSizing);
   if(sku.includes('Spry'))expect(k).toEqual(before[sku]);
  }
 });
 it('seats one centered level insert with its plug behind the glass and enough cap clearance',()=>{
  for(const i of items.filter(i=>i.roller)){
   const k=current[i.sku],r=k.parts.filter(p=>p.slot==='roller');expect(r).toHaveLength(1);
   const p=r[0],scale=p.box!.width/p.image.width;
   expect(p.image.url).toContain(i.applicator === 'Metal Roller Ball' ? 'roller-metal.' : 'roller-plastic.');
   expect(p.box!.height/p.image.height).toBeCloseTo(scale,5);
   expect(p.box!.y+760*scale).toBeCloseTo(k.anchors.seatY,5);
   expect((p.bounds.left+p.bounds.right)/2).toBeCloseTo(k.anchors.axisX,5);
   expect(p.zOrder).toBeLessThan(k.parts.find(p=>p.slot==='body')!.zOrder);
   expect(p.views).toBeUndefined();
   const cap=k.parts.find(p=>p.slot==='cap')!;
   expect(cap.bounds.top).toBeLessThan(p.bounds.top);
   expect(cap.bounds.bottom).toBeGreaterThan(p.bounds.bottom);
   expect(cap.bounds.left).toBeLessThan(p.bounds.left);expect(cap.bounds.right).toBeGreaterThan(p.bounds.right);
  }
 });
 it('seats each original cap without stretching it or exposing the rim above it',()=>{
  for(const i of items){const k=current[i.sku],c=k.parts.find(p=>p.slot==='cap')!,b=k.parts.find(p=>p.slot==='body')!;
   expect(c.box!.width/c.image.width).toBeCloseTo(c.box!.height/c.image.height,5);
   expect(c.box!.width).toBeCloseTo(before[i.sku].parts.find(p=>p.slot==='cap')!.box!.width,5);
   expect((c.bounds.left+c.bounds.right)/2).toBeCloseTo(k.anchors.axisX,5);
   expect(c.bounds.top).toBeLessThan(b.bounds.top);
   const isShortPlastic=['CMP-CAP-BLK-S-13-415','CMP-CAP-WHT-S-13-415'].includes(c.componentId!);
   expect(c.bounds.bottom).toBeCloseTo(isShortPlastic?before[i.sku].parts.find(p=>p.slot==='cap')!.bounds.bottom:k.glassSizing!.landmarkY!-14,5);
  }
 });
 it('keeps the camera and body fixed, and separates full plugs and caps in every view',()=>{
  for(const i of items){const k=current[i.sku];const layouts=(['sidecar','capon','exploded'] as const).map(v=>stageLayout(k,v,{family:'Cylinder',capacityMl:5,color:i.glass,applicator:i.applicator,websiteSku:i.sku})!);
   for(const l of layouts){expect(l.frame).toEqual(layouts[0].frame);expect(l.parts.find(p=>p.slot==='body')).toEqual(layouts[0].parts.find(p=>p.slot==='body'));
    for(const p of l.parts){const orig=k.parts.find(x=>x.slot===p.slot&&x.image.url===p.url)!;const dx=p.dxPct/100*k.canvas.width,dy=p.dyPct/100*k.canvas.height;const x=(v:number)=>l.frame.x+(v+dx)/k.canvas.width*100*l.frame.scale,y=(v:number)=>l.frame.y+(v+dy)/k.canvas.height*100*l.frame.scale;
     expect(x(orig.bounds.left)).toBeGreaterThanOrEqual(0);expect(x(orig.bounds.right)).toBeLessThanOrEqual(100);expect(y(orig.bounds.top)).toBeGreaterThanOrEqual(0);expect(y(orig.bounds.bottom)).toBeLessThanOrEqual(100);
    }
   }
   if(i.roller){const r=k.parts.find(p=>p.slot==='roller')!,p=layouts[2].parts.find(p=>p.slot==='roller')!;expect(p.dxPct).toBeCloseTo(0,5);expect(r.bounds.bottom+p.dyPct/100*k.canvas.height).toBeLessThan(k.parts.find(p=>p.slot==='body')!.bounds.top);}
  }
 });
});
