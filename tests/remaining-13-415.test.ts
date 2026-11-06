import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
const batch=JSON.parse(readFileSync('public/local-kits/remaining-13-415-2026-11-01/kits.json','utf8'));
const rows=batch.rows as Record<string,KitLike>;
const protectedSkus=new Set(JSON.parse(readFileSync('docs/reviews/remaining-13-415-2026-11-01/protected-skus.json','utf8')));
const ledger=JSON.parse(readFileSync('docs/reviews/remaining-13-415-2026-11-01/registration.json','utf8'));
const registered = new Map<string, { sku: string; visibleAssemblyAxisX: number }>(
  ledger.configurations.filter((entry: { status?: string }) => entry.status !== 'held-source-recovery').map((entry: { sku: string; visibleAssemblyAxisX: number }) => [entry.sku, entry]),
);
const bellBodyId = 'bell-10ml-13-415';
describe('remaining 13-415 body and component registrations',()=>{
 it('keeps completed work out of the new batch and retains seven source recovery holds',()=>{
  expect(registered.size).toBe(450);
  expect([...registered.keys()].filter(sku => !rows[sku])).toEqual([]);
  const additions = Object.entries(rows).filter(([sku]) => !registered.has(sku));
  expect(additions).toHaveLength(32);
  for (const [sku, kit] of additions) expect(kit.register?.bodyId, sku).toBe(bellBodyId);
  expect(ledger.configurations.filter((c:{status?:string})=>c.status==='held-source-recovery')).toHaveLength(7);
  for(const sku of Object.keys(rows))expect(protectedSkus.has(sku)).toBe(false);
 });
 it('shares one body and sizing registration per body and glass color',()=>{
  const bodies=new Map<string,string>();
  for(const k of Object.values(rows)){
   const key=k.register!.bodyId+'|'+k.register!.glass,b=k.parts.find(p=>p.slot==='body')!;
   const signature=JSON.stringify({b,a:k.anchors,g:k.glassSizing});
   if(bodies.has(key))expect(signature,key).toBe(bodies.get(key));else bodies.set(key,signature);
   for(const p of k.parts)if(p.image.url.startsWith('/'))expect(existsSync('public'+p.image.url),p.image.url).toBe(true);
  }
  expect(bodies.size).toBe(16);
  const centers=JSON.parse(readFileSync('docs/reviews/remaining-13-415-2026-11-01/center-verification.json','utf8'));expect(centers.maxResidual).toBeLessThan(.01);
 });
 it('has a single level roller and full plug with the photographed 13-415 flange datum',()=>{
  for(const k of Object.values(rows)){
   const rollers=k.parts.filter(p=>p.slot==='roller');if(!rollers.length)continue;
   expect(rollers).toHaveLength(1);const r=rollers[0],s=r.box!.width/r.image.width;
   expect(r.box!.height/r.image.height).toBeCloseTo(s,8);
   expect(r.box!.y+760*s).toBeCloseTo(k.anchors.seatY+8*k.anchors.pxPerMm!/10.5,8);
   const bellReference = r.image.url === rows.GBBell10MtlRollBlkDot.parts.find(p => p.slot === 'roller')?.image.url
     ? 'GBBell10MtlRollBlkDot'
     : 'GBBell10RollBlkDot';
   const registration = registered.get(k.sku) ?? (k.register?.bodyId === bellBodyId ? registered.get(bellReference) : undefined);
   expect(registration, k.sku).toBeDefined();
   expect((r.bounds.left+r.bounds.right)/2).toBeCloseTo(registration!.visibleAssemblyAxisX,8);
   expect(r.views).toBeUndefined();expect(r.zOrder).toBeLessThan(k.parts.find(p=>p.slot==='body')!.zOrder);
  }
 });
 it('terminates tubes above each glass floor and exposes exactly one mechanism in each view',()=>{
  for(const c of ledger.configurations.filter((c:{tubeTip?:number})=>c.tubeTip!==undefined)){
   const k=rows[c.sku];expect(c.tubeTip).toBeLessThan(c.interiorFloor);expect(c.interiorFloor).toBeLessThan(k.anchors.baselineY);
   for(const v of ['sidecar','capon','exploded'])expect(k.parts.filter(p=>p.slot==='diptube'&&(!p.views||p.views.includes(v as 'sidecar')))).toHaveLength(1);
  }
 });
 it('keeps approved sizing, body position and component visibility stable in all three views',()=>{
  for(const k of Object.values(rows)){
   const context={family:k.register!.bodyId.split('-')[0],websiteSku:k.sku,applicator:k.parts.some(p=>p.slot==='roller')?'Metal Roller Ball':k.parts.some(p=>p.slot==='sprayer')?'Fine Mist Sprayer':null};
   const layouts=(['sidecar','capon','exploded'] as const).map(v=>stageLayout(k,v,context)!);
   for(const l of layouts){expect(l.frame,k.sku).toEqual(layouts[0].frame);expect(l.parts.find(p=>p.slot==='body'),k.sku).toEqual(layouts[0].parts.find(p=>p.slot==='body'));
    for(const p of l.parts){const orig=k.parts.find(o=>o.slot===p.slot&&o.image.url===p.url)!;
     const dx=p.dxPct/100*k.canvas.width,dy=p.dyPct/100*k.canvas.height;
     const x=(v:number)=>l.frame.x+(v+dx)/k.canvas.width*100*l.frame.scale,y=(v:number)=>l.frame.y+(v+dy)/k.canvas.height*100*l.frame.scale;
     expect(x(orig.bounds.left),k.sku+' '+p.slot).toBeGreaterThanOrEqual(-.01);expect(x(orig.bounds.right),k.sku+' '+p.slot).toBeLessThanOrEqual(100.01);
     expect(y(orig.bounds.top),k.sku+' '+p.slot).toBeGreaterThanOrEqual(-.01);expect(y(orig.bounds.bottom),k.sku+' '+p.slot).toBeLessThanOrEqual(100.01);
    }
   }
  }
 });
});
