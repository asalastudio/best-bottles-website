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
const laterAdditions=new Set<string>(['docs/reviews/hosted-vial3-jumbo28-2026-11-02/release-manifest.json','docs/reviews/hosted-elegant-masters-2026-11-03/release-manifest.json'].flatMap(file=>JSON.parse(readFileSync(file,'utf8')).addedSkus).concat(JSON.parse(readFileSync('docs/reviews/hosted-vial-masters-2026-11-04/release-manifest.json','utf8')).publishedSkus).concat(JSON.parse(readFileSync('docs/reviews/hosted-diva-masters-2026-11-04/release-manifest.json','utf8')).publishedSkus).concat(JSON.parse(readFileSync('docs/reviews/hosted-pillar-masters-2026-11-04/release-manifest.json','utf8')).publishedSkus).concat(JSON.parse(readFileSync('docs/reviews/hosted-egd-masters-2026-11-04/release-manifest.json','utf8')).publishedSkus));
const hosted=manifest.rows as unknown as Record<string,KitLike>;
const selected=Object.entries(source.rows as unknown as Record<string,KitLike>).filter(([,kit])=>['cylinder-9ml-13-415|Clear','cylinder-9ml-13-415|Frosted'].includes(kit.register?.plateKey??''));
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical((value as Record<string,unknown>)[key])])):value;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
describe('approved tall 9 ml shared catalog, PDP and builder masters',()=>{
 it('publishes exactly the 72 approved combinations while preserving the earlier 290',()=>{
  const release=JSON.parse(readFileSync('docs/reviews/hosted-tall-cylinder9-2026-11-01/release-manifest.json','utf8'));
  expect(selected).toHaveLength(72);expect(Object.keys(hosted)).toHaveLength(1034);/* + 7 Pillar sprayers + 177 Empire/Grace/Diamond (2026-11-04) */expect(release.addedSkus).toEqual(selected.map(([sku])=>sku).sort());
  const selectedSkus=new Set(release.addedSkus);const prior=Object.fromEntries(Object.entries(hosted).filter(([sku,kit])=>!laterAdditions.has(sku)&&!selectedSkus.has(sku)&&!/^GBRect10(?:MtlRoll|Roll)/.test(sku)&&!['GBVAmb2BlackCap','GBVAmb2WhtCap','GBVialClr2mlBlackCap','GBVialClr2mlWhtCap'].includes(sku)&&!['sleek-5ml-13-415','sleek-8ml-13-415'].includes(kit.register?.bodyId??'')));Object.assign(prior,JSON.parse(readFileSync('docs/reviews/tulip6-glass-depth-2026-11-01/before-kits.json','utf8')).rows);Object.assign(prior,JSON.parse(readFileSync('docs/reviews/tulip-amber-seating-2026-11-01/before-kits.json','utf8')).rows);Object.assign(prior,lotionTubeBefore);expect(Object.keys(prior)).toHaveLength(290);expect(hash(prior)).toBe(release.preservedPriorRecipesSha256);
 });
 it('routes each cap choice to the approved body without changing placement or glass appearance',()=>{
  for(const [sku,original]of selected){const kit=hosted[sku];expect(kit,sku).toBeDefined();if(!kit)continue;expect(cylinderMasterSku(sku)).toBe(sku);expect(kit.glassSizing).toEqual(original.glassSizing);expect(kit.parts).toHaveLength(original.parts.length);
   for(const [i,part]of kit.parts.entries()){const sourcePart=original.parts[i];const restored=structuredClone(capFitBefore[sku]&&part.slot==='cap'?capFitBefore[sku].parts.find(p=>p.slot==='cap')!:part);restored.image=sourcePart.image;if(restored.detached&&sourcePart.detached)restored.detached.image=sourcePart.detached.image;expect(restored,sku).toEqual(sourcePart);expect(part.image.url).toMatch(/^https:\/\/yzy7l20k4yt6znzz\.public\.blob\.vercel-storage\.com\//);expect((part.image as {sha256?:string}).sha256).toBeTruthy();}
   const layouts=(['sidecar','capon','exploded'] as const).map(view=>stageLayout(kit,view,{websiteSku:sku,family:'Cylinder',color:kit.register?.glass,applicator:kit.parts.some(p=>p.slot==='sprayer')?'Fine Mist Sprayer':null})!);
   for(const layout of layouts){expect(layout.frame).toEqual(layouts[0].frame);expect(layout.parts.find(p=>p.slot==='body')).toEqual(layouts[0].parts.find(p=>p.slot==='body'));}
  }
 });
});
