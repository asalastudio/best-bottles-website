import { describe, expect, it } from "vitest";
import {
    DAY_MS,
    describeDelivery,
    issueUrlFromEventUrl,
    mergeIssueDelivery,
    normalizeSentryIssueObject,
    normalizeSentryWebhook,
    summarizePlatformHealth,
    toEpochMs,
    type SentryDelivery,
    type StoredIssueFields,
} from "../src/lib/observability/sentryIssues";

const NOW = Date.parse("2026-09-02T18:00:00Z");

const issuePayload = {
    action: "created",
    installation: { uuid: "24b397fc" },
    data: {
        issue: {
            url: "https://sentry.io/api/0/organizations/best-bottles/issues/1234567890/",
            web_url: "https://best-bottles.sentry.io/issues/1234567890/",
            id: "1234567890",
            shortId: "BEST-BOTTLES-WEB-1A",
            title: "TypeError: Cannot read properties of undefined (reading 'priceTiers')",
            culprit: "ProductDetailClient(app/products/[slug])",
            permalink: "https://best-bottles.sentry.io/issues/1234567890/",
            level: "error",
            status: "unresolved",
            substatus: "new",
            platform: "javascript",
            project: { id: "112", name: "Best Bottles Web", slug: "best-bottles-web", platform: "javascript-nextjs" },
            priority: "high",
            isUnhandled: true,
            count: "3",
            userCount: 2,
            firstSeen: "2026-09-02T17:40:00.000000+00:00",
            lastSeen: "2026-09-02T17:58:00.000000+00:00",
        },
    },
    actor: { type: "application", id: "sentry", name: "Sentry" },
};

const eventAlertPayload = {
    action: "triggered",
    actor: { id: "sentry", name: "Sentry", type: "application" },
    data: {
        event: {
            event_id: "e4874d664c3540c1a32eab185f12c5ab",
            issue_id: "1234567890",
            issue_url: "https://sentry.io/api/0/issues/1234567890/",
            web_url: "https://best-bottles.sentry.io/issues/1234567890/events/e4874d664c3540c1a32eab185f12c5ab/",
            url: "https://sentry.io/api/0/projects/best-bottles/best-bottles-web/events/e4874d664c3540c1a32eab185f12c5ab/",
            title: "TypeError: Cannot read properties of undefined (reading 'priceTiers')",
            culprit: "ProductDetailClient(app/products/[slug])",
            level: "error",
            platform: "javascript",
            project: 112,
            release: "0e840a32",
            datetime: "2026-09-02T17:59:30.000000Z",
            tags: [["environment", "production"], ["surface", "pdp"], ["browser", "Chrome"]],
            exception: { values: [{ type: "TypeError", value: "boom", stacktrace: { frames: [{ filename: "secret.js" }] } }] },
        },
        triggered_rule: "Storefront errors",
    },
    installation: { uuid: "24b397fc" },
};

describe("normalizeSentryWebhook", () => {
    it("mirrors the headline of an issue webhook and nothing more", () => {
        const delivery = normalizeSentryWebhook("issue", issuePayload, NOW);
        expect(delivery).not.toBeNull();
        expect(delivery!.resource).toBe("issue");
        expect(delivery!.action).toBe("created");
        expect(delivery!.actorName).toBe("Sentry");
        expect(delivery!.isOccurrence).toBe(false);
        expect(delivery!.issue).toMatchObject({
            sentryIssueId: "1234567890",
            shortId: "BEST-BOTTLES-WEB-1A",
            projectSlug: "best-bottles-web",
            projectName: "Best Bottles Web",
            level: "error",
            status: "unresolved",
            substatus: "new",
            priority: "high",
            isUnhandled: true,
            count: 3,
            userCount: 2,
            webUrl: "https://best-bottles.sentry.io/issues/1234567890/",
        });
        expect(delivery!.issue.firstSeenAt).toBe(Date.parse("2026-09-02T17:40:00Z"));
        expect(JSON.stringify(delivery)).not.toContain("stacktrace");
    });

    it("turns an issue-alert webhook into one occurrence with environment and release from tags", () => {
        const delivery = normalizeSentryWebhook("event_alert", eventAlertPayload, NOW);
        expect(delivery).not.toBeNull();
        expect(delivery!.isOccurrence).toBe(true);
        expect(delivery!.triggeredRule).toBe("Storefront errors");
        expect(delivery!.eventId).toBe("e4874d664c3540c1a32eab185f12c5ab");
        expect(delivery!.issue.environment).toBe("production");
        expect(delivery!.issue.release).toBe("0e840a32");
        expect(delivery!.issue.projectSlug).toBe("project-112");
        expect(delivery!.issue.webUrl).toBe("https://best-bottles.sentry.io/issues/1234567890/");
        expect(delivery!.issue.lastSeenAt).toBe(Date.parse("2026-09-02T17:59:30Z"));
        expect(JSON.stringify(delivery)).not.toContain("secret.js");
    });

    it("ignores resources we do not mirror and malformed bodies", () => {
        expect(normalizeSentryWebhook("comment", { action: "created", data: {} }, NOW)).toBeNull();
        expect(normalizeSentryWebhook("metric_alert", { action: "resolved", data: {} }, NOW)).toBeNull();
        expect(normalizeSentryWebhook("issue", { action: "created", data: { issue: { id: "1" } } }, NOW)).toBeNull();
        expect(normalizeSentryWebhook("issue", "nope", NOW)).toBeNull();
        expect(normalizeSentryWebhook(null, issuePayload, NOW)).toBeNull();
    });

    it("normalizes the REST API issue shape with the same code path", () => {
        const record = normalizeSentryIssueObject({ ...issuePayload.data.issue, level: "FATAL", count: 7 }, NOW);
        expect(record?.level).toBe("fatal");
        expect(record?.count).toBe(7);
    });
});

