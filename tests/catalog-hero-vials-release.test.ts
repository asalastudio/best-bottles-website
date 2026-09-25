import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rows from '../src/lib/products/catalog-hero-vials-release.json';
import batch3 from '../src/lib/products/catalog-hero-batch3-release.json';
import approval from '../docs/hero-families/vials-2026-09-25/approval.json';
import { getCatalogHero, getProductHero } from '../src/lib/products/catalog-heroes';

afterEach(() => vi.unstubAllEnvs());

// Jordan's caliper heights (2026-09-25): glass without the cap.
const GLASS_MM: Record<string, number> = {
  GBV1DrmWhtCapSht: 45, GBVAmb1DrmWhtCapSht: 45, GBVBlu1DrmWhtCapSht: 45, GBVGr1DrmWhtCapSht: 45,
  GBV1DrmBlkDropper: 45, GBVAmb1DrmBlkDrpr: 45, GBVBlu1DrmBlkDropper: 45, GBVGr1DrmBlkDropper: 45,
  GBVialClr2mlWhtCap: 35, GBVAmb2WhtCap: 35, GB1mlAmbVialWht: 35, GB1mlVBlk: 35,
  GBVialAmb1o5WhtCapSht: 22, GBVBlu1o9BlackCapSht: 27, GBVGreen2o4BlackCapSht: 27,
};
const LEGACY_PHOTO = ['GBVBlu1o9BlackCapSht', 'GBVGreen2o4BlackCapSht', 'LB3mlClear'];

describe('Vial family catalog hero release', () => {
  it('ships the 16 approved heroes with intact image files and replaces the batch-3 vials', async () => {
    expect(rows).toHaveLength(16);
    expect(new Set(rows.map(row => row.websiteSku)).size).toBe(16);
    expect(rows.filter(row => row.family === 'Vial')).toHaveLength(15);
    expect(rows.filter(row => row.family === 'Lotion Bottle')).toHaveLength(1);
    expect(batch3.some(row => row.family === 'Vial')).toBe(false);
    expect(approval.rows).toHaveLength(16);
    for (const hero of rows) {
      const evidence = approval.rows.find(row => row.sku === hero.websiteSku)!;
      expect(evidence.status).toBe('approved');
      expect(evidence.production.slug).toBe(hero.groupSlug);
      expect(hero.url).toBe(`/images/catalog/vials-approved-2026-09-25/${hero.websiteSku}.${evidence.sha256.slice(0, 12)}.webp`);
      const bytes = readFileSync(`public${hero.url}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(evidence.sha256);
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1560, 1716]);
      expect([hero.width, hero.height]).toEqual([1560, 1716]);
      expect(evidence.model).toBe('gpt-image-2.5-sunburst');
      expect(hero.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
      expect(evidence.source.path.startsWith('legacy:')).toBe(LEGACY_PHOTO.includes(hero.websiteSku));
    }
  });

  it('sizes the vials proportionally to the caliper heights on one family scale', () => {
    const pxPerMm = approval.rows
      .filter(row => row.family === 'Vial')
      .map(row => ({ mm: GLASS_MM[row.sku], pct: row.sizing.glassHeightPct as number }));
    expect(pxPerMm).toHaveLength(15);
    // glassHeightPct / mm is the family scale: the same for every vial.
    const scales = pxPerMm.map(({ mm, pct }) => pct / mm);
    for (const scale of scales) expect(scale).toBeCloseTo(scales[0], 3);
    // The 4 ml (45 mm) anchor sits at 43.1% × 1.20 of the card.
    expect(pxPerMm.find(({ mm }) => mm === 45)!.pct).toBeCloseTo(51.7, 0);
    for (const row of approval.rows) {
      if (row.sku === 'GBVialAmb1o5WhtCapSht') expect(row.sizing.glassHeightPct).toBeCloseTo(25.3, 0);
      if (row.sku === 'LB3mlClear') expect(row.sizing.heightWithCapMm).toBe(65);
    }
  });

  it('serves each vial hero on its card only under the families release flag, for exactly its SKU', () => {
    vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', 'families-2026-09-22');
    for (const hero of rows) {
      expect(getProductHero(hero.websiteSku)?.url).toBe(hero.url);
      expect(getCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku }])?.url).toBe(hero.url);
      expect(getCatalogHero(hero.groupSlug, [{ websiteSku: 'Other' }])?.url).not.toBe(hero.url);
    }
    vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', '');
    for (const hero of rows) {
      expect(getCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku }])?.url).not.toBe(hero.url);
    }
  });
});
