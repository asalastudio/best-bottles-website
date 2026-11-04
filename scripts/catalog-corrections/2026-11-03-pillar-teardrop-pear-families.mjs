#!/usr/bin/env node
/**
 * 2026-11-03 — three small families fold into their neighbours (Jordan):
 * - Pillar into Cylinder ("we'll move pillar into the cylinder family"): the four 9 ml 13-415 Pillar bottles and their
 *   three groups (one of them empty), beside the 9 ml Cylinders.
 * - Teardrop into Apothecary ("we're gonna move the teardrop into the apothecary family"): the three 9 ml stoppered
 *   teardrops and their groups.
 * - The 355 ml cobalt pear bottle (GBCB12ozPear) from Decorative into Apothecary, beside the 118 ml stoppered pear.
 * family and bottleCollection both take the new family's name (the Pillar bottles carried four different collections:
 * null, Roll-On Collection, Specialty & Decorative, Pillar). Group slugs stay, so no page address changes. Every write
 * is guarded by the value it replaces (read from production on 3 Nov 2026) and logged in catalogChangeLog; --revert
 * restores each record's own previous values.
 *
 *   node scripts/catalog-corrections/2026-11-03-pillar-teardrop-pear-families.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-11-03-pillar-teardrop-pear-families.mjs --prod [--apply]
 *   ... --revert [--apply]
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

// [websiteSku, family before, bottleCollection before, family after]
const BOTTLES = [
    ["GBPillar9SpryBlkMatt", "Pillar", "Pillar", "Cylinder"],
    ["GBPillar9MtlRollBlkdot", "Pillar", null, "Cylinder"],
    ["GBPillar9RollBlkDot", "Pillar", "Roll-On Collection", "Cylinder"],
    ["GBPillar9BlkShSht", "Pillar", "Specialty & Decorative", "Cylinder"],
    ["GBTRDPClear", "Teardrop", "Teardrop", "Apothecary"],
    ["GBTrdpBlue", "Teardrop", "Teardrop", "Apothecary"],
    ["GBTRDPGreen", "Teardrop", "Teardrop", "Apothecary"],
    ["GBCB12ozPear", "Decorative", "Decorative", "Apothecary"],
];
// [slug, family before, bottleCollection before, family after]
const GROUPS = [
    ["pillar-9ml-clear-13-415", "Pillar", null, "Cylinder"],
    ["pillar-9ml-clear-17-415-finemist", "Pillar", "Pillar", "Cylinder"],
    ["pillar-9ml-clear-Size: GBPillar9BlkSht Nemat In", "Pillar", "Specialty & Decorative", "Cylinder"],
    ["teardrop-9ml-clear-Ground-glassapplicator", "Teardrop", "Teardrop", "Apothecary"],
    ["teardrop-9ml-cobalt-blue-Ground-glassapplicator", "Teardrop", "Teardrop", "Apothecary"],
    ["teardrop-9ml-green-Ground-glassapplicator", "Teardrop", "Teardrop", "Apothecary"],
    ["pear-355ml-clear-Ground-glassapplicator", "Decorative", "Decorative", "Apothecary"],
];
const pair = (family, collection, to) => {
    const before = { family, bottleCollection: collection }, after = { family: to, bottleCollection: to };
    return revert ? [after, before] : [before, after];
};
const reason = revert ? "revert 2026-11-03 Pillar/Teardrop/pear family moves"
    : "2026-11-03 Pillar into Cylinder; Teardrop and the 355 ml pear into Apothecary (Jordan)";

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
let problems = 0;
const products = await client.mutation("catalogCorrections:correctProductFields", { writeToken, dryRun: !apply, reason,
    entries: BOTTLES.map(([websiteSku, f, c, to]) => { const [expect, patch] = pair(f, c, to); return { websiteSku, expect, patch }; }) });
const groups = await client.mutation("catalogCorrections:correctGroupFields", { writeToken, dryRun: !apply, reason,
    entries: GROUPS.map(([slug, f, c, to]) => { const [expect, patch] = pair(f, c, to); return { slug, expect, patch }; }) });
for (const [kind, result, key] of [["bottle", products, "websiteSku"], ["group", groups, "slug"]]) {
    console.log(`  ${kind}s: ${result.written.length} field writes ${apply ? "made" : "to make"}`);
    for (const w of result.written) console.log(`    ${w[key]}.${w.field}: ${w.before} → ${w.after}`);
    if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.join(", ")}`);
    if (result.changedSince.length) { problems++; console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c[key]}.${c.field}=${c.now}`).join(", ")}`); }
    if (result.notFound.length) { problems++; console.log(`  not found: ${result.notFound.join(", ")}`); }
}
if (problems) process.exitCode = 1;
