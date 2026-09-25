import { NextRequest, NextResponse } from "next/server";
import { enforceGraceRateLimit } from "@/lib/graceRateLimitServer";
import { reportError } from "@/lib/observability/report";
import { normalizeCatalogSearchArgs } from "@/lib/catalogServer";
import { SEARCH_LOG_MAX_QUERY_LENGTH } from "@/lib/catalog/searchLog";
import { recordCatalogSearchEvent } from "@/lib/catalog/searchLogServer";
import { catalogInterpretationMode, interpretCatalogSearch } from "@/lib/catalog/searchInterpretationServer";

/**
 * POST /api/catalog/interpret
 *
 * Called by the catalogue only after a search has found nothing. Returns up to
 * three "closest match" filter sets, each already counted against the live
 * catalogue (src/lib/catalog/searchInterpretation.ts). Controlled by
 * CATALOG_SEARCH_INTERPRETATION (off | suggest | auto; default off).
 */
export async function POST(request: NextRequest) {
    const mode = catalogInterpretationMode();
    if (mode === "off") return NextResponse.json({ mode, suggestions: [], reason: "disabled", notMatched: [] });

    const body = await request.json().catch(() => null) as { query?: unknown; filters?: unknown; locale?: unknown } | null;
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query || query.length > SEARCH_LOG_MAX_QUERY_LENGTH) {
        return NextResponse.json({ error: "query must be 1-120 characters" }, { status: 400 });
    }

    const rateLimited = await enforceGraceRateLimit(request, { route: "catalog-interpret", limit: 30, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const locale = body?.locale === "es" ? "es" : "en";
    // Same sanitising as the catalogue search itself: unknown keys and wrong types are dropped.
    const { filters } = normalizeCatalogSearchArgs({
        filters: body?.filters && typeof body.filters === "object" ? body.filters : {},
        sort: "featured",
        view: "visual",
        limit: 1,
    });
    try {
        const interpretation = await interpretCatalogSearch({ query, filters, locale });
        if (interpretation.suggestions.length > 0) {
            await recordCatalogSearchEvent({ query, locale, event: { kind: "suggestions_shown", labels: interpretation.suggestions.map((s) => s.label) } });
        }
        return NextResponse.json(interpretation);
    } catch (error) {
        reportError(error, { area: "catalog-interpret" });
        return NextResponse.json({ mode, suggestions: [], reason: "jev_unavailable", notMatched: [] });
    }
}
