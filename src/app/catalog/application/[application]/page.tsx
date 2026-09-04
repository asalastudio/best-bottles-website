import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";
import { searchCatalogServer } from "@/lib/catalogServer";
import { applicationCatalogSurface } from "@/lib/catalogSurface";
import { paramsToFilters } from "@/lib/catalogFilters";
import { parseBrowseContext } from "@/lib/products/focused-shopping";
import ApplicationFinderClient from "./ApplicationFinderClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
    title: { absolute: "Find Bottles by Application | Best Bottles" },
    description: "Find wholesale bottles by dispensing application, capacity, and fitment.",
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

export default async function ApplicationFinderPage({
    params,
    searchParams,
}: {
    params: Promise<{ application: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [{ application: routeSlug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
    const pathname = `/catalog/application/${routeSlug}`;
    const urlSearchParams = toURLSearchParams(resolvedSearchParams);
    const context = parseBrowseContext(pathname, urlSearchParams);
    if (context.entryMode !== "application" || !context.application) notFound();

    const surface = applicationCatalogSurface(context.application);
    const parsedState = paramsToFilters(urlSearchParams);
    const sort = urlSearchParams.has("sort") ? parsedState.sort : surface.defaultSort;
    const unrefinedArgs = buildCatalogSearchArgs({
        surface,
        filters: {},
        sort: surface.defaultSort,
        view: "visual",
        limit: 240,
    });
    const activeArgs = buildCatalogSearchArgs({
        surface,
        filters: parsedState.filters,
        sort,
        view: "visual",
        limit: 240,
    });
    const unrefinedPromise = searchCatalogServer(unrefinedArgs);
    const activePromise = JSON.stringify(activeArgs) === JSON.stringify(unrefinedArgs)
        ? unrefinedPromise
        : searchCatalogServer(activeArgs);
    const [unrefinedFacetSource, initialResult] = await Promise.all([unrefinedPromise, activePromise]);
    const search = urlSearchParams.toString();

    return (
        <>
            <ApplicationFinderClient
                application={context.application}
                pathname={pathname}
                search={search ? `?${search}` : ""}
                unrefinedFacetSource={unrefinedFacetSource}
                initialResult={initialResult}
            />
            <Footer />
        </>
    );
}
