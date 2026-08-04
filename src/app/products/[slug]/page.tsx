import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { draftMode } from "next/headers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import ProductDetailClient, {
    type ApplicatorSibling,
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
import { filterVariantsForProductGroup, isLegacyBestBottlesImageUrl } from "@/lib/productVariantIntegrity";
import type { PdpBlock } from "@/components/PdpBlocks";
import UnifiedBottlePdp from "@/components/products/UnifiedBottlePdp";
import { getPreviewPaperDollFamily, getStorefrontPaperDollFamily } from "@/sanity/lib/queries";
import { isPaperDollDraftPreviewAllowed } from "@/lib/paper-doll/preview";
import {
    buildCylinder9mlConfigurations,
    type CylinderConfigurationSourceGroup,
    type CylinderConfigurationSourceVariant,
} from "@/lib/products/cylinder-9ml-configurator";
import { CYLINDER_9ML_17415_COHORT, isCylinder9ml17415Group } from "@/lib/products/product-cohorts";
import { searchCatalogServer } from "@/lib/catalogServer";

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

function hasPreferredProductImage(variant: ProductVariant): boolean {
    return isPreferredProductImageUrl(variant.imageUrl) || isPreferredProductImageUrl(variant.imageUrlCapOff);
}

async function getProductData(slug: string): Promise<ProductGroupPayload | null> {
    const data = await getConvexClient().query(api.products.getProductGroup, { slug }) as ProductGroupPayload | null;
    if (!data) return null;
    return {
        ...data,
        variants: filterVariantsForProductGroup(data.group, data.variants),
    };
}

type CylinderCohortGroup = CylinderConfigurationSourceGroup & { _id: string };
type CylinderCohortVariant = CylinderConfigurationSourceVariant & { productGroupId?: string };

async function getUnifiedCylinderData() {
    let cohort: { groups: CylinderCohortGroup[]; variants: CylinderCohortVariant[] };
    try {
        cohort = await getConvexClient().query(api.products.getProductCohort, {
            family: CYLINDER_9ML_17415_COHORT.family,
            capacityMl: CYLINDER_9ML_17415_COHORT.capacityMl,
            neckThreadSize: CYLINDER_9ML_17415_COHORT.neckThreadSize,
            paperDollFamilyKey: CYLINDER_9ML_17415_COHORT.paperDollFamilyKey,
        }) as { groups: CylinderCohortGroup[]; variants: CylinderCohortVariant[] };
    } catch {
        // The storefront Convex deployment can lag the web branch. Rebuild the
        // exact cohort through the already-deployed group reads, preserving the
        // same family/capacity/neck/family-key boundary and complete commerce rows.
        const catalog = await searchCatalogServer({
            filters: { families: [CYLINDER_9ML_17415_COHORT.family] },
            sort: "capacity-asc",
            view: "visual",
            limit: 240,
            cursor: null,
        });
        const exactGroups = catalog.items.filter((group) => isCylinder9ml17415Group({
            family: group.family,
            capacityMl: group.capacityMl,
            neckThreadSize: group.neckThreadSize,
            paperDollFamilyKey: group.paperDollFamilyKey ?? null,
        }));
        const payloads = await Promise.all(exactGroups.map((group) => getProductData(group.slug)));
        cohort = {
            groups: exactGroups.map((group) => ({
                ...group,
                family: group.family,
                paperDollFamilyKey: group.paperDollFamilyKey ?? null,
            })) as CylinderCohortGroup[],
            variants: payloads.flatMap((payload, index) =>
                (payload?.variants ?? []).map((variant) => ({
                    ...variant,
                    productGroupId: exactGroups[index]._id,
                })),
            ),
        };
    }
    const groups = new Map(cohort.groups.map((group) => [String(group._id), group]));
    const rows = cohort.variants.map((variant) => {
        const group = groups.get(String(variant.productGroupId ?? ""));
        if (!group) throw new Error(`CYL-9ML product ${variant.graceSku} is missing its cohort group`);
        return { group, variant };
    });
    return buildCylinder9mlConfigurations(rows);
}

async function getReleasedCylinderPaperDoll(preview: boolean) {
    try {
        return preview
            ? await getPreviewPaperDollFamily(CYLINDER_9ML_17415_COHORT.paperDollFamilyKey)
            : await getStorefrontPaperDollFamily(CYLINDER_9ML_17415_COHORT.paperDollFamilyKey);
    } catch (error) {
        console.warn(`CYL-9ML Paper Doll ${preview ? "draft preview" : "release gate"} rejected the Sanity document`, error);
        return null;
    }
}

function getPrimaryVariant(data: ProductGroupPayload | null): ProductVariant | null {
    if (!data) return null;
    const primaryWebsiteSku = data.group.primaryWebsiteSku?.trim();
    const primaryGraceSku = data.group.primaryGraceSku?.trim();
    const explicitPrimary = data.variants.find((variant) =>
        (primaryWebsiteSku && variant.websiteSku === primaryWebsiteSku) ||
        (primaryGraceSku && variant.graceSku === primaryGraceSku)
    );
    return explicitPrimary ?? data.variants.find(hasPreferredProductImage) ?? data.variants[0] ?? null;
}

