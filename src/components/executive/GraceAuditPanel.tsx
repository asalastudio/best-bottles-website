"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import {
    buildAuditCsv,
    buildAuditHtml,
    downloadFile,
    type AuditResultRow,
    type AuditRunHeader,
} from "@/lib/executive/auditReport";

/**
 * Grace Live Audit — executive-hub control surface.
 *
 * Two independent checks:
 *  • Integrity sweep — deterministic, free, covers every SKU in the catalog.
 *  • Conversation audit — drives the real Grace brain scenario by scenario.
 *    A run is 10–20 minutes, so the browser steps through it and Convex holds
 *    state; results stream into the table as each scenario lands.
 */

type Verdict = "pass" | "warn" | "fail";

const VERDICT_STYLES: Record<Verdict, { dot: string; text: string; chip: string }> = {
    pass: { dot: "bg-emerald-400", text: "text-emerald-700", chip: "bg-emerald-400/10 text-emerald-700" },
    warn: { dot: "bg-amber-300", text: "text-gold-dim", chip: "bg-amber-300/10 text-gold-dim" },
    fail: { dot: "bg-red-400", text: "text-red-600", chip: "bg-red-400/10 text-red-600" },
};

type IntegrityCheck = { label: string; verdict: Verdict; detail: string };
type IntegrityReport = {
    generatedAt: string;
    products: { scanned: number; invertedVolumePrice: number };
    checks: IntegrityCheck[];
    issues: Array<{ graceSku: string; issue: string; detail: string }>;
};

