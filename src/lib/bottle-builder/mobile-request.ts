import type { BuilderBody } from "@/lib/bottle-builder/model";
import { clearBodyPreview, previewParts } from "@/lib/bottle-builder/model";

/** First-paint mobile signal from the request. matchMedia still corrects after hydrate. */
export function preferMobileRequest(headerList: { get(name: string): string | null }) {
    const hint = headerList.get("sec-ch-ua-mobile");
    if (hint === "?1") return true;
    if (hint === "?0") return false;
    return /iPhone|iPod|Android.+Mobile|Mobile.*Safari|webOS|BlackBerry/i.test(headerList.get("user-agent") ?? "");
}

export function chooserImageUrl(body: BuilderBody) {
    const preview = clearBodyPreview(body);
    return previewParts(preview, "body")[0]?.image.url ?? preview.bodyImage?.url;
}

/** Mobile 2-column chooser keeps about 12 tiles in or at the first viewport.
 * Those must start immediately — lazy + fetchPriority=low left tiles 8–12 blank. */
export const CHOOSER_PRIORITY_TILES = 12;

export function chooserPreloadUrls(bodies: BuilderBody[], count = CHOOSER_PRIORITY_TILES) {
    return [...new Set(bodies.map(chooserImageUrl).filter((url): url is string => Boolean(url)))].slice(0, count);
}
