import { describe, expect, it } from 'vitest';
import { searchCatalog } from '../convex/products';

type SearchResult = { totalCount: number; items: Array<{ slug: string }>; variantPreviewRows: Array<{ variants: Array<{ websiteSku: string | null }> }> };
const handler = (searchCatalog as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<SearchResult> })._handler;

describe('catalog exact variant SKU search', () => {
  it('finds a group through an alternate Atomizer SKU, not just its primary SKU', async () => {
    const group = {
      _id: 'atomizer-group', slug: 'atomizer-10ml', displayName: '10 ml Atomizer',
      primaryWebsiteSku: 'GBAtom10Blk', family: 'Atomizer', capacity: '10 ml', capacityMl: 10,
      category: 'Metal Atomizer', neckThreadSize: '17mm', applicatorTypes: ['Fine Mist Sprayer'],
      priceRangeMin: 2.46, priceRangeMax: 3.15,
    };
    const variants = [
      { _id: 'black', productGroupId: group._id, websiteSku: 'GBAtom10Blk', graceSku: 'GB-CYL-BLK-10ML-ATM-BLK' },
      { _id: 'blue', productGroupId: group._id, websiteSku: 'GBAtom10Blu', graceSku: 'GB-CYL-BLU-10ML-ATM-BLU' },
    ];
    const ctx = { db: { query: (table: string) => ({
      collect: async () => table === 'productGroups' ? [group] : variants,
      withIndex: (_index: string, predicate: (q: { eq: (field: string, value: string) => { field: string; value: string } }) => { field: string; value: string }) => {
        const { field, value } = predicate({ eq: (key, target) => ({ field: key, value: target }) });
        return { collect: async () => variants.filter(row => String(row[field as keyof typeof row]) === value) };
      },
    }) } };
    const result = await handler(ctx, {
      filters: { search: 'GBAtom10Blu' }, sort: 'best-match', view: 'grid', limit: 24, cursor: null,
    });
    expect(result.items.map(row => row.slug)).toEqual(['atomizer-10ml']);
    expect(result.totalCount).toBe(1);
    expect(result.variantPreviewRows[0].variants.map(row => row.websiteSku)).toContain('GBAtom10Blu');
  });
});
