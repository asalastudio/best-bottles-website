import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import rows from '../src/lib/products/catalog-hero-cre-pilot.json';
import cylinder from '../src/lib/products/catalog-hero-pilot.json';
import approval from '../docs/hero-families/circle-round-empire-2026-09-22/complete-family-approval.json';
import {getCatalogHero, getProductHero, getCatalogHeroProductHref, resolveLiveCatalogCardHero} from '../src/lib/products/catalog-heroes';
afterEach(()=>vi.unstubAllEnvs());
describe('Approved Circle, Round and Empire staging heroes',()=>{
 it('serves the exact 60 approved files at identity framing and locked delivery size',()=>{
  expect(rows).toHaveLength(60); expect(new Set(rows.map(r=>r.websiteSku)).size).toBe(60);
  expect(Object.fromEntries(['Circle','Round','Empire'].map(f=>[f,rows.filter(r=>r.family===f).length]))).toEqual({Circle:28,Round:21,Empire:11});
  for(const row of rows){
   const lock=approval.rows.find(r=>r.sku===row.websiteSku)!;
   const b=readFileSync(`public${row.url}`);
   expect(createHash('sha256').update(b).digest('hex')).toBe(lock.sha256);
   expect([b.readUInt32BE(16),b.readUInt32BE(20)]).toEqual([2080,2288]);
   expect(row.framing).toEqual({scale:1,translateXPercent:0,translateYPercent:0});
   expect(lock.baselinePct).toBe(91);expect(lock.visualDecision).toBe('approved');
  }
 });
 it('retains production and old Cylinder-only opt-in behavior',()=>{
  vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT','');
  const previous=rows.map(r=>getProductHero(r.websiteSku));
  vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT','cylinder-2026-09-22');
  expect(rows.map(r=>getProductHero(r.websiteSku))).toEqual(previous);
  for(const r of cylinder)expect(getProductHero(r.websiteSku)).toEqual(r);
 });
 it('adds only exact filtered matches while preserving all Cylinder exports',()=>{
  vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT','families-2026-09-22');
  for(const row of [...cylinder,...rows]){
   expect(getProductHero(row.websiteSku)).toEqual(row);
   expect(getCatalogHero(row.groupSlug,[{websiteSku:row.websiteSku}])).toEqual(row);
   expect(getCatalogHero('wrong-group',[{websiteSku:row.websiteSku}])).toBeNull();
   expect(getCatalogHero(row.groupSlug,[{websiteSku:'wrong-finish'}])).toBeNull();
   expect(getCatalogHeroProductHref(row,`/products/${row.groupSlug}`)).toContain(`sku=${row.websiteSku}`);
   const live='https://cdn.shopify.com/example.png';
   expect(resolveLiveCatalogCardHero({heroImageUrl:live,staticHero:row,variants:[{websiteSku:row.websiteSku}]}).imageUrl).toBe(row.url);
   expect(resolveLiveCatalogCardHero({heroImageUrl:live,staticHero:row,variants:[{websiteSku:'wrong-finish'}]}).imageUrl).toBe(live);
  }
 });
});
