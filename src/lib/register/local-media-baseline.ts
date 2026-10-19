import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { ConvexHttpClient } from 'convex/browser';
import { getFunctionName, type FunctionReference } from 'convex/server';
import { localMediaBaselineAllowed, replayMediaQuery, type MediaBaseline } from './media-baseline-replay';

// Deliberate opt-in: an ignored local file; never a public env URL or a backend switch.
const file = path.join(process.cwd(), 'output/local-media-baseline/active.json');
let cached: { mtime: number; size: number; version: string; snapshot: MediaBaseline } | null = null;
export function localMediaBaseline() {
    if (!localMediaBaselineAllowed(process.env.NODE_ENV, process.env.VERCEL) || !fs.existsSync(file)) return null;
    const stat = fs.statSync(file);
    if (!cached || cached.mtime !== stat.mtimeMs || cached.size !== stat.size) {
        const bytes = fs.readFileSync(file);
        const snapshot = JSON.parse(bytes.toString()) as MediaBaseline;
        if (snapshot.schemaVersion !== 1 || !snapshot.scopeSkus.length || !snapshot.queries.length) throw new Error('Invalid local media snapshot');
        cached = { mtime: stat.mtimeMs, size: stat.size, version: createHash('sha256').update(bytes).digest('hex').slice(0, 16), snapshot };
    }
    return cached;
}
export const localMediaBaselineCacheKey = () => localMediaBaseline()?.version ?? 'no-local-baseline';

/** Server catalogue reads only. The browser Convex provider and checkout backend are untouched. */
export function withLocalMediaBaseline(client: ConvexHttpClient, family?: string): ConvexHttpClient {
    const baseline = localMediaBaseline();
    if (!baseline) return client;
    return new Proxy(client, {
        get(target, property) {
            if (property === 'query') return async (reference: FunctionReference<'query'>, args: Record<string, unknown> = {}) => {
                const replayed = replayMediaQuery(baseline.snapshot, getFunctionName(reference), args, family);
                return replayed ? replayed.value : target.query(reference, args);
            };
            if (property === 'mutation' || property === 'action' || property === 'setAuth' || property === 'setAdminAuth') return () => { throw new Error('Local media review client is read-only'); };
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}
