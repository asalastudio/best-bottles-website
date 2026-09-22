import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rows from '../src/lib/products/catalog-hero-pilot.json';
import manifest from '../docs/hero-families/cylinder-2026-09-22/manifest.json';
import { getCatalogHero, getProductHero, getCatalogHeroProductHref, resolveLiveCatalogCardHero } from '../src/lib/products/catalog-heroes';
import { filterCatalogCardVariants } from '../src/lib/products/product-card-variant-previews';
const enable = () => vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', 'cylinder-2026-09-22');
afterEach(() => vi.unstubAllEnvs());
describe('Cylinder staging pilot', () => {
 it('preserves every exact export and identity framing', () => {
  expect(rows).toHaveLength(28);
  expect(new Set(rows.map(r => r.groupSlug)).size).toBe(22);
  for (const row of rows) {
   const source = manifest.rows.find(r => r.sku === row.websiteSku)!;
   const bytes = readFileSync(`public${row.url}`);
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.outputSha256);
   expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2080,2288]);
   expect(row.framing).toEqual({scale:1,translateXPercent:0,translateYPercent:0});
   expect(source.lock.baselinePct).toBe(91);
   expect(source.technicalClearance).toBe(false);
  }
 });
 it('leaves production and unrelated families on the existing registry', () => {
  vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', '');
  expect(getProductHero('GBCyl9MtlRollBlkDot')?.url).toContain('/bone-review/');
  const before = getProductHero('GBCyl5SprySlMatt');
  enable();
  expect(getProductHero('GBCyl5SprySlMatt')).toEqual(before);
 });
 it('selects only exact group and filtered SKU matches for all candidates', () => {
  enable();
  for (const row of rows) {
   expect(getCatalogHero(row.groupSlug,[{websiteSku:row.websiteSku}])).toEqual(row);
   expect(getCatalogHero('wrong-group',[{websiteSku:row.websiteSku}])).toBeNull();
   expect(getCatalogHero(row.groupSlug,[{websiteSku:'missing-sku'}])).toBeNull();
   expect(getCatalogHeroProductHref(row,`/products/${row.groupSlug}`)).toContain(`sku=${row.websiteSku}`);
  }
 });
 it('uses the staged assembly ahead of Shopify only when that variant is present', () => {
  enable();
  const row = rows[0];
  const liveUrl='https://cdn.shopify.com/s/files/example.png';
  expect(resolveLiveCatalogCardHero({heroImageUrl:liveUrl,staticHero:row,variants:[{websiteSku:row.websiteSku}]}).imageUrl).toBe(row.url);
  expect(resolveLiveCatalogCardHero({heroImageUrl:liveUrl,staticHero:row,variants:[{websiteSku:'other'}]}).imageUrl).toBe(liveUrl);
  vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT','');
  expect(resolveLiveCatalogCardHero({heroImageUrl:liveUrl,staticHero:row,variants:[{websiteSku:row.websiteSku}]}).imageUrl).toBe(liveUrl);
 });
 it('retains the metal roller representative and supports a plastic-only filter', () => {
  enable();
  const group='cylinder-9ml-clear-17-415-rollon';
  const plastic={websiteSku:'GBCyl9RollBlkDot',ballMaterial:'Plastic'},metal={websiteSku:'GBCyl9MtlRollBlkDot',ballMaterial:'Metal'};
  expect(getCatalogHero(group,[plastic,metal])?.websiteSku).toBe(metal.websiteSku);
  expect(getCatalogHero(group,filterCatalogCardVariants([metal,plastic],['plastic']))?.websiteSku).toBe(plastic.websiteSku);
 });
});
