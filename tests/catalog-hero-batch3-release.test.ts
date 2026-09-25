import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rows from '../src/lib/products/catalog-hero-batch3-release.json';
import catalog from '../src/lib/products/catalog-heroes.json';
import approval from '../docs/hero-families/batch3-2026-09-25/approval.json';
import { getCatalogHero, getProductHero, resolveLiveCatalogCardHero } from '../src/lib/products/catalog-heroes';

afterEach(() => vi.unstubAllEnvs());

// SKUs the base registry never carried: the cobalt and green SQST (production
// files all three stopper bottles in one Clear group) and the two frosted
// tassel bottles, whose cards showed plates until now.
const NEW_SKUS = ['GBSQSTBlue', 'GBSQSTGREEN', 'GBCrclFrst50AnSpTslBlk', 'GBRndFrst128AnSpTslRed'];
const RE_RENDERED = [
  'GBRect10Gl', 'GBRect10MtlRollBlkDot', 'GBRect10SpryGlMatt', 'GBSqr15Gl', 'GBSqr15MtlRollBlkDot', 'GBSqr15SpryGlMatt',
  'GBSQSTClear', 'GBTRDPClear', 'GBTrdpBlue', 'GBTRDPGreen',
];

describe('Batch 3 catalog hero release (Square, Rectangle, Tulip, Diamond, frosted tassels, Teardrop, SQST, Vials)', () => {
  it('ships the 41 approved exact-SKU Sunburst renders with intact image files', async () => {
    expect(rows).toHaveLength(41);
    expect(new Set(rows.map(row => row.websiteSku)).size).toBe(41);
    expect(Object.fromEntries(Object.entries(approval.scope))).toEqual({ Square: 3, Rectangle: 9, Tulip: 6, Diamond: 5, Circle: 1, Round: 1, Teardrop: 3, Vial: 13 });
    for (const [family, count] of Object.entries(approval.scope)) {
      expect(rows.filter(row => row.family === family)).toHaveLength(count);
    }
    expect(approval.rows).toHaveLength(41);
    for (const hero of rows) {
      const evidence = approval.rows.find(row => row.sku === hero.websiteSku)!;
      expect(evidence.status).toBe('approved');
      const original = catalog.find(row => row.websiteSku === hero.websiteSku);
      if (NEW_SKUS.includes(hero.websiteSku)) {
        expect(original).toBeUndefined();
      } else {
        expect([hero.groupSlug, hero.graceSku, hero.shopifyVariantId, hero.family, hero.capacityMl]).toEqual([
          original!.groupSlug, original!.graceSku, original!.shopifyVariantId, original!.family, original!.capacityMl,
        ]);
      }
      expect(evidence.production.slug).toBe(hero.groupSlug);
      expect(evidence.selectedAttempt).toBe(RE_RENDERED.includes(hero.websiteSku) ? 'a2' : 'a1');
      expect(hero.url).toBe(`/images/catalog/batch3-approved-2026-09-25/${hero.websiteSku}.${evidence.sha256.slice(0, 12)}.webp`);
      const bytes = readFileSync(`public${hero.url}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(evidence.sha256);
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1560, 1716]);
      expect([hero.width, hero.height]).toEqual([1560, 1716]);
      expect(evidence.model).toBe('gpt-image-2.5-sunburst');
      expect(hero.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
    }
  });

  it("applies Jordan's vial sizes and the full-height rule for stopper bottles", () => {
    for (const row of approval.rows) {
      const pct = row.sizing.targetPct;
      if (row.family === 'Vial') {
        const capacityMl = rows.find(hero => hero.websiteSku === row.sku)!.capacityMl;
        expect(pct).toBe(capacityMl <= 2 ? 32 : 35);
      }
      if (/SQST|TRDP|Trdp/.test(row.sku)) {
        expect(row.sizing.heightWithStopperMm).toBe(row.sku.includes('SQST') ? 64 : 68);
        expect(row.sizing.override).toContain('full height with stopper');
      }
      if (/^GB(Rect10|Sqr15)/.test(row.sku)) expect(row.sizing.footFix).toContain('true glass bottom');
    }
  });

  it('labels the pictured glass colour and records where production differs', () => {
    expect(rows.find(row => row.websiteSku === 'GBSQSTBlue')?.bottleColor).toBe('Cobalt Blue');
    expect(rows.find(row => row.websiteSku === 'GBSQSTGREEN')?.bottleColor).toBe('Green');
    expect(approval.labelFollowUps).toMatchObject({
      GBSQSTBlue: { registryBottleColor: 'Cobalt Blue', productionColor: 'Clear' },
      GBSQSTGREEN: { registryBottleColor: 'Green', productionColor: 'Clear' },
    });
    for (const row of approval.rows) {
      if (!(row.sku in approval.labelFollowUps)) {
        expect(row.production.color).toBe(rows.find(hero => hero.websiteSku === row.sku)?.bottleColor);
      }
    }
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
    // All three SQST colours resolve from production's single Clear group.
    const sqst = ['GBSQSTClear', 'GBSQSTBlue', 'GBSQSTGREEN'].map(websiteSku => ({ websiteSku }));
    for (const { websiteSku } of sqst) {
      expect(getCatalogHero('rectangle-9ml-clear-Ground-glassapplicator', sqst, websiteSku)?.websiteSku).toBe(websiteSku);
    }
    vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', '');
    for (const hero of rows) {
      expect(getCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku }])?.url).not.toBe(hero.url);
    }
  });
});
