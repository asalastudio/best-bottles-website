import { mediaSourceUrl } from '../media-release/release';
import additionalSprayTubes from './local-empire-additional-spray-tubes.json';
import empire100SprayTube from './local-empire-100ml-spray-tube.json';
import sources from './local-source-tubes.json';
import vintageTube from './local-empire-vintage-tube.json';
import round78 from './local-round78-tubes.json';
import round78Lotion from './local-round78-lotion-tubes.json';

/** Exposed-tube lighting, applied to original source pixels only.
 * Brightness followed by contrast maps RGB c to 2.5*c - 1.5 (0..1).
 * White remains white; pale edge reflections gain contrast. Alpha, silhouette,
 * registration and tube length are untouched. Local pilot URLs only.
 * Inside the bottle, preserve the source's subtle through-glass lighting:
 * applying this exposed-part boost there makes it read as an exterior sticker.
 */
export function sourceTubeMaterialFilter(url: string, view: 'sidecar' | 'capon' | 'exploded'): string | undefined {
    url = mediaSourceUrl(url);
    // Round's source is photographed through glass. Keep its white highlights
    // neutral: darkening them turns the entire pump into a gray silhouette.
    if (url === vintageTube.url && view !== 'exploded') return 'brightness(0.96)';
    return view === 'exploded' && ([empire100SprayTube, ...additionalSprayTubes].some(row => row.url === url) || sources.some(source => source.url === url) || url === round78.url || url === round78Lotion.url)
        ? 'brightness(0.625) contrast(4)' : undefined;
}
