#!/usr/bin/env node
/**
 * 2026-10-01 — cap colours from the Build Your Bottle checklist, approved by Jordan (items 1f, 5a, 5b).
 *
 * 1f  Three short shiny black cap bottles stored a blank or "Clear" cap colour. Their reviewed pairing with
 *     CP13-415BlkShShtMtl (convex/catalog-component-links.json) names the bottle's cap colour, "Shiny Black".
 * 5a  Six Boston Round roll-ons said "Gold"; their names and pages say shiny gold, and the roll-on cap they list
 *     is CPRoll20-400TallShnGl. With "Gold" the builder matched no listed cap and never offered them.
 * 5b  Two Boston Round metal roll-ons said "Black"; the 2 oz name says shiny black cap and the 1 oz page address
 *     says shiny-black-cap. They list CPRoll20-400TallShnBlk.
 *
 *   node scripts/catalog-corrections/2026-10-01-byb-checklist-cap-colours.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-10-01-byb-checklist-cap-colours.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-10-01-byb-checklist-cap-colours.mjs --prod [--apply]
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

/** [websiteSku, cap colour today, cap colour after] */
const CORRECTIONS = [
    // 1f
    ["GBElgFrst15BlkShSht", null, "Shiny Black"],
    ["GBPillar9BlkShSht", "Clear", "Shiny Black"],
    ["GBTulip6BlkShSht", "Clear", "Shiny Black"],
    // 5a
    ["GBBstnAmb1ozRollonGl", "Gold", "Shiny Gold"],
    ["GBBstnAmb2ozRollonGl", "Gold", "Shiny Gold"],
    ["GBBstnBlu1ozRollonGl", "Gold", "Shiny Gold"],
    ["GBBstnBlu2ozRollonGl", "Gold", "Shiny Gold"],
    ["GBBstnAmb1ozMtlRollonGl", "Gold", "Shiny Gold"],
    ["GBBstnBlu1ozMtlRollonGl", "Gold", "Shiny Gold"],
    // 5b
    ["GBBstn1ozMtlRollonBlk", "Black", "Shiny Black"],
    ["GBBstn2ozMtlRollBlk", "Black", "Shiny Black"],
];
const entries = CORRECTIONS.map(([websiteSku, before, after]) => revert
    ? { websiteSku, expect: { capColor: after }, patch: { capColor: before } }
    : { websiteSku, expect: { capColor: before }, patch: { capColor: after } });

const client = new ConvexHttpClient(url);
const result = await client.mutation("catalogCorrections:correctProductFields", {
    writeToken, dryRun: !apply, entries,
    reason: revert ? "revert 2026-10-01 Build Your Bottle checklist cap colours" : "2026-10-01 Build Your Bottle checklist cap colours (Jordan: 1f, 5a, 5b)",
});
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
for (const w of result.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.join(", ")}`);
if (result.changedSince.length) console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
if (result.notFound.length) console.log(`  not found: ${result.notFound.join(", ")}`);
if (result.changedSince.length || result.notFound.length) process.exitCode = 1;
