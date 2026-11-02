import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { availableViews, effectiveView, stageLayout, type KitLike } from '@/lib/products/pdp-redesign/stage';
import { requiresAssembledClosure, allowsExplodedClosure } from '@/lib/products/closure-presentation';
import { productCopyFor } from '@/lib/products/item-description/product-copy';
import { getCatalogHero, getProductHero, getReleasedCatalogHero, resolveLiveCatalogCardHero } from '@/lib/products/catalog-heroes';
import { pdpFallbackMedia } from '@/lib/products/pdp-redesign/fallback-media';
const before = JSON.parse(readFileSync('docs/reviews/tola6-applicator-2026-11-01/before-register.json', 'utf8')).kit as KitLike;
const context = { websiteSku: 'GB6TPlGl', family: 'Decorative', applicator: null, capacityMl: 6, color: 'Clear' };
const image = 'https://yzy7l20k4yt6znzz.public.blob.vercel-storage.com/plates/decorative-6ml-clear-14-3mm/GB6TPlGl/d82ca4bb5b8e3d7a18427ba74d5e39bbdf972fb010cc00f76bb425f9a9ef3bf1.front-on-1000x1100.webp';
describe('single Tola 6 ml gold-cap plastic-applicator presentation', () => {
    it('offers only the honest assembled view even when the obsolete plug-as-cap kit arrives', () => {
        for (const kit of [null, before]) {
            expect(availableViews(kit, context)).toEqual(['capon']);
            for (const view of ['sidecar', 'capon', 'exploded'] as const) {
                expect(effectiveView(view, kit, context)).toBe('capon');
                const l = stageLayout(kit, view, context)!;
                expect(l.parts).toHaveLength(1); expect(l.parts[0].slot).toBe('assembly');
                expect(l.parts[0].url).toBe(image); expect(l.grid).toBe(false);
                expect(l.parts[0].box!.widthPct / 1000).toBeCloseTo(l.parts[0].box!.heightPct / 1100 * 1.1, 10);
                expect(l).toEqual(stageLayout(before, 'capon', context));
            }
        }
        expect(requiresAssembledClosure(null, context.websiteSku)).toBe(true);
        expect(allowsExplodedClosure(null, context.family, context.websiteSku)).toBe(false);
    });
    it('uses exact capped artwork and copy without describing a pour bottle or a bare-glass fallback', () => {
        const copy = productCopyFor(context)!;
        expect(copy.title).toBe('6 ml Clear Tola Applicator Bottle');
        expect(copy.itemType).toBe('Tola applicator bottle');
        expect(JSON.stringify(copy)).toContain('plastic applicator');
        expect(JSON.stringify(copy)).toContain('red bead');
        expect(JSON.stringify(copy)).not.toMatch(/pour bottle|no fitment|screw cap/i);
        expect(productCopyFor({ graceSku: 'GB-DEC-CLR-6ML-T' })).toEqual(copy);
        const fallback = pdpFallbackMedia({ groupSlug: 'tola-6ml-clear-14.3mm', variant: context, plateImageUrl: 'https://example.test/old-cap-off.webp' });
        expect(fallback).toEqual({ images: [image], bodyImageUrl: null });
        const bytes = readFileSync('docs/reviews/tola6-applicator-2026-11-01/sources/active-assembled.d82ca4bb5b8e.webp');
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(image.split('/').pop()!.split('.')[0]);
    });
    it('uses the same complete source as the default hero even when an older Shopify sidecar image is present', () => {
        const variants = [{ websiteSku: context.websiteSku }];
        const hero = getCatalogHero('tola-6ml-clear-14.3mm', variants, context.websiteSku)!;
        expect(hero.url).toBe(image);
        expect(getProductHero(context.websiteSku)?.url).toBe(image);
        expect(getReleasedCatalogHero('tola-6ml-clear-14.3mm', context.websiteSku)?.url).toBe(image);
        expect(resolveLiveCatalogCardHero({ staticHero: hero, variants, heroImageUrl: 'https://cdn.shopify.com/old-sidecar.gif' }).imageUrl).toBe(image);
    });
    it('leaves other Tola sizes and ordinary pour products on their existing policies', () => {
        for (const websiteSku of ['GB3TPlGl', 'GBCyl5BlkSht']) {
            expect(availableViews(before, { ...context, websiteSku })).toEqual(['sidecar', 'capon', 'exploded']);
            expect(requiresAssembledClosure(null, websiteSku)).toBe(false);
        }
    });
});
