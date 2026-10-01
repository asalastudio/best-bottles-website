#!/usr/bin/env node
/**
 * 2026-10-01 — the "Sleek 30ml" 18-415 fitment rule says droppers don't fit, yet the catalogue sells three Sleek 30
 * dropper bottles (GBSlk30DrpSl, GBSlk30DrpGl, GBSlk30DrpCu). Jordan confirmed droppers fit (checklist 3b), so the
 * rule's Dropper marker becomes ✓. Every Sleek 30 bottle then lists the three 18-415 droppers as compatible, and
 * Build Your Bottle offers the three dropper bottles. Needs catalogCorrections:correctFitmentRules (deployed with
 * the same pull request).
 *
 *   node scripts/catalog-corrections/2026-10-01-sleek30-dropper-rule.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-10-01-sleek30-dropper-rule.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-10-01-sleek30-dropper-rule.mjs --prod [--apply]
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

const [before, after] = revert ? ["✓", "—"] : ["—", "✓"];
const client = new ConvexHttpClient(url);
const result = await client.mutation("catalogCorrections:correctFitmentRules", {
    writeToken, dryRun: !apply,
    reason: revert ? "revert 2026-10-01 Sleek 30 dropper marker" : "2026-10-01 droppers fit the Sleek 30 (Jordan, Build Your Bottle checklist 3b)",
    entries: [{ bottleName: "Sleek 30ml", threadSize: "18-415", expect: { components: { Dropper: before } }, patch: { components: { Dropper: after } } }],
});
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
for (const w of result.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.rule} ${w.field}: ${w.before} → ${w.after}`);
if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.join(", ")}`);
if (result.changedSince.length) console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c.rule} ${c.field}=${c.now}`).join(", ")}`);
if (result.notFound.length) console.log(`  not found: ${result.notFound.join(", ")}`);
if (result.changedSince.length || result.notFound.length) process.exitCode = 1;
