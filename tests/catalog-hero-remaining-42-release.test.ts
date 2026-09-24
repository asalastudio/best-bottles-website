import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rows from '../src/lib/products/catalog-hero-remaining-42-release.json';
import catalog from '../src/lib/products/catalog-heroes.json';
import approval from '../docs/hero-families/remaining-42-2026-09-24/approval.json';
import { getCatalogHero, getProductHero, resolveLiveCatalogCardHero } from '../src/lib/products/catalog-heroes';

afterEach(() => vi.unstubAllEnvs());

describe('Slim, Aluminum, and Atomizer catalog hero release', () => {
  it('ships all 42 exact-SKU Sunburst renders with intact image files', async () => {
    expect(rows).toHaveLength(42);
    expect(new Set(rows.map(row => row.websiteSku)).size).toBe(42);
    expect(rows.filter(row => row.family === 'Slim')).toHaveLength(15);
    expect(rows.filter(row => row.family === 'Aluminum Bottle')).toHaveLength(4);
    expect(rows.filter(row => row.family === 'Atomizer')).toHaveLength(23);
    expect(approval.rows).toHaveLength(42);
    for (const hero of rows) {
      const evidence = approval.rows.find(row => row.sku === hero.websiteSku)!;
      const original = catalog.find(row => row.websiteSku === hero.websiteSku)!;
      expect([hero.groupSlug, hero.shopifyVariantId, hero.family]).toEqual([
        original.groupSlug, original.shopifyVariantId, original.family,
      ]);
      const bytes = readFileSync(`public${hero.url}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(evidence.sha256);
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1560, 1716]);
      expect(evidence.model).toBe('gpt-image-2.5-sunburst');
      expect(hero.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
    }
    expect(approval.rows.find(row => row.sku === 'GBAtom5SlimBlk')?.sourceFile)
      .toContain('black-hardware-v2');
  });

  it('keeps the pictured and purchasable SKU aligned, including exact Atomizer searches', () => {
    vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', 'families-2026-09-22');
    for (const row of rows) {
      expect(getProductHero(row.websiteSku)).toEqual(row);
      expect(getCatalogHero(row.groupSlug, [{ websiteSku: row.websiteSku }])).toEqual(row);
      expect(getCatalogHero(row.groupSlug, [{ websiteSku: 'other-sku' }])).toBeNull();
      expect(resolveLiveCatalogCardHero({
        staticHero: row, heroImageUrl: 'https://cdn.shopify.com/older.png',
        variants: [{ websiteSku: row.websiteSku }],
      })).toMatchObject({ imageUrl: row.url, picturedWebsiteSku: row.websiteSku });
    }
    const atomizers = rows.filter(row => row.groupSlug === 'atomizer-5ml');
    const chosen = atomizers.find(row => row.websiteSku === 'GBAtom5SlimBlk')!;
    expect(getCatalogHero('atomizer-5ml', atomizers.map(row => ({ websiteSku: row.websiteSku })),
      'gbatom5slimblk')).toEqual(chosen);
  });

  it('keeps the release gated and excludes the three held Aluminum candidates', () => {
    for (const sku of ['Alu100mlSprayBlack', 'Alu250SpryBl', 'Alu500']) {
      expect(rows.some(row => row.websiteSku === sku)).toBe(false);
    }
    for (const flag of ['', 'cylinder-2026-09-22']) {
      vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', flag);
      for (const row of rows) expect(getProductHero(row.websiteSku)?.url).not.toBe(row.url);
    }
  });
});
