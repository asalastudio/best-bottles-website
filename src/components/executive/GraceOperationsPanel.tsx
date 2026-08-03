import type { GraceOperationsSnapshot } from "@/lib/executive/graceOperations";

const money = (value: number | null) => value === null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);

const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;
const integer = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-US").format(value);
const latency = (value: number | null) => value === null ? "—" : `${new Intl.NumberFormat("en-US").format(value)} ms`;

export function GraceOperationsPanel({ snapshot }: { snapshot: GraceOperationsSnapshot }) {
    const signals = [
        { label: "Estimated spend · 30D", value: money(snapshot.estimatedCostUsd) },
        { label: "Successful answers", value: percent(snapshot.successRate) },
        { label: "Request volume", value: integer(snapshot.requestCount) },
        { label: "P95 latency", value: latency(snapshot.p95LatencyMs) },
        { label: "Tool calls", value: integer(snapshot.toolCalls) },
        {
            label: "Review queue",
            value: snapshot.pendingCorrections === null ? "—" : `${snapshot.pendingCorrections} pending corrections`,
        },
    ];

    return (
        <section aria-labelledby="grace-operations-title" className="border border-zinc-800 bg-[#191b20]">
            <div className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-300">AI operating system</p>
                    <h2 id="grace-operations-title" className="mt-1 font-serif text-lg text-zinc-50">Grace Operations</h2>
                </div>
                <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.13em] text-zinc-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${snapshot.status === "source-backed" ? "bg-emerald-400" : "bg-amber-300"}`} />
                    {snapshot.status === "source-backed" ? "Source-backed · trailing 30 days" : "Not connected"}
                </div>
            </div>

            {snapshot.message ? (
                <p className="border-b border-zinc-800 bg-amber-300/5 px-4 py-3 text-[11px] text-amber-100">{snapshot.message}</p>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
                {signals.map((signal) => (
                    <div key={signal.label} className="min-h-[86px] border-b border-r border-zinc-800 px-4 py-4 last:border-r-0 sm:border-b-0">
                        <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{signal.label}</p>
                        <p className="mt-2 text-base font-medium tabular-nums text-zinc-100">{signal.value}</p>
                    </div>
                ))}
            </div>

            <details className="border-t border-zinc-800 px-4 py-3 text-[10px] text-zinc-400">
                <summary className="cursor-pointer font-semibold uppercase tracking-[0.12em] text-zinc-300">Source coverage & metric definitions</summary>
                <div className="mt-3 grid gap-3 leading-5 sm:grid-cols-3">
                    <p><strong className="text-zinc-200">Coverage.</strong> Minimized Convex traces only; no prompts, audio, customer PII, or raw conversations.</p>
                    <p><strong className="text-zinc-200">Reliability.</strong> Successful answers divided by total recorded requests in the selected 30-day window.</p>
                    <p><strong className="text-zinc-200">Cost.</strong> Estimated from effective-dated OpenAI token and File Search rates retained with each trace.</p>
                </div>
            </details>
        </section>
    );
}
