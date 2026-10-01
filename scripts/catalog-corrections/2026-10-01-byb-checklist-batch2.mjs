#!/usr/bin/env node
/**
 * 2026-10-01 — catalogue corrections from the Build Your Bottle checklist, batch 2, approved by Jordan (items 1h, 1i,
 * 2a, 4a, 4b, 4c). Each value was checked against the bottle's bestbottles.com page and photo the same day.
 *
 * 1h  GB09BlackCapSht stored the glass colour, "Clear", as its cap colour; its page says "black short cap". With Black
 *     it pairs with the short black cap (tie-break in src/lib/bottle-builder/component-matches.ts).
 * 1i  GBSqr15BlkShSht's name and description say "short shiny silver cap", copied from its page; its SKU, cap colour
 *     and both photos (legacy and Shopify) show the short shiny black cap. (No short shiny silver Square 15 exists.)
 * 2a  GBDivaFrst46RdcrShnBlk said cap colour "Clear" and style "Tall"; the other 15 reducer bottles with its shiny black
 *     cap say "Shiny Black" / "Screw Cap", and its page says "reducer and black shiny cap".
 * 4a  GBBstn15BlkDrp said applicator "N/A" and no cap colour; its name and Shopify photo show a plain black dropper.
 * 4b  The two Pillar 9 black dotted roll-ons said applicator "N/A", so the builder looked for a screw cap. Their SKUs name
 *     the plastic and the metal roller; "Black Dotted" is what the other 13-415 dotted roll-ons say.
 * 4c  GBVialClr2mlBlackCap said cap style "Tall"; its name and page say short black cap.
 *
 *   node scripts/catalog-corrections/2026-10-01-byb-checklist-batch2.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-10-01-byb-checklist-batch2.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-10-01-byb-checklist-batch2.mjs --prod [--apply]
 *   ... --revert [--apply]   # swap expect and patch
 *   ... --only GBVialClr2mlBlackCap,GB09BlackCapSht   # just these bottles (1i needs the name fields of pull request #340)
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

const SQR15_SILVER = "Square design 15ml, 1/2oz Clear glass bottle with short shiny silver cap.";
const SQR15_BLACK = "Square design 15ml, 1/2oz Clear glass bottle with short shiny black cap.";
/** [websiteSku, fields today, fields after] */
const CORRECTIONS = [
    ["GB09BlackCapSht", { capColor: "Clear" }, { capColor: "Black" }],                                                       // 1h
    ["GBSqr15BlkShSht", { itemName: SQR15_SILVER, itemDescription: SQR15_SILVER }, { itemName: SQR15_BLACK, itemDescription: SQR15_BLACK }], // 1i
    ["GBDivaFrst46RdcrShnBlk", { capColor: "Clear", capStyle: "Tall" }, { capColor: "Shiny Black", capStyle: "Screw Cap" }],  // 2a
    ["GBBstn15BlkDrp", { applicator: "N/A", capColor: null }, { applicator: "Dropper", capColor: "Black" }],                 // 4a
    ["GBPillar9RollBlkDot", { applicator: "N/A", capColor: "Clear" }, { applicator: "Plastic Roller Ball", capColor: "Black Dotted" }], // 4b
    ["GBPillar9MtlRollBlkdot", { applicator: "N/A", capColor: null }, { applicator: "Metal Roller Ball", capColor: "Black Dotted" }],   // 4b
    ["GBVialClr2mlBlackCap", { capStyle: "Tall" }, { capStyle: "Short" }],                                                    // 4c
];
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt >= 0 ? new Set((process.argv[onlyAt + 1] ?? "").split(",").filter(Boolean)) : null;
if (only && [...only].some(sku => !CORRECTIONS.some(([websiteSku]) => websiteSku === sku))) { console.error("--only names a SKU this script does not correct"); process.exit(1); }
const entries = CORRECTIONS.filter(([websiteSku]) => !only || only.has(websiteSku)).map(([websiteSku, before, after]) => revert
    ? { websiteSku, expect: after, patch: before }
    : { websiteSku, expect: before, patch: after });

const client = new ConvexHttpClient(url);
const result = await client.mutation("catalogCorrections:correctProductFields", {
    writeToken, dryRun: !apply, entries,
    reason: revert ? "revert 2026-10-01 Build Your Bottle checklist batch 2" : "2026-10-01 Build Your Bottle checklist batch 2 (Jordan: 1h, 1i, 2a, 4a, 4b, 4c)",
});
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
for (const w of result.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.join(", ")}`);
if (result.changedSince.length) console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
if (result.notFound.length) console.log(`  not found: ${result.notFound.join(", ")}`);
if (result.changedSince.length || result.notFound.length) process.exitCode = 1;
