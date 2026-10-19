import { hasCatalogSourceHold } from "@/lib/products/catalog-listing-visibility";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import type { Metadata } from "next";
import PdpRedesignPage from "@/components/pdp/PdpRedesignPage";
import Footer from "@/components/Footer";
import { SITE_NAME, SITE_URL, buildBreadcrumbJsonLd, buildProductJsonLd } from "@/lib/seo";
import { chooseCanonicalProductDescription } from "@/lib/canonicalProduct";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getLegacyProductRouteOverride } from "@/lib/products/legacy-product-route-overrides";
import { resolveProductPageRedirectTarget, searchParamsToString, type ProductPageSearchParams } from "@/lib/products/pdp-redirect";
import { productPageRobots } from "@/lib/products/pdp-robots";
import { atomizerVariantCardName, isVariantCardFamily } from "@/lib/products/variant-cards";
import { getReleasedCatalogHero } from "@/lib/products/catalog-heroes";
import { derivePicks, pageOptionLabel, resolveVariant, variantTitle } from "@/lib/products/pdp-redesign/model";
import { productCopyFor } from "@/lib/products/item-description/product-copy";
import {
    getPrimaryVariant,
    isPreferredProductImageUrl,
    loadCachedGroup,
    loadCachedPage,
    redesignApplies,
} from "./productPageData";

// A shared link's ?sku= has to be in the first HTML. Next treats this route as
// static when generateStaticParams is set, then crashes on searchParams
// (DYNAMIC_SERVER_USAGE). Force a per-request render. The Convex/Sanity payload
// stays in unstable_cache for five minutes inside loadCachedPage.
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<ProductPageSearchParams>;
}): Promise<Metadata> {
    const { slug } = await params;
    const resolvedParams = await searchParams;
    const activeSlug = getLegacyProductRouteOverride(slug) ?? slug;
    const data = await loadCachedGroup(activeSlug);
    const group = data?.group;
    const requestedSku = firstParam(resolvedParams.sku);
    const skuVariant = isVariantCardFamily(group?.family) && typeof requestedSku === "string"
        // The PDP's own colour picker writes the Grace SKU; catalog cards write the website SKU.
        ? data?.variants.find((candidate) => candidate.websiteSku === requestedSku || candidate.graceSku === requestedSku) ?? null
        : null;
    // The redesigned page carries its picks in the URL (?roller=&cap=, or ?sku= from a card or Grace).
    const pagePicks = data && redesignApplies(activeSlug, data)
        ? derivePicks(data.variants, data.group, {
            roller: firstParam(resolvedParams.roller) ?? null,
            cap: firstParam(resolvedParams.cap) ?? null,
            sku: typeof requestedSku === "string" ? requestedSku : null,
        })
        : null;
    const pickedVariant = data && pagePicks ? resolveVariant(data.variants, pagePicks) : null;
    const variant = skuVariant ?? pickedVariant ?? getPrimaryVariant(data);

    if (!group) {
        // The page answers 404 for this slug, and Next adds its own
        // <meta name="robots" content="noindex"> to every 404; a robots value
        // here would print a second tag.
        return { title: { absolute: `Product Not Found | ${SITE_NAME}` } };
    }

    // Product copy v2 names the page as the headline does: its title, then the option picked on the page.
    const copy = variant ? productCopyFor(variant) : null;
    const copyName = copy && data && pagePicks && pickedVariant
        ? variantTitle(copy.title, pageOptionLabel(data.variants, pagePicks, pickedVariant))
        : null;
    const customerName = (skuVariant
        ? atomizerVariantCardName(group.capacityMl ?? getReleasedCatalogHero(group.slug, skuVariant.websiteSku)?.capacityMl, skuVariant)
        : null)
        ?? copyName
        ?? getCustomerFacingProductName({
            group,
            variant,
            fallbackName: group.displayName,
        }).displayName;
    const description = copy?.metaDescription ?? chooseCanonicalProductDescription({
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
        ...productPageRobots(data),
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
    searchParams: Promise<ProductPageSearchParams>;
}) {
    const { slug } = await params;
    const resolvedSearch = await searchParams;
    // The proxy already answers these before the page renders (a real 308 and
    // 404, src/lib/crawl/route-status.ts); these calls cover client-side
    // navigations and a catalogue the proxy could not reach.
    const redirectTarget = resolveProductPageRedirectTarget(slug, resolvedSearch);
    if (redirectTarget) permanentRedirect(redirectTarget);
    const legacyRouteOverride = getLegacyProductRouteOverride(slug);

    const activeSlug = legacyRouteOverride ?? slug;
    if (hasCatalogSourceHold(activeSlug)) notFound();
    const cached = await loadCachedPage(activeSlug);
    if (!cached) notFound();
    const data = cached.data;
    if (!data) notFound();
    if (cached.kind === "classic") {
        const query = searchParamsToString(resolvedSearch);
        redirect(`/legacy-product/${activeSlug}${query ? `?${query}` : ""}`);
    }
    const primaryVariant = getPrimaryVariant(data);
    const group = data.group;
    const variant = primaryVariant;
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
    const initialSearch = {
        sku: firstParam(resolvedSearch.sku) ?? null,
        roller: firstParam(resolvedSearch.roller) ?? null,
        cap: firstParam(resolvedSearch.cap) ?? null,
        qty: firstParam(resolvedSearch.qty) ?? null,
        drawing: firstParam(resolvedSearch.drawing) ?? null,
    };

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
            <PdpRedesignPage {...cached.payload} initialSearch={initialSearch} />
            <Footer />
        </>
    );
}
