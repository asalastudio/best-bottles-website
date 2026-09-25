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
  'LBMetalSilver1oz', 'GBMtlCylGl',
];
const ROUND2_QA_PASS = ['GBEternalFlameGreen', 'GBCB12ozPear'];
const ROUND2_ON_SIGHT = ['GBRoyal13Gl', 'GBRoyal13MtlRollBlkDot', 'GB3TPlGl', 'GBGrce55AnSpTslMtSl'];
const ON_SIGHT = [...ROUND2_ON_SIGHT, 'GB1ozGenieBl'];

describe('Grace, Royal, Flair, and Decorative catalog hero release', () => {
  it('ships the 21 approved exact-SKU Sunburst renders with intact image files', async () => {
    expect(rows).toHaveLength(21);
    expect(new Set(rows.map(row => row.websiteSku)).size).toBe(21);
    expect(rows.filter(row => row.family === 'Grace')).toHaveLength(5);
    expect(rows.filter(row => row.family === 'Royal')).toHaveLength(3);
    expect(rows.filter(row => row.family === 'Flair')).toHaveLength(3);
    expect(rows.filter(row => row.family === 'Decorative')).toHaveLength(10);
    expect(approval.rows).toHaveLength(21);
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
      // Every row passes the edge gate except the five Jordan approved on sight.
      expect(evidence.qa.operationalPass).toBe(!ON_SIGHT.includes(hero.websiteSku));
      expect(hero.framing).toEqual({ scale: 1, translateXPercent: 0, translateYPercent: 0 });
    }
    expect(rows.find(row => row.websiteSku === 'GBEternalFlameBlue')?.bottleColor).toBe('Cobalt Blue');
    expect(rows.find(row => row.websiteSku === 'GBEternalFlameGreen')?.bottleColor).toBe('Green');
  });

  it('labels the pictured glass colour and records where production differs', () => {
    const genie = rows.find(row => row.websiteSku === 'GB1ozGenieBl')!;
    expect([genie.groupSlug, genie.bottleColor]).toEqual(['genie-32ml-cobalt-blue-Ground', 'Aqua']);
    expect(genie.alt).toContain('Aqua');
    expect(rows.find(row => row.websiteSku === 'GBCB12ozPear')?.bottleColor).toBe('Cobalt Blue');
    expect(approval.labelFollowUps).toMatchObject({
      GB1ozGenieBl: { registryBottleColor: 'Aqua', productionColor: 'Cobalt Blue' },
      GBCB12ozPear: { registryBottleColor: 'Cobalt Blue', productionColor: 'Clear' },
    });
    for (const row of approval.rows) {
      if (!(row.sku in approval.labelFollowUps)) {
        expect(row.production.color).toBe(rows.find(hero => hero.websiteSku === row.sku)?.bottleColor);
      }
    }
  });

  it('takes the later-round heroes from their named attempt and records the on-sight approvals', () => {
    for (const sku of [...ROUND2_QA_PASS, ...ROUND2_ON_SIGHT]) {
      const evidence = approval.rows.find(row => row.sku === sku)!;
      expect(evidence.round).toBe(2);
      expect(evidence.selectedAttempt).toMatch(/^r2a\d$/);
      expect(evidence.status).toBe(ON_SIGHT.includes(sku) ? 'approved-on-sight' : 'qa-pass');
    }
    const genie = approval.rows.find(row => row.sku === 'GB1ozGenieBl')!;
    expect([genie.round, genie.selectedAttempt, genie.status]).toEqual([3, 'r3a1', 'approved-on-sight']);
    expect(genie.approvedOnSight!.measured).toMatchObject({
      edgeSmoothedP99: 2.6, edgeSmoothedMax: 2.84, fitErrPct: 0.001,
      glassColour: { inputMedianRGB: [202, 226, 230], outputMedianRGB: [203, 229, 233], inputHueDeg: 188.6, outputHueDeg: 188 },
    });
    for (const sku of ON_SIGHT) {
      const onSight = approval.rows.find(row => row.sku === sku)!.approvedOnSight!;
      expect(onSight.attemptsTotal).toBe(sku === 'GB1ozGenieBl' ? 3 : 6);
      expect(onSight.measured.operationalPass).toBe(false);
      expect(onSight.measured.iou).toBeLessThan(0.995);
    }
    expect([...approval.approvedOnSight.skus].sort()).toEqual([...ON_SIGHT].sort());
    expect(approval.rows.filter(row => 'status' in row)).toHaveLength(7);
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
