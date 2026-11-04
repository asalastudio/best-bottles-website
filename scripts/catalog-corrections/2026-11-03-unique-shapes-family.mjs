#!/usr/bin/env node
/**
 * 2026-11-03 — Royal, Rectangle, Square, Flair and Bell merge into one family, Unique Shapes (Jordan: "merge those
 * all into one family ... you could just call them unique shapes"). They are all small 13-415 shapes (10–15 ml, plus the 9 ml ground-glass
 * Rectangle applicator): 155 live bottles and 18 groups. family and bottleCollection both become "Unique Shapes" (Bell
 * carried "Bell", "Bell Collection" and null). The two retired Bell records (GBBell10[Mtl]RollBlkDot__RETIRED__...)
 * belong to no group and are left alone. Group slugs stay, so no page address changes. Every write is guarded by the
 * value it replaces (read from production on 3 Nov 2026) and logged in catalogChangeLog; --revert restores each
 * record's own previous values.
 *
 * STATUS: applied to production on 3 Nov 2026, then reverted the same day (--revert --apply). Jordan chose to keep each
 * family's name and group them in the Bottle family filter instead (FAMILY_GROUPS in src/lib/catalogFilters.ts, with
 * Tulip). Kept as the record of both writes in catalogChangeLog; do not re-apply without asking.
 *
 *   node scripts/catalog-corrections/2026-11-03-unique-shapes-family.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-11-03-unique-shapes-family.mjs --prod [--apply]
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

const TO = "Unique Shapes";
// [websiteSku, family before, bottleCollection before]
const BOTTLES = [
    ["GBBell10BlkShSht", "Bell", "Bell Collection"],
    ["GBBell10MtlRollBlkDot", "Bell", "Bell Collection"],
    ["GBBell10RollBlkDot", "Bell", "Bell Collection"],
    ["GBBell10SpryBlkSh", "Bell", "Bell"],
    ["GBFlair15BlkShSht", "Flair", "Flair"],
    ["GBFlair15BlkSht", "Flair", "Flair"],
    ["GBFlair15CuSht", "Flair", "Flair"],
    ["GBFlair15Gl", "Flair", "Flair"],
    ["GBFlair15GlMattSht", "Flair", "Flair"],
    ["GBFlair15GlSht", "Flair", "Flair"],
    ["GBFlair15MinarCu", "Flair", "Flair"],
    ["GBFlair15MinarSl", "Flair", "Flair"],
    ["GBFlair15MtlRollBlkDot", "Flair", "Flair"],
    ["GBFlair15MtlRollBlkSh", "Flair", "Flair"],
    ["GBFlair15MtlRollCuMatt", "Flair", "Flair"],
    ["GBFlair15MtlRollGlMatt", "Flair", "Flair"],
    ["GBFlair15MtlRollGlSh", "Flair", "Flair"],
    ["GBFlair15MtlRollPinkDot", "Flair", "Flair"],
    ["GBFlair15MtlRollSlDot", "Flair", "Flair"],
    ["GBFlair15MtlRollSlMatt", "Flair", "Flair"],
    ["GBFlair15MtlRollSlSh", "Flair", "Flair"],
    ["GBFlair15RollBlkDot", "Flair", "Flair"],
    ["GBFlair15RollBlkSh", "Flair", "Flair"],
    ["GBFlair15RollCuMatt", "Flair", "Flair"],
    ["GBFlair15RollGlMatt", "Flair", "Flair"],
    ["GBFlair15RollGlSh", "Flair", "Flair"],
    ["GBFlair15RollPinkDot", "Flair", "Flair"],
    ["GBFlair15RollSlDot", "Flair", "Flair"],
    ["GBFlair15RollSlMatt", "Flair", "Flair"],
    ["GBFlair15RollSlSh", "Flair", "Flair"],
    ["GBFlair15Sl", "Flair", "Flair"],
    ["GBFlair15SlMattSht", "Flair", "Flair"],
    ["GBFlair15SlSht", "Flair", "Flair"],
    ["GBFlair15SpryBlkMatt", "Flair", "Flair"],
    ["GBFlair15SpryBlkSh", "Flair", "Flair"],
    ["GBFlair15SpryBluMatt", "Flair", "Flair"],
    ["GBFlair15SpryCuMatt", "Flair", "Flair"],
    ["GBFlair15SpryGlMatt", "Flair", "Flair"],
    ["GBFlair15SpryGlSh", "Flair", "Flair"],
    ["GBFlair15SprySlMatt", "Flair", "Flair"],
    ["GBFlair15SprySlSh", "Flair", "Flair"],
    ["GBFlair15WhtSht", "Flair", "Flair"],
    ["GBMtlCylGl", "Royal", "Royal"],
    ["GBRect10BlkShSht", "Rectangle", "Rectangle"],
    ["GBRect10BlkSht", "Rectangle", "Rectangle"],
    ["GBRect10CuSht", "Rectangle", "Rectangle"],
    ["GBRect10Gl", "Rectangle", "Rectangle"],
    ["GBRect10GlMattSht", "Rectangle", "Rectangle"],
    ["GBRect10GlSht", "Rectangle", "Rectangle"],
    ["GBRect10MinarCu", "Rectangle", "Rectangle"],
    ["GBRect10MinarSl", "Rectangle", "Rectangle"],
    ["GBRect10MtlRollBlkDot", "Rectangle", "Rectangle"],
    ["GBRect10MtlRollBlkSh", "Rectangle", "Rectangle"],
    ["GBRect10MtlRollCuMatt", "Rectangle", "Rectangle"],
    ["GBRect10MtlRollGlMatt", "Rectangle", "Rectangle"],
    ["GBRect10MtlRollGlSh", "Rectangle", "Rectangle"],
    ["GBRect10MtlRollPinkDot", "Rectangle", "Rectangle"],
    ["GBRect10MtlRollSlDot", "Rectangle", "Rectangle"],
    ["GBRect10MtlRollSlMatt", "Rectangle", "Rectangle"],
    ["GBRect10MtlRollSlSh", "Rectangle", "Rectangle"],
    ["GBRect10RollBlkDot", "Rectangle", "Rectangle"],
    ["GBRect10RollBlkSh", "Rectangle", "Rectangle"],
    ["GBRect10RollCuMatt", "Rectangle", "Rectangle"],
    ["GBRect10RollGlMatt", "Rectangle", "Rectangle"],
    ["GBRect10RollGlSh", "Rectangle", "Rectangle"],
    ["GBRect10RollPinkDot", "Rectangle", "Rectangle"],
    ["GBRect10RollSlDot", "Rectangle", "Rectangle"],
    ["GBRect10RollSlMatt", "Rectangle", "Rectangle"],
    ["GBRect10RollSlSh", "Rectangle", "Rectangle"],
    ["GBRect10Sl", "Rectangle", "Rectangle"],
    ["GBRect10SlMattSht", "Rectangle", "Rectangle"],
    ["GBRect10SlSht", "Rectangle", "Rectangle"],
    ["GBRect10SpryBlkMatt", "Rectangle", "Rectangle"],
    ["GBRect10SpryBlkSh", "Rectangle", "Rectangle"],
    ["GBRect10SpryBluMatt", "Rectangle", "Rectangle"],
    ["GBRect10SpryCuMatt", "Rectangle", "Rectangle"],
    ["GBRect10SpryGlMatt", "Rectangle", "Rectangle"],
    ["GBRect10SpryGlSh", "Rectangle", "Rectangle"],
    ["GBRect10SprySlMatt", "Rectangle", "Rectangle"],
    ["GBRect10SprySlSh", "Rectangle", "Rectangle"],
    ["GBRect10WhtSht", "Rectangle", "Rectangle"],
    ["GBRoyal13BlkShSht", "Royal", "Royal"],
    ["GBRoyal13BlkSht", "Royal", "Royal"],
    ["GBRoyal13CuSht", "Royal", "Royal"],
    ["GBRoyal13Gl", "Royal", "Royal"],
    ["GBRoyal13GlMattSht", "Royal", "Royal"],
    ["GBRoyal13GlSht", "Royal", "Royal"],
    ["GBRoyal13MinarCu", "Royal", "Royal"],
    ["GBRoyal13MinarSl", "Royal", "Royal"],
    ["GBRoyal13MtlRollBlkDot", "Royal", "Royal"],
    ["GBRoyal13MtlRollBlkSh", "Royal", "Royal"],
    ["GBRoyal13MtlRollCuMatt", "Royal", "Royal"],
    ["GBRoyal13MtlRollGlMatt", "Royal", "Royal"],
    ["GBRoyal13MtlRollGlSh", "Royal", "Royal"],
    ["GBRoyal13MtlRollPinkDot", "Royal", "Royal"],
    ["GBRoyal13MtlRollSlDot", "Royal", "Royal"],
    ["GBRoyal13MtlRollSlMatt", "Royal", "Royal"],
    ["GBRoyal13MtlRollSlSh", "Royal", "Royal"],
    ["GBRoyal13RollBlkDot", "Royal", "Royal"],
    ["GBRoyal13RollBlkSh", "Royal", "Royal"],
    ["GBRoyal13RollCuMatt", "Royal", "Royal"],
    ["GBRoyal13RollGlMatt", "Royal", "Royal"],
    ["GBRoyal13RollGlSh", "Royal", "Royal"],
    ["GBRoyal13RollPinkDot", "Royal", "Royal"],
    ["GBRoyal13RollSlDot", "Royal", "Royal"],
    ["GBRoyal13RollSlMatt", "Royal", "Royal"],
    ["GBRoyal13RollSlSh", "Royal", "Royal"],
    ["GBRoyal13Sl", "Royal", "Royal"],
    ["GBRoyal13SlMattSht", "Royal", "Royal"],
    ["GBRoyal13SlSht", "Royal", "Royal"],
    ["GBRoyal13SpryBlkSh", "Royal", "Royal"],
    ["GBRoyal13SpryBluMatt", "Royal", "Royal"],
    ["GBRoyal13SpryCuMatt", "Royal", "Royal"],
    ["GBRoyal13SpryGlMatt", "Royal", "Royal"],
    ["GBRoyal13SpryGlSh", "Royal", "Royal"],
    ["GBRoyal13SprySlMatt", "Royal", "Royal"],
    ["GBRoyal13SprySlSh", "Royal", "Royal"],
    ["GBRoyal13WhtSht", "Royal", "Royal"],
    ["GBSQSTBlue", "Rectangle", "Rectangle"],
    ["GBSQSTClear", "Rectangle", "Rectangle"],
    ["GBSQSTGREEN", "Rectangle", "Rectangle"],
    ["GBSqr15BlkShSht", "Square", "Square"],
    ["GBSqr15BlkSht", "Square", "Square"],
    ["GBSqr15CuSht", "Square", "Square"],
    ["GBSqr15Gl", "Square", "Square"],
    ["GBSqr15GlMattSht", "Square", "Square"],
    ["GBSqr15GlSht", "Square", "Square"],
    ["GBSqr15MtlRollBlkDot", "Square", "Square"],
    ["GBSqr15MtlRollBlkSh", "Square", "Square"],
    ["GBSqr15MtlRollCuMatt", "Square", "Square"],
    ["GBSqr15MtlRollGlMatt", "Square", "Square"],
    ["GBSqr15MtlRollGlSh", "Square", "Square"],
    ["GBSqr15MtlRollPinkDot", "Square", "Square"],
    ["GBSqr15MtlRollSlDot", "Square", "Square"],
    ["GBSqr15MtlRollSlMatt", "Square", "Square"],
    ["GBSqr15MtlRollSlSh", "Square", "Square"],
    ["GBSqr15RollBlkDot", "Square", "Square"],
    ["GBSqr15RollBlkSh", "Square", "Square"],
    ["GBSqr15RollCuMatt", "Square", "Square"],
    ["GBSqr15RollGlMatt", "Square", "Square"],
    ["GBSqr15RollGlSh", "Square", "Square"],
    ["GBSqr15RollPinkDot", "Square", "Square"],
    ["GBSqr15RollSlDot", "Square", "Square"],
    ["GBSqr15RollSlMatt", "Square", "Square"],
    ["GBSqr15RollSlSh", "Square", "Square"],
    ["GBSqr15Sl", "Square", "Square"],
    ["GBSqr15SlMattSht", "Square", "Square"],
    ["GBSqr15SpryBlkSh", "Square", "Square"],
    ["GBSqr15SpryBluMatt", "Square", "Square"],
    ["GBSqr15SpryCuMatt", "Square", "Square"],
    ["GBSqr15SpryGlMatt", "Square", "Square"],
    ["GBSqr15SpryGlSh", "Square", "Square"],
    ["GBSqr15SprySlMatt", "Square", "Square"],
    ["GBSqr15SprySlSh", "Square", "Square"],
    ["GBSqr15WhtSht", "Square", "Square"],
].map(r => [...r, TO]);
// [slug, family before, bottleCollection before]
const GROUPS = [
    ["bell-10ml-clear-13-415-capclosure", "Bell", "Bell Collection"],
    ["bell-10ml-clear-13-415-finemist", "Bell", "Bell"],
    ["bell-10ml-clear-13-415-rollon", "Bell", "Bell Collection"],
    ["flair-15ml-clear-13-415", "Flair", "Flair"],
    ["flair-15ml-clear-13-415-finemist", "Flair", "Flair"],
    ["flair-15ml-clear-13-415-rollon", "Flair", "Flair"],
    ["footed-rectangle-10ml-clear-13-415", "Rectangle", "Rectangle"],
    ["footed-rectangle-10ml-clear-13-415-finemist", "Rectangle", "Rectangle"],
    ["footed-rectangle-10ml-clear-13-415-rollon", "Rectangle", "Rectangle"],
    ["rectangle-10ml-clear-13-415-finemist", "Rectangle", "Rectangle"],
    ["rectangle-9ml-clear-Ground-glassapplicator", "Rectangle", "Rectangle"],
    ["royal-13ml-clear-13-415", "Royal", "Royal"],
    ["royal-13ml-clear-13-415-finemist", "Royal", "Royal"],
    ["royal-13ml-clear-13-415-rollon", "Royal", "Royal"],
    ["royal-14ml-clear-11mm", "Royal", "Royal"],
    ["square-15ml-clear-13-415", "Square", "Square"],
    ["square-15ml-clear-13-415-finemist", "Square", "Square"],
    ["square-15ml-clear-13-415-rollon", "Square", "Square"],
].map(r => [...r, TO]);
const pair = (family, collection, to) => {
    const before = { family, bottleCollection: collection }, after = { family: to, bottleCollection: to };
    return revert ? [after, before] : [before, after];
};
const reason = revert ? "revert 2026-11-03 Unique Shapes family merge"
    : "2026-11-03 Royal, Rectangle, Square, Flair and Bell merge into Unique Shapes (Jordan)";

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
let problems = 0;
// The mutation takes at most 50 entries a call.
const products = { written: [], alreadyCorrect: [], changedSince: [], notFound: [] };
for (let i = 0; i < BOTTLES.length; i += 50) {
    const r = await client.mutation("catalogCorrections:correctProductFields", { writeToken, dryRun: !apply, reason,
        entries: BOTTLES.slice(i, i + 50).map(([websiteSku, f, c, to]) => { const [expect, patch] = pair(f, c, to); return { websiteSku, expect, patch }; }) });
    for (const k of Object.keys(products)) products[k].push(...r[k]);
}
const groups = await client.mutation("catalogCorrections:correctGroupFields", { writeToken, dryRun: !apply, reason,
    entries: GROUPS.map(([slug, f, c, to]) => { const [expect, patch] = pair(f, c, to); return { slug, expect, patch }; }) });
for (const [kind, result, key] of [["bottle", products, "websiteSku"], ["group", groups, "slug"]]) {
    console.log(`  ${kind}s: ${result.written.length} field writes ${apply ? "made" : "to make"}`);
    for (const w of result.written.slice(0, 6)) console.log(`    e.g. ${w[key]}.${w.field}: ${w.before} → ${w.after}`);
    if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.length}`);
    if (result.changedSince.length) { problems++; console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c[key]}.${c.field}=${c.now}`).join(", ")}`); }
    if (result.notFound.length) { problems++; console.log(`  not found: ${result.notFound.join(", ")}`); }
}
if (problems) process.exitCode = 1;
