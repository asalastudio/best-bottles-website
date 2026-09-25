import { readKitPilot } from "../../../../scripts/asset-ledger/kit-pilot.mjs";
import { localPdpComponentKits } from "@/lib/paper-doll/local-component-kits";
import { hasCatalogSourceHold } from "@/lib/products/catalog-listing-visibility";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import ProductDetailClient, {
    type PdpCompatibilityPayload,
    type ProductGroupPayload,
    type SiblingGroup,
    type ProductVariant,
} from "./ProductDetailClient";
import { isSanityConfigured } from "@/sanity/lib/client";
import { sanityFetch } from "@/sanity/lib/live";
import SanityLiveVisualEditing from "@/components/SanityLiveVisualEditing";
import Footer from "@/components/Footer";
import { SITE_NAME, SITE_URL, buildBreadcrumbJsonLd, buildProductJsonLd } from "@/lib/seo";
import { chooseCanonicalProductDescription } from "@/lib/canonicalProduct";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getLegacyProductRouteOverride } from "@/lib/products/legacy-product-route-overrides";
import { resolveProductPageRedirectTarget } from "@/lib/products/pdp-redirect";
import { filterVariantsForProductGroup, isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import { filterVariantsForGroupIntent } from "@/lib/products/group-variant-intent";
import type { PdpBlock } from "@/components/PdpBlocks";
import { loadPlatesForVariants } from "@/lib/paper-doll/plates";
import { atomizerVariantCardName, isVariantCardFamily, withReleasedHeroStages } from "@/lib/products/variant-cards";
import { getReleasedCatalogHero } from "@/lib/products/catalog-heroes";
import { headers } from "next/headers";
import { readCompletion } from "../../../../scripts/asset-ledger/plate-completion.mjs";
import { localBostonPreview, previewPlates } from "../../../../scripts/asset-ledger/product-preview.mjs";
import {
    selectPrimaryProductVariant,
    type FocusedPdpRelations,
} from "@/lib/products/pdp-relations";
import PdpRedesignPage, { type PdpRedesignPayload } from "@/components/pdp/PdpRedesignPage";
import { parseProductSlug } from "@/lib/products/group-variant-intent";
import { resolveItemDescriptions } from "@/lib/products/item-description/resolve";
import { collectionDescription, collectionFor, derivePicks, resolveVariant, type SiblingGlassGroup } from "@/lib/products/pdp-redesign/model";
import type { KitLike } from "@/lib/products/pdp-redesign/stage";
import { loadRegisterKits } from "@/lib/register/load";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getConvexClient() {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is required to render product pages.");
    return new ConvexHttpClient(url);
}

function isShopifyCdnImageUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    try {
        return new URL(value).hostname === "cdn.shopify.com";
    } catch {
        return value.includes("cdn.shopify.com/");
    }
}

function isPreferredProductImageUrl(value: string | null | undefined): boolean {
    return isShopifyCdnImageUrl(value) && !isLegacyBestBottlesImageUrl(value);
}

async function getProductData(slug: string): Promise<ProductGroupPayload | null> {
    const data = await getConvexClient().query(api.products.getProductGroup, { slug }) as ProductGroupPayload | null;
    if (!data) return null;
    return {
        ...data,
        variants: filterVariantsForGroupIntent(slug, filterVariantsForProductGroup(data.group, data.variants)),
    };
}

function getPrimaryVariant(data: ProductGroupPayload | null): ProductVariant | null {
    if (!data) return null;
    return selectPrimaryProductVariant(data.group, data.variants);
}

async function getSiblingGroups(data: ProductGroupPayload | null, activeSlug: string): Promise<SiblingGroup[]> {
    const group = data?.group;
    if (!group) return [];
    return await getConvexClient().query(api.products.getSiblingGroups, {
        family: group.family,
        capacityMl: group.capacityMl ?? 0,
        excludeSlug: activeSlug,
        neckThreadSize: group.neckThreadSize ?? undefined,
    }) as SiblingGroup[];
}

async function getFocusedPdpRelations(activeSlug: string): Promise<FocusedPdpRelations | null> {
    return await getConvexClient().query(api.products.getFocusedPdpRelations, {
        slug: activeSlug,
    }) as FocusedPdpRelations | null;
}

