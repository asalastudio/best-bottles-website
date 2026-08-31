import type { CatalogFilters, SortValue, ViewMode } from "@/lib/catalogFilters";
import type { CatalogSearchResultShape } from "@/lib/catalogSearchFallback";
import type { CatalogSearchArgs } from "@/lib/catalogServer";
import { applyCatalogSurface, type CatalogSurfaceManifest } from "@/lib/catalogSurface";

export class CatalogSearchRequestError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "CatalogSearchRequestError";
        this.status = status;
    }
}

export function buildCatalogSearchArgs(input: {
    surface: CatalogSurfaceManifest;
    filters: Partial<CatalogFilters>;
    sort?: SortValue;
    view?: ViewMode;
    limit?: number;
    cursor?: string | null;
}): CatalogSearchArgs {
    return {
        filters: applyCatalogSurface(input.filters, input.surface),
        sort: input.sort ?? input.surface.defaultSort,
        view: input.view ?? "visual",
        limit: input.limit ?? 48,
        cursor: input.cursor ?? null,
    };
}

export async function fetchCatalogSearch(
    args: CatalogSearchArgs,
    signal?: AbortSignal,
): Promise<CatalogSearchResultShape> {
    const response = await fetch("/api/catalog/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal,
    });
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new CatalogSearchRequestError(
            body?.error || `Catalog search failed with status ${response.status}`,
            response.status,
        );
    }
    return response.json() as Promise<CatalogSearchResultShape>;
}
