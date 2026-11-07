import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Footer from "@/components/Footer";
import { buildCatalogSearchArgs } from "@/lib/catalogSearchClient";
import { searchCatalogServer, withCatalogHeroes } from "@/lib/catalogServer";

/** Results sent to the browser carry the hero rows for their SKUs (catalog-heroes.server.ts). */
const searchWithHeroes = async (args: Parameters<typeof searchCatalogServer>[0]) => withCatalogHeroes(await searchCatalogServer(args));
import { applicationCatalogSurface } from "@/lib/catalogSurface";
import { paramsToFilters } from "@/lib/catalogFilters";
import { applicationLandingRedirect, parseBrowseContext } from "@/lib/products/focused-shopping";
import ApplicationFinderClient from "./ApplicationFinderClient";
import { getLocale } from "next-intl/server";
import { defaultLocale, isLocale, type AppLocale } from "@/i18n/config";
import { localizeHref } from "@/i18n/paths";
import { pageAlternates } from "@/i18n/metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The finder is a guided way into one filtered catalog view, the one
 * applicationLandingRedirect names for the bare route. That catalog view is
 * the canonical page; the finder points at it rather than at itself.
 */
export async function generateMetadata({ params }: { params: Promise<{ application: string }> }): Promise<Metadata> {
    const { application } = await params;
    const pathname = `/catalog/application/${application}`;
    const canonicalPath = applicationLandingRedirect(pathname, new URLSearchParams()) ?? pathname;
    return {
        title: { absolute: "Find Bottles by Application | Best Bottles" },
        description: "Find wholesale bottles by dispensing application, capacity, and fitment.",
        alternates: pageAlternates(pathname, canonicalPath),
    };
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
    const landingRedirect = applicationLandingRedirect(pathname, urlSearchParams);
    if (landingRedirect) {
        const localeValue = await getLocale();
        const locale: AppLocale = isLocale(localeValue) ? localeValue : defaultLocale;
        redirect(localizeHref(locale, landingRedirect));
    }

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
    const unrefinedPromise = searchWithHeroes(unrefinedArgs);
    const activePromise = JSON.stringify(activeArgs) === JSON.stringify(unrefinedArgs)
        ? unrefinedPromise
        : searchWithHeroes(activeArgs);
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
