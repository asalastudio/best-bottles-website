import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import heroes from '../src/lib/products/catalog-heroes.json';
import cylinderHeroes from '../src/lib/products/cylinder-catalog-heroes.json';
import { getCatalogHero, getProductHero, getCatalogHeroProductHref } from '../src/lib/products/catalog-heroes';
import elegant from '../docs/reviews/elegant-family-final-manifest-2026-09-06.json';
import circle from '../docs/reviews/circle-family-final-manifest-2026-09-06.json';
import empire from '../docs/reviews/empire-100ml-final-manifest-2026-09-06.json';
import empire50 from '../docs/reviews/empire-50ml-final-manifest-2026-09-06.json';
const approved=[...elegant.rows,...circle.rows,...empire.rows,...empire50.rows];
describe('approved catalog hero release',()=>{
 it('contains only the 71 explicitly approved registrations',()=>{
  expect(heroes).toHaveLength(71);
  expect(new Set(heroes.map(h=>h.websiteSku))).toEqual(new Set(approved.map(h=>h.sku)));
  expect(getProductHero('GBEmp50SpryMtGl')).not.toBeNull();
  expect(getCatalogHero('atomizer-10ml', [{websiteSku:'GBAtom10Gl'}])).toBeNull();
 });
 it('preserves existing Cylinder selection and hover artwork',()=>{
  for(const h of cylinderHeroes) expect(getCatalogHero(h.groupSlug,[{websiteSku:h.websiteSku}])).toEqual(h);
 });
 for(const h of heroes) it(`${h.websiteSku} preserves approved bytes, framing, bone and exact SKU filtering`,async()=>{
  const a=approved.find(a=>a.sku===h.websiteSku)!;
  const b=readFileSync(`public${h.url}`);
  expect(createHash('sha256').update(b).digest('hex')).toBe(a.assetSha256);
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
