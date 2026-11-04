import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '@/lib/paper-doll/approved-kits.generated.json';
import source from '../public/local-kits/remaining-13-415-2026-11-01/kits.json';
import { cylinderMasterSku } from '@/lib/products/cylinder-master';
import { stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
// Reconstruct the historical approval before the later tube-only lotion revision.
const lotionTubeBefore = JSON.parse(readFileSync('docs/reviews/cylinder-lotion-pumps-2026-11-02/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const capFitBefore = JSON.parse(readFileSync('docs/reviews/tall9-pour-cap-fit-2026-11-01/before-kits.json', 'utf8')).rows as Record<string, KitLike>;
const laterAdditions=new Set<string>(['docs/reviews/hosted-vial3-jumbo28-2026-11-02/release-manifest.json','docs/reviews/hosted-elegant-masters-2026-11-03/release-manifest.json'].flatMap(file=>JSON.parse(readFileSync(file,'utf8')).addedSkus).concat(JSON.parse(readFileSync('docs/reviews/hosted-vial-masters-2026-11-04/release-manifest.json','utf8')).publishedSkus));
const hosted=manifest.rows as unknown as Record<string,KitLike>;
const selected=Object.entries(source.rows as unknown as Record<string,KitLike>).filter(([,kit])=>['sleek-5ml-13-415|Clear','sleek-8ml-13-415|Clear'].includes(kit.register?.plateKey??''));
const opticsBefore=JSON.parse(readFileSync('docs/reviews/sleek8-hero-depth-2026-11-01/before-kits.json','utf8')).rows as Record<string,KitLike>;
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical((value as Record<string,unknown>)[key])])):value;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
describe('approved Sleek 5/8 ml shared catalog, PDP and builder masters',()=>{
 it('publishes exactly the 72 approved combinations while preserving the earlier 362',()=>{
  const release=JSON.parse(readFileSync('docs/reviews/hosted-sleek-5-8-2026-11-01/release-manifest.json','utf8'));
  expect(selected).toHaveLength(72);expect(Object.keys(hosted)).toHaveLength(671);expect(release.addedSkus).toEqual(selected.map(([sku])=>sku).sort());
  const selectedSkus=new Set(release.addedSkus);const prior=Object.fromEntries(Object.entries(hosted).filter(([sku])=>!laterAdditions.has(sku)&&!selectedSkus.has(sku)&&!/^GBRect10(?:MtlRoll|Roll)/.test(sku)&&!['GBVAmb2BlackCap','GBVAmb2WhtCap','GBVialClr2mlBlackCap','GBVialClr2mlWhtCap'].includes(sku)));Object.assign(prior,JSON.parse(readFileSync('docs/reviews/tulip6-glass-depth-2026-11-01/before-kits.json','utf8')).rows);Object.assign(prior,capFitBefore);Object.assign(prior,lotionTubeBefore);expect(Object.keys(prior)).toHaveLength(362);expect(hash(prior)).toBe(release.preservedPriorRecipesSha256);
 });
 it('routes each cap choice to the approved body without changing placement or glass appearance',()=>{
  for(const [sku,original]of selected){const kit=hosted[sku];expect(kit,sku).toBeDefined();if(!kit)continue;expect(cylinderMasterSku(sku)).toBe(sku);expect(kit.glassSizing).toEqual(original.glassSizing);expect(kit.parts).toHaveLength(original.parts.length);
   for(const [i,part]of kit.parts.entries()){const sourcePart=original.parts[i];const restored=structuredClone(part);restored.image=sourcePart.image;if(restored.detached&&sourcePart.detached)restored.detached.image=sourcePart.detached.image;if(opticsBefore[sku]){if(part.slot==='body')delete restored.blendMode;if(part.slot==='diptube'&&part.views?.includes('sidecar')){restored.zOrder=sourcePart.zOrder;restored.opacity=sourcePart.opacity;delete restored.blendMode;}}expect(restored,sku).toEqual(sourcePart);expect(part.image.url).toMatch(/^https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\//);expect((part.image as {sha256?:string}).sha256).toBeTruthy();}
   const layouts=(['sidecar','capon','exploded'] as const).map(view=>stageLayout(kit,view,{websiteSku:sku,family:'Cylinder',color:kit.register?.glass,applicator:kit.parts.some(p=>p.slot==='sprayer')?'Fine Mist Sprayer':null})!);
   for(const layout of layouts){expect(layout.frame).toEqual(layouts[0].frame);const placement=(l:typeof layout)=>{const p={...l.parts.find(p=>p.slot==='body')!};delete (p as Partial<typeof p>).zIndex;return p;};expect(placement(layout)).toEqual(placement(layouts[0]));}
  }
 });
});
