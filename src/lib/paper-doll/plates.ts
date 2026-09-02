import type { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

type ByFamilyPage = FunctionReturnType<typeof api.productPlates.byFamily>;

/**
 * Static paper-doll plates.
 *
 * A plate is one finished photograph of one configuration. The bytes live on
 * object storage; the index lives in Convex (productPlates). There is no
 * CMS, no release gate and no runtime compositing: a row exists when its
 * object has been uploaded and verified, and the page reads the row.
 *
 * Every loader here degrades to "no plates" rather than throwing, because a
 * missing photograph must cost the customer the photograph — never the
 * product page and its add-to-cart. The stage already falls back to the
 * SKU's catalogue photo, then the group hero.
 */

export type PlateVariant = {
    sku: string;
    graceSku: string | null;
    closure: string;
    closureLabel: string;
    color: string;
    swatch: string;
    image: string;
    thumb: string;
    imageCapOff: string | null;
    thumbCapOff: string | null;
    price: number | null;
    stock: string | null;
    applicator: string | null;
    productUrl: string | null;
    capacityMl: string | null;
    sourcePsd: string;
};

export type PlateFamilyManifest = {
    id: string;
    name: string;
    neckFinish: string;
    canvas: { width: number; height: number };
    closures: { id: string; label: string; count: number }[];
    variants: PlateVariant[];
};

export type PlateFamilySummary = {
    id: string;
    name: string;
    neckFinish: string;
    variantCount: number;
};

/** What the product page needs per SKU. */
export type PlateRef = {
    image: string;
    imageCapOff: string | null;
    thumb?: string;
    thumbCapOff?: string | null;
};

/** The 9 mL · 17-415 Cylinder's family id (legacy id kept as an alias in the registry). */
export const PLATE_FAMILY_CYL9 = "cylinder-9ml-17-415";

/**
 * Plates for a product group's variants, keyed by the SKU strings passed in
 * (grace and website SKUs both resolve). Returns {} on any failure after
 * logging it: the page renders photographs, never nothing.
 */
export async function loadPlatesForVariants(
    convex: ConvexHttpClient,
    skus: Array<string | null | undefined>,
    context = "product-page",
): Promise<Record<string, PlateRef>> {
    const wanted = Array.from(new Set(skus.filter((s): s is string => Boolean(s && s.trim())).map((s) => s.trim())));
    if (wanted.length === 0) return {};
    try {
        const result = await convex.query(api.productPlates.forSkus, { skus: wanted });
        if (result.conflicts.length > 0) {
            console.error(`[plates] duplicate index rows for ${result.conflicts.join(", ")} (${context})`);
        }
        return result.plates;
    } catch (error) {
        console.error(`[plates] lookup failed (${context}); rendering without plates`, error);
        return {};
    }
}

export async function loadPlateFamilies(convex: ConvexHttpClient): Promise<PlateFamilySummary[]> {
    try {
        const families = await convex.query(api.productPlates.families, {});
        return families.map((f) => ({ id: f.familyId, name: f.name, neckFinish: f.neckFinish, variantCount: f.variantCount }));
    } catch (error) {
        console.error("[plates] families lookup failed", error);
        return [];
    }
}

/** A whole family for the lab swapper. Null when the family is not in the index — never a throw. */
export async function loadPlateFamily(convex: ConvexHttpClient, id: string): Promise<PlateFamilyManifest | null> {
    if (!/^[a-z0-9-]+$/.test(id)) return null;
    try {
        const families = await convex.query(api.productPlates.families, {});
        const family = families.find((f) => f.familyId === id);
        if (!family) return null;
        const variants: PlateVariant[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 50; page++) {
            const result: ByFamilyPage = await convex.query(api.productPlates.byFamily, { familyId: id, cursor, limit: 500 });
            for (const row of result.page) {
                const closure = row.sku;
                variants.push({
                    sku: row.sku,
                    graceSku: row.graceSku,
                    closure,
                    closureLabel: closure,
                    color: row.sku,
                    swatch: "#cccccc",
                    image: row.image,
                    thumb: row.thumb,
                    imageCapOff: row.imageCapOff,
                    thumbCapOff: row.thumbCapOff,
                    price: null,
                    stock: null,
                    applicator: null,
                    productUrl: null,
                    capacityMl: null,
                    sourcePsd: row.sourcePath,
                });
            }
            if (result.isDone) break;
            cursor = result.continueCursor;
        }
        return {
            id: family.familyId,
            name: family.name,
            neckFinish: family.neckFinish,
            canvas: family.canvas,
            closures: family.closures,
            variants,
        };
    } catch (error) {
        console.error(`[plates] family ${id} lookup failed`, error);
        return null;
    }
}
