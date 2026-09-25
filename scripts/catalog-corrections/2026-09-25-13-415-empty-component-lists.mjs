#!/usr/bin/env node
/**
 * 2026-09-25 — nine 13-415 glass bottles list NO compatible components (Jordan: every 13-415
 * bottle takes the same 13-415 caps, roll-on caps and fine-mist sprayers; see the 13-415
 * neck-thread matrix, 23 Sep 2026). The product page reads that list, so these nine showed
 * "Bottle only" with no closure choices while their siblings offered the full set.
 *
 * Each bottle copies the list from a sibling of its own family and glass that already carries
 * the standard 13-415 set, and only while its own list is still empty (guarded by
 * `catalogCorrections.correctProductComponents`, logged in catalogChangeLog). Pillar's three
 * bottles copy from the Pillar spray, which received the standard list earlier today
 * (scripts/catalog-corrections/2026-09-25-pillar-spray-neck.mjs).
 *
 *   node scripts/catalog-corrections/2026-09-25-13-415-empty-component-lists.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-25-13-415-empty-component-lists.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-25-13-415-empty-component-lists.mjs --prod [--apply]
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
const url = prod ? PROD_URL : process.env.NEXT_PUBLIC_CONVEX_URL;
const writeToken = process.env.BEST_BOTTLES_CONVEX_WRITE_TOKEN;
if (!url || !writeToken) { console.error("NEXT_PUBLIC_CONVEX_URL and BEST_BOTTLES_CONVEX_WRITE_TOKEN must be set in .env.local"); process.exit(1); }
if (!prod && url === PROD_URL) { console.error(".env.local points at prod; pass --prod explicitly"); process.exit(1); }

/** [bottle with an empty list, sibling to copy from] — same family and glass, already on the standard 13-415 set. */
const COPIES = [
    ["GBPillar9BlkShSht", "GBPillar9SpryBlkMatt"],
    ["GBPillar9RollBlkDot", "GBPillar9SpryBlkMatt"],
    ["GBPillar9MtlRollBlkdot", "GBPillar9SpryBlkMatt"],
    ["GBElg15MinarCu", "GBElg15Gl"],
    ["GBElgFrst15BlkShSht", "GBElgFrst15Gl"],
    ["GBCylBlu5BlkShSht", "GBCylBlu5SlMattSht"],
    ["GBCyl5WhtSht", "GBCyl5GlMattSht"],
    ["GBTallCyl9WhtSht", "GBTallCyl9GlMattSht"],
    ["GBTulip6BlkShSht", "GBTulip6Gl"],
];
const reason = "2026-09-25 13-415 bottles with no component list take the standard 13-415 set (Jordan, neck-thread matrix)";

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}`);
let problems = 0;
for (const [websiteSku, copyFromWebsiteSku] of COPIES) {
    const r = await client.mutation("catalogCorrections:correctProductComponents", { writeToken, dryRun: !apply, reason, websiteSku, copyFromWebsiteSku, expectComponentSkus: [] });
    console.log(`  ${websiteSku.padEnd(24)} ${r.outcome.padEnd(16)} ${r.before.length} → ${r.after.length} (from ${copyFromWebsiteSku})`);
    if (r.outcome === "changed-since" || r.outcome === "not-found") { problems++; if (r.before.length) console.log(`    now lists: ${r.before.join(", ")}`); }
}
if (problems) process.exitCode = 1;
