import { getFinishFromWebsiteSku } from "@/lib/paper-doll/tokens.generated";
import reviewedCapPhotos from "./cylinder-cap-thumbnails.generated.json";
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
    const exact = preview.websiteSku ? (reviewedCapPhotos as Record<string, string>)[preview.websiteSku] : undefined;
    if (exact && !failed.has(exact)) return exact;
    const finish = getFinishFromWebsiteSku(preview.websiteSku)?.label ?? preview.capLabel ?? preview.label;
    if (!finish) return undefined;
    return rows.find((row) => row.websiteSku
        && !failed.has(row.thumb)
        && TOP_SKU[kind].test(row.websiteSku)
        && getFinishFromWebsiteSku(row.websiteSku)?.label === finish)?.thumb;
}

export function catalogCapKind(applicators: readonly string[]): CatalogCapKind | null {
    if (applicators.length && applicators.every((value) => /roller|roll-on/i.test(value))) return "roller";
    if (applicators.length && applicators.every((value) => /^cap\/closure$/i.test(value))) return "plain";
    if (applicators.length && applicators.every((value) => /tassel/i.test(value))) return "antiqueTassel";
    if (applicators.length && applicators.every((value) => /antique|vintage|bulb/i.test(value))) return "antique";
    if (applicators.length && applicators.every((value) => /lotion.*pump/i.test(value))) return "pump";
    if (applicators.length && applicators.every((value) => /dropper/i.test(value))) return "dropper";
    if (applicators.length && applicators.every((value) => /spray|atomizer/i.test(value))) return "sprayer";
    return null;
}
