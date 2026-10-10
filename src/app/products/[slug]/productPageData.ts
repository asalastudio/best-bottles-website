import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type {
    PdpCompatibilityPayload,
    ProductGroupPayload,
    SiblingGroup,
    ProductVariant,
} from "./ProductDetailClient";
import { client as sanityClient, isSanityConfigured } from "@/sanity/lib/client";
import { unstable_cache } from "next/cache";
import { filterVariantsForProductGroup, isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import { filterVariantsForGroupIntent } from "@/lib/products/group-variant-intent";
import type { PdpBlock } from "@/components/PdpBlocks";
import { loadPlatesForVariants } from "@/lib/paper-doll/plates";
import {
    selectPrimaryProductVariant,
    type FocusedPdpRelations,
} from "@/lib/products/pdp-relations";
import type { PdpRedesignPayload } from "@/components/pdp/PdpRedesignPage";
import { parseProductSlug } from "@/lib/products/group-variant-intent";
import { isVariantCardFamily } from "@/lib/products/variant-cards";
import { resolveItemDescriptions } from "@/lib/products/item-description/resolve";
import { collectionDescription, collectionFor, type SiblingGlassGroup } from "@/lib/products/pdp-redesign/model";
import type { KitLike } from "@/lib/products/pdp-redesign/stage";
import { loadRegisterKits } from "@/lib/register/load";
import { loadGlassStageEnvelopes } from "@/lib/register/stage-envelopes";
import { isSoldOutStockStatus } from "@/lib/checkout";

function getConvexClient() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is required to render product pages.");
    return new ConvexHttpClient(url);
}

export function isShopifyCdnImageUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    try {
        return new URL(value).hostname === "cdn.shopify.com";
    } catch {
        return value.includes("cdn.shopify.com/");
    }
}

export function isPreferredProductImageUrl(value: string | null | undefined): boolean {
    return isShopifyCdnImageUrl(value) && !isLegacyBestBottlesImageUrl(value);
}

export async function getProductData(slug: string): Promise<ProductGroupPayload | null> {
    const data = await getConvexClient().query(api.products.getProductGroup, { slug }) as ProductGroupPayload | null;
    if (!data) return null;
    return {
        ...data,
        variants: filterVariantsForGroupIntent(slug, filterVariantsForProductGroup(data.group, data.variants)),
    };
}

export function getPrimaryVariant(data: ProductGroupPayload | null): ProductVariant | null {
    if (!data) return null;
    return selectPrimaryProductVariant(data.group, data.variants);
}

export async function getSiblingGroups(data: ProductGroupPayload | null, activeSlug: string): Promise<SiblingGroup[]> {
    const group = data?.group;
    if (!group) return [];
    return await getConvexClient().query(api.products.getSiblingGroups, {
        family: group.family,
        capacityMl: group.capacityMl ?? 0,
        excludeSlug: activeSlug,
        neckThreadSize: group.neckThreadSize ?? undefined,
    }) as SiblingGroup[];
}

export async function getFocusedPdpRelations(activeSlug: string): Promise<FocusedPdpRelations | null> {
    return await getConvexClient().query(api.products.getFocusedPdpRelations, {
        slug: activeSlug,
    }) as FocusedPdpRelations | null;
}

export async function getPrimaryCompatibility(data: ProductGroupPayload | null): Promise<PdpCompatibilityPayload | null> {
    const primaryVariant = getPrimaryVariant(data);
    const primaryWebsiteSku = primaryVariant?.websiteSku?.trim();
    if (primaryWebsiteSku) {
        return await getConvexClient().query(api.grace.getBottleComponents, {
            websiteSku: primaryWebsiteSku,
        }) as PdpCompatibilityPayload | null;
    }
    const primaryGraceSku = primaryVariant?.graceSku?.trim();
    if (!primaryGraceSku) return null;
    return await getConvexClient().query(api.grace.getBottleComponents, {
        graceSku: primaryGraceSku,
    }) as PdpCompatibilityPayload | null;
}

export async function getPdpBlocks(activeSlug: string, family: string | null | undefined): Promise<PdpBlock[]> {
    if (!isSanityConfigured || !activeSlug || !family) return [];
    try {
        // Published content only. sanityFetch() reads draft mode and would make
        // this route dynamic, which streams the LCP image after the loading shell.
        const [groupContent, familyContent] = await Promise.all([
            sanityClient.fetch<{ pageBlocks?: PdpBlock[]; overrideTemplate?: boolean } | null>(
                `*[_type == "productGroupContent" && slug.current == $slug][0] { pageBlocks, overrideTemplate }`,
                { slug: activeSlug },
            ),
            sanityClient.fetch<{ pageBlocks?: PdpBlock[] } | null>(
                `*[_type == "productFamilyContent" && family == $family][0] { pageBlocks }`,
                { family },
            ),
        ]);
        const groupBlocks = groupContent?.pageBlocks ?? [];
        const familyBlocks = familyContent?.pageBlocks ?? [];
        return groupContent?.overrideTemplate ? groupBlocks : [...groupBlocks, ...familyBlocks];
    } catch {
        return [];
    }
}

