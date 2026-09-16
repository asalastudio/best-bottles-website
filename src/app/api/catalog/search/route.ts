import { NextRequest, NextResponse } from "next/server";
import { searchCatalogServer, type CatalogSearchArgs } from "@/lib/catalogServer";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import { reportError } from "@/lib/observability/report";

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
        if (!Number.isFinite(limit) || limit < 1 || limit > 48) {
            return NextResponse.json({ error: "limit must be between 1 and 48" }, { status: 400 });
        }
        const result = await searchCatalogServer({ ...args, limit });
        return NextResponse.json(result);
    } catch (error) {
        reportError(error, { area: "catalog-search" });
        const message = error instanceof Error ? error.message : "Catalog search failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
