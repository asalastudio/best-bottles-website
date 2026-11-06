import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
const d='docs/reviews/lotion9-flair-fit-2026-11-01/';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')).rows as Record<string,KitLike>;
const pumps=read('public/local-kits/cylinder9-masters-2026-11-01/kits.json'),oldPumps=read(d+'before-pumps.json');
const other=read('public/local-kits/remaining-13-415-2026-11-01/kits.json'),oldOther=read(d+'before-13.json');
const registration=JSON.parse(readFileSync(d+'registration.json','utf8'));
describe('lotion internals, Flair shoulders and tall Cylinder ribbed caps',()=>{
 it('changes only the 15 lotion internals, preserving every body and all exterior pump parts',()=>{
  let changed=0;for(const [sku,k]of Object.entries(pumps)){
   if(!sku.startsWith('LB')){expect(k).toEqual(oldPumps[sku]);continue;}changed++;
   expect(k.parts.filter(p=>p.slot!=='diptube')).toEqual(oldPumps[sku].parts.filter(p=>p.slot!=='diptube'));
   const t=k.parts.find(p=>p.slot==='diptube')!;expect(t.image.url).toBe(registration.image.url);
   expect(t.bounds.bottom).toBeCloseTo(oldPumps[sku].parts.find(p=>p.slot==='diptube')!.bounds.bottom-1.5*k.anchors.pxPerMm!,8);
   expect(t.bounds.bottom).toBeLessThan(k.parts.find(p=>p.slot==='body')!.bounds.bottom);
  }expect(changed).toBe(15);
 });
 it('keeps the Flair master and roller seating fixed while placing closures on the actual shoulder crest',()=>{
  const flair=Object.values(other).filter(k=>k.register!.bodyId==='flair-15ml-13-415');expect(flair).toHaveLength(36);
  for(const k of flair){expect(k.parts.find(p=>p.slot==='body')).toEqual(oldOther[k.sku].parts.find(p=>p.slot==='body'));
   expect(k.parts.filter(p=>p.slot==='roller')).toEqual(oldOther[k.sku].parts.filter(p=>p.slot==='roller'));
   for(const p of k.parts.filter(p=>['sprayer','overcap'].includes(p.slot)||(p.slot==='cap'&&!/CMP-CAP-(BLK|WHT)-S-13-415$/.test(p.componentId!))))expect(p.bounds.bottom).toBeCloseTo(registration.flairSeat,8);
   for(const p of k.parts.filter(p=>p.slot==='diptube'))expect(p.bounds.bottom).toBe(oldOther[k.sku].parts.find(p=>p.slot==='diptube')!.bounds.bottom);
  }
 });
 it('lowers only four tall Cylinder ribbed caps and preserves all other 13-415 configurations',()=>{
  const changed=new Set(registration.changes.filter((c:{kind:string})=>c.kind!=='lotion-tube').map((c:{sku:string})=>c.sku));
  // Configurations the batch did not have before are additions of one new body, never a rewrite of an existing one.
  for(const [sku,k]of Object.entries(other)){if(!oldOther[sku])expect(k.register?.bodyId,sku).toBe('bell-10ml-13-415');else if(!changed.has(sku))expect(k).toEqual(oldOther[sku]);}
  const ribbed=registration.changes.filter((c:{kind:string})=>c.kind==='tall9-ribbed');expect(ribbed).toHaveLength(4);
  for(const c of ribbed){const k=other[c.sku],p=k.parts.find(p=>p.slot==='cap')!;expect(p.image).toEqual(oldOther[c.sku].parts.find(p=>p.slot==='cap')!.image);expect(p.bounds.bottom).toBe(337);expect(p.box!.width).toBe(oldOther[c.sku].parts.find(p=>p.slot==='cap')!.box!.width);}
 });
 it('keeps bodies fixed and the lotion mechanism connected to the pump in all views',()=>{
  for(const c of registration.changes){const k=c.kind==='lotion-tube'?pumps[c.sku]:other[c.sku],context={family:'Cylinder',websiteSku:k.sku,applicator:c.kind==='lotion-tube'?'Lotion Pump':k.parts.some(p=>p.slot==='sprayer')?'Fine Mist Sprayer':k.parts.some(p=>p.slot==='roller')?'Metal Roller Ball':null};const layouts=(['sidecar','capon','exploded'] as const).map(v=>stageLayout(k,v,context)!);
   for(const l of layouts){expect(l.frame).toEqual(layouts[0].frame);const body=l.parts.find(p=>p.slot==='body')!,base=layouts[0].parts.find(p=>p.slot==='body')!;for(const field of ['key','url','box','dxPct','dyPct'] as const)expect(body[field]).toEqual(base[field]);}
   if(c.kind==='lotion-tube'){const l=layouts[2],parts=l.parts.filter(p=>['pump','collar','diptube'].includes(p.slot));expect(parts).toHaveLength(3);expect(new Set(parts.map(p=>JSON.stringify([p.dxPct,p.dyPct]))).size).toBe(1);}
  }
 });
});
