import { readFileSync } from 'node:fs';
import { beforeEgdRelease } from './egd-release-2026-11-04';

/** The Pillar 9 ml sprayer release (scripts/paperdoll/publish-pillar-masters.mjs, 4 Nov 2026): 7 new recipes, none
 * replaced. Earlier release tests check their baselines against the approved recipes as they stood before it. */
const release = JSON.parse(readFileSync('docs/reviews/hosted-pillar-masters-2026-11-04/release-manifest.json', 'utf8')) as
    { publishedSkus: string[]; replacedSkus: string[] };
export const pillarReleaseSkus = release.publishedSkus;
export function beforePillarRelease<T>(rows: Record<string, T>): Record<string, T> {
    // Also before the later Empire/Grace/Diamond release (4 Nov 2026), so Pillar's own baseline stays exact.
    return Object.fromEntries(Object.entries(beforeEgdRelease(rows)).filter(([sku]) => !pillarReleaseSkus.includes(sku)));
}
