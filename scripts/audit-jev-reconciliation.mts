#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { reconciliationCsv } from "../src/lib/catalog/reconciliation-csv";
import { reconciliationCaseSchema, reconciliationResponseSchema, reconciliationVerdict, reconciliationState,
    deterministicFindings, evidenceKey, reviewReconciliation, RECONCILIATION_MODEL } from "../src/lib/catalog/jev-reconciliation";

const args = process.argv.slice(2);
const option = (key: string) => args.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = resolve(option("input") ?? "data/reconciliation/jev-pilot.json");
const out = resolve(option("out") ?? "output/jev-reconciliation");
const run = args.includes("--run");
const rows = reconciliationCaseSchema.array().min(1).max(1000).parse(JSON.parse(readFileSync(input, "utf8")));
if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("Duplicate case IDs");
// No live Convex access, catalog mutation, artwork upload, or secret-store lookup.
const local = existsSync(".env.local") ? parse(readFileSync(".env.local")) : {};
const key = process.env.TYPESAFE_API_KEY || local.TYPESAFE_API_KEY;
if (run && !key) throw new Error("TYPESAFE_API_KEY is required for --run; dry-run remains available.");
const limit = Number(option("limit") ?? 32);
if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("--limit must be 1..1000");
if (run && rows.length > limit) throw new Error(`Input has ${rows.length} cases; explicit --limit=${rows.length} required`);
mkdirSync(out, { recursive: true });
const results = [];
let serviceFailures = 0;
for (const row of rows) {
    const hash = evidenceKey(row), cacheFile = resolve(out, `${hash}.json`);
    let response = null, error: string | null = null, cached = false;
    if (run) {
        try {
            if (existsSync(cacheFile) && !args.includes("--fresh")) {
                response = reconciliationResponseSchema.parse(JSON.parse(readFileSync(cacheFile, "utf8")));
                cached = true;
            } else {
                response = await reviewReconciliation(row, key!);
                writeFileSync(cacheFile, JSON.stringify(response, null, 2) + "\n");
            }
        } catch (err) {
            error = err instanceof Error && /^Jev HTTP \d+$/.test(err.message) ? err.message : "Jev request failed or returned an invalid response";
            serviceFailures++;
        }
    }
    const verdict = reconciliationVerdict(row, response);
    results.push({ id: row.id, kind: row.kind, sku: row.bottle.sku, proposedSku: row.proposed.sku,
        sourceUrls: [row.assemblySource?.url, row.componentSource?.url].filter(Boolean), inputSha256: hash,
        expected: row.expected ?? null, deterministicIssues: deterministicFindings(row), ...verdict,
        response, error, cached,
        benchmarkAgreement: row.expected && response ? (row.expected === "aligned" ? verdict.status === "evidence_aligned" : verdict.status === "review_required") : null,
    });
    console.log(`${row.id}: ${verdict.status}${error ? ` (${error})` : ""}`);
}
const controls = results.filter(r => r.kind === "control" && r.expected === "review");
const report = { checkedAt: new Date().toISOString(), mode: run ? "advisory-live" : "dry-run", model: RECONCILIATION_MODEL,
    scope: "Text evidence only; no physical-fit, image-quality, or publication approval", total: rows.length, serviceFailures,
    controls: { total: controls.length, flagged: controls.filter(r => r.status === "review_required").length,
        falseAlignment: controls.filter(r => r.status === "evidence_aligned").length }, results };
writeFileSync(resolve(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
writeFileSync(resolve(out, "catalog-review.csv"), reconciliationCsv(rows, results, report.checkedAt));
writeFileSync(resolve(out, "stakeholder-findings.csv"), reconciliationCsv(rows, results, report.checkedAt, true));
const safe = (s: string) => s.replace(/[|\r\n]/g, " ");
writeFileSync(resolve(out, "report.md"), `# Jev reconciliation pilot\n\n${report.mode}; ${rows.length} cases. Advisory text review only.\n\n| Case | SKU | Result | Findings |\n| --- | --- | --- | --- |\n${results.map(r => `| ${safe(r.id)} | ${safe(r.sku)} | ${r.status} | ${r.issues.join(", ")} |`).join("\n")}\n`);
if (!run) writeFileSync(resolve(out, "request-preview.json"), JSON.stringify(rows.map(row => ({ id: row.id, state: reconciliationState(row) })), null, 2) + "\n");
console.log(JSON.stringify({ mode: report.mode, total: rows.length, serviceFailures, controls: report.controls }));
// Model disagreements are review findings; unavailable service must not appear green.
if (serviceFailures) process.exitCode = 1;
