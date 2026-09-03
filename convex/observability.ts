/**
 * Platform health: Sentry issues mirrored into Convex for the Team and
 * Executive hubs.
 *
 * Two feeds keep `errorIssues` current:
 *   1. The signed Sentry webhook (src/app/api/sentry/webhook/route.ts) calls
 *      `recordSentryDelivery` the moment an issue is created, resolved,
 *      regressed or an alert rule fires — real time, but only for what Sentry
 *      chooses to send.
 *   2. `syncFromSentry` (convex/crons.ts, every 15 minutes) asks the Sentry
 *      REST API for recent issues so counts and statuses stay truthful even if
 *      a webhook was missed. It needs SENTRY_API_TOKEN + SENTRY_ORG_SLUG in the
 *      Convex environment and quietly does nothing until they exist.
 *
 * Reads are gated by the same server-only token as every other internal
 * operation (`BEST_BOTTLES_CONVEX_WRITE_TOKEN`), so the hubs load the panel on
 * the server and the browser never sees the token or the query.
 */
import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
    describeDelivery,
    mergeIssueDelivery,
    normalizeSentryIssueObject,
    summarizePlatformHealth,
    type PlatformHealthIssue,
    type SentryDelivery,
    type StoredIssueFields,
} from "../src/lib/observability/sentryIssues";

function verifyToken(token: string) {
    const expected = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
    if (!expected || token !== expected) {
        throw new Error("Unauthorized observability operation");
    }
}

const sentryTagV = v.object({ key: v.string(), value: v.string() });

