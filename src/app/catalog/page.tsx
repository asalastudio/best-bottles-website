import CatalogClient, { type CatalogSearchResult } from "./CatalogClient";
import { api } from "../../../convex/_generated/api";
import { paramsToFilters } from "@/lib/catalogFilters";
import { getCatalogConvexClient, searchCatalogServer } from "@/lib/catalogServer";

const PAGE_SIZE = 24;
const MAX_VISIBLE_LIMIT = 240;

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
        <CatalogClient
            initialSearchParams={urlSearchParams.toString()}
            initialResult={initialResult}
            initialTaxonomy={initialTaxonomy}
        />
    );
}
