// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, expect, it, vi } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';
import { readFileSync } from 'node:fs';
import type { Doc } from '../convex/_generated/dataModel';
type SeedTable = 'products' | 'productGroups' | 'registerAssemblies' | 'registerBodies' | 'registerBodyPlates' | 'registerComponents' | 'productKits' | 'productPlates' | 'fitments';
const seed = JSON.parse(readFileSync('docs/reviews/isolated-preview-setup-2026-10-20/test-catalog.json', 'utf8')) as { [T in SeedTable]: Doc<T>[] };
import manifest from '../src/lib/media-release/manifest.json';
import { applyMediaRelease } from '../src/lib/media-release/kits';
import { resolveBuilderConfigurations, type CatalogRow } from '../src/lib/bottle-builder/model';
const modules = import.meta.glob('../convex/**/*.ts');
afterEach(() => vi.unstubAllEnvs());

it('loads the isolated catalog against the real schema and resolves all 26 exact media sources', async () => {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
        const ids = new Map<string, string>();
        for (const [table, rows] of Object.entries(seed).sort(([a], [b]) => a === 'productGroups' ? -1 : b === 'productGroups' ? 1 : a.localeCompare(b))) {
            for (const row of rows) {
                const { _id, _creationTime, ...data } = row;
                void _creationTime;
                const fields = { ...data } as Record<string, unknown>;
                if (typeof fields.productGroupId === 'string') fields.productGroupId = ids.get(fields.productGroupId);
                ids.set(_id, await ctx.db.insert(table as never, fields as never));
            }
        }
    });
    vi.stubEnv('NEXT_PUBLIC_BB_MEDIA_RELEASE', `${manifest.revision}:all`);
    const payload = await t.query(api.registerStage.forSkus, { graceSkus: manifest.entries.map(e => e.graceSku) });
    const result = applyMediaRelease(payload, {});
    expect(result.rejected).toEqual([]);
    expect(manifest.entries.filter(e => result.kits[e.websiteSku])).toHaveLength(26);
    const families = await t.query(api.matrix.listFamilies, {});
    expect(families.map(f => f.family).sort()).toEqual(['Empire', 'Round']);
    const allRows: CatalogRow[] = [];
    for (const family of ['Empire', 'Round']) {
        const rows = await t.query(api.matrix.getFamilyRows, { family });
        allRows.push(...rows.rows as CatalogRow[]);
    }
    expect(allRows.map(r => r.websiteSku).sort()).toEqual(manifest.entries.map(e => e.websiteSku).sort());
    const configs = resolveBuilderConfigurations(allRows, allRows.map(() => null), allRows.map(row => seed.productPlates.find(p => p.websiteSku === row.websiteSku)?.front.url ?? null));
    for (const [index, config] of configs.entries()) expect(config, allRows[index].websiteSku ?? '').not.toBeNull();
    for (const group of seed.productGroups) {
        const data = await t.query(api.products.getProductGroup, { slug: group.slug });
        expect(data).not.toBeNull();
    }
});