const sentryIssueV = v.object({
    sentryIssueId: v.string(),
    shortId: v.union(v.string(), v.null()),
    projectSlug: v.string(),
    projectName: v.union(v.string(), v.null()),
    environment: v.union(v.string(), v.null()),
    title: v.string(),
    culprit: v.union(v.string(), v.null()),
    level: v.string(),
    platform: v.union(v.string(), v.null()),
    status: v.string(),
    substatus: v.union(v.string(), v.null()),
    priority: v.union(v.string(), v.null()),
    isUnhandled: v.boolean(),
    count: v.number(),
    userCount: v.number(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    webUrl: v.union(v.string(), v.null()),
    release: v.union(v.string(), v.null()),
    tags: v.array(sentryTagV),
});

const sentryDeliveryV = v.object({
    resource: v.union(v.literal("issue"), v.literal("event_alert"), v.literal("error")),
    action: v.string(),
    actorName: v.union(v.string(), v.null()),
    triggeredRule: v.union(v.string(), v.null()),
    eventId: v.union(v.string(), v.null()),
    eventWebUrl: v.union(v.string(), v.null()),
    isOccurrence: v.boolean(),
    issue: sentryIssueV,
});

/** Strip the Convex bookkeeping fields, leaving exactly the mirror payload. */
function storedFields(doc: Doc<"errorIssues">): StoredIssueFields {
    const fields = { ...doc } as Partial<Doc<"errorIssues">>;
    delete fields._id;
    delete fields._creationTime;
    delete fields.source;
    delete fields.rawContentStored;
    return fields as StoredIssueFields;
}

const MAX_ISSUE_SCAN = 500;

type ApplyOutcome = "inserted" | "updated";

/** Shared upsert used by the webhook path and the sync path. */
async function applyDelivery(
    ctx: { db: { query: any; insert: any; patch: any } },
    delivery: SentryDelivery,
    now: number,
): Promise<{ outcome: ApplyOutcome; issueId: Doc<"errorIssues">["_id"]; statusChanged: boolean; before: StoredIssueFields | null; after: StoredIssueFields }> {
    const existing: Doc<"errorIssues"> | null = await ctx.db
        .query("errorIssues")
        .withIndex("by_sentryIssueId", (q: any) => q.eq("sentryIssueId", delivery.issue.sentryIssueId))
        .unique();

    const before = existing ? storedFields(existing) : null;
    const after = mergeIssueDelivery(before, delivery, now);

    if (existing) {
        await ctx.db.patch(existing._id, after);
        return { outcome: "updated", issueId: existing._id, statusChanged: before!.status !== after.status, before, after };
    }

    const issueId = await ctx.db.insert("errorIssues", { ...after, source: "sentry", rawContentStored: false });
    return { outcome: "inserted", issueId, statusChanged: true, before, after };
}

/**
 * Webhook entry point. Idempotent on Sentry's `Request-ID` header so a retried
 * delivery never double-counts.
 */
export const recordSentryDelivery = mutation({
    args: {
        token: v.string(),
        requestId: v.union(v.string(), v.null()),
        delivery: sentryDeliveryV,
    },
    handler: async (ctx, args) => {
        verifyToken(args.token);
        const now = Date.now();

        if (args.requestId) {
            const duplicate = await ctx.db
                .query("errorIssueEvents")
                .withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
                .first();
            if (duplicate) {
                return { status: "duplicate" as const, issueId: duplicate.issueId };
            }
        }

        const result = await applyDelivery(ctx, args.delivery, now);
        await ctx.db.insert("errorIssueEvents", {
            issueId: result.issueId,
            sentryIssueId: args.delivery.issue.sentryIssueId,
            resource: args.delivery.resource,
            action: args.delivery.action,
            requestId: args.requestId,
            actorName: args.delivery.actorName,
            summary: describeDelivery(args.delivery),
            receivedAt: now,
        });

        return { status: result.outcome, issueId: result.issueId };
    },
});

/** Sync path: batch upsert without journaling unchanged issues. */
export const applySyncedIssues = internalMutation({
    args: {
        startedAt: v.number(),
        issues: v.array(sentryIssueV),
        outcome: v.union(v.literal("ok"), v.literal("failed")),
        detail: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        let changed = 0;

        for (const issue of args.issues) {
            const delivery: SentryDelivery = {
                resource: "issue",
                action: "synced",
                actorName: null,
                triggeredRule: null,
                eventId: null,
                eventWebUrl: null,
                isOccurrence: false,
                issue,
            };
            const result = await applyDelivery(ctx, delivery, now);
            const countMoved = result.before ? result.before.count !== result.after.count : true;
            if (result.outcome === "inserted" || result.statusChanged) {
                changed += 1;
                await ctx.db.insert("errorIssueEvents", {
                    issueId: result.issueId,
                    sentryIssueId: issue.sentryIssueId,
                    resource: "sync",
                    action: result.outcome === "inserted" ? "discovered" : `status → ${result.after.status}`,
                    requestId: null,
                    actorName: null,
                    summary: `${result.outcome === "inserted" ? "discovered by sync" : `now ${result.after.status}`} · ${issue.shortId ?? issue.sentryIssueId} · ${issue.title}`,
                    receivedAt: now,
                });
            } else if (countMoved) {
                changed += 1;
            }
        }

        await ctx.db.insert("errorSyncRuns", {
            startedAt: args.startedAt,
            finishedAt: now,
            outcome: args.outcome,
            issuesSeen: args.issues.length,
            issuesChanged: changed,
            detail: args.detail,
        });

        return { changed };
    },
});

export const recordSyncFailure = internalMutation({
    args: { startedAt: v.number(), detail: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.insert("errorSyncRuns", {
            startedAt: args.startedAt,
            finishedAt: Date.now(),
            outcome: "failed",
            issuesSeen: 0,
            issuesChanged: 0,
            detail: args.detail,
        });
    },
});

function sentryApiBase() {
    const configured = process.env.SENTRY_API_BASE_URL?.trim().replace(/\/+$/, "");
    return configured || "https://sentry.io";
}

async function fetchSentryIssues(base: string, org: string, token: string, queryString: string, now: number) {
    const url = `${base}/api/0/organizations/${encodeURIComponent(org)}/issues/?${queryString}`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!response.ok) {
        throw new Error(`sentry_api_${response.status}`);
    }
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error("sentry_api_unexpected_shape");
    return body
        .map((raw) => normalizeSentryIssueObject(raw, now))
        .filter((issue): issue is NonNullable<typeof issue> => issue !== null);
}

