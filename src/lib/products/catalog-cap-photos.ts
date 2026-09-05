import { getFinishFromWebsiteSku } from "@/lib/paper-doll/tokens.generated";
import reviewedCapPhotos from "./cylinder-cap-thumbnails.generated.json";
import sprayTops from "./tall-cylinder-spray-tops.json";
import type { ProductCardVariantPreview } from "./product-card-variant-previews";

export type CatalogCapPhoto = { websiteSku: string | null; thumb: string };
export type CatalogCapKind = "roller" | "plain" | "sprayer" | "pump" | "dropper" | "antique" | "antiqueTassel";

export const CATALOG_CAP_FAMILY: Record<CatalogCapKind, string> = {
    roller: "roll-on-cap", plain: "cap-closure", sprayer: "sprayer",
    pump: "lotion-pump", dropper: "dropper", antique: "sprayer", antiqueTassel: "sprayer",
};
const TOP_SKU: Record<CatalogCapKind, RegExp> = {
    roller: /^CPRoll/i, plain: /^CP(?!Roll)/i, sprayer: /^(?:Spry|CP\d{2,3}-\d{3}Spry)/i, pump: /^Ltn/i, dropper: /^Drp/i,
    antique: /^(?:AnSp(?!Tsl)|CP\d{2,3}-\d{3}AnSp(?!Tsl))/i,
    antiqueTassel: /^(?:AnSpTsl|CP\d{2,3}-\d{3}AnSpTsl)/i,
};

/** A finish alone is not a component identity. Preserve dotted/short/tall
 * modifiers and restrict the join to caps in the correct neck family. */
export function catalogCapPhoto(
    preview: ProductCardVariantPreview,
    rows: CatalogCapPhoto[],
    kind: CatalogCapKind,
    failed: ReadonlySet<string> = new Set(),
): string | undefined {
    const top = kind === "sprayer" && preview.websiteSku
        ? (sprayTops as Record<string, (typeof sprayTops)[keyof typeof sprayTops]>)[preview.websiteSku] : undefined;
    // This family has a complete spray-top set. Never fall back to the mixed
    // standalone index (some of those photographs are overcaps).
    if (top) return failed.has(top.url) ? undefined : top.url;
    const exact = preview.websiteSku ? (reviewedCapPhotos as Record<string, string>)[preview.websiteSku] : undefined;
    if (exact && !failed.has(exact)) return exact;
    const finish = getFinishFromWebsiteSku(preview.websiteSku)?.label ?? preview.capLabel ?? preview.label;
    if (!finish) return undefined;
    return rows.find((row) => row.websiteSku
        && !failed.has(row.thumb)
        && TOP_SKU[kind].test(row.websiteSku)
        && getFinishFromWebsiteSku(row.websiteSku)?.label === finish)?.thumb;
}

/** Frame the existing transparent kit layer without altering its pixels. */
export function catalogCapPhotoFrame(url: string) {
    const top = Object.values(sprayTops).find((photo) => photo.url === url);
    if (!top) return undefined;
    const { left, right, top: y, bottom } = top.bounds;
    const scale = 0.9 / Math.max(right - left, bottom - y);
    return {
        width: `${top.width * scale * 100}%`, height: `${top.height * scale * 100}%`,
        left: `${((1 - (right - left) * scale) / 2 - left * scale) * 100}%`,
        top: `${((1 - (bottom - y) * scale) / 2 - y * scale) * 100}%`,
    };
}

export function catalogCapKind(applicators: readonly string[], previews: readonly ProductCardVariantPreview[] = []): CatalogCapKind | null {
    // Cap-only imports can have no applicator at all. Require actual cap
    // finish previews rather than treating every empty applicator list as caps.
    if (!applicators.length && previews.length > 0 && previews.every((preview) => preview.optionType === "capColor")) return "plain";
    if (applicators.length && applicators.every((value) => /roller|roll-on/i.test(value))) return "roller";
    if (applicators.length && applicators.every((value) => /^cap\/closure$/i.test(value))) return "plain";
    if (applicators.length && applicators.every((value) => /tassel/i.test(value))) return "antiqueTassel";
    if (applicators.length && applicators.every((value) => /antique|vintage|bulb/i.test(value))) return "antique";
    if (applicators.length && applicators.every((value) => /lotion.*pump/i.test(value))) return "pump";
    if (applicators.length && applicators.every((value) => /dropper/i.test(value))) return "dropper";
    if (applicators.length && applicators.every((value) => /spray|atomizer/i.test(value))) return "sprayer";
    return null;
}