async function getPrimaryCompatibility(data: ProductGroupPayload | null): Promise<PdpCompatibilityPayload | null> {
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

async function getPdpBlocks(activeSlug: string, family: string | null | undefined): Promise<PdpBlock[]> {
    if (!isSanityConfigured || !activeSlug || !family) return [];
    try {
        // Live, draft-aware fetch: published blocks for visitors, draft blocks with
        // click-to-edit overlays inside the Studio's Presentation tool.
        const [groupRes, familyRes] = await Promise.all([
            sanityFetch({
                query: `*[_type == "productGroupContent" && slug.current == $slug][0] { pageBlocks, overrideTemplate }`,
                params: { slug: activeSlug },
            }),
            sanityFetch({
                query: `*[_type == "productFamilyContent" && family == $family][0] { pageBlocks }`,
                params: { family },
            }),
        ]);
        const groupContent = groupRes.data as { pageBlocks?: PdpBlock[]; overrideTemplate?: boolean } | null;
        const familyContent = familyRes.data as { pageBlocks?: PdpBlock[] } | null;
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
function redesignApplies(slug: string, data: ProductGroupPayload): boolean {
    if (process.env.NEXT_PUBLIC_PDP_REDESIGN === "off") return false;
    if (data.variants.length === 0) return false;
    if (isVariantCardFamily(data.group.family)) return false;
    return parseProductSlug(slug) !== null;
}

async function loadRedesignPayload(
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
        platesBySku,
        descriptions: resolveItemDescriptions(data.variants),
        collection,
        familyHref: `/catalog?family=${encodeURIComponent(data.group.family)}`,
    };
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
    const { slug } = await params;
    const activeSlug = getLegacyProductRouteOverride(slug) ?? slug;
    const data = await getProductData(activeSlug);
    const group = data?.group;
    // A variant-card family's catalog card links with ?sku=; title the page for that finish.
    const resolvedParams = await searchParams;
    const requestedSku = resolvedParams?.sku;
    const skuVariant = isVariantCardFamily(group?.family) && typeof requestedSku === "string"
        // The PDP's own colour picker writes the Grace SKU; catalog cards write the website SKU.
        ? data?.variants.find((candidate) => candidate.websiteSku === requestedSku || candidate.graceSku === requestedSku) ?? null
        : null;
    // The redesigned page carries its picks in the URL (?roller=&cap=, or ?sku= from a card or Grace).
    const pickedVariant = data && redesignApplies(activeSlug, data)
        ? resolveVariant(data.variants, derivePicks(data.variants, data.group, {
            roller: typeof resolvedParams?.roller === "string" ? resolvedParams.roller : null,
            cap: typeof resolvedParams?.cap === "string" ? resolvedParams.cap : null,
            sku: typeof requestedSku === "string" ? requestedSku : null,
        }))
        : null;
    const variant = skuVariant ?? pickedVariant ?? getPrimaryVariant(data);

    if (!group) {
        return {
            title: { absolute: `Product Not Found | ${SITE_NAME}` },
            robots: { index: false, follow: true },
        };
    }

    const customerName = (skuVariant
        ? atomizerVariantCardName(group.capacityMl ?? getReleasedCatalogHero(group.slug, skuVariant.websiteSku)?.capacityMl, skuVariant)
        : null)
        ?? getCustomerFacingProductName({
            group,
            variant,
            fallbackName: group.displayName,
        }).displayName;
    const description = chooseCanonicalProductDescription({
        groupDescription: group.groupDescription ?? null,
        variantDescription: variant?.itemDescription ?? null,
        graceDescription: variant?.graceDescription ?? null,
        applicators: variant?.applicator ? [variant.applicator] : group.applicatorTypes ?? [],
    }) ?? `${customerName} from the ${group.family} collection. ${group.capacity ?? ""} wholesale glass packaging from Best Bottles.`.trim();
    const image = isPreferredProductImageUrl(variant?.imageUrl)
        ? variant?.imageUrl ?? undefined
        : group.heroImageUrl ?? undefined;

    return {
        title: { absolute: `${customerName} | ${SITE_NAME}` },
        description,
        alternates: { canonical: `${SITE_URL}/products/${activeSlug}` },
        openGraph: {
            title: `${customerName} | ${SITE_NAME}`,
            description,
            url: `${SITE_URL}/products/${activeSlug}`,
            type: "website",
            images: image ? [{ url: image, alt: customerName }] : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: `${customerName} | ${SITE_NAME}`,
            description,
            images: image ? [image] : undefined,
        },
    };
}

export default async function ProductPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
    const redirectTarget = resolveProductPageRedirectTarget(slug, resolvedSearchParams);
    if (redirectTarget) redirect(redirectTarget);
    const legacyRouteOverride = getLegacyProductRouteOverride(slug);

    const activeSlug = legacyRouteOverride ?? slug;
    if (hasCatalogSourceHold(activeSlug)) notFound();
    const data = await getProductData(activeSlug);
    const primaryVariant = getPrimaryVariant(data);
    const [siblingGroups, pdpBlocks, platesBySku, relations, compatibility] = await Promise.all([
        getSiblingGroups(data, activeSlug),
        getPdpBlocks(activeSlug, data?.group.family),
        // The plates for THIS group's variants, from the Convex index -- never
        // the whole catalogue, and never a throw: a missing plate costs the
        // customer the plate, not the page.
        loadPlatesForVariants(
            getConvexClient(),
            (data?.variants ?? []).flatMap((variant) => [variant.graceSku, variant.websiteSku]),
            activeSlug,
        ),
        getFocusedPdpRelations(activeSlug),
        getPrimaryCompatibility(data),
    ]);
    const group = data?.group;
    const variant = primaryVariant;
    const localComponentKits = localPdpComponentKits((await headers()).get('host'), resolvedSearchParams.assetPreview, data?.variants ?? []);
    const localAssetPreview = localBostonPreview(process.env.NODE_ENV, (await headers()).get('host'), resolvedSearchParams.assetPreview) && group?.family === 'Boston Round';
    const completion = localAssetPreview ? await readCompletion(process.cwd()) : null;
    const displayedPlates = localAssetPreview ? previewPlates(completion, group?._id, data?.variants ?? [], platesBySku) : platesBySku;
    const pilot = localAssetPreview ? await readKitPilot(process.cwd(), group, displayedPlates) : {kits:{},plates:displayedPlates};
    const customerName = group
        ? getCustomerFacingProductName({ group, variant, fallbackName: group.displayName }).displayName
        : "";
    const description = group
        ? chooseCanonicalProductDescription({
            groupDescription: group.groupDescription ?? null,
            variantDescription: variant?.itemDescription ?? null,
            graceDescription: variant?.graceDescription ?? null,
            applicators: variant?.applicator ? [variant.applicator] : group.applicatorTypes ?? [],
        }) ?? `${customerName} - ${group.family} collection from Best Bottles. ${group.capacity ?? ""}`.trim()
        : "";
    const productJsonLd = group && variant
        ? buildProductJsonLd({
            name: customerName,
            description,
            sku: variant.graceSku ?? variant.websiteSku,
            image: isPreferredProductImageUrl(variant.imageUrl)
                ? variant.imageUrl ?? undefined
                : undefined,
            url: `${SITE_URL}/products/${activeSlug}`,
            family: group.family,
            priceLow: variant.webPrice12pc ?? variant.webPrice10pc ?? variant.webPrice1pc,
            priceHigh: variant.webPrice1pc,
            inStock: variant.stockStatus === "In Stock",
            neckThreadSize: group.neckThreadSize ?? undefined,
            capacity: group.capacity ?? undefined,
        })
        : null;
    const breadcrumbJsonLd = group
        ? buildBreadcrumbJsonLd([
            { name: "Home", url: SITE_URL },
            { name: "Catalog", url: `${SITE_URL}/catalog` },
            { name: group.family, url: `${SITE_URL}/catalog?family=${encodeURIComponent(group.family)}` },
            { name: customerName, url: `${SITE_URL}/products/${activeSlug}` },
        ])
        : null;

    if (data && redesignApplies(activeSlug, data)) {
        const payload = await loadRedesignPayload(data, activeSlug, siblingGroups, platesBySku);
        return (
            <>
                {productJsonLd && (
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
                    />
                )}
                {breadcrumbJsonLd && (
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
                    />
                )}
                <PdpRedesignPage {...payload} />
                <Footer />
            </>
        );
    }

    return (
        <>
            {productJsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
                />
            )}
            {breadcrumbJsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
                />
            )}
            <ProductDetailClient
                slug={activeSlug}
                initialData={data}
                initialPdpBlocks={pdpBlocks}
                initialRelations={relations}
                initialCompatibility={compatibility}
                siblingGroups={siblingGroups}
                platesBySku={localAssetPreview ? pilot.plates : withReleasedHeroStages(group, data?.variants ?? [], platesBySku)}
                localKits={pilot.kits}
                localComponentKits={localComponentKits}
                localAssetPreview={localAssetPreview}
                localAssetVersion={completion ? `${completion.token}:${completion.revision}` : ''}
            />
            <SanityLiveVisualEditing />
            <Footer />
        </>
    );
}
