import { readFileSync } from 'node:fs';
import { beforePillarRelease } from './pillar-release-2026-11-04';

/** The Diva review masters' release (scripts/paperdoll/publish-diva-masters.mjs, 4 Nov 2026): 179 new recipes, none
 * replaced. Earlier release tests check their baselines against the approved recipes as they stood before it. */
const release = JSON.parse(readFileSync('docs/reviews/hosted-diva-masters-2026-11-04/release-manifest.json', 'utf8')) as
    { publishedSkus: string[]; replacedSkus: string[] };
export const divaReleaseSkus = release.publishedSkus;
export function beforeDivaRelease<T>(rows: Record<string, T>): Record<string, T> {
    // Also before the later Pillar release (4 Nov 2026), so Diva's own baseline stays exact.
    return Object.fromEntries(Object.entries(beforePillarRelease(rows)).filter(([sku]) => !divaReleaseSkus.includes(sku)));
}