/**
 * Pull recent issues from the Sentry API. Runs on the cron; safe to invoke by
 * hand from the dashboard (`npx convex run observability:syncFromSentry`).
 */
type SyncOutcome =
    | { status: "not_configured" }
    | { status: "ok"; issuesSeen: number; changed: number }
    | { status: "failed"; detail: string };

// The explicit return type is required: the handler calls a mutation in this
// same file through `internal.observability`, so without it TypeScript tries to
// infer this action's type from a graph that includes itself.
export const syncFromSentry = internalAction({
    args: {},
    handler: async (ctx): Promise<SyncOutcome> => {
        const token = process.env.SENTRY_API_TOKEN?.trim();
        const org = process.env.SENTRY_ORG_SLUG?.trim();
        if (!token || !org) {
            // Not configured yet — stay silent rather than writing a "skipped"
            // row every 15 minutes. The dashboard reports "API sync not
            // configured" when no run rows exist.
            return { status: "not_configured" };
        }

        const startedAt = Date.now();
        const base = sentryApiBase();
        const projectFilter = new Set(
            (process.env.SENTRY_PROJECT_SLUGS ?? "")
                .split(/[\s,;]+/)
                .map((slug) => slug.trim())
                .filter(Boolean),
        );

        try {
            const [unresolved, resolved] = await Promise.all([
                fetchSentryIssues(base, org, token, "query=is%3Aunresolved&statsPeriod=14d&sort=date&limit=100", startedAt),
                fetchSentryIssues(base, org, token, "query=is%3Aresolved&statsPeriod=7d&sort=date&limit=50", startedAt),
            ]);
            const merged = new Map<string, (typeof unresolved)[number]>();
            for (const issue of [...unresolved, ...resolved]) {
                if (projectFilter.size && !projectFilter.has(issue.projectSlug)) continue;
                merged.set(issue.sentryIssueId, issue);
            }
            const issues = [...merged.values()];
            const result: { changed: number } = await ctx.runMutation(internal.observability.applySyncedIssues, {
                startedAt,
                issues,
                outcome: "ok",
                detail: null,
            });
            return { status: "ok", issuesSeen: issues.length, changed: result.changed };
        } catch (error) {
            const detail = error instanceof Error ? error.message : "sentry_sync_failed";
            await ctx.runMutation(internal.observability.recordSyncFailure, { startedAt, detail });
            return { status: "failed", detail };
        }
    },
});

/**
 * Retention / cleanup for the mirror. Sentry stays the system of record, so
 * dropping rows here loses nothing that matters — they come back on the next
 * sync if the issue is still open in Sentry.
 *
 * Pass `sentryIssueIds` to drop specific issues (a removed project, or test
 * deliveries), or `resolvedBefore` to age out issues resolved long ago.
 *
 *   npx convex run observability:pruneMirroredIssues '"'"'{"sentryIssueIds":["900001"]}'"'"'
 */
export const pruneMirroredIssues = internalMutation({
    args: {
        sentryIssueIds: v.optional(v.array(v.string())),
        resolvedBefore: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const targets: Array<Doc<"errorIssues">> = [];

        for (const sentryIssueId of args.sentryIssueIds ?? []) {
            const doc = await ctx.db
                .query("errorIssues")
                .withIndex("by_sentryIssueId", (q) => q.eq("sentryIssueId", sentryIssueId))
                .unique();
            if (doc) targets.push(doc);
        }

        if (args.resolvedBefore !== undefined) {
            const aged = await ctx.db
                .query("errorIssues")
                .withIndex("by_status_lastSeenAt", (q) =>
                    q.eq("status", "resolved").lt("lastSeenAt", args.resolvedBefore!),
                )
                .take(MAX_ISSUE_SCAN);
            targets.push(...aged);
        }

        const seen = new Set<string>();
        let issuesDeleted = 0;
        let eventsDeleted = 0;

        for (const doc of targets) {
            if (seen.has(doc._id)) continue;
            seen.add(doc._id);
            const events = await ctx.db
                .query("errorIssueEvents")
                .withIndex("by_issueId_receivedAt", (q) => q.eq("issueId", doc._id))
                .collect();
            for (const event of events) {
                await ctx.db.delete(event._id);
                eventsDeleted += 1;
            }
            await ctx.db.delete(doc._id);
            issuesDeleted += 1;
        }

        return { issuesDeleted, eventsDeleted };
    },
});

