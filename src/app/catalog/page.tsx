import type { Metadata } from "next";
import CatalogClient, { type CatalogSearchResult } from "./CatalogClient";
import Footer from "@/components/Footer";
import { api } from "../../../convex/_generated/api";
import { paramsToFilters } from "@/lib/catalogFilters";
import { getCatalogConvexClient, searchCatalogServer } from "@/lib/catalogServer";
import { SITE_URL } from "@/lib/seo";

const PAGE_SIZE = 24;
const MAX_VISIBLE_LIMIT = 240;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
    title: { absolute: "Catalog — Wholesale Glass Bottles & Packaging | Best Bottles" },
    description:
        "Browse wholesale glass bottles, jars, sprayers, droppers, roll-ons, and packaging components by family, capacity, color, applicator, and neck finish.",
    alternates: { canonical: `${SITE_URL}/catalog` },
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

function clampVisibleLimit(rawLimit: string | null): number {
    const parsed = Number(rawLimit);
    if (!Number.isFinite(parsed) || parsed <= PAGE_SIZE) return PAGE_SIZE;
    return Math.min(Math.ceil(parsed / PAGE_SIZE) * PAGE_SIZE, MAX_VISIBLE_LIMIT);
}

export default async function CatalogPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolvedSearchParams = await searchParams;
    const urlSearchParams = toURLSearchParams(resolvedSearchParams);
    const initialState = paramsToFilters(urlSearchParams);
    const initialLimit = clampVisibleLimit(urlSearchParams.get("limit"));
    const convex = getCatalogConvexClient();

    const [initialResult, initialTaxonomy] = await Promise.all([
        searchCatalogServer({
            filters: initialState.filters,
            sort: initialState.sort,
            view: initialState.view,
            limit: initialLimit,
            cursor: null,
        }) as Promise<CatalogSearchResult>,
        convex.query(api.products.getCatalogTaxonomy, {}),
    ]);

    return (
        <>
            <CatalogClient
                initialSearchParams={urlSearchParams.toString()}
                initialResult={initialResult}
                initialTaxonomy={initialTaxonomy}
            />
            <Footer />
        </>
    );
}
