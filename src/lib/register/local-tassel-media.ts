import assets from './local-tassel-assets.json';
import type { RegisterKit } from './stage-kit';

/** Local review only. Apply AFTER composition: seat measurements are keyed by
 * the original layer URLs. The prepared crops preserve their exact pixel datum.
 * Production retains its existing hosted images until a separately approved release.
 */
export function localTasselMedia(kit: RegisterKit): RegisterKit {
    if (process.env.NODE_ENV !== 'development') return kit;
    let changed = false;
    const parts = kit.parts.map(part => {
        if (part.slot !== 'sprayer') return part;
        const asset = assets.find(a => a.componentId === part.componentId
            && a.sourceUrl === part.image.url
            && a.sourceWidth === part.image.width && a.sourceHeight === part.image.height);
        if (!asset) return part;
        changed = true;
        return { ...part, image: { ...part.image, url: asset.url, key: asset.url,
            sha256: asset.sha256, bytes: asset.bytes } };
    });
    return changed ? { ...kit, parts } : kit;
}
