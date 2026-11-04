import { readFileSync } from 'node:fs';
import { beforePillarCapsRelease } from './pillar-caps-release-2026-11-04';

/** The Empire, Grace and Diamond release (scripts/paperdoll/publish-egd-masters.mjs, 4 Nov 2026): 177 new recipes, none
 * replaced. Earlier release tests check their baselines against the approved recipes as they stood before it. */
const release = JSON.parse(readFileSync('docs/reviews/hosted-egd-masters-2026-11-04/release-manifest.json', 'utf8')) as
    { publishedSkus: string[]; replacedSkus: string[] };
export const egdReleaseSkus = release.publishedSkus;
export function beforeEgdRelease<T>(rows: Record<string, T>): Record<string, T> {
    // Also before the later Pillar cap and roller release (4 Nov 2026).
    return Object.fromEntries(Object.entries(beforePillarCapsRelease(rows)).filter(([sku]) => !egdReleaseSkus.includes(sku)));
}
