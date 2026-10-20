import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '../src/lib/register/load';
import pilot from '../src/lib/register/local-round78-two-bottle-pilot.json';
import tube from '../src/lib/register/local-round78-tubes.json';
import heroes from '../src/lib/products/local-round78-pilot-catalog-heroes.json';
import { getProductHero, getCatalogHero, isLocalReviewHero } from '../src/lib/products/catalog-heroes';
const directory = process.env.BB_ROUND78_PILOT_DIR;
afterEach(() => vi.unstubAllEnvs());
(directory ? describe : describe.skip)('Round clear/frosted pilot isolation', () => {
 it('preserves the two approved pilot assemblies and their source pixels, glass and hardware', () => {
  vi.stubEnv('NODE_ENV', 'development');vi.stubEnv('VERCEL', '');
  for (const env of ['production','development']) {
   const snapshot=JSON.parse(fs.readFileSync(`${directory}/${env}-snapshot.json`,'utf8'));
   const before=JSON.parse(fs.readFileSync(`${directory}/${env}-before-kits.json`,'utf8'));
   const after=drawableRegisterKits(snapshot.register);let changed=0;
   for(const assembly of Object.values(snapshot.register.assemblies) as any[]) {
    const sku=assembly.websiteSku;const a=after[sku],b=before[sku];
    if(!pilot.websiteSkus.includes(sku))continue; // Remaining finishes are covered by the completion suite.
    changed++;const holder=a.parts.find(p=>p.slot==='sprayer')!;
    const stable=(parts:typeof a.parts)=>parts.filter(p=>p.slot!=='diptube').map(({exploded,...p})=>p);
    expect(stable(a.parts)).toEqual(stable(b.parts));
    const native=a.parts.filter(p=>p.slot==='diptube');expect(native).toHaveLength(2);
    for(const t of native){
     expect(t.image.url).toBe(tube.url);expect(t.image).toEqual(b.parts.find((p:any)=>p.slot==='diptube').image);
     expect(t.bounds.top).toBeCloseTo(holder.box.y+holder.box.height*pilot.solidBottomY/pilot.sprayerHeight-2,1);
     expect(t.box.width).toBe(b.parts.find((p:any)=>p.slot==='diptube').box.width);
     if(t.views?.includes('exploded'))expect(t.exploded).toEqual(holder.exploded);
     else expect(t.throughGlass?.opacity).toBe(sku.includes('Frst')?.22:.65);
    }
   }
   expect(changed).toBe(2);
  }
 });
 it('keeps the two matching catalog exports exact and local', () => {
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');expect(heroes).toHaveLength(2);
  const receipts=JSON.parse(fs.readFileSync('src/lib/products/local-round78-pilot-provenance.json','utf8'));
  for(const hero of heroes){
   expect(pilot.websiteSkus).toContain(hero.websiteSku);expect(isLocalReviewHero(getProductHero(hero.websiteSku))).toBe(true);
   expect(getCatalogHero(hero.groupSlug,[{websiteSku:hero.websiteSku}],hero.websiteSku)?.url).toBe(hero.url);
   const receipt=receipts.find((r:any)=>r.websiteSku===hero.websiteSku);
   expect(receipt.layers).toContainEqual(expect.objectContaining({url:tube.url,sha256:tube.sha256}));
   expect(createHash('sha256').update(fs.readFileSync(`public${hero.url}`)).digest('hex')).toBe(receipt.sha256);
   expect(getProductHero(hero.websiteSku.replace('ShnSl','MtSl'))?.url).not.toBe(hero.url);
  }
  for(const [env,vercel] of [['production',''],['development','1']]){
   vi.stubEnv('NODE_ENV',env);vi.stubEnv('VERCEL',vercel);
   for(const hero of heroes)expect(isLocalReviewHero(getProductHero(hero.websiteSku))).toBe(false);
  }
 });
});
