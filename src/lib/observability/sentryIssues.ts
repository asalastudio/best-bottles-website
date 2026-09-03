/**
 * Pure normalizers for what Sentry tells us about an issue — from the
 * integration-platform webhook (`issue`, `event_alert` and `error` resources)
 * and from the REST API used by the 15-minute sync in convex/observability.ts.
 *
 * Convex imports this file (the same way convex/knowledgeOperations.ts imports
 * src/lib/knowledge/operations), so it must stay free of React, Next and
 * Node-only modules.
 *
 * Privacy rule: we keep the headline — title, culprit, level, counts, and a
 * deep link back into Sentry — and never the payload body. No stack frames,
 * request bodies or user records are copied out of Sentry. The schema pins
 * this with `errorIssues.rawContentStored: v.literal(false)`.
 */

export type SentryIssueRecord = {
    sentryIssueId: string;
    shortId: string | null;
    projectSlug: string;
    projectName: string | null;
    environment: string | null;
    title: string;
    culprit: string | null;
    level: string;
    platform: string | null;
    status: string;
    substatus: string | null;
    priority: string | null;
    isUnhandled: boolean;
    count: number;
    userCount: number;
    firstSeenAt: number;
    lastSeenAt: number;
    webUrl: string | null;
    release: string | null;
    tags: Array<{ key: string; value: string }>;
};

export const SENTRY_WEBHOOK_RESOURCES = ["issue", "event_alert", "error"] as const;
export type SentryWebhookResource = (typeof SENTRY_WEBHOOK_RESOURCES)[number];

export type SentryDelivery = {
    resource: SentryWebhookResource;
    action: string;
    actorName: string | null;
    triggeredRule: string | null;
    eventId: string | null;
    eventWebUrl: string | null;
    /** True when the delivery represents one more occurrence rather than issue state. */
    isOccurrence: boolean;
    issue: SentryIssueRecord;
};

export const SENTRY_LEVELS = ["fatal", "error", "warning", "info", "debug"] as const;

type Dict = Record<string, unknown>;

function dict(value: unknown): Dict | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Dict) : null;
}

function str(value: unknown): string | null {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
}

function num(value: unknown, fallback = 0): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

/** ISO-8601 string, epoch seconds or epoch millis → epoch millis. */
export function toEpochMs(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return toEpochMs(numeric, fallback);
    }
    return fallback;
}

function normalizeLevel(value: unknown): string {
    const level = str(value)?.toLowerCase() ?? "error";
    return (SENTRY_LEVELS as readonly string[]).includes(level) ? level : "error";
}

function normalizeTags(value: unknown): Array<{ key: string; value: string }> {
    if (!Array.isArray(value)) return [];
    const out: Array<{ key: string; value: string }> = [];
    for (const entry of value) {
        if (Array.isArray(entry) && entry.length >= 2) {
            const key = str(entry[0]);
            const tagValue = str(entry[1]);
            if (key && tagValue) out.push({ key, value: tagValue });
            continue;
        }
        const obj = dict(entry);
        if (obj) {
            const key = str(obj.key);
            const tagValue = str(obj.value);
            if (key && tagValue) out.push({ key, value: tagValue });
        }
    }
    return out.slice(0, 40);
}

function tagValue(tags: Array<{ key: string; value: string }>, key: string): string | null {
    return tags.find((tag) => tag.key === key)?.value ?? null;
}

function projectFrom(value: unknown): { slug: string; name: string | null } {
    const obj = dict(value);
    if (obj) {
        const slug = str(obj.slug) ?? (str(obj.id) ? `project-${str(obj.id)}` : null);
        return { slug: slug ?? "unknown", name: str(obj.name) };
    }
    const scalar = str(value);
    // event_alert payloads carry the numeric project id only.
    return { slug: scalar ? (/^\d+$/.test(scalar) ? `project-${scalar}` : scalar) : "unknown", name: null };
}

/** `https://org.sentry.io/issues/123/events/abc/` → `https://org.sentry.io/issues/123/` */
export function issueUrlFromEventUrl(eventWebUrl: string | null): string | null {
    if (!eventWebUrl) return null;
    return eventWebUrl.replace(/events\/[^/]+\/?$/, "");
}

