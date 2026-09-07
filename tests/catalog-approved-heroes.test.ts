import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import heroes from '../src/lib/products/catalog-heroes.json';
import release from '../docs/reviews/catalog-complete-hero-release-2026-09-07.json';
import { getCatalogHero, getProductHero, getCatalogHeroProductHref } from '../src/lib/products/catalog-heroes';
import elegant from '../docs/reviews/elegant-family-final-manifest-2026-09-06.json';
import circle from '../docs/reviews/circle-family-final-manifest-2026-09-06.json';
import empire from '../docs/reviews/empire-100ml-final-manifest-2026-09-06.json';
import diva from '../docs/reviews/diva-family-final-manifest-2026-09-06.json';
import shoulderApproval from '../docs/reviews/elegant-shoulder-alignment-2026-09-07.json';
const approved=[...elegant.rows,...circle.rows,...empire.rows,...diva.rows];
describe('approved catalog hero release',()=>{
 it('includes the expanded release and preserves every prior approved registration',()=>{
  expect(heroes).toHaveLength(391);
  expect(new Set(heroes.map(h=>h.websiteSku)).size).toBe(391);
  for(const a of approved) {
   const h=getProductHero(a.sku)!;
   expect(h.framing).toEqual(shoulderApproval.rows.find(row=>row.sku===a.sku)?.framing ?? a.framing);
   expect(createHash('sha256').update(readFileSync(`public${h.url}`)).digest('hex')).toBe(a.assetSha256);
  }
  expect(heroes.filter(h=>h.family==='Cylinder')).toHaveLength(52);
 });
 it('locks all Elegant shoulders while preserving the approved vintage exceptions',()=>{
  expect(shoulderApproval.rows).toHaveLength(33);
  expect(shoulderApproval.rows.filter(row=>row.vintageException)).toHaveLength(8);
  for(const row of shoulderApproval.rows) {
   expect(getProductHero(row.sku)?.framing).toEqual(row.framing);
   if(row.vintageException) { expect(row.framing).toEqual(row.beforeFraming); continue; }
   const shoulder=row.landmarks!.shoulder*row.framing.scale/3.3+row.framing.translateYPercent;
   const baseline=row.bodyBase!*row.framing.scale/3.3+row.framing.translateYPercent;
   expect(shoulder).toBeCloseTo(row.shoulderYPercent!,8);
   expect(baseline).toBeCloseTo(91,8);
   for(const value of Object.values(row.sceneBounds!)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(100); }
  }
 });
 for(const h of heroes) it(`${h.websiteSku} preserves approved bytes, framing, bone and exact SKU filtering`,async()=>{
  const a=release.rows.find(a=>a.websiteSku===h.websiteSku)!;
  const b=readFileSync(`public${h.url}`);
  expect(createHash('sha256').update(b).digest('hex')).toBe(a.sha256);
  expect(h.framing).toEqual(a.framing);
  const {data,info}=await sharp(b).removeAlpha().raw().toBuffer({resolveWithObject:true});
  expect([info.width,info.height]).toEqual([1560,1716]);
  for(const [x,y] of [[0,0],[1559,0],[0,1715],[1559,1715]]) expect([...data.subarray((y*info.width+x)*3,(y*info.width+x)*3+3)]).toEqual([245,243,239]);
  expect(getCatalogHero(h.groupSlug,[{websiteSku:h.websiteSku}])?.url).toBe(h.url);
  expect(getCatalogHero(h.groupSlug,[{websiteSku:'unapproved-other-finish'}])).toBeNull();
  expect(getCatalogHeroProductHref(h,'/products/example?applicator=spray')).toContain(`sku=${h.websiteSku}`);
 });
 it('keeps catalog media out of product detail implementations',()=>{
  for(const p of ['ConfiguratorPdp.tsx','mobile/MobileProductHero.tsx','mobile/MobileProductPdp.tsx']) expect(readFileSync(`src/components/products/${p}`,'utf8')).not.toContain('catalog-heroes');
 });
});
