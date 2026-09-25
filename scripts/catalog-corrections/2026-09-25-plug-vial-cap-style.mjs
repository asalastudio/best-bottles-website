#!/usr/bin/env node
/**
 * 2026-09-25 — cap-style corrections for the four 1 ml plug vials, approved by Jordan.
 *
 * Their closure is a plug applicator, but the rows carried cap lengths ("Tall") or the bare word
 * "Applicator" as their cap style, so the catalog swatch read "Tall White" and "Applicator Black".
 * With capStyle "Plug" the card names the swatch by its plug: "White Plug", "Black Plug".
 *
 *   node scripts/catalog-corrections/2026-09-25-plug-vial-cap-style.mjs            # dry run, dev
 *   node scripts/catalog-corrections/2026-09-25-plug-vial-cap-style.mjs --apply    # write, dev
 *   node scripts/catalog-corrections/2026-09-25-plug-vial-cap-style.mjs --prod [--apply]
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

// websiteSku, cap style today, cap style after
const CORRECTIONS = [
    ["GB1mlAmbVialWht", "Tall", "Plug"],
    ["GB1mlAmbVBlk", "Applicator", "Plug"],
    ["GB1mlVBlk", "Tall", "Plug"],
    ["GB1mlVWht", "Tall", "Plug"],
];
const entries = CORRECTIONS.map(([websiteSku, before, after]) => revert
    ? { websiteSku, expect: { capStyle: after }, patch: { capStyle: before } }
    : { websiteSku, expect: { capStyle: before }, patch: { capStyle: after } });

const client = new ConvexHttpClient(url);
const result = await client.mutation("catalogCorrections:correctProductFields", {
    writeToken, dryRun: !apply, entries,
    reason: revert ? "revert 2026-09-25 plug vial cap styles" : "2026-09-25 plug vial cap styles (Jordan)",
});
console.log(`${prod ? "PROD" : "dev"} ${apply ? "APPLY" : "dry run"}${revert ? " (revert)" : ""}`);
for (const w of result.written) console.log(`  ${apply ? "wrote" : "would write"} ${w.websiteSku}.${w.field}: ${w.before} → ${w.after}`);
if (result.alreadyCorrect.length) console.log(`  already correct: ${result.alreadyCorrect.join(", ")}`);
if (result.changedSince.length) console.log(`  changed since, left alone: ${result.changedSince.map(c => `${c.websiteSku}.${c.field}=${c.now}`).join(", ")}`);
if (result.notFound.length) console.log(`  not found: ${result.notFound.join(", ")}`);
if (result.changedSince.length || result.notFound.length) process.exitCode = 1;
