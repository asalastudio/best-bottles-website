import { NextRequest, NextResponse } from "next/server";
import { searchCatalogServer, withCatalogHeroes, type CatalogSearchArgs } from "@/lib/catalogServer";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import { reportError } from "@/lib/observability/report";

/**
 * The catalog grid pages 48 at a time; the family and application finders ask for one 240-row page,
 * the same as their server render. Until 7 Nov 2026 this route rejected anything over 48, so every
 * refine on a finder failed with HTTP 400. The search itself is unchanged: it returns exactly what the
 * finder's server render gets for the same arguments (Convex's searchCatalog keeps its own 48-row
 * page cap for its read budget).
 */
const CATALOG_SEARCH_MAX_LIMIT = 240;

export async function POST(request: NextRequest) {
    try {
        const rateLimited = await enforceGraceRateLimit(request, {
            route: "catalog-search",
            limit: 120,
            windowMs: 60_000,
        });
        if (rateLimited) return rateLimited;

        const args = await request.json() as CatalogSearchArgs;
        const limit = Number(args.limit);
        if (!Number.isFinite(limit) || limit < 1 || limit > CATALOG_SEARCH_MAX_LIMIT) {
            return NextResponse.json({ error: `limit must be between 1 and ${CATALOG_SEARCH_MAX_LIMIT}` }, { status: 400 });
        }
        const result = await searchCatalogServer({ ...args, limit });
        return NextResponse.json(withCatalogHeroes(result));
    } catch (error) {
        reportError(error, { area: "catalog-search" });
        const message = error instanceof Error ? error.message : "Catalog search failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
