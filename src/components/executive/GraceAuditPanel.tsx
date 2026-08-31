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
    pass: { dot: "bg-emerald-400", text: "text-emerald-300", chip: "bg-emerald-400/10 text-emerald-300" },
    warn: { dot: "bg-amber-300", text: "text-amber-200", chip: "bg-amber-300/10 text-amber-200" },
    fail: { dot: "bg-red-400", text: "text-red-300", chip: "bg-red-400/10 text-red-300" },
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
        ? "text-zinc-400"
        : run.failCount > 0 ? "text-red-300" : run.warnCount > 0 ? "text-amber-200" : "text-emerald-300";

    return (
        <section aria-labelledby="grace-audit-title" className="border border-zinc-800 bg-[#191b20]">
            <div className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-300">Assurance</p>
                    <h2 id="grace-audit-title" className="mt-1 font-serif text-lg text-zinc-50">Grace Live Audit</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={runIntegrity}
                        disabled={integrityRunning || running}
                        className="border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-zinc-200 transition hover:border-zinc-500 disabled:opacity-40"
                    >
                        {integrityRunning ? "Sweeping…" : "Run integrity sweep"}
                    </button>
                    <button
                        type="button"
                        onClick={runConversationAudit}
                        disabled={running || integrityRunning}
                        className="border border-amber-300/60 bg-amber-300/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-amber-200 transition hover:bg-amber-300/20 disabled:opacity-40"
                    >
                        {running ? "Auditing…" : "Run conversation audit"}
                    </button>
                </div>
            </div>

            {error ? (
                <p className="border-b border-zinc-800 bg-red-500/5 px-4 py-2 text-[11px] text-red-200">{error}</p>
            ) : null}
            {running && phase ? (
                <p className="border-b border-zinc-800 bg-amber-300/5 px-4 py-2 text-[11px] text-amber-100">
                    {phase} — keep this tab open; results appear below as each scenario finishes.
                </p>
            ) : null}

            {/* ── Integrity sweep ─────────────────────────────────────────── */}
            {integrity ? (
                <div className="border-b border-zinc-800 px-4 py-3">
                    <p className="mb-2 text-[9px] uppercase tracking-[0.13em] text-zinc-400">
                        Catalog integrity · {integrity.products.scanned.toLocaleString()} SKUs swept ·{" "}
                        {new Date(integrity.generatedAt).toLocaleString()}
                    </p>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                        {integrity.checks.map((c) => (
                            <li key={c.label} className="flex items-start gap-2 text-[11px]">
                                <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${VERDICT_STYLES[c.verdict].dot}`} />
                                <span className="text-zinc-300">
                                    <span className={VERDICT_STYLES[c.verdict].text}>{c.label}</span>
                                    <span className="text-zinc-500"> — {c.detail}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {/* ── Conversation audit results ──────────────────────────────── */}
            {run ? (
                <>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-zinc-800 px-4 py-3">
                        <div>
                            <p className="text-[8px] uppercase tracking-[0.13em] text-zinc-500">Score</p>
                            <p className={`font-serif text-2xl ${scoreTone}`}>{run.scorePct === null ? "—" : `${run.scorePct}%`}</p>
                        </div>
                        {([["Pass", run.passCount, "pass"], ["Warn", run.warnCount, "warn"], ["Fail", run.failCount, "fail"]] as const).map(
                            ([label, value, key]) => (
                                <div key={label}>
                                    <p className="text-[8px] uppercase tracking-[0.13em] text-zinc-500">{label}</p>
                                    <p className={`font-serif text-2xl ${VERDICT_STYLES[key].text}`}>{value}</p>
                                </div>
                            ),
                        )}
                        <div>
                            <p className="text-[8px] uppercase tracking-[0.13em] text-zinc-500">Scenarios</p>
                            <p className="font-serif text-2xl text-zinc-200">{run.scenarioComplete}/{run.scenarioTotal}</p>
                        </div>
                        <div className="ml-auto flex gap-2">
                            <button type="button" onClick={exportCsv} className="border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-zinc-300 hover:border-zinc-500">
                                CSV
                            </button>
                            <button type="button" onClick={exportHtml} className="border border-zinc-700 px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-zinc-300 hover:border-zinc-500">
                                HTML report
                            </button>
                        </div>
                    </div>

                    <ul className="divide-y divide-zinc-800/70">
                        {results.map((r) => {
                            const failed = r.checks.filter((c) => !c.passed);
                            const open = expanded === r.scenarioId;
                            return (
                                <li key={r.scenarioId}>
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(open ? null : r.scenarioId)}
                                        className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-zinc-800/30"
                                    >
                                        <span className={`h-2 w-2 flex-none rounded-full ${VERDICT_STYLES[r.verdict].dot}`} />
                                        <span className="w-12 flex-none font-mono text-[10px] text-zinc-500">{r.scenarioId}</span>
                                        <span className="flex-1 truncate text-[11.5px] text-zinc-200">{r.title}</span>
                                        <span className="hidden flex-none text-[10px] text-zinc-500 sm:inline">{r.group}</span>
                                        <span className={`flex-none px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${VERDICT_STYLES[r.verdict].chip}`}>
                                            {r.verdict}
                                        </span>
                                        <span className="w-14 flex-none text-right font-mono text-[10px] text-zinc-500">
                                            {failed.length}/{r.checks.length}
                                        </span>
                                    </button>
                                    {open ? (
                                        <div className="bg-zinc-900/40 px-4 pb-3 pl-9">
                                            <ul className="space-y-1">
                                                {r.checks.map((c) => (
                                                    <li key={c.label} className="flex items-start gap-2 text-[11px]">
                                                        <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${c.passed ? "bg-emerald-400" : c.severity === "critical" ? "bg-red-400" : "bg-amber-300"}`} />
                                                        <span>
                                                            <span className={c.passed ? "text-zinc-300" : c.severity === "critical" ? "text-red-200" : "text-amber-200"}>
                                                                {c.label}
                                                            </span>
                                                            <span className="text-zinc-500"> — {c.detail}</span>
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {r.error ? <p className="mt-2 text-[11px] text-red-300">Error: {r.error}</p> : null}
                                            {r.transcript?.length ? (
                                                <div className="mt-3 space-y-2 border-l border-zinc-800 pl-3">
                                                    {r.transcript.map((t, i) => (
                                                        <div key={i}>
                                                            <p className="text-[11px] font-semibold text-zinc-300">{t.user}</p>
                                                            <p className="whitespace-pre-wrap text-[11px] text-zinc-400">{t.assistant || "(no reply)"}</p>
                                                            {t.toolCalls.length ? (
                                                                <p className="mt-1 font-mono text-[10px] text-zinc-600">
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
                <p className="px-4 py-6 text-[11px] text-zinc-500">
                    No audit has been run yet. The integrity sweep is free and covers every SKU; the conversation
                    audit drives the live Grace brain and costs model spend.
                </p>
            )}
        </section>
    );
}