/**
 * The `issue` object is the same shape in the webhook (`data.issue`) and in the
 * REST API (`GET /api/0/organizations/{org}/issues/`), so one normalizer serves
 * both. Returns null when the object has no id or title.
 */
export function normalizeSentryIssueObject(raw: unknown, now: number): SentryIssueRecord | null {
    const issue = dict(raw);
    if (!issue) return null;
    const id = str(issue.id);
    const title = str(issue.title) ?? str(dict(issue.metadata)?.title);
    if (!id || !title) return null;

    const project = projectFrom(issue.project);
    const firstSeenAt = toEpochMs(issue.firstSeen, now);
    const lastSeenAt = toEpochMs(issue.lastSeen, firstSeenAt);
    const tags = normalizeTags(issue.tags);

    return {
        sentryIssueId: id,
        shortId: str(issue.shortId),
        projectSlug: project.slug,
        projectName: project.name,
        environment: str(issue.environment) ?? tagValue(tags, "environment"),
        title: title.slice(0, 500),
        culprit: str(issue.culprit)?.slice(0, 500) ?? null,
        level: normalizeLevel(issue.level),
        platform: str(issue.platform),
        status: str(issue.status)?.toLowerCase() ?? "unresolved",
        substatus: str(issue.substatus)?.toLowerCase() ?? null,
        priority: str(issue.priority)?.toLowerCase() ?? null,
        isUnhandled: issue.isUnhandled === true,
        count: Math.max(0, Math.round(num(issue.count, 1))),
        userCount: Math.max(0, Math.round(num(issue.userCount, 0))),
        firstSeenAt,
        lastSeenAt: Math.max(firstSeenAt, lastSeenAt),
        webUrl: str(issue.web_url) ?? str(issue.permalink),
        release: str(dict(issue.release)?.version) ?? str(issue.release),
        tags,
    };
}

/** `data.event` (event_alert) or `data.error` (error resource) → one occurrence. */
function normalizeSentryEventObject(raw: unknown, now: number): { issue: SentryIssueRecord; eventId: string | null; eventWebUrl: string | null } | null {
    const event = dict(raw);
    if (!event) return null;
    const issueId = str(event.issue_id) ?? str(dict(event.issue)?.id);
    const title = str(event.title) ?? str(event.message) ?? str(dict(event.metadata)?.title);
    if (!issueId || !title) return null;

    const tags = normalizeTags(event.tags);
    const project = projectFrom(event.project);
    const seenAt = toEpochMs(event.datetime ?? event.timestamp, now);
    const eventWebUrl = str(event.web_url);

    return {
        eventId: str(event.event_id),
        eventWebUrl,
        issue: {
            sentryIssueId: issueId,
            shortId: null,
            projectSlug: project.slug,
            projectName: project.name,
            environment: str(event.environment) ?? tagValue(tags, "environment"),
            title: title.slice(0, 500),
            culprit: str(event.culprit)?.slice(0, 500) ?? null,
            level: normalizeLevel(event.level ?? tagValue(tags, "level")),
            platform: str(event.platform),
            status: "unresolved",
            substatus: null,
            priority: null,
            isUnhandled: dict(dict(dict(event.exception)?.values)?.[0 as unknown as string])?.mechanism !== undefined
                ? false
                : false,
            count: 1,
            userCount: 0,
            firstSeenAt: seenAt,
            lastSeenAt: seenAt,
            webUrl: issueUrlFromEventUrl(eventWebUrl),
            release: str(event.release),
            tags,
        },
    };
}

/**
 * Turn one webhook request into a delivery we can apply. Returns null for
 * resources we do not mirror (installation, comment, metric_alert, …) or for
 * malformed payloads; the receiver answers 200 in both cases so Sentry never
 * treats an ignored resource as a failing endpoint.
 */
