import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {afterEach, describe, expect, it, vi} from 'vitest';
import rows from '../src/lib/products/catalog-hero-elegant-release.json';
import approval from '../docs/hero-families/elegant-2026-09-23/approval.json';
import {getProductHero, getCatalogHero, resolveLiveCatalogCardHero} from '../src/lib/products/catalog-heroes';
afterEach(()=>vi.unstubAllEnvs());
describe('Approved Elegant delivery',()=>{
 it('serves only approved exact bytes with the locked canvas and identity framing',()=>{
  expect(rows).toHaveLength(31);expect(new Set(rows.map(r=>r.websiteSku)).size).toBe(31);
  expect(approval.rows.filter(r=>r.backgroundCleanup)).toHaveLength(5);
  for(const r of rows){const lock=approval.rows.find(x=>x.sku===r.websiteSku)!;const b=readFileSync(`public${r.url}`);
   expect(createHash('sha256').update(b).digest('hex')).toBe(lock.sha256);
   expect([b.readUInt32BE(16),b.readUInt32BE(20)]).toEqual([2080,2288]);
   expect(r.framing).toEqual({scale:1,translateXPercent:0,translateYPercent:0});
   expect(lock.baselinePct).toBe(91);expect(lock.visualDecision).toBe('approved');
  }
 });
 it('uses exact visible Elegant assemblies ahead of old Shopify photos only with family opt-in',()=>{
  vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT','families-2026-09-22');
  const old='https://cdn.shopify.com/old.png';
  for(const r of rows){expect(getProductHero(r.websiteSku)).toEqual(r);expect(getCatalogHero(r.groupSlug,[{websiteSku:r.websiteSku}])).toEqual(r);
   expect(getCatalogHero(r.groupSlug,[{websiteSku:'unrelated'}])).toBeNull();
   expect(resolveLiveCatalogCardHero({heroImageUrl:old,staticHero:r,variants:[{websiteSku:r.websiteSku}]}).imageUrl).toBe(r.url);
   expect(resolveLiveCatalogCardHero({heroImageUrl:old,staticHero:r,variants:[{websiteSku:'unrelated'}]}).imageUrl).toBe(old);
  }
  for(const sku of approval.pendingGeneration)expect(getProductHero(sku)?.url).not.toContain('elegant-approved-2026-09-23');
 });
 it('leaves flag-off and Cylinder-only behavior unchanged',()=>{
  vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT','');const previous=rows.map(r=>getProductHero(r.websiteSku));
  vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT','cylinder-2026-09-22');expect(rows.map(r=>getProductHero(r.websiteSku))).toEqual(previous);
 });
});
