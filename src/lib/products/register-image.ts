/**
 * Register masters (PNG plates and layers at native resolution) are served
 * display-sized through the optimizer. On a machine where the optimizer cannot
 * reach the Blob host (a local network quirk: the request 400s while the
 * deployed proxy serves the same URL), an <img> falls back to the master and
 * this remembers it for the rest of the session, so later renders go straight
 * to the master instead of failing once per image. Module state only: the
 * server render and the first client render agree, and the flag flips after.
 */
import { displayImageUrl, isRegisterAssetUrl, type DisplayImageWidth } from "./optimizable-image";

let optimizerUnavailable = false;

export function registerImageSrc(url: string, width: DisplayImageWidth): string {
    if (optimizerUnavailable && isRegisterAssetUrl(url)) return url;
    return displayImageUrl(url, width);
}

/** Call from an <img>'s onError. True when the failing URL was an optimized register asset, so the caller should show the master. */
export function markRegisterOptimizerUnavailable(url: string): boolean {
    if (!isRegisterAssetUrl(url)) return false;
    optimizerUnavailable = true;
    return true;
}

export function isRegisterOptimizerUnavailable(): boolean {
    return optimizerUnavailable;
}
