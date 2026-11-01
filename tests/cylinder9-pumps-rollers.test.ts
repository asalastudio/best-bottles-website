import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stageLayout, type KitLike, type StageView } from '@/lib/products/pdp-redesign/stage';
import index from '@/lib/products/cylinder9-master-index.json';
const root='docs/reviews/cylinder9-pumps-rollers-2026-11-01/';
const before=JSON.parse(readFileSync(root+'before-kits.json','utf8')).rows as Record<string,KitLike>;
const rows=JSON.parse(readFileSync(index.kitFile,'utf8')).rows as Record<string,KitLike>;
const configs=JSON.parse(readFileSync('public/reviews/cylinder9-pumps-rollers-2026-11-01/model.json','utf8')).configurations as {websiteSku:string;applicatorKey:string;glassLabel:string}[];
const context=(c:typeof configs[number])=>({family:'Cylinder',capacityMl:9,color:c.glassLabel,applicator:c.applicatorKey==='lotion-pump'?'Lotion Pump':c.applicatorKey==='metal-roller'?'Metal Roller Ball':'Plastic Roller Ball',websiteSku:c.websiteSku});
const views:StageView[]=['sidecar','capon','exploded'];

describe('9 ml lotion and roller review registration',()=>{
 it('preserves all approved bodies and every fine-mist assembly',()=>{
  const changed=new Set(configs.map(c=>c.websiteSku));
  expect(changed.size).toBe(115);
  for(const [sku,kit]of Object.entries(rows)){
   expect(kit.parts.find(p=>p.slot==='body')).toEqual(before[sku].parts.find(p=>p.slot==='body'));
   expect(kit.glassSizing).toEqual(before[sku].glassSizing);
   if(!changed.has(sku))expect(kit).toEqual(before[sku]);
  }
 });
 it('keeps the bottle and physical layer identities fixed in all 345 views',()=>{
  for(const c of configs){
   const kit=rows[c.websiteSku],layouts=views.map(v=>stageLayout(kit,v,context(c))!);
   for(const l of layouts){
    expect(l.frame).toEqual(layouts[0].frame);
    const body=l.parts.find(p=>p.slot==='body')!,original=layouts[0].parts.find(p=>p.slot==='body')!;
    for(const key of ['key','url','box','dxPct','dyPct'] as const)expect(body[key]).toEqual(original[key]);
    for(const part of l.parts){
     const other=layouts[0].parts.find(p=>p.url===part.url&&p.slot===part.slot);
     if(other)expect(part.key).toBe(other.key);
     // Check visible ink, not the transparent padding around the image.
     const source=kit.parts.find(p=>p.slot===part.slot&&p.image.url===part.url)!;
     const b=source.bounds,dx=part.dxPct/100*kit.canvas.width,dy=part.dyPct/100*kit.canvas.height;
     const x=(n:number)=>l.frame.x+(n+dx)/kit.canvas.width*100*l.frame.scale;
     const y=(n:number)=>l.frame.y+(n+dy)/kit.canvas.height*100*l.frame.scale;
     expect(x(b.left),c.websiteSku+' '+part.slot).toBeGreaterThanOrEqual(-.01);
     expect(x(b.right),c.websiteSku+' '+part.slot).toBeLessThanOrEqual(100.01);
     expect(y(b.top),c.websiteSku+' '+part.slot).toBeGreaterThanOrEqual(-.01);
     expect(y(b.bottom),c.websiteSku+' '+part.slot).toBeLessThanOrEqual(100.01);
    }
   }
  }
 });
 it('has one full seated roller insert and lifts it above the mouth without overlap',()=>{
  for(const c of configs.filter(c=>c.applicatorKey!=='lotion-pump')){
   const kit=rows[c.websiteSku],body=kit.parts.find(p=>p.slot==='body')!,inserts=kit.parts.filter(p=>p.slot==='roller');
   expect(inserts).toHaveLength(1);
   const r=inserts[0],s=r.box!.height/r.image.height;
   const seatY=kit.anchors.seatY;
   expect(r.box!.y+760*s).toBeCloseTo(seatY,5);
   expect(r.zOrder).toBeLessThan(body.zOrder);
   expect((r.bounds.left+r.bounds.right)/2).toBeCloseTo(kit.anchors.axisX,5);
   const cap=kit.parts.find(p=>p.slot==='cap')!;
   expect(cap.bounds.top).toBeLessThan(r.bounds.top);
   expect(cap.bounds.bottom).toBeGreaterThan(r.bounds.bottom);
   const layout=stageLayout(kit,'exploded',context(c))!;
   const moved=layout.parts.find(p=>p.slot==='roller')!;
   expect(moved.dxPct).toBeCloseTo(0,5);
   expect(r.bounds.bottom+moved.dyPct/100*kit.canvas.height).toBeLessThan(body.bounds.top);
   const closure=layout.parts.find(p=>p.slot==='cap')!;
   const dx=closure.dxPct/100*kit.canvas.width;
   expect(cap.bounds.left+dx).toBeGreaterThan(r.bounds.right);
  }
 });
 it('moves the lotion head, collar and connected tube as one unit, with no tube below the foot',()=>{
  for(const c of configs.filter(c=>c.applicatorKey==='lotion-pump')){
   const kit=rows[c.websiteSku],body=kit.parts.find(p=>p.slot==='body')!,tube=kit.parts.find(p=>p.slot==='diptube')!;
   expect(tube.bounds.bottom).toBeLessThan(body.bounds.bottom);
   expect(tube.views).toEqual(c.glassLabel==='Clear'?['sidecar','capon']:['exploded']);
   for(const view of ['sidecar','capon','exploded'] as const)expect(kit.parts.filter(p=>p.slot==='diptube'&&(!p.views||p.views.includes(view)))).toHaveLength(c.glassLabel==='Clear'||view==='exploded'?1:0);
   const l=stageLayout(kit,'exploded',context(c))!;
   const moving=l.parts.filter(p=>['pump','collar','diptube'].includes(p.slot));
   expect(moving).toHaveLength(3);
   expect(new Set(moving.map(p=>JSON.stringify([p.dxPct,p.dyPct]))).size).toBe(1);
  }
 });
});
