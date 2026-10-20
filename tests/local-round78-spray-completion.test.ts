import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawableRegisterKits } from '../src/lib/register/load';
import pilot from '../src/lib/register/local-round78-two-bottle-pilot.json';
import joins from '../src/lib/register/local-round78-additional-spray-joins.json';
import tube from '../src/lib/register/local-round78-tubes.json';
import pilotHeroes from '../src/lib/products/local-round78-pilot-catalog-heroes.json';
import extraHeroes from '../src/lib/products/local-round78-additional-catalog-heroes.json';
import { getProductHero, getCatalogHero, isLocalReviewHero } from '../src/lib/products/catalog-heroes';
const directory=process.env.BB_ROUND78_COMPLETION_DIR;
afterEach(()=>vi.unstubAllEnvs());
(directory?describe:describe.skip)('Round 78 local spray completion',()=>{
 it('preserves the accepted pair and source geometry while joining all ten additional tubes',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
  expect(joins.flatMap(j=>j.websiteSkus)).toHaveLength(10);
  for(const environment of ['production','development']){
   const snapshot=JSON.parse(fs.readFileSync(`${directory}/${environment}-snapshot.json`,'utf8'));
   const before=JSON.parse(fs.readFileSync(`${directory}/${environment}-before-kits.json`,'utf8'));
   const after=drawableRegisterKits(snapshot.register);expect(new Set(Object.values(after).map(k=>k.sku)).size).toBe(12);
   for(const sku of [pilot,...joins].flatMap(j=>j.websiteSkus)){
    const kit=after[sku];
    const old=before[sku];
    if(pilot.websiteSkus.includes(sku))expect(kit,sku).toEqual(old);
    const join=[pilot,...joins].find(j=>j.websiteSkus.includes(sku))!;
    const head=kit.parts.find(p=>p.slot==='sprayer')!;
    const stable=(parts:typeof kit.parts)=>parts.filter(p=>p.slot!=='diptube').map(({exploded,...p})=>p);
    expect(stable(kit.parts),sku).toEqual(stable(old.parts));
    for(const t of kit.parts.filter(p=>p.slot==='diptube')){
     const prev=old.parts.find((p:any)=>p.slot==='diptube'&&p.views.join(',')===t.views!.join(','));
     expect(t.image).toEqual(prev.image);expect(t.image.url).toBe(tube.url);
     expect(t.box.width).toBe(prev.box.width);expect(t.box.height).toBe(prev.box.height);
     expect(t.bounds.top).toBeCloseTo(head.box.y+head.box.height*join.solidBottomY/join.sprayerHeight-2,1);
     if(t.views?.includes('exploded'))expect(t.exploded).toEqual(head.exploded);
     else {expect(t.throughGlass).toEqual(prev.throughGlass);expect(t.bounds.bottom).toBeLessThan(Math.max(...t.throughGlass!.clip.map(p=>p[1])));}
    }
   }
  }
 });
 it('exports and routes every finish exactly and excludes all local overrides in production',()=>{
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');const heroes=[...pilotHeroes,...extraHeroes];
  expect(heroes).toHaveLength(12);expect(new Set(heroes.map(h=>h.websiteSku)).size).toBe(12);
  const receipts=JSON.parse(fs.readFileSync('src/lib/products/local-round78-completion-provenance.json','utf8'));
  for(const hero of heroes){
   expect(getProductHero(hero.websiteSku)?.url).toBe(hero.url);
   expect(getCatalogHero(hero.groupSlug,[{websiteSku:hero.websiteSku}],hero.websiteSku)?.url).toBe(hero.url);
   const receipt=receipts.find((r:any)=>r.websiteSku===hero.websiteSku);
   expect(receipt.layers).toContainEqual(expect.objectContaining({url:tube.url,sha256:tube.sha256}));
   expect(createHash('sha256').update(fs.readFileSync(`public${hero.url}`)).digest('hex')).toBe(receipt.sha256);
  }
  for(const [env,vercel] of [['production',''],['development','1']]){
   vi.stubEnv('NODE_ENV',env);vi.stubEnv('VERCEL',vercel);
   for(const hero of heroes)expect(isLocalReviewHero(getProductHero(hero.websiteSku))).toBe(false);
  }
 });
});
