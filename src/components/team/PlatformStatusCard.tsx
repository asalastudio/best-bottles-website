import type { PlatformHealthSnapshot } from "@/lib/executive/platformHealth";

const integer = (value: number | null | undefined) =>
    value === null || value === undefined ? "—" : new Intl.NumberFormat("en-US").format(value);

/**
 * Light-palette status strip for the Team Hub: one line that answers "is the
 * site healthy right now?" and where to go for detail. Same snapshot as the
 * Executive Hub panel, loaded server-side.
 */
export function PlatformStatusCard({ snapshot }: { snapshot: PlatformHealthSnapshot }) {
    const summary = snapshot.data?.summary ?? null;
    // An unfed pipeline reports the same zeros a healthy one does — say
    // "not connected", never "all healthy".
    const state: "healthy" | "degraded" | "critical" | "unknown" = !summary || snapshot.awaitingFirstDelivery
        ? "unknown"
        : summary.unresolvedFatalOrError > 0
            ? "critical"
            : summary.unresolved > 0
                ? "degraded"
                : "healthy";

    const dot = {
        healthy: "bg-emerald-500",
        degraded: "bg-amber-500",
        critical: "bg-red-500",
        unknown: "bg-slate/40",
    }[state];

    const headline = {
        healthy: "All systems healthy",
        degraded: `${integer(summary?.unresolved)} open issue${summary?.unresolved === 1 ? "" : "s"}, none fatal`,
        critical: `${integer(summary?.unresolvedFatalOrError)} open error${summary?.unresolvedFatalOrError === 1 ? "" : "s"} need attention`,
        unknown: "Platform monitoring not connected",
    }[state];

    const detail = snapshot.awaitingFirstDelivery || !summary
        ? snapshot.message ?? "Sentry has not reported into Convex yet."
        : `${integer(summary.newLast24h)} new and ${integer(summary.activeLast24h)} active in the last 24 hours · ${integer(summary.resolvedLast7d)} resolved this week`;

    const topIssues = snapshot.data?.issues.slice(0, 3) ?? [];

    return (
        <section
            aria-labelledby="platform-status-title"
            data-platform-state={state}
            className="mb-8 border border-champagne/50 bg-linen px-6 py-5 shadow-[0_18px_45px_rgba(29,29,31,0.04)]"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-dim">Platform status</p>
                    <h2 id="platform-status-title" className="flex items-center gap-3 font-serif text-2xl font-semibold leading-tight text-obsidian">
                        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
                        {headline}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate">{detail}</p>
                    {topIssues.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-sm text-slate">
                            {topIssues.map((issue) => (
                                <li key={issue.sentryIssueId} className="truncate">
                                    <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-dim">{issue.level}</span>
                                    {issue.webUrl ? (
                                        <a href={issue.webUrl} target="_blank" rel="noopener noreferrer" className="text-obsidian underline decoration-champagne underline-offset-4 hover:text-muted-gold">
                                            {issue.title}
                                        </a>
                                    ) : (
                                        <span className="text-obsidian">{issue.title}</span>
                                    )}
                                    <span className="ml-2 text-xs text-slate">{integer(issue.count)}×</span>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-3 text-sm font-semibold">
                    <a
                        href="/executive#platform"
                        className="inline-flex border border-obsidian bg-obsidian px-4 py-2.5 text-linen transition hover:border-muted-gold hover:bg-muted-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                    >
                        Platform Health →
                    </a>
                    {snapshot.sentryIssuesUrl ? (
                        <a
                            href={snapshot.sentryIssuesUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex border border-champagne bg-bone px-4 py-2.5 text-obsidian transition hover:border-muted-gold hover:text-muted-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-muted-gold"
                        >
                            Open Sentry ↗
                        </a>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
