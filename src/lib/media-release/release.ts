import manifest from './manifest.json';

export const MEDIA_RELEASE_ID = manifest.revision;
export type MediaReleaseMode = 'off' | 'canary' | 'empire' | 'all';
/** Next inlines this public build setting identically in server and browser code.
 * Changing it requires a new build. There is no runtime/client toggle. */
export function mediaReleaseMode(): MediaReleaseMode {
    const value = process.env.NEXT_PUBLIC_BB_MEDIA_RELEASE;
    if (value === `${MEDIA_RELEASE_ID}:canary`) return 'canary';
    if (value === `${MEDIA_RELEASE_ID}:empire`) return 'empire';
    if (value === `${MEDIA_RELEASE_ID}:all`) return 'all';
    return 'off';
}
export function mediaRevision(): string {
    const mode = mediaReleaseMode();
    return mode === 'off' ? 'media-off-v1' : `${MEDIA_RELEASE_ID}:${mode}`;
}
export function releaseEntries() {
    const mode = mediaReleaseMode();
    return manifest.entries.filter(row => mode === 'all' || (mode === 'empire' && row.stage !== 'round') || (mode === 'canary' && row.stage === 'canary'));
}
export function releaseHero(sku?: string | null) {
    return releaseEntries().find(row => row.websiteSku === sku)?.hero ?? null;
}
export function releaseBodyImage(sku?: string | null) {
    return releaseEntries().find(row => row.websiteSku === sku)?.bodyImage ?? null;
}
export function isReleaseHero(hero?: { websiteSku: string; groupSlug: string; url: string } | null): boolean {
    const entry = releaseHero(hero?.websiteSku);
    return Boolean(entry && hero && entry.groupSlug === hero.groupSlug && entry.url === hero.url);
}
const sourceByReleaseUrl = new Map(Object.entries(manifest.assetMap).map(([source, released]) => [released, source]));
/** Material identity survives immutable URL promotion, including detached views. */
export function mediaSourceUrl(url: string): string {
    return sourceByReleaseUrl.get(url) ?? url;
}
export function builderMediaUrl(url: string): string {
    return `${url}${url.includes('?') ? '&' : '?'}mediaRevision=${encodeURIComponent(mediaRevision())}`;
}
export function acceptsMediaRevision(url: string): boolean {
    const requested = new URL(url).searchParams.get('mediaRevision');
    return requested === mediaRevision() || (!requested && mediaReleaseMode() === 'off');
}
