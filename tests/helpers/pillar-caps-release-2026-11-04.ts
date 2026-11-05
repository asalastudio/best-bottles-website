import { readFileSync } from 'node:fs';

/** The Pillar cap and roller release (scripts/paperdoll/publish-pillar-caps.mjs, 4 Nov 2026): 3 new recipes, none
 * replaced. Earlier release tests check their baselines against the approved recipes as they stood before it. */
const release = JSON.parse(readFileSync('docs/reviews/hosted-pillar-caps-2026-11-04/release-manifest.json', 'utf8')) as
    { publishedSkus: string[]; replacedSkus: string[] };
export const pillarCapsReleaseSkus = release.publishedSkus;
export function beforePillarCapsRelease<T>(rows: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.entries(rows).filter(([sku]) => !pillarCapsReleaseSkus.includes(sku)));
}
