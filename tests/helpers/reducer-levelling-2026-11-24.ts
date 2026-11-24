import { readFileSync } from 'node:fs';

/** The reducer levelling (scripts/paperdoll/level-reducers-everywhere.py, 24 Nov 2026): no recipe added or removed;
 * the two reducer parts of the 96 live Elegant 60/100 and Diva reducer recipes now hold the levelled insert, already
 * hosted with the Empire/Grace/Diamond masters. Earlier release tests check their baselines against the approved
 * recipes as they stood before it: each changed part given back the image and derivation it held. */
type Replaced = { part: number; image: unknown; derivation: unknown };
export const reducerLevelling = JSON.parse(readFileSync('docs/reviews/reducer-levelling-2026-11-24/release-manifest.json', 'utf8')) as
    { priorVersion: string; version: string; levelledSkus: string[]; replacedParts: Record<string, Replaced[]> };
export function beforeReducerLevelling<T>(rows: Record<string, T>): Record<string, T> {
    const out = { ...rows };
    for (const [sku, replaced] of Object.entries(reducerLevelling.replacedParts)) {
        const row = rows[sku] as { parts: Array<Record<string, unknown>> } | undefined;
        if (!row) continue;
        const parts = row.parts.map(part => ({ ...part }));
        for (const { part, image, derivation } of replaced) { parts[part].image = image; parts[part].derivation = derivation; }
        out[sku] = { ...row, parts } as T;
    }
    return out;
}
