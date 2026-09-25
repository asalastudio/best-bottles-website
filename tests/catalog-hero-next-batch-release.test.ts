import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rows from '../src/lib/products/catalog-hero-next-batch-release.json';
import catalog from '../src/lib/products/catalog-heroes.json';
import approval from '../docs/hero-families/next-batch-2026-09-25/approval.json';
import { getCatalogHero, getProductHero, resolveLiveCatalogCardHero } from '../src/lib/products/catalog-heroes';

afterEach(() => vi.unstubAllEnvs());

const HELD = [
  'GBHeartFrst4KeyGld', 'GBHeartFrst4TslRed', 'LB1ozGl', 'LB1ozSl', 'LB3mlClear',
  'LBMetalSilver1oz', 'GBMtlCylGl', 'GB1ozGenieBl',
];
const ROUND2_QA_PASS = ['GBEternalFlameGreen', 'GBCB12ozPear'];
const ON_SIGHT = ['GBRoyal13Gl', 'GBRoyal13MtlRollBlkDot', 'GB3TPlGl', 'GBGrce55AnSpTslMtSl'];

describe('Grace, Royal, Flair, and Decorative catalog hero release', () => {
  it('ships the 20 approved exact-SKU Sunburst renders with intact image files', async () => {
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map(row => row.websiteSku)).size).toBe(20);
    expect(rows.filter(row => row.family === 'Grace')).toHaveLength(5);
    expect(rows.filter(row => row.family === 'Royal')).toHaveLength(3);
    expect(rows.filter(row => row.family === 'Flair')).toHaveLength(3);
    expect(rows.filter(row => row.family === 'Decorative')).toHaveLength(9);
    expect(approval.rows).toHaveLength(20);
    for (const hero of rows) {
      const evidence = approval.rows.find(row => row.sku === hero.websiteSku)!;
      const original = catalog.find(row => row.websiteSku === hero.websiteSku)!;
      expect([hero.groupSlug, hero.graceSku, hero.shopifyVariantId, hero.family, hero.capacityMl]).toEqual([
        original.groupSlug, original.graceSku, original.shopifyVariantId, original.family, original.capacityMl,
      ]);
      expect(evidence.production.slug).toBe(hero.groupSlug);
      expect(evidence.sourceFile).toBe(`${hero.websiteSku}-${evidence.selectedAttempt}-fitted.png`);
      expect(hero.url).toBe(`/images/catalog/next-batch-approved-2026-09-25/${hero.websiteSku}.${evidence.sha256.slice(0, 12)}.webp`);
      const bytes = readFileSync(`public${hero.url}`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(evidence.sha256);
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1560, 1716]);
      expect([hero.width, hero.height]).toEqual([1560, 1716]);
      expect(evidence.model).toBe('gpt-image-2.5-sunburst');
      // Every row passes the edge gate except the four Jordan approved on sight.
      expect(evidence.qa.operationalPass).toBe(!ON_SIGHT.includes(hero.websiteSku));
      expect(hero.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
    }
    expect(rows.find(row => row.websiteSku === 'GBEternalFlameBlue')?.bottleColor).toBe('Cobalt Blue');
    expect(rows.find(row => row.websiteSku === 'GBEternalFlameGreen')?.bottleColor).toBe('Green');
  });

  it('takes the six added heroes from round 2 and records the four on-sight approvals', () => {
    for (const sku of [...ROUND2_QA_PASS, ...ON_SIGHT]) {
      const evidence = approval.rows.find(row => row.sku === sku)!;
      expect(evidence.round).toBe(2);
      expect(evidence.selectedAttempt).toMatch(/^r2a\d$/);
      expect(evidence.status).toBe(ON_SIGHT.includes(sku) ? 'approved-on-sight' : 'qa-pass');
    }
    for (const sku of ON_SIGHT) {
      const onSight = approval.rows.find(row => row.sku === sku)!.approvedOnSight!;
      expect(onSight.attemptsTotal).toBe(6);
      expect(onSight.measured.operationalPass).toBe(false);
      expect(onSight.measured.iou).toBeLessThan(0.995);
    }
    expect(approval.approvedOnSight.skus.sort()).toEqual([...ON_SIGHT].sort());
    expect(approval.rows.filter(row => 'status' in row)).toHaveLength(6);
  });

  it('keeps the pictured and purchasable SKU aligned in its production group', () => {
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
  });

  it('keeps the release gated and excludes every held SKU', () => {
    for (const sku of HELD) {
      expect(rows.some(row => row.websiteSku === sku)).toBe(false);
      expect(approval.rows.some(row => row.sku === sku)).toBe(false);
    }
    expect(rows.some(row => /^GBPillar|Pillar/i.test(row.websiteSku))).toBe(false);
    for (const flag of ['', 'cylinder-2026-09-22']) {
      vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', flag);
      for (const row of rows) expect(getProductHero(row.websiteSku)?.url).not.toBe(row.url);
    }
  });
});
