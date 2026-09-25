/**
 * Daily counters for what shoppers type into the storefront search box.
 *
 * One row per (UTC day, cleaned query, locale). The Next.js route
 * `src/app/api/catalog/search-log/route.ts` scrubs the query and forwards it
 * with the server-only BEST_BOTTLES_CONVEX_WRITE_TOKEN; nothing here stores a
 * user, session or IP. Rows older than RETENTION_DAYS are deleted daily.
 */
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const RETENTION_DAYS = 90;
const MAX_LABELS = 3;

function verifyToken(token: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected || token !== expected) {
        throw new Error("Unauthorized catalog search log operation");
    }
}

function utcDay(now: number): string {
    return new Date(now).toISOString().slice(0, 10);
}

const eventV = v.union(
    v.object({ kind: v.literal("search"), resultCount: v.number() }),
    v.object({ kind: v.literal("suggestions_shown"), labels: v.array(v.string()) }),
    v.object({ kind: v.literal("suggestion_click"), label: v.string() }),
);

/** A catalogue page count: whole, non-negative, and never larger than the catalogue. */
function boundedResultCount(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100_000, Math.max(0, Math.round(value)));
}

export const record = mutation({
    args: {
        token: v.string(),
        query: v.string(),
        locale: v.string(),
        event: eventV,
    },
    returns: v.object({ status: v.union(v.literal("recorded"), v.literal("skipped")) }),
    handler: async (ctx, args) => {
        verifyToken(args.token);
        const query = args.query.trim().slice(0, 120);
        const locale = args.locale.slice(0, 8);
        if (!query) return { status: "skipped" as const };
        const now = Date.now();
        const day = utcDay(now);
        const existing = await ctx.db
            .query("catalogSearchDaily")
            .withIndex("by_day_query_locale", (q) => q.eq("day", day).eq("query", query).eq("locale", locale))
            .first();
        const row = existing ?? {
            day, query, locale,
            searches: 0, zeroResults: 0, lastResultCount: 0,
            suggestionsShown: 0, suggestionClicks: 0, lastSuggestions: [] as string[], lastClicked: null as string | null,
            updatedAt: now,
        };
        const next = { ...row, updatedAt: now };
        const event = args.event;
        if (event.kind === "search") {
            next.searches += 1;
            next.lastResultCount = boundedResultCount(event.resultCount);
            if (next.lastResultCount === 0) next.zeroResults += 1;
        } else if (event.kind === "suggestions_shown") {
            next.suggestionsShown += 1;
            next.lastSuggestions = event.labels.slice(0, MAX_LABELS).map((label) => label.slice(0, 80));
        } else {
            next.suggestionClicks += 1;
            next.lastClicked = event.label.slice(0, 80);
        }
        if (existing) {
            await ctx.db.patch(existing._id, {
                searches: next.searches, zeroResults: next.zeroResults, lastResultCount: next.lastResultCount,
                suggestionsShown: next.suggestionsShown, suggestionClicks: next.suggestionClicks,
                lastSuggestions: next.lastSuggestions, lastClicked: next.lastClicked, updatedAt: now,
            });
        } else {
            await ctx.db.insert("catalogSearchDaily", next);
        }
        return { status: "recorded" as const };
    },
});

/** Deletes rows older than the retention window, 500 at a time. */
export const deleteExpired = internalMutation({
    args: {},
    returns: v.object({ deleted: v.number() }),
    handler: async (ctx) => {
        const cutoff = utcDay(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const expired = await ctx.db
            .query("catalogSearchDaily")
            .withIndex("by_day", (q) => q.lt("day", cutoff))
            .take(500);
        for (const row of expired) await ctx.db.delete(row._id);
        if (expired.length === 500) {
            await ctx.scheduler.runAfter(0, internal.catalogSearchLog.deleteExpired, {});
        }
        return { deleted: expired.length };
    },
});