export function normalizeSentryWebhook(resourceHeader: string | null, body: unknown, now: number): SentryDelivery | null {
    const resource = (resourceHeader ?? "").trim().toLowerCase();
    const payload = dict(body);
    if (!payload) return null;
    const data = dict(payload.data);
    const action = str(payload.action) ?? "unknown";
    const actorName = str(dict(payload.actor)?.name);

    if (resource === "issue") {
        const issue = normalizeSentryIssueObject(data?.issue, now);
        if (!issue) return null;
        return { resource, action, actorName, triggeredRule: null, eventId: null, eventWebUrl: null, isOccurrence: false, issue };
    }

    if (resource === "event_alert" || resource === "error") {
        const normalized = normalizeSentryEventObject(resource === "error" ? data?.error : data?.event, now);
        if (!normalized) return null;
        return {
            resource,
            action: resource === "event_alert" ? "triggered" : "occurred",
            actorName,
            triggeredRule: str(data?.triggered_rule),
            eventId: normalized.eventId,
            eventWebUrl: normalized.eventWebUrl,
            isOccurrence: true,
            issue: normalized.issue,
        };
    }

    return null;
}

export type StoredIssueFields = SentryIssueRecord & {
    lastAction: string;
    lastActorName: string | null;
    lastTriggeredRule: string | null;
    lastEventId: string | null;
    lastEventWebUrl: string | null;
    updatedAt: number;
};

/**
 * Merge a delivery into what we already hold. Issue-state deliveries win on
 * state; occurrence deliveries only advance counts and lastSeen — and reopen a
 * resolved issue, which is exactly what Sentry itself does on regression.
 */
export function mergeIssueDelivery(existing: StoredIssueFields | null, delivery: SentryDelivery, now: number): StoredIssueFields {
    const incoming = delivery.issue;
    const base: StoredIssueFields = existing ?? {
        ...incoming,
        lastAction: delivery.action,
        lastActorName: delivery.actorName,
        lastTriggeredRule: delivery.triggeredRule,
        lastEventId: delivery.eventId,
        lastEventWebUrl: delivery.eventWebUrl,
        updatedAt: now,
    };

    const keepKnownProject = existing && !existing.projectSlug.startsWith("project-") && incoming.projectSlug.startsWith("project-");

    if (delivery.isOccurrence) {
        const regressed = existing ? existing.status !== "unresolved" : false;
        return {
            ...base,
            title: incoming.title || base.title,
            culprit: incoming.culprit ?? base.culprit,
            level: incoming.level || base.level,
            platform: base.platform ?? incoming.platform,
            projectSlug: keepKnownProject ? existing!.projectSlug : (incoming.projectSlug === "unknown" ? base.projectSlug : incoming.projectSlug),
            projectName: base.projectName ?? incoming.projectName,
            environment: incoming.environment ?? base.environment,
            release: incoming.release ?? base.release,
            tags: incoming.tags.length ? incoming.tags : base.tags,
            webUrl: base.webUrl ?? incoming.webUrl,
            status: regressed ? "unresolved" : base.status,
            substatus: regressed ? "regressed" : base.substatus,
            count: existing ? existing.count + 1 : Math.max(1, incoming.count),
            userCount: base.userCount,
            firstSeenAt: existing ? Math.min(existing.firstSeenAt, incoming.firstSeenAt) : incoming.firstSeenAt,
            lastSeenAt: Math.max(base.lastSeenAt, incoming.lastSeenAt),
            lastAction: delivery.action,
            lastActorName: delivery.actorName,
            lastTriggeredRule: delivery.triggeredRule ?? base.lastTriggeredRule,
            lastEventId: delivery.eventId ?? base.lastEventId,
            lastEventWebUrl: delivery.eventWebUrl ?? base.lastEventWebUrl,
            updatedAt: now,
        };
    }

    return {
        ...base,
        ...incoming,
        shortId: incoming.shortId ?? base.shortId,
        projectSlug: keepKnownProject ? existing!.projectSlug : incoming.projectSlug,
        projectName: incoming.projectName ?? base.projectName,
        environment: incoming.environment ?? base.environment,
        release: incoming.release ?? base.release,
        tags: incoming.tags.length ? incoming.tags : base.tags,
        webUrl: incoming.webUrl ?? base.webUrl,
        // Sentry's count is authoritative; never let a stale sync roll it back.
        count: Math.max(incoming.count, existing?.count ?? 0),
        userCount: Math.max(incoming.userCount, existing?.userCount ?? 0),
        firstSeenAt: existing ? Math.min(existing.firstSeenAt, incoming.firstSeenAt) : incoming.firstSeenAt,
        lastSeenAt: Math.max(base.lastSeenAt, incoming.lastSeenAt),
        lastAction: delivery.action,
        lastActorName: delivery.actorName,
        lastTriggeredRule: base.lastTriggeredRule,
        lastEventId: base.lastEventId,
        lastEventWebUrl: base.lastEventWebUrl,
        updatedAt: now,
    };
}