async function getApplicatorSiblings(data: ProductGroupPayload | null, activeSlug: string): Promise<ApplicatorSibling[]> {
    const group = data?.group;
    if (!group) return [];
    return await getConvexClient().query(api.products.getApplicatorSiblings, {
        family: group.family,
        capacityMl: group.capacityMl ?? 0,
        color: group.color ?? "",
        excludeSlug: activeSlug,
        neckThreadSize: group.neckThreadSize ?? undefined,
    }) as ApplicatorSibling[];
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

function searchParamsToString(input: Record<string, string | string[] | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
        if (Array.isArray(value)) {
            for (const item of value) params.append(key, item);
        } else if (value != null) {
            params.set(key, value);
        }
    }
    return params.toString();
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const activeSlug = getLegacyProductRouteOverride(slug) ?? slug;
    if (activeSlug === CYLINDER_9ML_17415_COHORT.slug) {
        return {
            title: { absolute: `9 mL Cylinder Bottle — 17-415 | ${SITE_NAME}` },
            description: "Configure one 9 mL 17-415 Cylinder bottle across compatible glass colors, roll-on fitments, fine mist sprayers, lotion pumps, and finishes.",
            alternates: { canonical: `${SITE_URL}/products/${CYLINDER_9ML_17415_COHORT.slug}` },
            openGraph: {
                title: `9 mL Cylinder Bottle — 17-415 | ${SITE_NAME}`,
                description: "Choose the glass, delivery system, roller material, and finish for the exact 9 mL 17-415 Cylinder platform.",
                url: `${SITE_URL}/products/${CYLINDER_9ML_17415_COHORT.slug}`,
                type: "website",
            },
        };
    }
    const data = await getProductData(activeSlug);
    const group = data?.group;
    const variant = getPrimaryVariant(data);

    if (!group) {
        return {
            title: { absolute: `Product Not Found | ${SITE_NAME}` },
            robots: { index: false, follow: true },
        };
    }

    const customerName = getCustomerFacingProductName({
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
    const legacyRouteOverride = getLegacyProductRouteOverride(slug);
    if (legacyRouteOverride) {
        const qs = searchParamsToString(resolvedSearchParams);
        redirect(`/products/${legacyRouteOverride}${qs ? `?${qs}` : ""}`);
    }

    const activeSlug = legacyRouteOverride ?? slug;
    if (activeSlug === CYLINDER_9ML_17415_COHORT.slug) {
        const previewValue = Array.isArray(resolvedSearchParams.paperDollPreview)
            ? resolvedSearchParams.paperDollPreview[0]
            : resolvedSearchParams.paperDollPreview;
        const previewRequested = previewValue === "1" || previewValue === "true";
        const paperDollPreview = isPaperDollDraftPreviewAllowed({
            requested: previewRequested,
            draftModeEnabled: (await draftMode()).isEnabled,
            nodeEnv: process.env.NODE_ENV,
        });
        const [configurations, paperDollFamily] = await Promise.all([
            getUnifiedCylinderData(),
            getReleasedCylinderPaperDoll(paperDollPreview),
        ]);
        return (
            <>
                <UnifiedBottlePdp configurations={configurations} paperDollFamily={paperDollFamily} paperDollPreview={paperDollPreview} />
                <SanityLiveVisualEditing />
                <Footer />
            </>
        );
    }
    const data = await getProductData(activeSlug);
    const productGroupWithFamilyKey = data?.group as (ProductGroupPayload["group"] & { paperDollFamilyKey?: string | null }) | undefined;
    if (productGroupWithFamilyKey && isCylinder9ml17415Group({
        family: productGroupWithFamilyKey.family ?? null,
        capacityMl: productGroupWithFamilyKey.capacityMl ?? null,
        neckThreadSize: productGroupWithFamilyKey.neckThreadSize ?? null,
        paperDollFamilyKey: productGroupWithFamilyKey.paperDollFamilyKey ?? null,
    })) {
        const primary = getPrimaryVariant(data);
        const next = new URLSearchParams();
        next.set("view", "beauty");
        if (primary?.graceSku) next.set("configuration", primary.graceSku);
        redirect(`/products/${CYLINDER_9ML_17415_COHORT.slug}?${next.toString()}`);
    }
    const [siblings, siblingGroups, pdpBlocks] = await Promise.all([
        getApplicatorSiblings(data, activeSlug),
        getSiblingGroups(data, activeSlug),
        getPdpBlocks(activeSlug, data?.group.family),
    ]);
    const group = data?.group;
    const variant = getPrimaryVariant(data);
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
                initialApplicatorSiblings={siblings}
                initialPdpBlocks={pdpBlocks}
                siblingGroups={siblingGroups}
            />
            <SanityLiveVisualEditing />
            <Footer />
        </>
    );
}
