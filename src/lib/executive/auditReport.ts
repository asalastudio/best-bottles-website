/**
 * Audit artifact builders — CSV for spreadsheets, standalone HTML for reading.
 *
 * Both are generated client-side from the Convex run data so an operator can
 * hand the file to someone without database access. The HTML is fully
 * self-contained (no external CSS/JS) so it survives being emailed.
 */

export type AuditCheckRow = { label: string; passed: boolean; severity: string; detail: string };

export type AuditResultRow = {
    scenarioId: string;
    group: string;
    title: string;
    verdict: "pass" | "warn" | "fail";
    checks: AuditCheckRow[];
    toolCallCount: number;
    durationMs: number;
    error: string | null;
    transcript?: Array<{ user: string; assistant: string; toolCalls: Array<{ name: string; executed: string }> }>;
};

export type AuditRunHeader = {
    kind: string;
    status: string;
    startedAt: number;
    finishedAt: number | null;
    environment: string;
    scenarioTotal: number;
    scenarioComplete: number;
    passCount: number;
    warnCount: number;
    failCount: number;
    scorePct: number | null;
};

const csvCell = (value: unknown): string => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildAuditCsv(run: AuditRunHeader, results: AuditResultRow[]): string {
    const lines: string[] = [];
    lines.push(["Scenario", "Group", "Title", "Verdict", "Failed checks", "Check", "Passed", "Severity", "Detail", "Tool calls", "Duration (ms)", "Error"].join(","));

    for (const r of results) {
        const failed = r.checks.filter((c) => !c.passed).length;
        if (r.checks.length === 0) {
            lines.push([r.scenarioId, r.group, r.title, r.verdict, failed, "", "", "", "", r.toolCallCount, r.durationMs, r.error ?? ""].map(csvCell).join(","));
            continue;
        }
        // One row per check so the sheet is filterable line by line.
        for (const c of r.checks) {
            lines.push([
                r.scenarioId, r.group, r.title, r.verdict, failed,
                c.label, c.passed ? "PASS" : "FAIL", c.severity, c.detail,
                r.toolCallCount, r.durationMs, r.error ?? "",
            ].map(csvCell).join(","));
        }
    }

    const summary = [
        "",
        ["# Run summary"].join(","),
        ["Environment", run.environment].map(csvCell).join(","),
        ["Started", new Date(run.startedAt).toISOString()].map(csvCell).join(","),
        ["Scenarios", `${run.scenarioComplete}/${run.scenarioTotal}`].map(csvCell).join(","),
        ["Pass", run.passCount].map(csvCell).join(","),
        ["Warn", run.warnCount].map(csvCell).join(","),
        ["Fail", run.failCount].map(csvCell).join(","),
        ["Score", run.scorePct === null ? "—" : `${run.scorePct}%`].map(csvCell).join(","),
    ];

    return [...lines, ...summary].join("\n");
}