/**
 * The redesigned product page (design 3a/4a) serves every group whose slug
 * follows the bottle grammar (<family>-<ml>ml-<colour>-<neck>[-<closure>]) and
 * sells at least one SKU. Components, packaging and the odd slug keep the
 * classic page. `NEXT_PUBLIC_PDP_REDESIGN=off` restores the classic page
 * everywhere.
 */
export function redesignApplies(slug: string, data: ProductGroupPayload): boolean {
    if (process.env.NEXT_PUBLIC_PDP_REDESIGN === "off") return false;
    if (data.variants.length === 0) return false;
    if (isVariantCardFamily(data.group.family)) return false;
    return parseProductSlug(slug) !== null;
}

/** The fitment groups a cap-only glass is also sold as, in the strip's order (spray, then roller). */
const STRIP_FITMENT_CLOSURES = ["finemist", "rollon"] as const;

export async function loadRedesignPayload(
    data: ProductGroupPayload,
    activeSlug: string,
    siblingGroups: SiblingGroup[],
    platesBySku: Record<string, { image: string; imageCapOff: string | null }>,
): Promise<PdpRedesignPayload> {
    const convex = getConvexClient();
    const siblings: SiblingGlassGroup[] = await Promise.all(siblingGroups.map(async (sibling) => {
        try {
            const payload = await convex.query(api.products.getProductGroup, { slug: sibling.slug }) as ProductGroupPayload | null;
            const variants = payload ? filterVariantsForGroupIntent(sibling.slug, filterVariantsForProductGroup(payload.group, payload.variants)) : [];
            const primary = payload ? selectPrimaryProductVariant(payload.group, variants) : null;
            // The bare body is the same layer on every SKU of a glass; keep a few candidates so a
            // primary SKU without a published kit still gets its body from a sibling SKU.
            const candidates = [primary, ...variants.filter((variant) => variant !== primary).slice(0, 2)]
                .filter((variant): variant is ProductVariant => Boolean(variant));
            return {
                slug: sibling.slug,
                color: sibling.color,
                displayName: sibling.displayName,
                primaryWebsiteSku: primary?.websiteSku ?? payload?.group.primaryWebsiteSku ?? null,
                primaryGraceSku: primary?.graceSku ?? payload?.group.primaryGraceSku ?? null,
                bodyCandidates: candidates.map((variant) => ({ websiteSku: variant.websiteSku ?? null, graceSku: variant.graceSku ?? null })),
                inStock: variants.some((variant) => !isSoldOutStockStatus(variant.stockStatus) && variant.shopifySellable !== false),
            };
        } catch {
            return { slug: sibling.slug, color: sibling.color, displayName: sibling.displayName };
        }
    }));

    // Kits for this group's SKUs plus each sibling's primary body, 50 pairs per call.
    const pairs = [
        ...data.variants.map((variant) => ({ websiteSku: variant.websiteSku ?? null, graceSku: variant.graceSku ?? null })),
        ...siblings.flatMap((sibling) => sibling.bodyCandidates ?? [{ websiteSku: sibling.primaryWebsiteSku ?? null, graceSku: sibling.primaryGraceSku ?? null }]),
    ].filter((pair) => pair.websiteSku || pair.graceSku);
    // The component register first: one body plate per glass and the component
    // library's layers, every SKU of a body on one fixed datum, so swapping a cap
    // or the glass never moves the bottle. Only the SKUs it cannot draw read
    // their published per-SKU kit.
    const kitsBySku: Record<string, KitLike | null> = {};
    const registerKits = await loadRegisterKits(convex, pairs.map((pair) => pair.graceSku));
    const pending: typeof pairs = [];
    for (const pair of pairs) {
        const kit = (pair.graceSku ? registerKits[pair.graceSku] : null) ?? (pair.websiteSku ? registerKits[pair.websiteSku] : null) ?? null;
        if (!kit) { pending.push(pair); continue; }
        if (pair.websiteSku) kitsBySku[pair.websiteSku] = kit;
        if (pair.graceSku) kitsBySku[pair.graceSku] = kit;
    }
    // One frame per glass: the bounds every SKU of this glass needs, across all its colours and
    // closures (cached per glass), read while the published kits load.
    const stageEnvelopesLoad = Object.keys(registerKits).length
        ? loadGlassStageEnvelopes({ family: data.group.family, capacityMl: data.group.capacityMl ?? null })
        : Promise.resolve({});
    for (let index = 0; index < pending.length; index += 50) {
        try {
            const chunk = await convex.query(api.productKits.forSkus, { pairs: pending.slice(index, index + 50) });
            for (const [key, kit] of Object.entries(chunk)) {
                kitsBySku[key] = kit as KitLike | null;
                if (kit) {
                    const owner = pending.find((pair) => pair.websiteSku === key || pair.graceSku === key);
                    if (owner?.websiteSku) kitsBySku[owner.websiteSku] = kit as KitLike;
                    if (owner?.graceSku) kitsBySku[owner.graceSku] = kit as KitLike;
                }
            }
        } catch (error) {
            console.error("[pdp] kit lookup failed; rendering without layers", error);
        }
    }

    // A cap-only group has no fitment of its own: the Build Your Bottle strip's fitment tile shows this
    // glass's sprayer and both roller inserts, and its cap tile adds the roll-on caps that come with the
    // rollers (Jordan 2026-09-28), from every SKU of those groups.
    const fitmentKits: KitLike[] = [];
    if (parseProductSlug(activeSlug)?.closure === null) {
        const groups = await Promise.all(STRIP_FITMENT_CLOSURES.map(async (closure) => {
            try {
                const payload = await convex.query(api.products.getProductGroup, { slug: `${activeSlug}-${closure}` }) as ProductGroupPayload | null;
                return payload ? filterVariantsForGroupIntent(`${activeSlug}-${closure}`, filterVariantsForProductGroup(payload.group, payload.variants)) : [];
            } catch {
                return [];
            }
        }));
        const found = groups.flat().filter((variant) => Boolean(variant.graceSku));
        const kits = found.length ? await loadRegisterKits(convex, found.map((variant) => variant.graceSku)).catch(() => ({} as Record<string, KitLike>)) : {};
        for (const variant of found) {
            const kit = kits[variant.graceSku] ?? (variant.websiteSku ? kits[variant.websiteSku] : undefined);
            if (kit) fitmentKits.push(kit as KitLike);
        }
    }

    const band = collectionFor(data.group);
    let collection: PdpRedesignPayload["collection"] = null;
    if (band) {
        try {
            const groups = await convex.query(api.products.getShopCollectionGroups, {});
            collection = { band, description: collectionDescription(band, groups) };
        } catch {
            collection = { band, description: band.subtitle };
        }
    }

    return {
        slug: activeSlug,
        group: data.group,
        variants: data.variants,
        siblings,
        kitsBySku,
        fitmentKits,
        stageEnvelopes: await stageEnvelopesLoad,
        platesBySku,
        descriptions: resolveItemDescriptions(data.variants),
        collection,
        familyHref: `/catalog?family=${encodeURIComponent(data.group.family)}`,
    };
}

