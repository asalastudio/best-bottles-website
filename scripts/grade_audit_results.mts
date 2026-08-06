/**
 * Grade a recorded audit-results.json (from tests/grace-accuracy-audit.live.test.ts)
 * with the SAME machine checks the executive-dashboard runner uses
 * (auditRunner.buildChecks + auditScenarios.verdictFor), against LIVE Convex
 * ground truth. Point NEXT_PUBLIC_CONVEX_URL at the deployment the run targeted.
 *
 * Usage: NEXT_PUBLIC_CONVEX_URL=... npx tsx scripts/grade_audit_results.mts <results.json>
 */
import { readFileSync } from "node:fs";
import { buildChecks } from "../src/lib/grace/auditRunner";
import { GRACE_AUDIT_SCENARIOS, verdictFor, type AuditTurn } from "../src/lib/grace/auditScenarios";

const file = process.argv[2];
if (!file) throw new Error("usage: grade_audit_results.mts <audit-results.json>");
type Recorded = { id: string; group: string; title: string; transcript: AuditTurn[]; error: string | null };
const recorded: Recorded[] = JSON.parse(readFileSync(file, "utf8"));

const tally = { pass: 0, warn: 0, fail: 0 };
const failures: string[] = [];

for (const rec of recorded) {
    const scenario = GRACE_AUDIT_SCENARIOS.find((s) => s.id === rec.id);
    if (!scenario) {
        console.log(`?? ${rec.id} — no scenario definition, skipped`);
        continue;
    }
    const checks = await buildChecks(scenario, rec.transcript ?? []);
    const verdict = verdictFor(checks, rec.error ?? null);
    tally[verdict] += 1;
    const critsFailed = checks.filter((c) => c.severity === "critical" && !c.passed);
    const softsFailed = checks.filter((c) => c.severity === "soft" && !c.passed);
    const mark = verdict === "pass" ? "✓" : verdict === "warn" ? "~" : "✗";
    console.log(`${mark} ${rec.id.padEnd(5)} ${verdict.toUpperCase().padEnd(4)} ${rec.title}`);
    for (const c of critsFailed) {
        console.log(`      CRITICAL: ${c.label} — ${c.detail}`);
        failures.push(`${rec.id}: ${c.label}`);
    }
    for (const c of softsFailed) console.log(`      soft: ${c.label} — ${c.detail}`);
}

console.log(`\nTally: ${tally.pass} pass · ${tally.warn} warn · ${tally.fail} fail of ${recorded.length}`);
