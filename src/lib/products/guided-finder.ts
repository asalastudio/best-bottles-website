import { APPLICATOR_BUCKETS, APPLICATOR_NAV, FAMILY_ORDER, normalizeCapacityFilterValue, rollerMaterialMatchesProductValues, type RollerMaterial } from "@/lib/catalogFilters";
import type { CatalogSearchResultShape, CatalogSearchVariantPreviewRow } from "@/lib/catalogSearchFallback";
import { isCheckoutReady } from "@/lib/checkout";
import { getCustomerFacingProductName } from "@/lib/products/customer-facing-names";
import { getProductCardVariantPreviews } from "@/lib/products/product-card-variant-previews";
import type { BrowseContext } from "@/lib/products/focused-shopping";
import { getCylinderCatalogHero, type CylinderCatalogHero } from "@/lib/products/cylinder-catalog-heroes";

type GuidedFinderAvailability = "in-stock" | "confirm-availability";

export type GuidedFinderProduct = {
    id: string;
    groupId: string;
    displayName: string;
    imageUrl: string | null;
    catalogHero?: CylinderCatalogHero | null;
    family: string;
    capacity: string | null;
    color: string | null;
    application: string | null;
    rollerMaterial: RollerMaterial | null;
    neckFinish: string | null;
    stockStatus: string | null;
    availability: GuidedFinderAvailability;
    caseQuantity: number | null;
    webPrice1pc: number | null;
    startingUnitPrice: number | null;
    shopifyVariantId: string | null;
    shopifySellable: boolean | null;
    checkoutReady: boolean;
    href: string;
};

export type GuidedFinderFamily = {
    family: string;
    exactProducts: GuidedFinderProduct[];
};

function capacityLabel(capacityMl: number | null, capacity: string | null): string | null {
    if (capacityMl != null && capacityMl > 0) return `${capacityMl} ml`;
    return capacity ? normalizeCapacityFilterValue(capacity) : null;
}

function applicationLabel(value: string | null | undefined, fallbackValues: readonly string[] | null | undefined): string | null {
    const values = [value, ...(fallbackValues ?? [])].filter((candidate): candidate is string => Boolean(candidate));
    const match = APPLICATOR_NAV.find((application) => application.buckets.some((bucket) => {
        const productValues = APPLICATOR_BUCKETS.find((candidate) => candidate.value === bucket)?.productValues as readonly string[] | undefined;
        return values.some((value) => productValues?.includes(value));
    }));
    if (match) return match.label;
    return values[0] ?? null;
}

function rollerMaterial(value: string | null | undefined, fallbackValues: readonly string[] | null | undefined): RollerMaterial | null {
    const values = [value, ...(fallbackValues ?? [])].filter((candidate): candidate is string => Boolean(candidate));
    if (rollerMaterialMatchesProductValues("metal", values)) return "metal";
    if (rollerMaterialMatchesProductValues("plastic", values)) return "plastic";
    return null;
}

function availabilityFor(stockStatus: string | null): GuidedFinderAvailability {
    return stockStatus?.trim().toLowerCase() === "in stock" ? "in-stock" : "confirm-availability";
}

function allFacetValuesEmpty<T>(
    values: readonly T[] | undefined,
    countFor: (value: T) => number,
): boolean {
    if (!values?.length) return false;
    return values.every((value) => countFor(value) === 0);
}

function imageFor(
    group: CatalogSearchResultShape["items"][number],
    variant: CatalogSearchVariantPreviewRow["variants"][number] | null,
    displayName: string,
): string | null {
    const preview = variant ? getProductCardVariantPreviews([variant], {
        productTitle: displayName,
        defaultImageUrl: group.heroImageUrl,
        groupColor: group.color,
        productHref: `/products/${group.slug}`,
    })[0] : null;
    if (preview?.imageUrl) return preview.imageUrl;

    return getProductCardVariantPreviews([{
        id: group._id,
        itemName: displayName,
        websiteSku: null,
        graceSku: null,
        imageUrl: group.heroImageUrl ?? null,
        imageUrlCapOff: null,
        color: group.color,
        applicator: null,
        capColor: null,
        trimColor: null,
        capStyle: null,
        capHeight: null,
        ballMaterial: null,
    }], {
        productTitle: displayName,
        defaultImageUrl: group.heroImageUrl,
        groupColor: group.color,
        productHref: `/products/${group.slug}`,
    })[0]?.imageUrl ?? null;
}

