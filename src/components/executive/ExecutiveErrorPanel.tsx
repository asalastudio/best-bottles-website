import type { PlatformHealthSnapshot } from "@/lib/executive/platformHealth";

function relativeDay(timestamp: number): string {
    const days = Math.floor((Date.now() - timestamp) / 86_400_000);
    if (days < 1) return "today";
    if (days === 1) return "yesterday";
    if (days < 14) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

/**
 * Errors, ranked by how often they are happening.
 *
 * Ordered by event count rather than recency, because that is the question a
 * reader has: one error seen 452 times in three days and one seen once a
 * fortnight ago look identical in a list sorted by time, and only one of them
 * is a problem.
 *
 * THE COUNTS ARE ONLY AS GOOD AS THE SYNC. Sentry's webhook fires when an
 * issue is first created and does not fire again as events accumulate, so
 * without the reconciliation cron every count sits at its first-sighting value
 * — in practice, 1. Ranking all-1s would present a confident order that means
 * nothing, so when the API sync is not configured the panel says so, drops the
 * bars, and falls back to ordering by recency, which is at least true.
 *
 * Every row links to Sentry, since the next move after noticing a spike is the
 * stack trace, and this panel deliberately does not carry one.
 */
export default function ExecutiveErrorPanel({
    snapshot,
    limit = 5,
}: {
    snapshot: PlatformHealthSnapshot;
    limit?: number;
}) {
    if (snapshot.status !== "source-backed") {
        return (
            <p className="font-sans text-[13px] leading-6 text-slate">
                {snapshot.message ?? "Sentry is not connected."}
            </p>
        );
    }

    // Without the API reconciliation, counts are frozen at first delivery.
    const countsAreLive = Boolean(snapshot.data?.apiSyncConfigured);

    const issues = [...(snapshot.data?.issues ?? [])]
        .sort((a, b) => (countsAreLive ? b.count - a.count : b.lastSeenAt - a.lastSeenAt))
        .slice(0, limit);

    if (issues.length === 0) {
        return (
            <p className="font-sans text-[13px] leading-6 text-slate">
                {snapshot.awaitingFirstDelivery
                    ? "Sentry has never delivered an event, so this is not a clean bill of health."
                    : "Nothing unresolved."}
            </p>
        );
    }

    const busiest = Math.max(...issues.map((issue) => issue.count), 1);

    return (
        <>
        {!countsAreLive ? (
            <p
                className="mb-3 rounded-md px-3 py-2 font-sans text-[11.5px] leading-4"
                style={{
                    background: "var(--color-status-warning-surface)",
                    color: "var(--color-status-warning-text)",
                }}
            >
                Event counts are not syncing, so these are ordered by when they were last seen, not
                by how often. Sentry&rsquo;s own list is the accurate one.
            </p>
        ) : null}
        <ol className="m-0 flex list-none flex-col gap-0 p-0">
            {issues.map((issue) => (
                <li key={issue.sentryIssueId} className="border-b border-champagne/40 py-2.5 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-3">
                        <a
                            href={issue.webUrl ?? "https://sentry.io/"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 font-sans text-[13px] text-obsidian hover:underline"
                        >
                            <span className="block truncate">{issue.title}</span>
                        </a>
                        {countsAreLive ? (
                            <span className="shrink-0 font-sans text-[13px] tabular-nums text-obsidian">
                                {issue.count.toLocaleString()}
                            </span>
                        ) : null}
                    </div>

                    {countsAreLive ? (
                        <div
                            className="mt-1.5 h-[4px] rounded-[1px]"
                            style={{
                                width: `${Math.max(2, (issue.count / busiest) * 100)}%`,
                                // Gold marks the one that is actually happening a lot.
                                background: issue.count === busiest
                                    ? "var(--color-muted-gold)"
                                    : "var(--color-obsidian)",
                                opacity: issue.count === busiest ? 1 : 0.35,
                            }}
                        />
                    ) : null}

                    <p className="mt-1 font-sans text-[11.5px] text-slate">
                        {[
                            issue.culprit,
                            relativeDay(issue.lastSeenAt),
                            issue.userCount > 0 ? `${issue.userCount} users` : "no users recorded",
                        ]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                </li>
            ))}
        </ol>
        </>
    );
}