export const loadCachedGroup = unstable_cache(async (slug: string) => {
    const data = await getProductData(slug);
    return data ? JSON.parse(JSON.stringify(data)) as ProductGroupPayload : null;
}, ["pdp-group-v2"], { revalidate: 300 });

export const loadCachedPage = unstable_cache(async (slug: string) => {
    const data = await getProductData(slug);
    if (!data) return null;
    const siblingGroups = await getSiblingGroups(data, slug);
    const platesBySku = await loadPlatesForVariants(
        getConvexClient(),
        (data.variants ?? []).flatMap((variant) => [variant.graceSku, variant.websiteSku]),
        slug,
    );
    if (redesignApplies(slug, data)) {
        const payload = await loadRedesignPayload(data, slug, siblingGroups, platesBySku);
        return JSON.parse(JSON.stringify({ kind: "redesign" as const, data, payload })) as {
            kind: "redesign";
            data: ProductGroupPayload;
            payload: PdpRedesignPayload;
        };
    }
    const [pdpBlocks, relations, compatibility] = await Promise.all([
        getPdpBlocks(slug, data.group.family),
        getFocusedPdpRelations(slug),
        getPrimaryCompatibility(data),
    ]);
    return JSON.parse(JSON.stringify({
        kind: "classic" as const,
        data,
        siblingGroups,
        platesBySku,
        pdpBlocks,
        relations,
        compatibility,
    })) as {
        kind: "classic";
        data: ProductGroupPayload;
        siblingGroups: SiblingGroup[];
        platesBySku: Awaited<ReturnType<typeof loadPlatesForVariants>>;
        pdpBlocks: PdpBlock[];
        relations: FocusedPdpRelations | null;
        compatibility: PdpCompatibilityPayload | null;
    };
}, ["pdp-page-v2"], { revalidate: 300 });

