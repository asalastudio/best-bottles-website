import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { searchCatalogServer } from "@/lib/catalogServer";
import { paramsToFilters } from "@/lib/catalogFilters";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";
import { CYLINDER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { buildCylinderFamilyPageModel } from "@/lib/products/cylinder-family-page";
import { getProductFamilyPageContent, getStorefrontPaperDollFamily } from "@/sanity/lib/queries";
import { SITE_URL } from "@/lib/seo";
import CylinderFamilyPageClient from "./CylinderFamilyPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
    title: { absolute: "Cylinder Bottle Family — Build or Browse | Best Bottles" },
    description: "Explore Cylinder bottles by capacity, glass color, applicator, and neck finish, or build a compatible 9 mL 17-415 Cylinder configuration.",
    alternates: { canonical: `${SITE_URL}/catalog/cylinder` },
};

async function hasReleasedCylinderPaperDoll(): Promise<boolean> {
    try {
        return Boolean(await getStorefrontPaperDollFamily("CYL-9ML"));
    } catch (error) {
        console.warn("CYL-9ML Paper Doll remains behind the storefront release gate", error);
        return false;
    }
}

function toURLSearchParams(input: Record<string, string | string[] | undefined>): URLSearchParams {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
        if (Array.isArray(value)) {
            for (const item of value) params.append(key, item);
        } else if (value != null) {
            params.set(key, value);
        }
    }
    return params;
}

export default async function CylinderFamilyPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolvedSearchParams = await searchParams;
    const urlSearchParams = toURLSearchParams(resolvedSearchParams);
    const parsedState = paramsToFilters(urlSearchParams);
    const baseArgs = buildCatalogSearchArgs({
        surface: CYLINDER_CATALOG_SURFACE,
        filters: {},
        sort: CYLINDER_CATALOG_SURFACE.defaultSort,
        view: "visual",
        limit: 240,
    });
    const activeArgs = buildCatalogSearchArgs({
        surface: CYLINDER_CATALOG_SURFACE,
        filters: parsedState.filters,
        sort: urlSearchParams.has("sort") ? parsedState.sort : CYLINDER_CATALOG_SURFACE.defaultSort,
        view: "visual",
        limit: 240,
    });
    const baseCatalogPromise = searchCatalogServer(baseArgs);
    const activeCatalogPromise = JSON.stringify(activeArgs) === JSON.stringify(baseArgs)
        ? baseCatalogPromise
        : searchCatalogServer(activeArgs);
    const [baseCatalog, initialReadyMadeCatalog, editorial, assetsReady] = await Promise.all([
        baseCatalogPromise,
        activeCatalogPromise,
        getProductFamilyPageContent("Cylinder"),
        hasReleasedCylinderPaperDoll(),
    ]);
    const model = buildCylinderFamilyPageModel(baseCatalog.items, baseCatalog.variantPreviewRows);

    return (
        <>
            <CylinderFamilyPageClient
                baseCatalog={baseCatalog}
                initialReadyMadeCatalog={initialReadyMadeCatalog}
                editorial={editorial}
                paperDollBuildReady={assetsReady && model.featuredCohort.variantCount === 145}
            />
            <Footer />
        </>
    );
}