export function GraceAuditPanel() {
    const latest = useQuery(api.graceAudit.latestRun, { kind: "conversation" });
    const [running, setRunning] = useState(false);
    const [phase, setPhase] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
    const [integrityRunning, setIntegrityRunning] = useState(false);

    const post = useCallback(async (url: string, body?: Record<string, unknown>) => {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body ?? {}),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
        return json;
    }, []);

    const runIntegrity = useCallback(async () => {
        setIntegrityRunning(true);
        setError(null);
        try {
            const { report } = await post("/api/executive/grace-integrity");
            setIntegrity(report);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Integrity sweep failed.");
        } finally {
            setIntegrityRunning(false);
        }
    }, [post]);

    const runConversationAudit = useCallback(async () => {
        setError(null);
        let plan: { scenarios: unknown[]; estimatedCostUsd: number };
        try {
            plan = await post("/api/executive/grace-audit", { action: "plan" });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load the audit plan.");
            return;
        }

        const confirmed = window.confirm(
            `Run the full Grace conversation audit?\n\n` +
            `${plan.scenarios.length} scenarios against live catalog data.\n` +
            `Estimated model spend: ~$${plan.estimatedCostUsd.toFixed(2)}.\n` +
            `Takes roughly 10–20 minutes — keep this tab open.\n\n` +
            `No cart, order, or form is ever submitted.`,
        );
        if (!confirmed) return;

        setRunning(true);
        try {
            const { runId, scenarioIds } = await post("/api/executive/grace-audit", { action: "start" });
            for (let i = 0; i < scenarioIds.length; i++) {
                const scenarioId = scenarioIds[i];
                setPhase(`Scenario ${i + 1} of ${scenarioIds.length} · ${scenarioId}`);
                try {
                    await post("/api/executive/grace-audit", { action: "step", runId, scenarioId });
                } catch (e) {
                    // One bad scenario must not abandon the run.
                    console.error("[grace-audit] scenario failed", scenarioId, e);
                }
            }
            await post("/api/executive/grace-audit", { action: "finish", runId, status: "complete" });
            setPhase("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Audit run failed.");
        } finally {
            setRunning(false);
        }
    }, [post]);

    const run = latest?.run as AuditRunHeader | undefined;
    const results = useMemo(() => (latest?.results ?? []) as unknown as AuditResultRow[], [latest]);

    const exportCsv = useCallback(() => {
        if (!run) return;
        downloadFile(
            `grace-audit-${new Date(run.startedAt).toISOString().slice(0, 10)}.csv`,
            buildAuditCsv(run, results),
            "text/csv;charset=utf-8",
        );
    }, [run, results]);

    const exportHtml = useCallback(() => {
        if (!run) return;
        downloadFile(
            `grace-audit-${new Date(run.startedAt).toISOString().slice(0, 10)}.html`,
            buildAuditHtml(run, results),
            "text/html;charset=utf-8",
        );
    }, [run, results]);

    const scoreTone = !run
        ? "text-slate"
        : run.failCount > 0 ? "text-red-600" : run.warnCount > 0 ? "text-gold-dim" : "text-emerald-700";

    return (
        <section aria-labelledby="grace-audit-title" className="border border-champagne/50 bg-white">
            <div className="flex flex-col gap-3 border-b border-champagne/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-gold-dim">Assurance</p>
                    <h2 id="grace-audit-title" className="mt-1 font-serif text-lg text-obsidian">Grace Live Audit</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={runIntegrity}
                        disabled={integrityRunning || running}
                        className="border border-champagne px-3 py-1.5 text-[12px] uppercase tracking-[0.13em] text-obsidian transition hover:border-zinc-500 disabled:opacity-40"
                    >
                        {integrityRunning ? "Sweeping…" : "Run integrity sweep"}
                    </button>
                    <button
                        type="button"
                        onClick={runConversationAudit}
                        disabled={running || integrityRunning}
                        className="border border-amber-300/60 bg-amber-300/10 px-3 py-1.5 text-[12px] uppercase tracking-[0.13em] text-gold-dim transition hover:bg-amber-300/20 disabled:opacity-40"
                    >
                        {running ? "Auditing…" : "Run conversation audit"}
                    </button>
                </div>
            </div>

            {error ? (
                <p className="border-b border-champagne/50 bg-red-500/5 px-4 py-2 text-[11px] text-red-200">{error}</p>
            ) : null}
            {running && phase ? (
                <p className="border-b border-champagne/50 px-4 py-2 text-[12.5px] leading-5" style={{ background: "var(--color-status-warning-surface)", color: "var(--color-status-warning-text)" }}>
                    {phase} — keep this tab open; results appear below as each scenario finishes.
                </p>
            ) : null}

            {/* ── Integrity sweep ─────────────────────────────────────────── */}
            {integrity ? (
                <div className="border-b border-champagne/50 px-4 py-3">
                    <p className="mb-2 text-[11.5px] uppercase tracking-[0.13em] text-slate">
                        Catalog integrity · {integrity.products.scanned.toLocaleString()} SKUs swept ·{" "}
                        {new Date(integrity.generatedAt).toLocaleString()}
                    </p>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                        {integrity.checks.map((c) => (
                            <li key={c.label} className="flex items-start gap-2 text-[11px]">
                                <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${VERDICT_STYLES[c.verdict].dot}`} />
                                <span className="text-slate">
                                    <span className={VERDICT_STYLES[c.verdict].text}>{c.label}</span>
                                    <span className="text-obsidian0"> — {c.detail}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {/* ── Conversation audit results ──────────────────────────────── */}
            {run ? (
                <>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-champagne/50 px-4 py-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.13em] text-obsidian0">Score</p>
                            <p className={`font-serif text-2xl ${scoreTone}`}>{run.scorePct === null ? "—" : `${run.scorePct}%`}</p>
                        </div>
                        {([["Pass", run.passCount, "pass"], ["Warn", run.warnCount, "warn"], ["Fail", run.failCount, "fail"]] as const).map(
                            ([label, value, key]) => (
                                <div key={label}>
                                    <p className="text-[11px] uppercase tracking-[0.13em] text-obsidian0">{label}</p>
                                    <p className={`font-serif text-2xl ${VERDICT_STYLES[key].text}`}>{value}</p>
                                </div>
                            ),
                        )}
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.13em] text-obsidian0">Scenarios</p>
                            <p className="font-serif text-2xl text-obsidian">{run.scenarioComplete}/{run.scenarioTotal}</p>
                        </div>
                        <div className="ml-auto flex gap-2">
                            <button type="button" onClick={exportCsv} className="border border-champagne px-3 py-1.5 text-[12px] uppercase tracking-[0.13em] text-slate hover:border-zinc-500">
                                CSV
                            </button>
                            <button type="button" onClick={exportHtml} className="border border-champagne px-3 py-1.5 text-[12px] uppercase tracking-[0.13em] text-slate hover:border-zinc-500">
                                HTML report
                            </button>
                        </div>
                    </div>

                    <ul className="divide-y divide-champagne/50/70">
                        {results.map((r) => {
                            const failed = r.checks.filter((c) => !c.passed);
                            const open = expanded === r.scenarioId;
                            return (
                                <li key={r.scenarioId}>
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(open ? null : r.scenarioId)}
                                        className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-travertine/30"
                                    >
                                        <span className={`h-2 w-2 flex-none rounded-full ${VERDICT_STYLES[r.verdict].dot}`} />
                                        <span className="w-12 flex-none font-mono text-[12px] text-obsidian0">{r.scenarioId}</span>
                                        <span className="flex-1 truncate text-[11.5px] text-obsidian">{r.title}</span>
                                        <span className="hidden flex-none text-[12px] text-obsidian0 sm:inline">{r.group}</span>
                                        <span className={`flex-none px-2 py-0.5 text-[11.5px] uppercase tracking-[0.1em] ${VERDICT_STYLES[r.verdict].chip}`}>
                                            {r.verdict}
                                        </span>
                                        <span className="w-14 flex-none text-right font-mono text-[12px] text-obsidian0">
                                            {failed.length}/{r.checks.length}
                                        </span>
                                    </button>
                                    {open ? (
                                        <div className="bg-bone/40 px-4 pb-3 pl-9">
                                            <ul className="space-y-1">
                                                {r.checks.map((c) => (
                                                    <li key={c.label} className="flex items-start gap-2 text-[11px]">
                                                        <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${c.passed ? "bg-emerald-400" : c.severity === "critical" ? "bg-red-400" : "bg-amber-300"}`} />
                                                        <span>
                                                            <span className={c.passed ? "text-slate" : c.severity === "critical" ? "text-red-200" : "text-gold-dim"}>
                                                                {c.label}
                                                            </span>
                                                            <span className="text-obsidian0"> — {c.detail}</span>
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {r.error ? <p className="mt-2 text-[11px] text-red-600">Error: {r.error}</p> : null}
                                            {r.transcript?.length ? (
                                                <div className="mt-3 space-y-2 border-l border-champagne/50 pl-3">
                                                    {r.transcript.map((t, i) => (
                                                        <div key={i}>
                                                            <p className="text-[11px] font-semibold text-slate">{t.user}</p>
                                                            <p className="whitespace-pre-wrap text-[11px] text-slate">{t.assistant || "(no reply)"}</p>
                                                            {t.toolCalls.length ? (
                                                                <p className="mt-1 font-mono text-[12px] text-ash">
                                                                    {t.toolCalls.map((c) => c.name).join(" · ")}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                </>
            ) : (
                <p className="px-4 py-6 text-[11px] text-obsidian0">
                    No audit has been run yet. The integrity sweep is free and covers every SKU; the conversation
                    audit drives the live Grace brain and costs model spend.
                </p>
            )}
        </section>
    );
}
