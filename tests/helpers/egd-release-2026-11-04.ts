import { readFileSync } from 'node:fs';

/** The Empire, Grace and Diamond release (scripts/paperdoll/publish-egd-masters.mjs, 4 Nov 2026): 177 new recipes, none
 * replaced. Earlier release tests check their baselines against the approved recipes as they stood before it. */
const release = JSON.parse(readFileSync('docs/reviews/hosted-egd-masters-2026-11-04/release-manifest.json', 'utf8')) as
    { publishedSkus: string[]; replacedSkus: string[] };
export const egdReleaseSkus = release.publishedSkus;
export function beforeEgdRelease<T>(rows: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.entries(rows).filter(([sku]) => !egdReleaseSkus.includes(sku)));
}
