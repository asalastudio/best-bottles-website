import { getFinishFromWebsiteSku } from "@/lib/paper-doll/tokens.generated";
import reviewedCapPhotos from "./cylinder-cap-thumbnails.generated.json";
import localCloseUps from "./local-cap-close-ups.json";
import sprayTops from "./tall-cylinder-spray-tops.json";
import swatchBounds from "./cap-swatch-bounds.generated.json";
import psdPhotos from "./cap-swatch-photos.generated.json";
import psdOptions from "./cap-swatch-photo-options.generated.json";
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
    { platesLoaded = true }: { platesLoaded?: boolean } = {},
): string | undefined {
    const exact = catalogCapExactPhoto(preview, kind, failed);
    if (exact !== null) return exact;
    const plate = catalogCapPlatePhoto(preview, rows, kind, failed);
    if (plate) return plate;
    // The PSD cut-out only fills a finish the plate index has no photo for, so it is held back
    // until the plates have answered: a card never swaps one photo of a cap for another.
    if (!platesLoaded) return undefined;
    const psd = catalogCapPsdPhoto(preview.websiteSku);
    return psd && !failed.has(psd.url) ? psd.url : undefined;
}

/**
 * A photo chosen for this exact SKU, ahead of any index: a Tall Cylinder spray top, a localhost close-up
 * under review, or a reviewed cap thumbnail. Null when there is none, so the indexes decide; undefined
 * when the SKU's spray top failed to load (that family never falls back to the mixed index).
 */
export function catalogCapExactPhoto(
    preview: ProductCardVariantPreview,
    kind: CatalogCapKind,
    failed: ReadonlySet<string> = new Set(),
): string | undefined | null {
    const top = kind === "sprayer" && preview.websiteSku
        ? (sprayTops as Record<string, (typeof sprayTops)[keyof typeof sprayTops]>)[preview.websiteSku] : undefined;
    // This family has a complete spray-top set. Never fall back to the mixed
    // standalone index (some of those photographs are overcaps).
    if (top) return failed.has(top.url) ? undefined : top.url;
    // Close-ups under review (scripts/elegant-masters/cap-close-ups.py) are served from public/local-kits: localhost only.
    const local = process.env.NODE_ENV === "development" && preview.websiteSku
        ? (localCloseUps as Record<string, string>)[preview.websiteSku] : undefined;
    if (local && !failed.has(local)) return local;
    const exact = preview.websiteSku ? (reviewedCapPhotos as Record<string, string>)[preview.websiteSku] : undefined;
    if (exact && !failed.has(exact)) return exact;
    return null;
}

/** The finish's photograph in the live plate index of the cap's neck family, joined on finish. */
export function catalogCapPlatePhoto(
    preview: ProductCardVariantPreview,
    rows: CatalogCapPhoto[],
    kind: CatalogCapKind,
    failed: ReadonlySet<string> = new Set(),
): string | undefined {
    const finish = getFinishFromWebsiteSku(preview.websiteSku)?.label ?? preview.capLabel ?? preview.label;
    if (!finish) return undefined;
    return rows.find((row) => row.websiteSku
        && !failed.has(row.thumb)
        && TOP_SKU[kind].test(row.websiteSku)
        && getFinishFromWebsiteSku(row.websiteSku)?.label === finish)?.thumb;
}

export type CatalogCapPsdPhoto = { component: string; url: string; width: number; height: number; source: string };

/**
 * The component photograph cut from the PSD master library for an option that has no reviewed or
 * plate photo (scripts/catalog/build-cap-swatch-photos.py cuts them; map-cap-swatch-photos.mts maps
 * each catalog option to its component SKU). Served from the repo, trimmed to the part.
 */
export function catalogCapPsdPhoto(websiteSku: string | null | undefined): CatalogCapPsdPhoto | undefined {
    const component = websiteSku ? (psdOptions as Record<string, string>)[websiteSku] : undefined;
    const photo = component ? (psdPhotos as Record<string, Omit<CatalogCapPsdPhoto, "component">>)[component] : undefined;
    return photo && component ? { component, ...photo } : undefined;
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

/**
 * Where the part sits inside a cap photo, in pixels, so a swatch can show the
 * part alone: a spray top's box on its full bottle canvas, or the opaque area
 * of a reviewed close-up (measured by scripts/catalog/build-cap-swatch-bounds.mjs).
 * Undefined for photos never measured, such as the live plate index's.
 */
export function catalogCapPhotoBounds(url: string) {
    const spray = Object.values(sprayTops).find((photo) => photo.url === url);
    if (spray) return { width: spray.width, height: spray.height, ...spray.bounds };
    // A PSD cut-out is trimmed to the part already: its bounds are the whole image.
    const psd = Object.values(psdPhotos as Record<string, { url: string; width: number; height: number }>).find((photo) => photo.url === url);
    if (psd) return { width: psd.width, height: psd.height, left: 0, top: 0, right: psd.width, bottom: psd.height };
    const name = url.split("?")[0].split("/").pop() ?? "";
    const box = (swatchBounds as Record<string, number[]>)[name];
    if (!box) return undefined;
    const [width, height, left, top, right, bottom] = box;
    return { width, height, left, top, right, bottom };
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