const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildAuditHtml(run: AuditRunHeader, results: AuditResultRow[]): string {
    const tone = { pass: "#15803d", warn: "#b45309", fail: "#b91c1c" } as const;
    const bg = { pass: "#dcfce7", warn: "#fef3c7", fail: "#fee2e2" } as const;

    const rows = results.map((r) => {
        const checks = r.checks.map((c) => `
      <li class="${c.passed ? "ok" : c.severity === "critical" ? "bad" : "soft"}">
        <span class="dot"></span>
        <span><strong>${escapeHtml(c.label)}</strong> — ${escapeHtml(c.detail)}</span>
      </li>`).join("");

        const convo = (r.transcript ?? []).map((t) => `
      <div class="turn">
        <p class="q">${escapeHtml(t.user)}</p>
        <p class="a">${escapeHtml(t.assistant || "(no reply)")}</p>
        ${t.toolCalls.length ? `<p class="tools">tools: ${t.toolCalls.map((c) => escapeHtml(c.name)).join(", ")}</p>` : ""}
      </div>`).join("");

        return `
    <tr class="row">
      <td class="mono">${escapeHtml(r.scenarioId)}</td>
      <td>${escapeHtml(r.group)}</td>
      <td>${escapeHtml(r.title)}</td>
      <td><span class="pill" style="color:${tone[r.verdict]};background:${bg[r.verdict]}">${r.verdict.toUpperCase()}</span></td>
      <td class="mono">${r.checks.filter((c) => !c.passed).length}/${r.checks.length}</td>
      <td class="mono">${r.toolCallCount}</td>
      <td class="mono">${(r.durationMs / 1000).toFixed(1)}s</td>
    </tr>
    <tr class="detail"><td colspan="7">
      <ul class="checks">${checks}</ul>
      ${r.error ? `<p class="err">Error: ${escapeHtml(r.error)}</p>` : ""}
      ${convo ? `<details><summary>Transcript</summary>${convo}</details>` : ""}
    </td></tr>`;
    }).join("");

    const score = run.scorePct === null ? "—" : `${run.scorePct}%`;
    const scoreTone = run.failCount > 0 ? tone.fail : run.warnCount > 0 ? tone.warn : tone.pass;

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Grace Audit — ${new Date(run.startedAt).toLocaleString()}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; margin: 0; padding: 32px; background:#fafaf9; color:#1c1917; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color:#57534e; font-size: 12px; margin: 0 0 24px; }
  .cards { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:24px; }
  .card { border:1px solid #e7e5e4; background:#fff; padding:12px 16px; min-width:120px; }
  .card b { display:block; font-size:22px; }
  .card span { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#78716c; }
  table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #e7e5e4; }
  th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#78716c; padding:10px; border-bottom:1px solid #e7e5e4; }
  td { padding:10px; vertical-align:top; border-bottom:1px solid #f5f5f4; }
  tr.detail td { padding-top:0; background:#fcfcfb; }
  .mono { font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
  .pill { padding:2px 8px; font-size:11px; font-weight:600; border-radius:2px; }
  ul.checks { list-style:none; margin:0 0 8px; padding:0; }
  ul.checks li { display:flex; gap:8px; align-items:flex-start; padding:3px 0; font-size:12.5px; }
  .dot { width:8px; height:8px; border-radius:50%; margin-top:6px; flex:0 0 8px; }
  li.ok .dot { background:#16a34a; } li.bad .dot { background:#dc2626; } li.soft .dot { background:#d97706; }
  li.bad span { color:#991b1b; } li.soft span { color:#92400e; }
  .err { color:#b91c1c; font-size:12px; }
  details { margin-top:6px; } summary { cursor:pointer; font-size:12px; color:#57534e; }
  .turn { border-left:2px solid #e7e5e4; padding:6px 0 6px 12px; margin:8px 0; }
  .q { margin:0 0 4px; font-weight:600; font-size:12.5px; }
  .a { margin:0; white-space:pre-wrap; font-size:12.5px; }
  .tools { margin:4px 0 0; font-size:11px; color:#78716c; }
  @media (prefers-color-scheme: dark) {
    body{background:#0c0a09;color:#e7e5e4}.card,table{background:#1c1917;border-color:#292524}
    tr.detail td{background:#171412}td{border-color:#292524}.sub,.card span,summary,.tools{color:#a8a29e}
  }
</style></head><body>
<h1>Grace Accuracy Audit</h1>
<p class="sub">${escapeHtml(run.environment)} · started ${new Date(run.startedAt).toLocaleString()} · ${escapeHtml(run.status)}</p>
<div class="cards">
  <div class="card"><span>Score</span><b style="color:${scoreTone}">${score}</b></div>
  <div class="card"><span>Pass</span><b style="color:${tone.pass}">${run.passCount}</b></div>
  <div class="card"><span>Warn</span><b style="color:${tone.warn}">${run.warnCount}</b></div>
  <div class="card"><span>Fail</span><b style="color:${tone.fail}">${run.failCount}</b></div>
  <div class="card"><span>Scenarios</span><b>${run.scenarioComplete}/${run.scenarioTotal}</b></div>
</div>
<table>
  <thead><tr><th>ID</th><th>Group</th><th>Scenario</th><th>Verdict</th><th>Failed</th><th>Tools</th><th>Time</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;
}

export function downloadFile(filename: string, contents: string, mime: string) {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
