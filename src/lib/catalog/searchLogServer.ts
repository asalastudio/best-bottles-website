import "server-only";
import { api } from "../../../convex/_generated/api";
import { getCatalogConvexClient } from "@/lib/catalogServer";
import { reportError } from "@/lib/observability/report";
import { scrubSearchQuery, type CatalogSearchLogPayload } from "./searchLog";

/**
 * Writes one search-box log event (convex/catalogSearchLog.ts). Silently does
 * nothing without the server write token; never throws.
 */
export async function recordCatalogSearchEvent(payload: CatalogSearchLogPayload): Promise<void> {
    const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    const query = scrubSearchQuery(payload.query);
    if (!writeToken || !query) return;
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
}
