import { NextRequest, NextResponse } from "next/server";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import { parseSearchLogPayload } from "@/lib/catalog/searchLog";
import { recordCatalogSearchEvent } from "@/lib/catalog/searchLogServer";

/**
 * POST /api/catalog/search-log
 *
 * Counts storefront searches, zero-result searches and suggestion use per day
 * (convex/catalogSearchLog.ts). Always answers 204 so logging can never slow
 * down or break the catalogue; nothing identifying the shopper is forwarded.
 */
export async function POST(request: NextRequest) {
    const noContent = () => new NextResponse(null, { status: 204 });
    if (!process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN) return noContent();

    const rateLimited = await enforceGraceRateLimit(request, {
        route: "catalog-search-log",
        limit: 60,
        windowMs: 60_000,
    });
    if (rateLimited) return noContent();

    const payload = parseSearchLogPayload(await request.json().catch(() => null));
    if (payload) await recordCatalogSearchEvent(payload);
    return noContent();
}
