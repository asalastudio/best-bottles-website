/**
 * Register masters (PNG plates and layers at native resolution) are served
 * display-sized through the optimizer. On a machine where the optimizer cannot
 * reach the Blob host (a local network quirk: the request 400s while the
 * deployed proxy serves the same URL), an <img> falls back to the master and
 * this remembers the failed source for the rest of the session. A single
 * failure must not send every other multi-megabyte master to the browser.
 * Module state only: the
 * server render and the first client render agree, and the flag flips after.
 */
import { displayImageUrl, isRegisterAssetUrl, type DisplayImageWidth } from "./optimizable-image";
import { displayDerivativeSrcSet, displayDerivativeUrl } from "./display-derivative";

const unavailableSources = new Set<string>();

export function registerImageSrc(url: string, width: DisplayImageWidth): string {
    if (unavailableSources.has(url)) return url;
    return displayImageUrl(url, width);
}

export function registerImageSrcSet(url: string): string | undefined {
    return unavailableSources.has(url) ? undefined : displayDerivativeSrcSet(url);
}

/** Call from an <img>'s onError. True when the failing URL was an optimized register asset, so the caller should show the master. */
export function markRegisterOptimizerUnavailable(url: string): boolean {
    if (!isRegisterAssetUrl(url) && !displayDerivativeUrl(url, 640)) return false;
    unavailableSources.add(url);
    return true;
}

export function isRegisterOptimizerUnavailable(): boolean {
    return unavailableSources.size > 0;
}
