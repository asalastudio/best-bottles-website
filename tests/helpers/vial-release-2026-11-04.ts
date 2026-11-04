import { readFileSync } from 'node:fs';
import { beforeDivaRelease } from './diva-release-2026-11-04';

/** The Vial review masters' release (scripts/paperdoll/publish-vial-masters.mjs, 4 Nov 2026): 12 new recipes, and
 * the four 2 ml vials' recipes replaced by the slimmer reshape. Earlier release tests check their baselines
 * against the approved recipes as they stood before it: the new SKUs left out, the replaced rows restored (and the
 * later Diva release, 4 Nov 2026, left out too). */
const directory = 'docs/reviews/hosted-vial-masters-2026-11-04/';
const release = JSON.parse(readFileSync(directory + 'release-manifest.json', 'utf8')) as { publishedSkus: string[]; replacedSkus: string[] };
const replaced = JSON.parse(readFileSync(directory + 'replaced-recipes.json', 'utf8')) as Record<string, unknown>;
export const vialReleaseNewSkus = release.publishedSkus.filter(sku => !release.replacedSkus.includes(sku));
export const vialReleaseReplacedSkus = release.replacedSkus;
export function beforeVialRelease<T>(rows: Record<string, T>): Record<string, T> {
    const out = Object.fromEntries(Object.entries(beforeDivaRelease(rows)).filter(([sku]) => !vialReleaseNewSkus.includes(sku)));
    for (const sku of release.replacedSkus) out[sku] = replaced[sku] as T;
    return out;
}
