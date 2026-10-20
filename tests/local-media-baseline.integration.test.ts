/** Explicit local evidence run; requires the captured public family snapshot. */
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { replayMediaQuery } from '../src/lib/register/media-baseline-replay';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
const provided = process.env.BB_MEDIA_REVIEW_SNAPSHOT;
const suite = provided ? describe : describe.skip;
suite('captured family through real server loaders (offline)', () => {
    let snapshot: any;
    beforeAll(() => {
        snapshot = JSON.parse(fs.readFileSync(provided!, 'utf8'));
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('NEXT_PUBLIC_CONVEX_URL', 'https://offline-review.convex.cloud');
        vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in snapshot replay'); }));
    });
    afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
    it('loads the actual Builder family and full kits with captured production data', async () => {
        const { loadBuilderFamily, loadBuilderBodyKits } = await import('../src/lib/bottle-builder/server');
        const bodies = await loadBuilderFamily('Empire');
        const body = bodies.find(b => b.capacityMl === 50)!;
        expect(body).toBeTruthy();
        const kits = await loadBuilderBodyKits('Empire', body.id);
        const expected = snapshot.matrix.rows.filter((r: any) => r.capacityMl === 50 && r.applicator === 'Lotion Pump');
        expect(expected).toHaveLength(8);
        for (const row of expected) {
            expect(body.configurations.some(c => c.id === row.websiteSku), row.websiteSku).toBe(true);
            expect(kits[row.websiteSku], row.websiteSku).toBeTruthy();
        }
        expect(Object.values(kits).filter(k => k?.parts.some(p => p.image.url.includes('/empire50-lotion.')))).toHaveLength(7);
        expect(kits.LBEmp50WhtClOvrCp?.parts.some(p => p.image.url.includes('/empire50-white-lotion.'))).toBe(true);
        for (const size of [50, 100]) {
            const own = bodies.find(b => b.capacityMl === size)!;
            expect(own.configurations.every(c => c.bodyImage?.url.startsWith('/local-media/empire-bare-glass/'))).toBe(true);
            const loaded = await loadBuilderBodyKits('Empire', own.id);
            const corrected = snapshot.matrix.rows.filter((r: any) => r.capacityMl === size);
            for (const row of corrected) expect(loaded[row.websiteSku]?.parts.find(p => p.slot === 'body')?.image.url, row.websiteSku).toContain('/local-media/empire-bare-glass/');
        }
    });
    it('uses captured catalogue cards and compatibility without any development requests', async () => {
        const { searchCatalogServer } = await import('../src/lib/catalogServer');
        const result = await searchCatalogServer({ filters: { families: ['Empire'] }, sort: 'featured', view: 'visual', limit: 48 });
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items.every(g => g.family === 'Empire')).toBe(true);
        expect(result.items.some(g => g.slug === 'empire-50ml-clear-18-415-lotionpump')).toBe(true);
        expect(result.primarySkus.every(p => snapshot.catalog.primarySkus.some((saved: any) => saved.groupId === p.groupId && saved.websiteSku === p.websiteSku))).toBe(true);
        for (const row of snapshot.matrix.rows.filter((r: any) => r.capacityMl === 50 && r.applicator === 'Lotion Pump')) {
            expect(replayMediaQuery(snapshot, 'grace:getBottleComponents', { websiteSku: row.websiteSku })).toBeTruthy();
        }
    });
    it('calculates PDP envelopes from the same production snapshot', async () => {
        const { glassStageEnvelopes } = await import('../src/lib/register/stage-envelopes');
        const query = async (fn: any, args: any) => {
            const replay = replayMediaQuery(snapshot, getFunctionName(fn), args);
            if (!replay) throw new Error('Uncaptured envelope query');
            return replay.value;
        };
        const envelopes = await glassStageEnvelopes({ query } as any, { family: 'Empire', capacityMl: 50 });
        expect(Object.keys(envelopes).length).toBeGreaterThan(0);
    });
});
