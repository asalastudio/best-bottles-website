"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlatformHealthSnapshot } from "@/lib/executive/platformHealth";

const integer = (value: number | null | undefined) =>
    value === null || value === undefined ? "—" : new Intl.NumberFormat("en-US").format(value);

const relative = (timestamp: number | null | undefined, now: number) => {
    if (!timestamp) return "—";
    const diff = Math.max(0, now - timestamp);
    const minutes = Math.round(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
};

const LEVEL_STYLES: Record<string, { dot: string; chip: string }> = {
    fatal: { dot: "bg-red-400", chip: "bg-red-400/10 text-red-600" },
    error: { dot: "bg-red-400", chip: "bg-red-400/10 text-red-600" },
    warning: { dot: "bg-[color:var(--color-muted-gold)]", chip: "bg-[color:var(--color-status-warning-surface)] text-[color:var(--color-status-warning-text)]" },
    info: { dot: "bg-sky-300", chip: "bg-sky-300/10 text-sky-200" },
    debug: { dot: "bg-zinc-400", chip: "bg-zinc-400/10 text-slate" },
};

function levelStyle(level: string) {
    return LEVEL_STYLES[level] ?? LEVEL_STYLES.error;
}

/**
 * Re-pulls the server snapshot every minute while the tab is visible.
 *
 * Rendered only after mount: useRouter() throws when there is no app-router
 * context, which is exactly the case when the dashboard is server-rendered in
 * a test. Effects do not run there, so `mounted` stays false and this never
 * renders — while in a real browser it mounts on the first commit.
 */
function MinuteRefresh() {
    const router = useRouter();
    useEffect(() => {
        const tick = () => {
            if (document.visibilityState === "visible") router.refresh();
        };
        const id = window.setInterval(tick, 60_000);
        return () => window.clearInterval(id);
    }, [router]);
    return null;
}

export function PlatformHealthPanel({ snapshot }: { snapshot: PlatformHealthSnapshot }) {
    const [expanded, setExpanded] = useState<string | null>(null);
    // Wall-clock read in an effect, not during render: rendering must be pure,
    // and the server/client timestamps must not disagree on first paint.
    const [clientNow, setClientNow] = useState<number | null>(null);
    useEffect(() => {
        // Reading the clock is the whole point of this effect — it is the one
        // value that cannot come from the server snapshot.
        setClientNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect
        const id = window.setInterval(() => setClientNow(Date.now()), 30_000);
        return () => window.clearInterval(id);
    }, []);

    const data = snapshot.data;
    const summary = data?.summary ?? null;
    // Issue ages are measured against the snapshot the server built, so every
    // row on the page agrees with the counts beside it.
    const now = data?.generatedAt ?? clientNow ?? 0;

    const health: "healthy" | "degraded" | "critical" | "unknown" = !summary || snapshot.awaitingFirstDelivery
        ? "unknown"
        : summary.unresolvedFatalOrError > 0
            ? "critical"
            : summary.unresolved > 0
                ? "degraded"
                : "healthy";

    const headerDot = {
        healthy: "bg-emerald-400",
        degraded: "bg-amber-300",
        critical: "bg-red-400",
        unknown: "bg-amber-300",
    }[health];

    const headerLabel = {
        healthy: "No open issues",
        degraded: `${integer(summary?.unresolved)} open · none fatal`,
        critical: `${integer(summary?.unresolvedFatalOrError)} open errors`,
        unknown: "Not connected",
    }[health];

    const lastSync = data?.lastSync ?? null;
    const syncValue = !data
        ? "—"
        : !data.apiSyncConfigured
            ? "Webhook only"
            : lastSync
                ? `${lastSync.outcome === "ok" ? "OK" : lastSync.outcome === "failed" ? "Failed" : "Skipped"} · ${relative(lastSync.finishedAt, now)}`
                : "Pending first run";

    const signals = [
        { label: "Open issues", value: integer(summary?.unresolved) },
        { label: "Open fatal / error", value: integer(summary?.unresolvedFatalOrError) },
        { label: "New · last 24 h", value: integer(summary?.newLast24h) },
        { label: "Active · last 24 h", value: integer(summary?.activeLast24h) },
        { label: "Resolved · last 7 d", value: integer(summary?.resolvedLast7d) },
        { label: "Sentry API sync", value: syncValue },
    ];

    return (
        <section id="platform" aria-labelledby="platform-health-title" className="border border-champagne/50 bg-white">
            {clientNow !== null && snapshot.status === "source-backed" ? <MinuteRefresh /> : null}
            <div className="flex flex-col gap-3 border-b border-champagne/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold-dim">Platform</p>
                    <h2 id="platform-health-title" className="mt-1 font-serif text-lg text-obsidian">Platform Health</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11.5px] uppercase tracking-[0.13em] text-slate">
                    <span className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${headerDot}`} />
                        {headerLabel}
                    </span>
                    {data && clientNow !== null ? <span>Updated {relative(data.generatedAt, clientNow)}</span> : null}
                    {snapshot.sentryIssuesUrl ? (
                        <a
                            href={snapshot.sentryIssuesUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border border-champagne px-2 py-1 text-slate hover:border-amber-300/70 hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                            Open Sentry ↗
                        </a>
                    ) : null}
                </div>
            </div>

            {snapshot.message ? (
                <p
                    className="border-b border-champagne/50 px-4 py-3 text-[12.5px] leading-5"
                    style={{
                        background: "var(--color-status-warning-surface)",
                        color: "var(--color-status-warning-text)",
                    }}
                >{snapshot.message}</p>
            ) : null}

            {lastSync?.outcome === "failed" ? (
                <p className="border-b border-champagne/50 bg-red-500/5 px-4 py-2 text-[11px] text-red-200">
                    Last Sentry API sync failed{lastSync.detail ? ` (${lastSync.detail})` : ""}. Issue counts may lag until SENTRY_API_TOKEN is fixed in the Convex environment.
                </p>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
                {signals.map((signal) => (
                    <div key={signal.label} className="min-h-[86px] border-b border-r border-champagne/50 px-4 py-4 last:border-r-0 sm:border-b-0">
                        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-obsidian0">{signal.label}</p>
                        <p className="mt-2 text-base font-medium tabular-nums text-obsidian">{signal.value}</p>
                    </div>
                ))}
            </div>

            {summary && summary.byProject.length > 0 ? (
                <div className="flex flex-wrap gap-2 border-t border-champagne/50 px-4 py-3 text-[12px] text-slate">
                    {summary.byProject.map((project) => (
                        <span key={project.projectSlug} className="border border-champagne/50 px-2 py-1">
                            <span className="text-obsidian">{project.projectSlug}</span> · {project.unresolved} open · {project.activeLast24h} active today
                        </span>
                    ))}
                </div>
            ) : null}

            <div className="grid border-t border-champagne/50 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="border-b border-champagne/50 lg:border-b-0 lg:border-r">
                    <p className="border-b border-champagne/50 px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-obsidian0">Open issues · most recent first</p>
                    {data && data.issues.length > 0 ? (
                        <ul className="divide-y divide-champagne/50/70">
                            {data.issues.map((issue) => {
                                const style = levelStyle(issue.level);
                                const key = issue.sentryIssueId;
                                const open = expanded === key;
                                return (
                                    <li key={key}>
                                        <button
                                            type="button"
                                            onClick={() => setExpanded(open ? null : key)}
                                            aria-expanded={open}
                                            className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none hover:bg-linen/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
                                        >
                                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex flex-wrap items-center gap-2 text-[11.5px] uppercase tracking-[0.12em] text-obsidian0">
                                                    <span className={`px-1.5 py-0.5 ${style.chip}`}>{issue.level}</span>
                                                    {issue.shortId ? <span className="text-slate">{issue.shortId}</span> : null}
                                                    <span>{issue.projectSlug}</span>
                                                    {issue.environment ? <span>{issue.environment}</span> : null}
                                                    {issue.substatus === "regressed" || issue.substatus === "escalating" ? (
                                                        <span className="bg-red-400/10 px-1.5 py-0.5 text-red-600">{issue.substatus}</span>
                                                    ) : null}
                                                </span>
                                                <span className="mt-1 block truncate text-sm text-obsidian">{issue.title}</span>
                                                {issue.culprit ? <span className="mt-0.5 block truncate text-[11px] text-obsidian0">{issue.culprit}</span> : null}
                                            </span>
                                            <span className="shrink-0 text-right text-[12px] tabular-nums text-slate">
                                                <span className="block text-obsidian">{integer(issue.count)}×</span>
                                                <span className="block">{integer(issue.userCount)} users</span>
                                                <span className="block">{relative(issue.lastSeenAt, now)}</span>
                                            </span>
                                        </button>
                                        {open ? (
                                            <div className="flex flex-wrap items-center gap-4 border-t border-champagne/50/70 bg-zinc-950/40 px-4 py-3 text-[11px] text-slate">
                                                <span>First seen {relative(issue.firstSeenAt, now)}</span>
                                                <span>Last action: {issue.lastAction}</span>
                                                {issue.priority ? <span>Priority {issue.priority}</span> : null}
                                                {issue.isUnhandled ? <span className="text-red-600">Unhandled</span> : null}
                                                {issue.webUrl ? (
                                                    <a
                                                        href={issue.webUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="ml-auto border border-champagne px-2 py-1 text-obsidian hover:border-amber-300/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                                    >
                                                        Open in Sentry ↗
                                                    </a>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="px-4 py-6 text-[11px] text-obsidian0">
                            {data ? "Nothing open. Resolved issues stay in Sentry; the last few are listed in the activity feed." : "Connect Sentry to see open issues here."}
                        </p>
                    )}
                </div>

                <div>
                    <p className="border-b border-champagne/50 px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-obsidian0">Activity</p>
                    {data && data.activity.length > 0 ? (
                        <ul className="divide-y divide-champagne/50/70">
                            {data.activity.map((event, index) => (
                                <li key={`${event.sentryIssueId}-${event.receivedAt}-${index}`} className="px-4 py-2.5 text-[11px] leading-5 text-slate">
                                    <span className="mr-2 text-[11.5px] uppercase tracking-[0.12em] text-obsidian0">{relative(event.receivedAt, now)}</span>
                                    <span className="text-obsidian">{event.summary}</span>
                                    {event.actorName ? <span className="text-obsidian0"> · {event.actorName}</span> : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="px-4 py-6 text-[11px] text-obsidian0">No deliveries yet.</p>
                    )}
                </div>
            </div>

            <details className="border-t border-champagne/50 px-4 py-3 text-[12px] text-slate">
                <summary className="cursor-pointer font-semibold uppercase tracking-[0.12em] text-slate">Source coverage & definitions</summary>
                <div className="mt-3 grid gap-3 leading-5 sm:grid-cols-3">
                    <p><strong className="text-obsidian">Source.</strong> Sentry is the system of record. Convex mirrors the headline of each issue (title, level, counts, deep link) from the signed webhook and a 15-minute API sync — never stack traces, request bodies or customer data.</p>
                    <p><strong className="text-obsidian">Open issues.</strong> Sentry status <em>unresolved</em>. “Fatal / error” counts open issues at those levels; warnings and info are tracked but do not turn the dot red.</p>
                    <p><strong className="text-obsidian">Coverage.</strong> Storefront browser, Next.js server and edge runtimes, and Convex functions (via the Convex → Sentry exception-reporting integration).</p>
                </div>
            </details>
        </section>
    );
}
