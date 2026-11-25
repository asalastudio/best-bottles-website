import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import rows from '../src/lib/products/catalog-hero-vial2-black-cap-2026-11-04.json';
import approval from '../docs/hero-families/vial2-black-cap-2026-11-04/approval.json';
import { getCatalogHero } from '../src/lib/products/catalog-heroes';
import smallGlass from '../src/lib/paper-doll/small-glass-bodies.generated.json';

afterEach(() => vi.unstubAllEnvs());

describe('2026-11-04 2 ml amber black-cap photo', () => {
  it('ships one lossless WebP with its approval row', async () => {
    expect(rows.map(row => row.websiteSku)).toEqual(['GBVAmb1o5BlackCapSht']);
    const [hero] = rows; const [evidence] = approval.rows;
    expect(evidence.sku).toBe(hero.websiteSku);
    expect(evidence.status).toBe('approved');
    // 24 Nov 2026: the approved photo with its glass re-shot (scripts/diva-vial/small-glass-bodies.py); the cap is unchanged.
    const swap = (smallGlass.heroes as Record<string, { from: string; url: string; sha256: string }>)[hero.websiteSku];
    expect(swap.from).toBe(`/images/catalog/vial2-black-cap-2026-11-04/${hero.websiteSku}.${evidence.sha256.slice(0, 12)}.webp`);
    expect(createHash('sha256').update(readFileSync(`public${swap.from}`)).digest('hex')).toBe(evidence.sha256);
    expect(hero.url).toBe(swap.url);
    const bytes = readFileSync(`public${hero.url}`);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(swap.sha256);
    const meta = await sharp(bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1560, 1716]);
  });

  it('shows on the card only when the black cap is picked; the group keeps its white-cap hero', () => {
    vi.stubEnv('NEXT_PUBLIC_CATALOG_HERO_PILOT', 'families-2026-09-22');
    const both = [{ websiteSku: 'GBVialAmb1o5WhtCapSht' }, { websiteSku: 'GBVAmb1o5BlackCapSht' }];
    expect(getCatalogHero('vial-2ml-amber-13-425', both)?.websiteSku).toBe('GBVialAmb1o5WhtCapSht');
    expect(getCatalogHero('vial-2ml-amber-13-425', [{ websiteSku: 'GBVAmb1o5BlackCapSht' }], 'GBVAmb1o5BlackCapSht')?.url).toBe(rows[0].url);
  });
});
