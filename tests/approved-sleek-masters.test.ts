import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import source from '../public/local-kits/remaining-13-415-2026-11-01/kits.json';
import { cylinderMasterSku } from '@/lib/products/cylinder-master';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
const hosted=manifest.rows as unknown as Record<string,KitLike>;
const selected=Object.entries(source.rows as unknown as Record<string,KitLike>).filter(([,kit])=>['sleek-5ml-13-415|Clear','sleek-8ml-13-415|Clear'].includes(kit.register?.plateKey??''));
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical((value as Record<string,unknown>)[key])])):value;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
describe('approved Sleek 5/8 ml shared catalog, PDP and builder masters',()=>{
 it('publishes exactly the 72 approved combinations while preserving the earlier 362',()=>{
  const release=JSON.parse(readFileSync('docs/reviews/hosted-sleek-5-8-2026-11-01/release-manifest.json','utf8'));
  expect(selected).toHaveLength(72);expect(Object.keys(hosted)).toHaveLength(434);expect(release.addedSkus).toEqual(selected.map(([sku])=>sku).sort());
  const selectedSkus=new Set(release.addedSkus);const prior=Object.fromEntries(Object.entries(hosted).filter(([sku])=>!selectedSkus.has(sku)));expect(Object.keys(prior)).toHaveLength(362);expect(hash(prior)).toBe(release.preservedPriorRecipesSha256);
 });
 it('routes each cap choice to the approved body without changing placement or glass appearance',()=>{
  for(const [sku,original]of selected){const kit=hosted[sku];expect(kit,sku).toBeDefined();if(!kit)continue;expect(cylinderMasterSku(sku)).toBe(sku);expect(kit.glassSizing).toEqual(original.glassSizing);expect(kit.parts).toHaveLength(original.parts.length);
   for(const [i,part]of kit.parts.entries()){const sourcePart=original.parts[i];const restored=structuredClone(part);restored.image=sourcePart.image;if(restored.detached&&sourcePart.detached)restored.detached.image=sourcePart.detached.image;expect(restored,sku).toEqual(sourcePart);expect(part.image.url).toMatch(/^https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\//);expect((part.image as {sha256?:string}).sha256).toBeTruthy();}
   const layouts=(['sidecar','capon','exploded'] as const).map(view=>stageLayout(kit,view,{websiteSku:sku,family:'Cylinder',color:kit.register?.glass,applicator:kit.parts.some(p=>p.slot==='sprayer')?'Fine Mist Sprayer':null})!);
   for(const layout of layouts){expect(layout.frame).toEqual(layouts[0].frame);expect(layout.parts.find(p=>p.slot==='body')).toEqual(layouts[0].parts.find(p=>p.slot==='body'));}
  }
 });
});
