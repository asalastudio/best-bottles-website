import materials from '../media-release/exposed-tube-materials.json';
import manifest from '../media-release/manifest.json';

/** Approved exposed-tube lighting. No alpha, silhouette or geometry changes.
 * Seated tubes retain their captured through-glass appearance. */
export function sourceTubeMaterialFilter(url: string, view: 'sidecar' | 'capon' | 'exploded'): string | undefined {
    const released = (manifest.assetMap as Record<string, string>)[url] ?? url;
    return view === 'exploded' ? (materials as Record<string, string>)[released] : undefined;
}
