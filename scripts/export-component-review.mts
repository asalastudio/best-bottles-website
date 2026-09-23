#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { evidenceKey, reconciliationCaseSchema, reconciliationResponseSchema, reconciliationVerdict } from "../src/lib/catalog/jev-reconciliation";
import { reconciliationCsv } from "../src/lib/catalog/reconciliation-csv";

const option = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const reportPath = option("report");
if (!reportPath) throw new Error("Use --report=path/to/report.json from a completed Jev audit.");
const rows = reconciliationCaseSchema.array().parse(JSON.parse(readFileSync(option("input") ?? "data/reconciliation/jev-pilot.json", "utf8")));
const report = z.object({ checkedAt: z.string().datetime(), mode: z.literal("advisory-live"), model: z.literal("jev-1.13.0"),
    results: z.array(z.object({ id: z.string(), inputSha256: z.string(), response: reconciliationResponseSchema.nullable() })) }).parse(JSON.parse(readFileSync(reportPath, "utf8")));
if (new Set(report.results.map(r => r.id)).size !== report.results.length || report.results.length !== rows.length) throw new Error("Report case set does not match input.");
const results = rows.map(row => {
    const result = report.results.find(r => r.id === row.id);
    if (!result || result.inputSha256 !== evidenceKey(row)) throw new Error(`Stale or mismatched evidence for ${row.id}`);
    return { ...result, kind: row.kind, ...reconciliationVerdict(row, result.response) };
});
const out = resolve(option("out") ?? "output/component-review"); mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "catalog-review.csv"), reconciliationCsv(rows, results, report.checkedAt));
writeFileSync(resolve(out, "stakeholder-findings.csv"), reconciliationCsv(rows, results, report.checkedAt, true));
const queue = { checkedAt: report.checkedAt, model: report.model, rows: rows.filter(row => row.kind === "catalog").map(row => {
    const result = results.find(r => r.id === row.id)!;
    return { id: row.id, evidenceSha: createHash("sha256").update(JSON.stringify({ input: result.inputSha256, status: result.status, issues: result.issues })).digest("hex"),
        family: row.bottle.family, capacityMl: row.bottle.capacityMl, glass: row.bottle.glass,
        bottleSku: row.bottle.sku, bottleName: row.bottle.name, neck: row.bottle.neck, fitment: row.bottle.applicator, finish: row.bottle.finish,
        componentSku: row.proposed.sku, componentName: row.proposed.name, componentNeck: row.proposed.neck,
        status: result.status, issues: result.issues, sourceUrl: row.assemblySource?.url ?? null, sourceDescription: row.assemblySource?.description ?? null,
        componentSourceUrl: row.componentSource?.url ?? null, componentSourceDescription: row.componentSource?.description ?? null };
}) };
const target = resolve(option("snapshot") ?? `${out}/queue-snapshot.json`); mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(queue, null, 2) + "\n");
console.log(`Exported ${queue.rows.length} catalog review items; benchmark controls excluded. No remote writes.`);
