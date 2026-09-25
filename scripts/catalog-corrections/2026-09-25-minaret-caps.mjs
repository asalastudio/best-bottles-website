#!/usr/bin/env node
/**
 * 2026-09-25 — the ten Minaret dab-on cap SKUs, approved by Jordan ("fold the Minarets into the cap groups").
 *
 * A Minaret is a decorative dab-on cap, yet eight of the ten rows were filed as fine mist sprayers
 * (Rectangle 10 ml, in a "-finemist" group) or roll-ons (Royal 13, Flair 15, Elegant 15 frosted, in
 * "-rollon" groups), so the catalog named and filtered them as sprays and rollers. The two Elegant 15
 * clear rows already carry the right vocabulary (applicator "Cap/Closure", cap style "Minaret") and
 * one already sits in its family's cap group; that is the pattern applied to all ten.
 *
 * Two steps, both guarded: field corrections (applicator, capStyle) through
 * catalogCorrections:correctProductFields, then products:moveProductToGroup into each family's
 * plain-cap group. The emptied groups (rectangle-10ml-clear-13-415-finemist,
 * elegant-15ml-clear-13-415-capclosure) are hidden while empty and redirected in code.
 *
 *   node scripts/catalog-corrections/2026-09-25-minaret-caps.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-25-minaret-caps.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-25-minaret-caps.mjs --prod [--apply]
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

// websiteSku, applicator today, cap style today, target group (the family's plain-cap group)
const MINARETS = [
    ["GBRect10MinarCu", "Fine Mist Sprayer", "Spray", "footed-rectangle-10ml-clear-13-415"],
    ["GBRect10MinarSl", "Fine Mist Sprayer", "Spray", "footed-rectangle-10ml-clear-13-415"],
    ["GBRoyal13MinarCu", "Plastic Roller Ball", "Dot Cap", "royal-13ml-clear-13-415"],
    ["GBRoyal13MinarSl", "Plastic Roller Ball", "Dot Cap", "royal-13ml-clear-13-415"],
    ["GBFlair15MinarCu", "Plastic Roller Ball", "Dot Cap", "flair-15ml-clear-13-415"],
    ["GBFlair15MinarSl", "Plastic Roller Ball", "Dot Cap", "flair-15ml-clear-13-415"],
    ["GBElgFrst15MinarCu", "Plastic Roller Ball", "Roll-On", "elegant-15ml-frosted-13-415"],
    ["GBElgFrst15MinarSl", "Plastic Roller Ball", "Roll-On", "elegant-15ml-frosted-13-415"],
    ["GBElg15MinarCu", "Cap/Closure", "Minaret", "elegant-15ml-clear-13-415"],
    ["GBElg15MinarSl", "Cap/Closure", "Minaret", "elegant-15ml-clear-13-415"],
];
const TARGET = { applicator: "Cap/Closure", capStyle: "Minaret" };

const client = new ConvexHttpClient(url);
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}`);

const fields = await client.mutation("catalogCorrections:correctProductFields", {
    writeToken, dryRun: !apply, reason: "2026-09-25 Minaret dab-on caps are caps, not sprayers or roll-ons (Jordan)",
    entries: MINARETS.map(([websiteSku, applicator, capStyle]) => ({ websiteSku, expect: { applicator, capStyle }, patch: TARGET })),
});
for (const w of fields.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (fields.alreadyCorrect.length) console.log(`  already correct: ${fields.alreadyCorrect.join(", ")}`);
if (fields.changedSince.length) console.log(`  changed since, left alone: ${fields.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
if (fields.notFound.length) console.log(`  not found: ${fields.notFound.join(", ")}`);
if (fields.changedSince.length || fields.notFound.length) process.exitCode = 1;

for (const [websiteSku, , , groupSlug] of MINARETS) {
    if (!apply) { console.log(`  would move ${websiteSku} → ${groupSlug}`); continue; }
    const result = await client.mutation("products:moveProductToGroup", { writeToken, websiteSku, groupSlug });
    console.log(`  ${result.moved ? "moved" : "NOT moved"} ${websiteSku}: ${result.from ?? "?"} → ${result.to} (${result.detail})`);
    if (!result.moved && !/already/i.test(result.detail)) process.exitCode = 1;
}