export function describeDelivery(delivery: SentryDelivery): string {
    const label = delivery.issue.shortId ?? delivery.issue.sentryIssueId;
    switch (delivery.resource) {
        case "issue":
            return `${delivery.action} · ${label} · ${delivery.issue.title}`;
        case "event_alert":
            return `alert "${delivery.triggeredRule ?? "rule"}" fired · ${label} · ${delivery.issue.title}`;
        default:
            return `new occurrence · ${label} · ${delivery.issue.title}`;
    }
}

// ─── Dashboard summary ────────────────────────────────────────────────────────

export type PlatformHealthIssue = Pick<
    StoredIssueFields,
    "sentryIssueId" | "shortId" | "projectSlug" | "environment" | "title" | "culprit" | "level" | "status" | "substatus" | "priority" | "isUnhandled" | "count" | "userCount" | "firstSeenAt" | "lastSeenAt" | "webUrl" | "lastAction"
>;

export type PlatformHealthSummary = {
    unresolved: number;
    unresolvedFatalOrError: number;
    newLast24h: number;
    activeLast24h: number;
    resolvedLast7d: number;
    regressedUnresolved: number;
    byProject: Array<{ projectSlug: string; unresolved: number; activeLast24h: number }>;
    byLevel: Record<"fatal" | "error" | "warning" | "info" | "debug", number>;
    latestSeenAt: number | null;
};

export const DAY_MS = 24 * 60 * 60 * 1000;

export function summarizePlatformHealth(issues: readonly PlatformHealthIssue[], now: number): PlatformHealthSummary {
    const dayAgo = now - DAY_MS;
    const weekAgo = now - 7 * DAY_MS;
    const byProject = new Map<string, { projectSlug: string; unresolved: number; activeLast24h: number }>();
    const byLevel: PlatformHealthSummary["byLevel"] = { fatal: 0, error: 0, warning: 0, info: 0, debug: 0 };

    let unresolved = 0;
    let unresolvedFatalOrError = 0;
    let newLast24h = 0;
    let activeLast24h = 0;
    let resolvedLast7d = 0;
    let regressedUnresolved = 0;
    let latestSeenAt: number | null = null;

    for (const issue of issues) {
        latestSeenAt = latestSeenAt === null ? issue.lastSeenAt : Math.max(latestSeenAt, issue.lastSeenAt);
        const isUnresolved = issue.status === "unresolved";
        if (isUnresolved) {
            unresolved += 1;
            if (issue.level === "fatal" || issue.level === "error") unresolvedFatalOrError += 1;
            if (issue.substatus === "regressed" || issue.substatus === "escalating") regressedUnresolved += 1;
            const level = (issue.level in byLevel ? issue.level : "error") as keyof typeof byLevel;
            byLevel[level] += 1;
            const bucket = byProject.get(issue.projectSlug) ?? { projectSlug: issue.projectSlug, unresolved: 0, activeLast24h: 0 };
            bucket.unresolved += 1;
            if (issue.lastSeenAt >= dayAgo) {
                bucket.activeLast24h += 1;
                activeLast24h += 1;
            }
            byProject.set(issue.projectSlug, bucket);
            if (issue.firstSeenAt >= dayAgo) newLast24h += 1;
        } else if (issue.status === "resolved" && issue.lastSeenAt >= weekAgo) {
            resolvedLast7d += 1;
        }
    }

    return {
        unresolved,
        unresolvedFatalOrError,
        newLast24h,
        activeLast24h,
        resolvedLast7d,
        regressedUnresolved,
        byProject: [...byProject.values()].sort((a, b) => b.unresolved - a.unresolved || a.projectSlug.localeCompare(b.projectSlug)),
        byLevel,
        latestSeenAt,
    };
}
