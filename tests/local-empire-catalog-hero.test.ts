import { afterEach, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { getCatalogHero, getProductHero, resolveLiveCatalogCardHero } from '../src/lib/products/catalog-heroes';
import hero100 from '../src/lib/products/local-empire-catalog-hero.json';
import additionalHeroes from '../src/lib/products/local-empire-additional-catalog-heroes.json';
import assets from '../src/lib/register/local-empire-bare-glass.json';
import tube100 from '../src/lib/register/local-empire-100ml-spray-tube.json';
import additionalTubes from '../src/lib/register/local-empire-additional-spray-tubes.json';
const heroes = [hero100, ...additionalHeroes];
import whiteTube from '../src/lib/register/local-empire-100ml-white-pump-tube.json';
import sources from '../src/lib/register/local-source-tubes.json';
import receipts from '../src/lib/products/local-empire-completion-provenance.json';
const tubes = [tube100, ...additionalTubes, whiteTube];
afterEach(() => vi.unstubAllEnvs());
it('uses each exact local assembly only for its present SKU, finish, group and size', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('VERCEL', '');
    expect(heroes).toHaveLength(14);
    for (const hero of heroes) {
        const variants = [{ websiteSku: hero.websiteSku }];
        expect(getCatalogHero(hero.groupSlug, variants)?.url).toBe(hero.url);
        expect(getProductHero(hero.websiteSku)?.url).toBe(hero.url);
        expect(getCatalogHero(hero.groupSlug, heroes.map(h => ({ websiteSku: h.websiteSku })), hero.websiteSku)?.url).toBe(hero.url);
        expect(getCatalogHero(hero.groupSlug, [{ websiteSku: 'unrelated-sku' }])?.url).not.toBe(hero.url);
        expect(getCatalogHero('unrelated-group', variants)?.url).not.toBe(hero.url);
        expect(getCatalogHero(hero.groupSlug, variants, 'unrelated-sku')?.url).not.toBe(hero.url);
        expect(resolveLiveCatalogCardHero({ staticHero: hero, variants, heroImageUrl: 'https://cdn.shopify.com/old.png' }).catalogHero?.url).toBe(hero.url);
    }
});
it('cannot override a production or Vercel catalog', () => {
    for (const [env, vercel] of [['production', ''], ['development', '1']]) {
        vi.stubEnv('NODE_ENV', env); vi.stubEnv('VERCEL', vercel);
        for (const hero of heroes) {
            expect(getCatalogHero(hero.groupSlug, [{ websiteSku: hero.websiteSku }])?.url).not.toBe(hero.url);
            expect(getProductHero(hero.websiteSku)?.url).not.toBe(hero.url);
        }
    }
});
it('exports the exact glass and native tube bytes used by each shared assembly', () => {
    for (const hero of heroes) {
        const receipt = receipts.find(r => r.websiteSku === hero.websiteSku)!;
        const tube = tubes.find(t => t.websiteSku === hero.websiteSku) ?? sources.find(t => t.url.includes('/empire50-white-lotion.'))!;
        const body = assets.find(a => a.expectedPlate.bodyId === `empire-${hero.capacityMl}ml-18-415`)!;
        expect(receipt.layers).toContainEqual(expect.objectContaining({ url: body.url, sha256: body.sha256 }));
        expect(receipt.layers).toContainEqual(expect.objectContaining({ url: tube.url, sha256: tube.sha256 }));
        expect(createHash('sha256').update(fs.readFileSync(`public${hero.url}`)).digest('hex')).toBe(receipt.sha256);
    }
});
