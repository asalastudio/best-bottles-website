import { stageLayout, type KitLike } from "./pdp-redesign/stage";
import { displayImageUrl } from "./optimizable-image";
import { isTolaApplicator, tolaAssemblyLayout } from "./tola-applicator";
import { displayDerivativeSrcSet, registeredImageSizes } from "./display-derivative";

/** Start only the selected assembly while the server reads supporting product
 * data. Use the painted URLs exactly, so preloading never downloads a second
 * master or all of the unselected closure finishes. */
export function pdpHeroImageUrls(kit: KitLike | null, websiteSku: string | null | undefined): string[] {
    return pdpHeroImagePreloads(kit, websiteSku).map(image => image.href);
}

export function pdpHeroImagePreloads(kit: KitLike | null, websiteSku: string | null | undefined) {
    const layout = isTolaApplicator(websiteSku) ? tolaAssemblyLayout()
        : kit ? stageLayout(kit, "sidecar", { websiteSku: websiteSku ?? undefined }) : null;
    const seen = new Set<string>();
    const backdrop = layout?.backdrop?.url;
    if (backdrop) seen.add(backdrop);
    return [...(backdrop ? [{ href: backdrop, imageSrcSet: undefined, imageSizes: undefined }] : []), ...(layout?.parts ?? []).flatMap(part => {
        const href = displayImageUrl(part.url, part.box ? 640 : 1200);
        if (seen.has(href)) return [];
        seen.add(href);
        return [{ href, imageSrcSet: part.box ? displayDerivativeSrcSet(part.url) : undefined,
            imageSizes: part.box ? registeredImageSizes(part.box.widthPct, layout!.frame.scale) : undefined }];
    })];
}
