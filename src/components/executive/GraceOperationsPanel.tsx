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
        { label: "Internal successful answers", value: percent(snapshot.successRate) },
        { label: "Internal request volume", value: integer(snapshot.requestCount) },
        { label: "P95 latency", value: latency(snapshot.p95LatencyMs) },
        { label: "Internal tool calls", value: integer(snapshot.toolCalls) },
        {
            label: "Review queue",
            value: snapshot.pendingCorrections === null ? "—" : `${snapshot.pendingCorrections} pending corrections`,
        },
    ];

    return (
        <section aria-labelledby="grace-operations-title" className="border border-champagne/50 bg-white">
            <div className="flex flex-col gap-3 border-b border-champagne/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold-dim">AI operating system</p>
                    <h2 id="grace-operations-title" className="mt-1 font-serif text-lg text-obsidian">Grace Operations</h2>
                </div>
                <div className="flex items-center gap-2 text-[11.5px] uppercase tracking-[0.13em] text-slate">
                    <span className={`h-1.5 w-1.5 rounded-full ${snapshot.status === "source-backed" ? "bg-emerald-400" : "bg-amber-300"}`} />
                    {snapshot.status === "source-backed" ? "Internal Responses · trailing 30 days" : "Not connected"}
                </div>
            </div>

            {snapshot.message ? (
                <p className="border-b border-champagne/50 px-4 py-3 text-[12.5px] leading-5" style={{ background: "var(--color-status-warning-surface)", color: "var(--color-status-warning-text)" }}>{snapshot.message}</p>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
                {signals.map((signal) => (
                    <div key={signal.label} className="min-h-[86px] border-b border-r border-champagne/50 px-4 py-4 last:border-r-0 sm:border-b-0">
                        <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-obsidian0">{signal.label}</p>
                        <p className="mt-2 text-base font-medium tabular-nums text-obsidian">{signal.value}</p>
                    </div>
                ))}
            </div>

            <details className="border-t border-champagne/50 px-4 py-3 text-[12px] text-slate">
                <summary className="cursor-pointer font-semibold uppercase tracking-[0.12em] text-slate">Source coverage & metric definitions</summary>
                <div className="mt-3 grid gap-3 leading-5 sm:grid-cols-3">
                    <p><strong className="text-obsidian">Coverage.</strong> Employee/internal Responses only; public Realtime traffic is not included yet. Traces contain no prompts, audio, customer PII, or raw conversations.</p>
                    <p><strong className="text-obsidian">Reliability.</strong> Successful answers divided by total recorded requests in the selected 30-day window.</p>
                    <p><strong className="text-obsidian">Cost.</strong> Estimated from effective-dated OpenAI token and File Search rates retained with each trace.</p>
                </div>
            </details>
        </section>
    );
}
