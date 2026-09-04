import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import { searchCatalogServer } from "@/lib/catalogServer";
import { paramsToFilters } from "@/lib/catalogFilters";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";
import { familyCatalogSurface } from "@/lib/catalogSurface";
import { HOME_FAMILY_MOSAIC } from "@/lib/homepageMerchandising";
import { familyFromSlug, familyToSlug } from "@/lib/products/focused-shopping";
import { getProductFamilyPageContent } from "@/sanity/lib/queries";
import { SITE_URL } from "@/lib/seo";
import FamilyPageClient from "./FamilyPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function familyHeroFallback(family: string): string {
    return HOME_FAMILY_MOSAIC.find((card) => card.family === family)?.image ?? "/assets/Hero-BB.png";
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ family: string }>;
}): Promise<Metadata> {
    const family = familyFromSlug((await params).family);
    if (!family) return {};
    const slug = familyToSlug(family);
    return {
        title: { absolute: `${family} Bottle Family — Build or Browse | Best Bottles` },
        description: `Find wholesale ${family} bottles by application and capacity, then open an exact product page for specifications and ordering.`,
        alternates: { canonical: `${SITE_URL}/catalog/${slug}` },
    };
}

export default async function FamilyLandingPage({
    params,
    searchParams,
}: {
    params: Promise<{ family: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ family: routeSlug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
    const family = familyFromSlug(routeSlug);
    if (!family) notFound();

    const surface = familyCatalogSurface(family);
    const urlSearchParams = toURLSearchParams(resolvedSearchParams);
    urlSearchParams.delete("family");
    urlSearchParams.delete("families");
    const parsedState = paramsToFilters(urlSearchParams);
    const baseArgs = buildCatalogSearchArgs({
        surface,
        filters: {},
        sort: surface.defaultSort,
        view: "visual",
        limit: 240,
    });
    const activeArgs = buildCatalogSearchArgs({
        surface,
        filters: parsedState.filters,
        sort: urlSearchParams.has("sort") ? parsedState.sort : surface.defaultSort,
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
        getProductFamilyPageContent(family),
    ]);
    const search = urlSearchParams.toString();

    return (
        <>
            <FamilyPageClient
                family={family}
                heroFallback={familyHeroFallback(family)}
                baseCatalog={baseCatalog}
                initialResult={initialResult}
                search={search ? `?${search}` : ""}
                editorial={editorial}
            />
            <Footer />
        </>
    );
}
