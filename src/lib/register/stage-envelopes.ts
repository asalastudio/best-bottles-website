/**
 * One frame per glass on the product page (size-consistency audit 2026-09-27).
 *
 * A product page lists one colour and one closure type, but a glass sells in
 * several of each (Diva 46 mL: 88 SKUs on 12 pages). Framed to its own parts,
 * a SKU with a tall sprayer or a wide cap parked beside the glass drew that
 * glass up to a third smaller than its siblings. Every SKU of a register body
 * stands on the body's datum, so their bounds share one coordinate system: the
 * envelope is those bounds merged, and every page of the glass frames to it.
 * This is Build Your Bottle's rule (`builderBodyFrame`) on the product page,
 * with one exception: each hanging top (the vintage bulb sprayers) sells on
 * its own pages and shares an envelope only with its own kind
 * (`stageFrameKey`, from the catalogue applicator the pages are built from).
 *
 * The SKUs are every variant the catalogue lists for the glass's family and
 * capacity (all colours, closures and neck labels; a group's neck label can be
 * wrong, and the kits sort themselves by register body), drawn by the register
 * exactly as the page draws them. Cached for an hour per family and capacity
 * under the builder's `bottle-components` tag. A failed read is thrown, so it
 * is never cached, and the page frames to its own kits instead.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import type { ConvexHttpClient } from "convex/browser";
import { createResilientConvexHttpClient } from "@/lib/convexServerClient";
import { api } from "../../../convex/_generated/api";
import { drawableRegisterKits, registerStageEnabled } from "./load";
import type { RegisterKit, RegisterStagePayload } from "./stage-kit";
import { stageEnvelope, stageFrameKey } from "@/lib/products/pdp-redesign/stage";
import type { StageBounds } from "@/lib/products/pdp-stage-frame";

const CHUNK = 50;
const ENVELOPE_CACHE_SECONDS = 60 * 60;

/** The catalogue's family and capacity of a page's glass. */
export type StageGlass = { family: string; capacityMl: number | null };

/** The envelopes by frame key of the glasses a family sells at one capacity: every SKU's frame bounds, merged per key. */
export async function glassStageEnvelopes(convex: Pick<ConvexHttpClient, "query">, glass: StageGlass): Promise<Record<string, StageBounds>> {
    const groups = (await convex.query(api.products.getGroupsByFamily, { family: glass.family }))
        .filter((group) => (group.capacityMl ?? null) === glass.capacityMl);
    if (!groups.length) return {};
    const listed = await convex.query(api.products.getCatalogGroupVariantPreviewData, { groupIds: groups.map((group) => String(group._id)) });
    const applicatorOf = new Map<string, string | null>();
    for (const { variants } of listed) {
        for (const variant of variants) {
            if (variant.graceSku && !/__RETIRED__/i.test(variant.websiteSku ?? "")) applicatorOf.set(variant.graceSku, variant.applicator);
        }
    }
    const skus = [...applicatorOf.keys()];
    const kits = new Map<string, RegisterKit[]>();
    for (let index = 0; index < skus.length; index += CHUNK) {
        const chunk = skus.slice(index, index + CHUNK);
        const drawable = drawableRegisterKits(await convex.query(api.registerStage.forSkus, { graceSkus: chunk }) as RegisterStagePayload);
        for (const sku of chunk) {
            const kit = drawable[sku];
            if (!kit) continue;
            const key = stageFrameKey(kit.register.bodyId, applicatorOf.get(sku));
            kits.set(key, [...(kits.get(key) ?? []), kit]);
        }
    }
    const envelopes: Record<string, StageBounds> = {};
    for (const [key, list] of kits) {
        const envelope = stageEnvelope(list);
        if (envelope) envelopes[key] = envelope;
    }
    return envelopes;
}

const cachedGlassEnvelopes = unstable_cache(
    async (family: string, capacityMl: number | null) =>
        glassStageEnvelopes(createResilientConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!), { family, capacityMl }),
    ["pdp-glass-stage-envelopes-v1"],
    { revalidate: ENVELOPE_CACHE_SECONDS, tags: ["bottle-components"] },
);

/** Envelopes by frame key for the glass a page sells; empty when they cannot be read (each SKU then frames with its page). */
export async function loadGlassStageEnvelopes(glass: StageGlass): Promise<Record<string, StageBounds>> {
    if (!registerStageEnabled() || !glass.family) return {};
    try {
        return await cachedGlassEnvelopes(glass.family, glass.capacityMl);
    } catch (error) {
        if (process.env.NODE_ENV !== "production") console.warn(`[register] no stage envelopes for ${glass.family} ${glass.capacityMl} ml; framing with the page's own kits`, error instanceof Error ? error.message : error);
        return {};
    }
}