export function buildGuidedFinderFamilies(result: CatalogSearchResultShape): GuidedFinderFamily[] {
    const rowsByGroupId = new Map(result.variantPreviewRows.map((row) => [row.groupId, row]));
    const grouped = new Map<string, GuidedFinderProduct[]>();

    for (const group of result.items) {
        const variants = rowsByGroupId.get(group._id)?.variants ?? [];
        const catalogHero = getCylinderCatalogHero(group.slug, variants);
        const variant = variants.find((candidate) => candidate.websiteSku === catalogHero?.websiteSku) ?? variants[0] ?? null;
        const displayName = getCustomerFacingProductName({ group, variant, fallbackName: group.displayName }).displayName;
        const family = group.family ?? group.category;
        const product: GuidedFinderProduct = {
            id: variant?.id ?? group._id,
            groupId: group._id,
            displayName,
            imageUrl: imageFor(group, variant, displayName),
            catalogHero,
            family,
            capacity: capacityLabel(group.capacityMl, group.capacity),
            color: catalogHero?.bottleColor ?? variant?.color ?? group.color,
            application: applicationLabel(variant?.applicator, group.applicatorTypes),
            rollerMaterial: rollerMaterial(variant?.applicator, group.applicatorTypes),
            neckFinish: group.neckThreadSize,
            stockStatus: variant?.stockStatus ?? null,
            availability: availabilityFor(variant?.stockStatus ?? null),
            caseQuantity: variant?.caseQuantity ?? null,
            webPrice1pc: variant?.webPrice1pc ?? null,
            startingUnitPrice: group.priceRangeMin,
            shopifyVariantId: variant?.shopifyVariantId ?? null,
            shopifySellable: variant?.shopifySellable ?? null,
            checkoutReady: variant ? isCheckoutReady({
                graceSku: variant.graceSku ?? variant.websiteSku ?? group._id,
                shopifyVariantId: variant.shopifyVariantId,
                shopifySellable: variant.shopifySellable,
            }) : false,
            href: `/products/${group.slug}`,
        };
        const products = grouped.get(family) ?? [];
        products.push(product);
        grouped.set(family, products);
    }

    const familyIndex = (family: string) => {
        const index = FAMILY_ORDER.indexOf(family);
        return index < 0 ? FAMILY_ORDER.length : index;
    };
    return [...grouped.entries()]
        .sort(([a], [b]) => familyIndex(a) - familyIndex(b) || a.localeCompare(b))
        .map(([family, exactProducts]) => ({
            family,
            exactProducts: exactProducts.sort((a, b) => {
                const aCapacity = Number.parseFloat(a.capacity ?? "") || Number.POSITIVE_INFINITY;
                const bCapacity = Number.parseFloat(b.capacity ?? "") || Number.POSITIVE_INFINITY;
                return aCapacity - bCapacity || a.displayName.localeCompare(b.displayName);
            }),
        }));
}

export function conflictingRefinement(
    context: BrowseContext,
    facets: CatalogSearchResultShape["facets"],
): keyof BrowseContext | null {
    if (context.family && (facets.families[context.family] ?? 0) === 0) return "family";
    if (context.application) {
        const application = APPLICATOR_NAV.find((candidate) => candidate.value === context.application);
        if (application && application.buckets.every((bucket) => (facets.applicators[bucket] ?? 0) === 0)) return "application";
    }
    if (allFacetValuesEmpty(context.capacities, (capacity) => facets.capacities[normalizeCapacityFilterValue(capacity)]?.count ?? 0)) return "capacities";
    if (allFacetValuesEmpty(context.rollerMaterials, (material) => facets.rollerMaterials[material] ?? 0)) return "rollerMaterials";
    if (allFacetValuesEmpty(context.glassColors, (color) => facets.colors[color] ?? 0)) return "glassColors";
    if (allFacetValuesEmpty(context.neckThreads, (thread) => facets.neckThreadSizes[thread] ?? 0)) return "neckThreads";
    return null;
}
