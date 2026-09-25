#!/usr/bin/env node
/**
 * 2026-09-25 — cap-colour corrections for the 9 mL Cylinder (17-415), approved by Jordan.
 *
 * Ten clear-glass rows carried the glass colour as their cap colour; each gets the value its
 * amber sibling already uses. The turquoise sprayer component carried "Shiny" although its
 * item name is "Shiny turquoise collar sprayer".
 *
 *   node scripts/catalog-corrections/2026-09-25-cyl9-cap-colours.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-25-cyl9-cap-colours.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-25-cyl9-cap-colours.mjs --prod [--apply]
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

const CORRECTIONS = [
    ["GBCyl9SpryBlk", "Clear", "Black"],
    ["LBCyl9LtnBlk", "Clear", "Black"],
    ["GBCyl9SpryGl", "Clear", "Gold"],
    ["LBCyl9LtnGl", "Clear", "Gold"],
    ["GBCyl9SpryMattSl", "Clear", "Matte Silver"],
    ["LBCyl9LtnMtSl", "Clear", "Matte Silver"],
    ["GBCyl9SpryRd", "Clear", "Red"],
    ["GBCyl9SpryShSl", "Clear", "Shiny Silver"],
    ["GBCyl9SpryTur", "Clear", "Turquoise"],
    ["GBCylSwrl9SpryTur", "Clear", "Turquoise"],
    ["Spry17-415Tur", "Shiny", "Turquoise"],
];
const entries = CORRECTIONS.map(([websiteSku, before, after]) => revert
    ? { websiteSku, expect: { capColor: after }, patch: { capColor: before } }
    : { websiteSku, expect: { capColor: before }, patch: { capColor: after } });

const client = new ConvexHttpClient(url);
const result = await client.mutation("catalogCorrections:correctProductFields", {
    writeToken, dryRun: !apply, entries,
    reason: revert ? "revert 2026-09-25 9 mL Cylinder cap colours" : "2026-09-25 9 mL Cylinder cap colours (Jordan)",
});
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
for (const w of result.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.join(", ")}`);
if (result.changedSince.length) console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
if (result.notFound.length) console.log(`  not found: ${result.notFound.join(", ")}`);
if (result.changedSince.length || result.notFound.length) process.exitCode = 1;
