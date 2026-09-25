import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rows from '../src/lib/products/catalog-hero-batch6-release.json';
import catalog from '../src/lib/products/catalog-heroes.json';
import nextBatch from '../src/lib/products/catalog-hero-next-batch-release.json';
import batch3 from '../src/lib/products/catalog-hero-batch3-release.json';
import approval from '../docs/hero-families/batch6-2026-09-25/approval.json';
import { getCatalogHero, getProductHero, resolveLiveCatalogCardHero } from '../src/lib/products/catalog-heroes';

afterEach(() => vi.unstubAllEnvs());

// Jordan, 2026-09-25, after reviewing the 13-415 family cards: "Regenerate all three plus Pillar and Bell".
const SCOPE = { Royal: 3, Square: 3, Flair: 3, Bell: 3, Pillar: 3 };
// Production's glass heights (mm without the cap), which the approved curve sizes each card from.
const GLASS_MM: Record<string, number> = { Royal: 56, Square: 52, Flair: 56, Bell: 55, Pillar: 57 };
const LEGACY_PHOTO = ['GBPillar9BlkShSht', 'GBPillar9MtlRollBlkdot', 'GBPillar9SpryBlkMatt'];
// The Pillar cap card never had a registry row (production filed the bottle in a corrupt group until the
// 2026-09-25 move), so its identity comes from production alone; every other SKU already had a card.
const NEW_CARD = 'GBPillar9BlkShSht';
const SUPERSEDED_NEXT_BATCH = ['GBRoyal13Gl', 'GBRoyal13SpryGlMatt', 'GBRoyal13MtlRollBlkDot', 'GBFlair15Gl', 'GBFlair15SpryGlMatt', 'GBFlair15MtlRollBlkDot'];
const SUPERSEDED_BATCH3 = ['GBSqr15Gl', 'GBSqr15SpryGlMatt', 'GBSqr15MtlRollBlkDot'];

describe('Batch 6 catalog hero release (Royal, Square, Flair, Bell, Pillar)', () => {
  it('ships the 15 approved exact-SKU Sunburst renders with intact image files', async () => {
    expect(rows).toHaveLength(15);
    expect(new Set(rows.map(row => row.websiteSku)).size).toBe(15);
    expect(approval.scope).toEqual(SCOPE);
    for (const [family, count] of Object.entries(SCOPE)) expect(rows.filter(row => row.family === family)).toHaveLength(count);
    expect(approval.rows).toHaveLength(15);
    for (const hero of rows) {
      const evidence = approval.rows.find(row => row.sku === hero.websiteSku)!;
      expect(evidence.status).toBe('approved');
      const original = catalog.find(row => row.websiteSku === hero.websiteSku);
      if (hero.websiteSku === NEW_CARD) {
        // No older card to agree with: the group is the one the Pillar rollers already carry.
        expect(original).toBeUndefined();
        expect([hero.groupSlug, hero.family, hero.capacityMl]).toEqual(['pillar-9ml-clear-13-415', 'Pillar', 9]);
        expect(hero.graceSku).toBeTruthy();
      } else {
        // Every other SKU already had a card; the identity the older registry recorded is unchanged.
        expect(original).toBeDefined();
        expect([hero.groupSlug, hero.graceSku, hero.shopifyVariantId, hero.family, hero.capacityMl]).toEqual([
          original!.groupSlug, original!.graceSku, original!.shopifyVariantId, original!.family, original!.capacityMl,
        ]);
      }
      expect(evidence.production.slug).toBe(hero.groupSlug);
      expect(evidence.production.color).toBe('Clear');
      expect(hero.bottleColor).toBe('Clear');
      expect(hero.presentation).toBe('Empty · cap beside');
      expect(evidence.selectedAttempt).toBe('a1');
      expect(hero.url).toBe(`/images/catalog/batch6-approved-2026-09-25/${hero.websiteSku}.${evidence.sha256.slice(0, 12)}.webp`);
      const bytes = readFileSync(`public${hero.url}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(evidence.sha256);
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1560, 1716]);
      expect([hero.width, hero.height]).toEqual([1560, 1716]);
      expect(evidence.model).toBe('gpt-image-2.5-sunburst');
      expect(hero.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
    }
  });

  it('sizes every card from production glass height on the approved curve, on the shoulder landmark', () => {
    for (const row of approval.rows) {
      expect(row.sizing.glassMm).toBe(GLASS_MM[row.family]);
      expect(row.sizing.landmarkRule).toBe('shoulder');
      const pct = 3.5314 * row.sizing.glassMm ** 0.5868;
      expect(Math.abs(row.sizing.targetPct - pct)).toBeLessThan(0.02);
    }
  });

  it('records the master PSD for every card except Pillar, which comes from its legacy site photograph', () => {
    for (const row of approval.rows) {
      if (LEGACY_PHOTO.includes(row.sku)) {
        expect(row.source.psd).toBeNull();
        expect(row.source.legacy).toBe(`https://www.bestbottles.com/images/store/enlarged_pics/${row.sku}.gif`);
      } else {
        expect(row.source.psd).toContain('/BB-PSD-Files-Master/5.  13-415 Bottles/');
        expect(row.source.legacy ?? null).toBeNull();
      }
    }
    // The Pillar cap card was held on the first run and released the same day; nothing stays held.
    expect(approval.held).toEqual({});
    expect(approval.releasedFromHold).toHaveProperty(NEW_CARD);
    expect(rows.some(row => row.websiteSku === NEW_CARD)).toBe(true);
  });

  it('replaces the Royal and Flair rows of the next batch and the Square rows of batch 3', () => {
    for (const sku of SUPERSEDED_NEXT_BATCH) expect(nextBatch.some(row => row.websiteSku === sku)).toBe(false);
    for (const sku of SUPERSEDED_BATCH3) expect(batch3.some(row => row.websiteSku === sku)).toBe(false);
    for (const sku of [...SUPERSEDED_NEXT_BATCH, ...SUPERSEDED_BATCH3]) expect(rows.some(row => row.websiteSku === sku)).toBe(true);
  });

  it('serves each hero on its card only under the families release flag, for exactly its SKU', () => {
    vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', 'families-2026-09-22');
    for (const hero of rows) {
      const variants = [{ websiteSku: hero.websiteSku }];
      expect(getProductHero(hero.websiteSku)?.url).toBe(hero.url);
      expect(getCatalogHero(hero.groupSlug, variants)?.url).toBe(hero.url);
      expect(getCatalogHero(hero.groupSlug, [{ websiteSku: 'Other' }])?.url).not.toBe(hero.url);
      const card = resolveLiveCatalogCardHero({
        heroImageUrl: 'https://cdn.shopify.com/s/files/1/0000/files/group.png',
        staticHero: getCatalogHero(hero.groupSlug, variants), variants,
      });
      expect(card.imageUrl).toBe(hero.url);
    }
    vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', '');
    for (const hero of rows) {
      expect(getCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku }])?.url).not.toBe(hero.url);
    }
  });
});
