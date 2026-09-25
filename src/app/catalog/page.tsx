import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import CatalogClient, { type CatalogSearchResult } from "./CatalogClient";
import Footer from "@/components/Footer";
import { catalogBrowseRedirect, paramsToFilters } from "@/lib/catalogFilters";
import { searchCatalogServer } from "@/lib/catalogServer";
import { catalogInterpretationMode } from "@/lib/catalog/searchInterpretationServer";
import { defaultLocale, isLocale, type AppLocale } from "@/i18n/config";
import { buildHreflangAlternates } from "@/i18n/metadata";
import { localizeHref } from "@/i18n/paths";
import enMessages from "../../../messages/en.json";
import esMessages from "../../../messages/es.json";

const PAGE_SIZE = 24;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
    const localeValue = await getLocale();
    const locale: AppLocale = isLocale(localeValue) ? localeValue : defaultLocale;
    const copy = locale === "es" ? esMessages.catalog : enMessages.catalog;
    const path = locale === "es" ? "/es/catalog" : "/catalog";
    return {
        title: { absolute: copy.seoTitle },
        description: copy.description,
        alternates: buildHreflangAlternates(path),
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

export default async function CatalogPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolvedSearchParams = await searchParams;
    const urlSearchParams = toURLSearchParams(resolvedSearchParams);
    const browseRedirect = catalogBrowseRedirect(urlSearchParams);
    if (browseRedirect) {
        const localeValue = await getLocale();
        const locale: AppLocale = isLocale(localeValue) ? localeValue : defaultLocale;
        redirect(localizeHref(locale, browseRedirect));
    }
    const initialState = paramsToFilters(urlSearchParams);

    const initialResult = await (searchCatalogServer({
        filters: initialState.filters,
        sort: initialState.sort,
        view: initialState.view,
        limit: PAGE_SIZE,
        cursor: null,
    }) as Promise<CatalogSearchResult>);

    return (
        <>
            <CatalogClient
                initialSearchParams={urlSearchParams.toString()}
                initialResult={initialResult}
                interpretMode={catalogInterpretationMode()}
            />
            <Footer />
        </>
    );
}
