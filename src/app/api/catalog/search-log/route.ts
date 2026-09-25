import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getCatalogConvexClient } from "@/lib/catalogServer";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import { reportError } from "@/lib/observability/report";
import { parseSearchLogPayload, scrubSearchQuery } from "@/lib/catalog/searchLog";

/**
 * POST /api/catalog/search-log
 *
 * Counts storefront searches, zero-result searches and suggestion use per day
 * (convex/catalogSearchLog.ts). Always answers 204 so logging can never slow
 * down or break the catalogue; nothing identifying the shopper is forwarded.
 */
export async function POST(request: NextRequest) {
    const noContent = () => new NextResponse(null, { status: 204 });
    const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!writeToken) return noContent();

    const rateLimited = await enforceGraceRateLimit(request, {
        route: "catalog-search-log",
        limit: 60,
        windowMs: 60_000,
    });
    if (rateLimited) return noContent();

    const payload = parseSearchLogPayload(await request.json().catch(() => null));
    const query = payload ? scrubSearchQuery(payload.query) : "";
    if (!payload || !query) return noContent();

    try {
        await getCatalogConvexClient().mutation(api.catalogSearchLog.record, {
            token: writeToken,
            query,
            locale: payload.locale,
            event: payload.event,
        });
    } catch (error) {
        reportError(error, { area: "catalog-search-log", level: "warning" });
    }
    return noContent();
}
