import type { Metadata } from "next";
import Footer from "@/components/Footer";
import { searchCatalogServer } from "@/lib/catalogServer";
import { paramsToFilters } from "@/lib/catalogFilters";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";
import { CYLINDER_CATALOG_SURFACE } from "@/lib/catalogSurface";
import { getProductFamilyPageContent } from "@/sanity/lib/queries";
import { SITE_URL } from "@/lib/seo";
import CylinderFamilyPageClient from "./CylinderFamilyPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
    title: { absolute: "Cylinder Bottle Family — Build or Browse | Best Bottles" },
    description: "Find wholesale Cylinder bottles by application and capacity, then open an exact product page for specifications and ordering.",
    alternates: { canonical: `${SITE_URL}/catalog/cylinder` },
};

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
    urlSearchParams.delete("family");
    urlSearchParams.delete("families");
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
    const [baseCatalog, initialResult, editorial] = await Promise.all([
        baseCatalogPromise,
        activeCatalogPromise,
        getProductFamilyPageContent("Cylinder"),
    ]);
    const search = urlSearchParams.toString();

    return (
        <>
            <CylinderFamilyPageClient
                baseCatalog={baseCatalog}
                initialResult={initialResult}
                search={search ? `?${search}` : ""}
                editorial={editorial}
            />
            <Footer />
        </>
    );
}
