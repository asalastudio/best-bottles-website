#!/usr/bin/env node
/**
 * 2026-10-01 — three plastic flip-top bottles were filed in the glass Cylinder family (Jordan, checklist 8b):
 * PbClear4ozFlpWh (114 ml), PbClear8ozFlpWh (227 ml) and PbNat16ozFlpWh (454 ml). Their category is already
 * "Plastic Bottle"; the bottles and their three one-bottle groups move to the Plastic Bottle family, where the other
 * four plastic bottles live. Group slugs stay as they are, so no page address changes. Needs the family and
 * bottleCollection fields of catalogCorrections (deployed with the same pull request).
 *
 *   node scripts/catalog-corrections/2026-10-01-plastic-flip-tops.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-10-01-plastic-flip-tops.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-10-01-plastic-flip-tops.mjs --prod [--apply]
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

const BEFORE = { family: "Cylinder", bottleCollection: null };
const AFTER = { family: "Plastic Bottle", bottleCollection: "Plastic Bottle" };
const [expect, patch] = revert ? [AFTER, BEFORE] : [BEFORE, AFTER];
const BOTTLES = ["PbClear4ozFlpWh", "PbClear8ozFlpWh", "PbNat16ozFlpWh"];
const GROUPS = ["cylinder-118ml-clear", "cylinder-227ml-clear", "cylinder-454ml-clear"];
const reason = revert ? "revert 2026-10-01 plastic flip-top family move" : "2026-10-01 plastic flip-top bottles belong to the Plastic Bottle family (Jordan, checklist 8b)";

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
let problems = 0;
const products = await client.mutation("catalogCorrections:correctProductFields", { writeToken, dryRun: !apply, reason,
    entries: BOTTLES.map(websiteSku => ({ websiteSku, expect, patch })) });
const groups = await client.mutation("catalogCorrections:correctGroupFields", { writeToken, dryRun: !apply, reason,
    entries: GROUPS.map(slug => ({ slug, expect, patch })) });
for (const [kind, result, key] of [["bottle", products, "websiteSku"], ["group", groups, "slug"]]) {
    for (const w of result.written) console.log(`  ${apply ? "wrote" : "would write"} ${kind} ${w[key]}.${w.field}: ${w.before} → ${w.after}`);
    if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.join(", ")}`);
    if (result.changedSince.length) { problems++; console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c[key]}.${c.field}=${c.now}`).join(", ")}`); }
    if (result.notFound.length) { problems++; console.log(`  not found: ${result.notFound.join(", ")}`); }
}
if (problems) process.exitCode = 1;
