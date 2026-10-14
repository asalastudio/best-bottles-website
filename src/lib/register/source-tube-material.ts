import sources from './local-source-tubes.json';
import vintageTube from './local-empire-vintage-tube.json';

/** Exposed-tube lighting, applied to original source pixels only.
 * Brightness followed by contrast maps RGB c to 2.5*c - 1.5 (0..1).
 * White remains white; pale edge reflections gain contrast. Alpha, silhouette,
 * registration and tube length are untouched. Local pilot URLs only.
 * Inside the bottle, preserve the source's subtle through-glass lighting:
 * applying this exposed-part boost there makes it read as an exterior sticker.
 */
export function sourceTubeMaterialFilter(url: string, view: 'sidecar' | 'capon' | 'exploded'): string | undefined {
    // A slight neutral attenuation makes the complete pale native tube
    // visible through the empty glass without an opaque white centre.
    if (url === vintageTube.url && view !== 'exploded') return 'brightness(0.96)';
    return view === 'exploded' && sources.some(source => source.url === url)
        ? 'brightness(0.625) contrast(4)' : undefined;
}
