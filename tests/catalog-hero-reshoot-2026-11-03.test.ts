import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rows from '../src/lib/products/catalog-hero-reshoot-2026-11-03.json';
import nextBatch from '../src/lib/products/catalog-hero-next-batch-release.json';
import vials from '../src/lib/products/catalog-hero-vials-release.json';
import approval from '../docs/hero-families/reshoot-2026-11-03/approval.json';
import { getCatalogHero, getProductHero } from '../src/lib/products/catalog-heroes';

afterEach(() => vi.unstubAllEnvs());

describe('2026-11-03 catalog hero reshoots', () => {
  it('ships the four reshoots with intact lossless WebP files and their approval rows', async () => {
    expect(rows.map(row => row.websiteSku).sort()).toEqual(['GB3TPlGl', 'GBHeartFrst4KeyGld', 'GBHeartFrst4TslRed', 'LB3mlClear']);
    for (const hero of rows) {
      const evidence = approval.rows.find(row => row.sku === hero.websiteSku)!;
      expect(evidence.groupSlug).toBe(hero.groupSlug);
      expect(evidence.model).toBe('gpt-image-2.5-sunburst');
      expect(hero.url).toBe(`/images/catalog/reshoot-2026-11-03/${hero.websiteSku}.${evidence.sha256.slice(0, 12)}.webp`);
      const bytes = readFileSync(`public${hero.url}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(evidence.sha256);
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1560, 1716]);
      expect(hero.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
    }
    expect(approval.rows.filter(row => row.status === 'approved').map(row => row.sku).sort()).toEqual(['GBHeartFrst4KeyGld', 'GBHeartFrst4TslRed']);
  });

  it('replaces the earlier release rows rather than shadowing them', () => {
    expect(nextBatch.some(row => row.websiteSku === 'GB3TPlGl')).toBe(false);
    expect(vials.some(row => row.websiteSku === 'LB3mlClear')).toBe(false);
  });

  it('serves each reshoot on its card under the families release flag, for exactly its SKU', () => {
    vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', 'families-2026-09-22');
    for (const hero of rows) {
      expect(getProductHero(hero.websiteSku)?.url).toBe(hero.url);
      expect(getCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku }])?.url).toBe(hero.url);
      expect(getCatalogHero(hero.groupSlug, [{ websiteSku: 'Other' }])?.url).not.toBe(hero.url);
    }
  });
});
