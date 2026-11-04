#!/usr/bin/env node
/**
 * 2026-11-03 — the 10 ml clear Tall Rectangle bottles belong to the Sleek family (Jordan: "the clear tall rectangular
 * bottle, roll on with cap, and sprayer is supposed to go under the sleek family"; scope chosen: Tall 10 ml only).
 * Its 36 bottles and three groups (roll-on, cap, fine mist) move from Rectangle to Sleek, beside the 5 and 8 ml Sleek
 * 13-415 bottles. The Footed Rectangle and the 9 ml ground-glass applicator stay in Rectangle. Group slugs stay as
 * they are, so no page address changes. Every write is guarded by the value it replaces and logged in
 * catalogChangeLog; --revert restores Rectangle.
 *
 *   node scripts/catalog-corrections/2026-11-03-tall-rectangle-to-sleek.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-11-03-tall-rectangle-to-sleek.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-11-03-tall-rectangle-to-sleek.mjs --prod [--apply]
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

const BOTTLE = { before: { family: "Rectangle" }, after: { family: "Sleek" } };
const GROUP = { before: { family: "Rectangle", bottleCollection: "Rectangle" }, after: { family: "Sleek", bottleCollection: "Sleek" } };
const swap = ({ before, after }) => revert ? [after, before] : [before, after];
const BOTTLES = [
    "GBTallRect10BlkShSht", "GBTallRect10BlkSht", "GBTallRect10CuSht", "GBTallRect10Gl", "GBTallRect10GlMattSht", "GBTallRect10GlSht",
    "GBTallRect10MtlRollBlkDot", "GBTallRect10MtlRollBlkSh", "GBTallRect10MtlRollCuMatt", "GBTallRect10MtlRollGlMatt", "GBTallRect10MtlRollGlSh",
    "GBTallRect10MtlRollPinkDo", "GBTallRect10MtlRollSlDot", "GBTallRect10MtlRollSlMatt", "GBTallRect10MtlRollSlSh",
    "GBTallRect10RollBlkDot", "GBTallRect10RollBlkSh", "GBTallRect10RollCuMatt", "GBTallRect10RollGlMatt", "GBTallRect10RollGlSh",
    "GBTallRect10RollPinkDot", "GBTallRect10RollSlDot", "GBTallRect10RollSlMatt", "GBTallRect10RollSlSh",
    "GBTallRect10Sl", "GBTallRect10SlMattSht", "GBTallRect10SlSht",
    "GBTallRect10SpryBlkMatt", "GBTallRect10SpryBlkSh", "GBTallRect10SpryBluMatt", "GBTallRect10SpryCuMatt", "GBTallRect10SpryGlMatt",
    "GBTallRect10SpryGlSh", "GBTallRect10SprySlMatt", "GBTallRect10SprySlSh", "GBTallRect10WhtSht",
];
const GROUPS = ["tall-rectangle-10ml-clear-13-415", "tall-rectangle-10ml-clear-13-415-rollon", "tall-rectangle-10ml-clear-13-415-finemist"];
const reason = revert ? "revert 2026-11-03 Tall Rectangle family move" : "2026-11-03 the 10 ml Tall Rectangle bottles belong to the Sleek family (Jordan)";

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
let problems = 0;
const [bExpect, bPatch] = swap(BOTTLE), [gExpect, gPatch] = swap(GROUP);
const products = await client.mutation("catalogCorrections:correctProductFields", { writeToken, dryRun: !apply, reason,
    entries: BOTTLES.map(websiteSku => ({ websiteSku, expect: bExpect, patch: bPatch })) });
const groups = await client.mutation("catalogCorrections:correctGroupFields", { writeToken, dryRun: !apply, reason,
    entries: GROUPS.map(slug => ({ slug, expect: gExpect, patch: gPatch })) });
for (const [kind, result, key] of [["bottle", products, "websiteSku"], ["group", groups, "slug"]]) {
    console.log(`  ${kind}s: ${result.written.length} ${apply ? "written" : "to write"}`);
    for (const w of result.written.slice(0, 3)) console.log(`    e.g. ${w[key]}.${w.field}: ${w.before} → ${w.after}`);
    if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.join(", ")}`);
    if (result.changedSince.length) { problems++; console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c[key]}.${c.field}=${c.now}`).join(", ")}`); }
    if (result.notFound.length) { problems++; console.log(`  not found: ${result.notFound.join(", ")}`); }
}
if (problems) process.exitCode = 1;