function toHealthIssue(doc: Doc<"errorIssues">): PlatformHealthIssue {
    return {
        sentryIssueId: doc.sentryIssueId,
        shortId: doc.shortId,
        projectSlug: doc.projectSlug,
        environment: doc.environment,
        title: doc.title,
        culprit: doc.culprit,
        level: doc.level,
        status: doc.status,
        substatus: doc.substatus,
        priority: doc.priority,
        isUnhandled: doc.isUnhandled,
        count: doc.count,
        userCount: doc.userCount,
        firstSeenAt: doc.firstSeenAt,
        lastSeenAt: doc.lastSeenAt,
        webUrl: doc.webUrl,
        lastAction: doc.lastAction,
    };
}

/**
 * Everything the Platform Health panel needs in one read. `issueLimit` bounds
 * the list rendered; the summary always covers the most recent MAX_ISSUE_SCAN
 * issues by lastSeen so the counts stay stable as the table grows.
 */
export const getPlatformHealth = query({
    args: {
        token: v.string(),
        issueLimit: v.optional(v.number()),
        activityLimit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        verifyToken(args.token);
        const now = Date.now();
        const issueLimit = Math.max(1, Math.min(args.issueLimit ?? 25, 100));
        const activityLimit = Math.max(0, Math.min(args.activityLimit ?? 20, 100));

        const recent = await ctx.db.query("errorIssues").withIndex("by_lastSeenAt").order("desc").take(MAX_ISSUE_SCAN);
        const scanned = recent.map(toHealthIssue);
        const summary = summarizePlatformHealth(scanned, now);

        const unresolvedTop = scanned.filter((issue) => issue.status === "unresolved").slice(0, issueLimit);
        const recentlyResolved = scanned.filter((issue) => issue.status === "resolved").slice(0, Math.min(5, issueLimit));

        const activityDocs = activityLimit
            ? await ctx.db.query("errorIssueEvents").withIndex("by_receivedAt").order("desc").take(activityLimit)
            : [];
        const activity = activityDocs.map((event) => ({
            sentryIssueId: event.sentryIssueId,
            resource: event.resource,
            action: event.action,
            actorName: event.actorName,
            summary: event.summary,
            receivedAt: event.receivedAt,
        }));

        const lastSyncDoc = await ctx.db.query("errorSyncRuns").withIndex("by_startedAt").order("desc").first();
        const lastSync = lastSyncDoc
            ? {
                  startedAt: lastSyncDoc.startedAt,
                  finishedAt: lastSyncDoc.finishedAt,
                  outcome: lastSyncDoc.outcome,
                  issuesSeen: lastSyncDoc.issuesSeen,
                  issuesChanged: lastSyncDoc.issuesChanged,
                  detail: lastSyncDoc.detail,
              }
            : null;

        const lastWebhookAt = activityDocs.find((event) => event.resource !== "sync")?.receivedAt ?? null;

        return {
            generatedAt: now,
            summary,
            issues: unresolvedTop,
            recentlyResolved,
            activity,
            lastSync,
            lastWebhookAt,
            totalTracked: scanned.length,
            apiSyncConfigured: Boolean(process.env.SENTRY_API_TOKEN && process.env.SENTRY_ORG_SLUG),
        };
    },
});
