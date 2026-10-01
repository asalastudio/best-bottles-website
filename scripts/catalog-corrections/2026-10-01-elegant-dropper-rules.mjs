#!/usr/bin/env node
/**
 * 2026-10-01 — the Elegant 60 dropper bottles (GBElg60Drp{Sl,Gl,Cu}, GBElgFrst60Drp{Sl,Gl,Cu}) were matched to the wrong
 * 18-415 fitment rule (Jordan, Build Your Bottle checklist 3a). "Elegant 100m Frosted" has no capacity, so it
 * outscores every other Elegant rule, and it says droppers don't fit; the rule that does fit the 60 mL glass,
 * "Elegant 2oz" (and its frosted twin), allows droppers but is filed as 59 mL. After the fix the Elegant 60 bottles take
 * the 2 oz rules: the six dropper bottles become builder options, and the 88 other Elegant 60 bottles list the three
 * 18-415 droppers as compatible on their product pages. The two 100 mL rules carry the same markers, so the
 * Elegant 100 bottles change nothing. Needs catalogCorrections:correctFitmentRules (pull request #340).
 *
 *   node scripts/catalog-corrections/2026-10-01-elegant-dropper-rules.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-10-01-elegant-dropper-rules.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-10-01-elegant-dropper-rules.mjs --prod [--apply]
 *   ... --revert [--apply]   # swap expect and patch
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}
const PROD_URL = "https://precise-raccoon-123.convex.cloud";
const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const revert = process.argv.includes("--revert");
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

/** [rule, capacity today, capacity after] */
const RULES = [["Elegant 100m Frosted", null, 100], ["Elegant 2oz", 59, 60], ["Elegant 2oz Frosted", 59, 60]];
const entries = RULES.map(([bottleName, before, after]) => ({ bottleName, threadSize: "18-415",
    expect: { capacityMl: revert ? after : before }, patch: { capacityMl: revert ? before : after } }));

const client = new ConvexHttpClient(url);
const result = await client.mutation("catalogCorrections:correctFitmentRules", {
    writeToken, dryRun: !apply, entries,
    reason: revert ? "revert 2026-10-01 Elegant rule capacities" : "2026-10-01 Elegant 60 takes the 2 oz rules (Jordan, Build Your Bottle checklist 3a)",
});
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
for (const w of result.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.rule} ${w.field}: ${w.before} → ${w.after}`);
if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.join(", ")}`);
if (result.changedSince.length) console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c.rule} ${c.field}=${c.now}`).join(", ")}`);
if (result.notFound.length) console.log(`  not found: ${result.notFound.join(", ")}`);
if (result.changedSince.length || result.notFound.length) process.exitCode = 1;
