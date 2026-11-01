import { createElement, type ImgHTMLAttributes } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const query = vi.hoisted(() => vi.fn<(...args: unknown[]) => undefined>(() => undefined));
// Keep coverage of the legacy photographic fallback for SKUs outside the approved layered release.
vi.mock("@/lib/products/cylinder-master", () => ({ cylinderMasterSku: () => null, cylinderMasterSource: () => null, masterProductHref: (href: string) => href }));
vi.mock('convex/react', () => ({ useQuery: query }));
vi.mock('next/image', () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; unoptimized?: boolean }) => {
    const p = { ...props }; delete p.fill; delete p.unoptimized; return createElement('img', p);
} }));
import CatalogCardPreview from '@/components/catalog/CatalogCardPreview';
import CatalogCapDots, { useCatalogCapPhotos } from '@/components/catalog/CatalogCapDots';
import { getProductHero } from '@/lib/products/catalog-heroes';
const hero = getProductHero('GBCyl5MtlRollBlkDot')!;
const black = { id: 'black', label: 'Black with Dots', websiteSku: 'GBCyl5MtlRollBlkDot', optionType: 'capColor' as const };
const copper = { id: 'copper', label: 'Matte Copper', websiteSku: 'GBCyl5MtlRollCuMatt', optionType: 'capColor' as const };
const props = { title: '5 ml Clear Cylinder', catalogHero: hero, imageUrl: null, href: '/products/cylinder-5ml-clear-13-415-rollon', variants: [black,copper], family: 'Cylinder', slug: hero.groupSlug };
beforeEach(() => query.mockClear());
describe('catalog media loading', () => {
    it('displays an approved hero without subscribing to unused assembly plates', () => {
        const html = renderToStaticMarkup(<CatalogCardPreview {...props} />);
        expect(html).toContain(hero.url);
        expect(query.mock.calls.at(-1)?.[1]).toBe('skip');
    });
    it('requests only the chosen SKU when a shopper changes a hero cap', () => {
        renderToStaticMarkup(<CatalogCardPreview {...props} selected={copper} />);
        expect(query.mock.calls.at(-1)?.[1]).toEqual({ skus: [copper.websiteSku] });
    });
    it('still fetches the primary assembly when no approved hero exists', () => {
        renderToStaticMarkup(<CatalogCardPreview {...props} catalogHero={null} />);
        expect(query.mock.calls.at(-1)?.[1]).toEqual({ skus: [black.websiteSku] });
    });
    it('loads cap photos as small lazy images, not eager CSS backgrounds', () => {
        const html = renderToStaticMarkup(<CatalogCapDots title="Cylinder" variants={[black,copper]} selectedId={black.id} onSelect={() => {}} photo={v => `/caps/${v.id}.webp`} />);
        expect(html.match(/loading="lazy"/g)).toHaveLength(2);
        expect(html).toContain('width="22"');
        expect(html).toContain('height="22"');
        expect(html).not.toContain('background-image:url');
        expect(html).toContain('aria-label="Matte Copper"');
    });
});

function CapPhotos({ complete }: { complete: boolean }) {
    const photo = useCatalogCapPhotos({ capKind: 'roller', neck: '13-415', variants: complete ? [black, copper] : [{ ...black, websiteSku: 'unregistered-sku' }] });
    return <span>{photo(black)}</span>;
}
describe('catalog cap photo index', () => {
    it('uses the checked-in exact photos without reading the live family index', () => {
        const html = renderToStaticMarkup(<CapPhotos complete />);
        expect(html).toContain('reviewed-cap-thumbs');
        expect(query.mock.calls.every(call => call[1] === 'skip')).toBe(true);
    });
    it('keeps the family index fallback when an exact cap photo is missing', () => {
        renderToStaticMarkup(<CapPhotos complete={false} />);
        expect(query.mock.calls[0][1]).toEqual({ familyId: 'roll-on-cap-13-415', limit: 200 });
    });
});
