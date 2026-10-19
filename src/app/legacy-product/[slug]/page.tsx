import { readKitPilot } from "../../../../scripts/asset-ledger/kit-pilot.mjs";
import { localPdpComponentKits } from "@/lib/paper-doll/local-component-kits";
import { hasCatalogSourceHold } from "@/lib/products/catalog-listing-visibility";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import Footer from "@/components/Footer";
import { SITE_URL, buildBreadcrumbJsonLd, buildProductJsonLd } from "@/lib/seo";
import { chooseCanonicalProductDescription } from "@/lib/canonicalProduct";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getLegacyProductRouteOverride } from "@/lib/products/legacy-product-route-overrides";
import { searchParamsToString, type ProductPageSearchParams } from "@/lib/products/pdp-redirect";
import { withReleasedHeroStages } from "@/lib/products/variant-cards";
import { readCompletion } from "../../../../scripts/asset-ledger/plate-completion.mjs";
import { localBostonPreview, previewPlates } from "../../../../scripts/asset-ledger/product-preview.mjs";
import { getPrimaryVariant, isPreferredProductImageUrl, loadCachedPage } from "../../products/[slug]/productPageData";

const ProductDetailClient = nextDynamic(() => import("../../products/[slug]/ProductDetailClient"));

// Classic product pages (components, packaging, variant-card families) live on
// their own route so the redesigned PDP never imports this client, Three.js,
// or framer-motion. /products/[slug] redirects here when the redesign does not apply.
// Same dynamic reason as the redesign route: the query string is part of the redirect.
export const dynamic = "force-dynamic";

export default async function LegacyProductPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<ProductPageSearchParams>;
}) {
    const { slug } = await params;
    const resolvedSearch = await searchParams;
    const activeSlug = getLegacyProductRouteOverride(slug) ?? slug;
    if (hasCatalogSourceHold(activeSlug)) notFound();
    const cached = await loadCachedPage(activeSlug);
    if (!cached) notFound();
    const data = cached.data;
    if (!data) notFound();
    const query = searchParamsToString(resolvedSearch);
    const suffix = query ? `?${query}` : "";
    if (cached.kind === "redesign") redirect(`/products/${activeSlug}${suffix}`);

    const { siblingGroups, platesBySku, pdpBlocks, relations, compatibility } = cached;
    const primaryVariant = getPrimaryVariant(data);
    const group = data.group;
    const variant = primaryVariant;
    // Asset preview reads the host header. That opts the route into dynamic
    // rendering, so the cached storefront does not overlay local Boston plates.
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
    const localComponentKits = localPdpComponentKits(null, undefined, data.variants ?? []);
    const localAssetPreview = localBostonPreview(process.env.NODE_ENV, null, undefined) && group?.family === "Boston Round";
    const completion = localAssetPreview ? await readCompletion(process.cwd()) : null;
    const displayedPlates = localAssetPreview ? previewPlates(completion, group?._id, data?.variants ?? [], platesBySku) : platesBySku;
    const pilot = localAssetPreview ? await readKitPilot(process.cwd(), group, displayedPlates) : { kits: {}, plates: displayedPlates };

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
            <Suspense fallback={null}>
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
                localAssetVersion={completion ? `${completion.token}:${completion.revision}` : ""}
            />
            </Suspense>
            <Footer />
        </>
    );
}