describe("mergeIssueDelivery", () => {
    const created = normalizeSentryWebhook("issue", issuePayload, NOW) as SentryDelivery;
    const occurrence = normalizeSentryWebhook("event_alert", eventAlertPayload, NOW + 1000) as SentryDelivery;

    it("creates from an issue delivery", () => {
        const stored = mergeIssueDelivery(null, created, NOW);
        expect(stored.count).toBe(3);
        expect(stored.lastAction).toBe("created");
        expect(stored.updatedAt).toBe(NOW);
    });

    it("an occurrence bumps count, keeps the known project slug, and reopens a resolved issue", () => {
        const resolved: StoredIssueFields = { ...mergeIssueDelivery(null, created, NOW), status: "resolved", substatus: null, lastAction: "resolved" };
        const merged = mergeIssueDelivery(resolved, occurrence, NOW + 2000);
        expect(merged.count).toBe(4);
        expect(merged.status).toBe("unresolved");
        expect(merged.substatus).toBe("regressed");
        expect(merged.projectSlug).toBe("best-bottles-web");
        expect(merged.environment).toBe("production");
        expect(merged.lastTriggeredRule).toBe("Storefront errors");
        expect(merged.lastEventId).toBe("e4874d664c3540c1a32eab185f12c5ab");
    });

    it("an issue-state delivery wins on status but never rolls a count backwards", () => {
        const stored = { ...mergeIssueDelivery(null, created, NOW), count: 50 };
        const resolvedDelivery: SentryDelivery = { ...created, action: "resolved", issue: { ...created.issue, status: "resolved", count: 3 } };
        const merged = mergeIssueDelivery(stored, resolvedDelivery, NOW + 5000);
        expect(merged.status).toBe("resolved");
        expect(merged.count).toBe(50);
        expect(merged.lastAction).toBe("resolved");
    });
});

describe("summarizePlatformHealth", () => {
    const base = mergeIssueDelivery(null, normalizeSentryWebhook("issue", issuePayload, NOW) as SentryDelivery, NOW);
    const issues = [
        base,
        { ...base, sentryIssueId: "2", level: "warning", firstSeenAt: NOW - 3 * DAY_MS, lastSeenAt: NOW - 2 * DAY_MS },
        { ...base, sentryIssueId: "3", status: "resolved", lastSeenAt: NOW - DAY_MS },
        { ...base, sentryIssueId: "4", status: "resolved", lastSeenAt: NOW - 10 * DAY_MS },
        { ...base, sentryIssueId: "5", projectSlug: "best-bottles-convex", substatus: "regressed" },
    ];

    it("counts what the panel shows", () => {
        const summary = summarizePlatformHealth(issues, NOW);
        expect(summary.unresolved).toBe(3);
        expect(summary.unresolvedFatalOrError).toBe(2);
        expect(summary.newLast24h).toBe(2);
        expect(summary.activeLast24h).toBe(2);
        expect(summary.resolvedLast7d).toBe(1);
        expect(summary.regressedUnresolved).toBe(1);
        expect(summary.byLevel).toEqual({ fatal: 0, error: 2, warning: 1, info: 0, debug: 0 });
        expect(summary.byProject.map((row) => row.projectSlug)).toEqual(["best-bottles-web", "best-bottles-convex"]);
    });

    it("is empty-safe", () => {
        expect(summarizePlatformHealth([], NOW).unresolved).toBe(0);
        expect(summarizePlatformHealth([], NOW).latestSeenAt).toBeNull();
    });
});

describe("helpers", () => {
    it("derives the issue permalink from an event permalink", () => {
        expect(issueUrlFromEventUrl("https://o.sentry.io/issues/1/events/abc/")).toBe("https://o.sentry.io/issues/1/");
        expect(issueUrlFromEventUrl(null)).toBeNull();
    });

    it("parses ISO strings, epoch seconds and epoch millis", () => {
        expect(toEpochMs("2026-09-02T17:40:00Z", 0)).toBe(Date.parse("2026-09-02T17:40:00Z"));
        expect(toEpochMs(1_700_000_000, 0)).toBe(1_700_000_000_000);
        expect(toEpochMs(1_700_000_000_000, 0)).toBe(1_700_000_000_000);
        expect(toEpochMs("garbage", 42)).toBe(42);
    });

    it("describes a delivery for the activity feed", () => {
        const delivery = normalizeSentryWebhook("issue", issuePayload, NOW) as SentryDelivery;
        expect(describeDelivery(delivery)).toContain("created · BEST-BOTTLES-WEB-1A");
    });
});
