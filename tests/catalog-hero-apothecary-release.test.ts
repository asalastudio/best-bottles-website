import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rows from '../src/lib/products/catalog-hero-apothecary-release.json';
import approval from '../docs/hero-families/apothecary-2026-09-24/approval.json';
import { getProductHero, getCatalogHero, resolveLiveCatalogCardHero } from '../src/lib/products/catalog-heroes';

afterEach(() => vi.unstubAllEnvs());

describe('Approved Apothecary catalog heroes', () => {
  it('ships all five mapped assets with verified file hashes and dimensions', async () => {
    expect(rows.map(row => row.websiteSku)).toEqual(['GB15ApthBlue', 'GB1ozApth', 'GB1ozApthBlue', 'GB1ozApthGreen', 'GBPearClear4ozStpr']);
    expect(approval.rows).toHaveLength(5);
    for (const hero of rows) {
      const entry = approval.rows.find(row => row.sku === hero.websiteSku)!;
      const bytes = readFileSync(`public${hero.url}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1560, 1716]);
      expect(hero.shopifyVariantId).toBe(entry.shopifyVariantId);
      expect(entry.model).toBe('gpt-image-2.5-sunburst');
      expect(hero.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
    }
    expect(approval.rows.find(row => row.sku === 'GB1ozApthGreen')?.sourceRenderSha256)
      .toBe('9b2bbf248baaf67bf345c4eb8e4d8986a2ce865aebed79b8def3e8f16bf7fd40');
  });

  it('uses an approved hero only when the exact SKU is still visible', () => {
    vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', 'families-2026-09-22');
    for (const row of rows) {
      expect(getProductHero(row.websiteSku)).toEqual(row);
      expect(getCatalogHero(row.groupSlug, [{ websiteSku: row.websiteSku }])).toEqual(row);
      expect(getCatalogHero(row.groupSlug, [{ websiteSku: 'wrong-material' }])).toBeNull();
      expect(resolveLiveCatalogCardHero({ staticHero: row, heroImageUrl: 'https://cdn.shopify.com/old.png', variants: [{ websiteSku: row.websiteSku }] }).imageUrl).toBe(row.url);
      expect(resolveLiveCatalogCardHero({ staticHero: row, heroImageUrl: 'https://cdn.shopify.com/old.png', variants: [{ websiteSku: 'wrong-material' }] }).imageUrl).toBe('https://cdn.shopify.com/old.png');
    }
  });

  it('retains existing images when the family release is disabled', () => {
    for (const flag of ['', 'cylinder-2026-09-22']) {
      vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', flag);
      for (const row of rows) expect(getProductHero(row.websiteSku)?.url).not.toBe(row.url);
    }
  });
});
